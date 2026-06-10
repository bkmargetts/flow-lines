import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';

export interface OptimizePlotOptions {
  /**
   * Endpoints closer than this (px) are chained into one continuous
   * stroke — the pen draws a tiny invisible bridge instead of lifting.
   * 0 disables merging (default 1.5)
   */
  mergeTolerance?: number;
  /** Reorder strokes to minimize pen-up travel (default true) */
  sort?: boolean;
}

/**
 * Total pen-up travel: the distance the pen moves between the end of one
 * stroke and the start of the next, in drawing order
 */
export function measurePenTravel(result: FlowLinesResult): number {
  let travel = 0;
  for (let i = 1; i < result.lines.length; i++) {
    const prev = result.lines[i - 1].points;
    const next = result.lines[i].points;
    if (prev.length === 0 || next.length === 0) continue;
    const a = prev[prev.length - 1];
    const b = next[0];
    travel += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return travel;
}

/**
 * Make the result cheap to plot: chain strokes whose endpoints nearly
 * touch into continuous paths (fewer pen lifts — linked hatching also
 * reads as more "drawn"), then greedily order strokes nearest-first to
 * minimize pen-up travel. Strokes only merge within the same pen layer.
 */
export function optimizePlot(
  result: FlowLinesResult,
  options: OptimizePlotOptions = {}
): FlowLinesResult {
  const mergeTolerance = options.mergeTolerance ?? 1.5;
  const sort = options.sort ?? true;

  let lines = result.lines.filter((line) => line.points.length > 0);

  if (mergeTolerance > 0) {
    lines = mergeLines(lines, mergeTolerance);
  }
  if (sort) {
    lines = sortLines(lines, result.width, result.height);
  }

  return { ...result, lines };
}

interface EndpointRef {
  lineIndex: number;
  /** true = the line's start point, false = its end point */
  isStart: boolean;
}

/** Spatial hash over stroke endpoints */
class EndpointGrid {
  private cells = new Map<number, EndpointRef[]>();
  private cols: number;
  private rows: number;

  constructor(
    private cellSize: number,
    width: number,
    height: number
  ) {
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
  }

  private key(p: Point): number {
    const c = Math.max(0, Math.min(this.cols - 1, Math.floor(p.x / this.cellSize)));
    const r = Math.max(0, Math.min(this.rows - 1, Math.floor(p.y / this.cellSize)));
    return r * this.cols + c;
  }

  insert(p: Point, ref: EndpointRef): void {
    const k = this.key(p);
    const cell = this.cells.get(k);
    if (cell) cell.push(ref);
    else this.cells.set(k, [ref]);
  }

  /** Visit refs in cells within `radius` of p (caller filters precisely) */
  nearby(p: Point, radius: number, visit: (ref: EndpointRef) => void): void {
    const r = Math.ceil(radius / this.cellSize);
    const c0 = Math.max(0, Math.floor(p.x / this.cellSize) - r);
    const c1 = Math.min(this.cols - 1, Math.floor(p.x / this.cellSize) + r);
    const r0 = Math.max(0, Math.floor(p.y / this.cellSize) - r);
    const r1 = Math.min(this.rows - 1, Math.floor(p.y / this.cellSize) + r);

    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const cell = this.cells.get(row * this.cols + col);
        if (!cell) continue;
        for (const ref of cell) visit(ref);
      }
    }
  }
}

function endpoint(line: FlowLine, isStart: boolean): Point {
  return isStart ? line.points[0] : line.points[line.points.length - 1];
}

/**
 * Greedily chain lines whose endpoints are within tolerance. Each line is
 * consumed at most once; chains only grow within the same pen class.
 */
function mergeLines(lines: FlowLine[], tolerance: number): FlowLine[] {
  let maxX = 1;
  let maxY = 1;
  for (const line of lines) {
    for (const p of line.points) {
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  const grid = new EndpointGrid(Math.max(tolerance * 2, 4), maxX + 1, maxY + 1);
  for (let i = 0; i < lines.length; i++) {
    grid.insert(endpoint(lines[i], true), { lineIndex: i, isStart: true });
    grid.insert(endpoint(lines[i], false), { lineIndex: i, isStart: false });
  }

  const used = new Array<boolean>(lines.length).fill(false);
  const merged: FlowLine[] = [];

  const findNext = (p: Point, pen: FlowLine['pen']): EndpointRef | null => {
    let best: EndpointRef | null = null;
    let bestDist = tolerance;
    grid.nearby(p, tolerance, (ref) => {
      if (used[ref.lineIndex]) return;
      if ((lines[ref.lineIndex].pen ?? 'fine') !== (pen ?? 'fine')) return;
      const q = endpoint(lines[ref.lineIndex], ref.isStart);
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d <= bestDist) {
        bestDist = d;
        best = ref;
      }
    });
    return best;
  };

  for (let i = 0; i < lines.length; i++) {
    if (used[i]) continue;
    used[i] = true;

    let chain = [...lines[i].points];
    const pen = lines[i].pen;

    // Grow forward from the chain's tail
    for (;;) {
      const next = findNext(chain[chain.length - 1], pen);
      if (!next) break;
      used[next.lineIndex] = true;
      const pts = lines[next.lineIndex].points;
      chain = chain.concat(next.isStart ? pts : [...pts].reverse());
    }

    // Grow backward from the chain's head
    for (;;) {
      const next = findNext(chain[0], pen);
      if (!next) break;
      used[next.lineIndex] = true;
      const pts = lines[next.lineIndex].points;
      chain = (next.isStart ? [...pts].reverse() : pts).concat(chain);
    }

    merged.push(pen ? { points: chain, pen } : { points: chain });
  }

  return merged;
}

/**
 * Greedy nearest-neighbour ordering: from the current pen position, draw
 * the stroke whose nearest endpoint is closest (reversing it if its end
 * is nearer than its start). Grid-accelerated with expanding search.
 */
function sortLines(lines: FlowLine[], width: number, height: number): FlowLine[] {
  if (lines.length < 3) return lines;

  const cellSize = Math.max(4, Math.min(width, height) / 64);
  const grid = new EndpointGrid(cellSize, width, height);
  for (let i = 0; i < lines.length; i++) {
    grid.insert(endpoint(lines[i], true), { lineIndex: i, isStart: true });
    grid.insert(endpoint(lines[i], false), { lineIndex: i, isStart: false });
  }

  const used = new Array<boolean>(lines.length).fill(false);
  const ordered: FlowLine[] = [];
  let position: Point = { x: 0, y: 0 };
  const maxRadius = Math.hypot(width, height);

  for (let n = 0; n < lines.length; n++) {
    let best: EndpointRef | null = null;
    let bestDist = Infinity;

    // Expanding ring search around the current pen position
    for (let radius = cellSize * 2; ; radius *= 2) {
      grid.nearby(position, radius, (ref) => {
        if (used[ref.lineIndex]) return;
        const q = endpoint(lines[ref.lineIndex], ref.isStart);
        const d = Math.hypot(q.x - position.x, q.y - position.y);
        if (d < bestDist) {
          bestDist = d;
          best = ref;
        }
      });

      // The found candidate is only guaranteed nearest once the search
      // radius exceeds its distance
      if (best && bestDist <= radius) break;
      if (radius > maxRadius) break;
    }

    if (!best) break;
    const ref: EndpointRef = best;

    used[ref.lineIndex] = true;
    const line = lines[ref.lineIndex];
    const points = ref.isStart ? line.points : [...line.points].reverse();
    ordered.push(line.pen ? { points, pen: line.pen } : { points });
    position = points[points.length - 1];
  }

  return ordered;
}
