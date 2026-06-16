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

export interface DensityProtectOptions {
  /**
   * Max pen passes allowed to overlap one coverage cell. Once a cell has been
   * inked this many times, a stroke running *along* it (a sustained overlap
   * run) has that run trimmed out. A little overlap is welcome (texture); this
   * caps the pile-up that inflates plot time and breaks down the paper.
   */
  maxPasses: number;
  /** Coverage cell size in px — derive from the pen width so a "pass" ≈ one nib. */
  cellPx: number;
  /**
   * Minimum length (px) of a sustained overlap run before it's trimmed. This is
   * the crossing/coalescence distinction: streamlines that merely *cross* a
   * previous line share a cell or two — well under this — and are left whole;
   * lines that *coalesce* and run along a previous path for longer than this get
   * the shared run cut out. Defaults to `cellPx * 8`.
   */
  minOverlapPx?: number;
  /**
   * Kept fragments shorter than this (px) are discarded rather than plotted as
   * dust after a trim. Defaults to `cellPx * 3`.
   */
  minKeepPx?: number;
  /**
   * Layers left untouched and not counted toward density (e.g. 'texture',
   * 'border' — they're a different pen / deliberate, not drawing pile-up).
   */
  skipLayers?: string[];
}

export interface DensityProtectResult {
  result: FlowLinesResult;
  /** Strokes removed because they piled onto already-saturated paper. */
  removed: FlowLine[];
  /** Total drawn length of the removed strokes, in px (≈ pen-down time saved). */
  removedTravel: number;
}

/** Per-layer pass-count grid; overlap is only counted within one pen layer. */
class CoverageGrid {
  private counts = new Map<number, number>();
  private cols: number;

  constructor(
    private cellPx: number,
    width: number,
    height: number
  ) {
    this.cols = Math.max(1, Math.ceil(width / cellPx));
    void height;
  }

  index(x: number, y: number): number {
    const c = Math.max(0, Math.floor(x / this.cellPx));
    const r = Math.max(0, Math.floor(y / this.cellPx));
    return r * this.cols + c;
  }

  countAt(cell: number): number {
    return this.counts.get(cell) ?? 0;
  }

  add(cell: number): void {
    this.counts.set(cell, (this.counts.get(cell) ?? 0) + 1);
  }
}

/** Resample a polyline to ~`step`-spaced points (endpoints kept). */
function densify(points: Point[], step: number): Point[] {
  if (points.length === 0) return [];
  const out: Point[] = [{ x: points[0].x, y: points[0].y }];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(segLen / step));
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

function lineLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

/**
 * Pen-plotting density protection. Strokes are processed in order, each building
 * up a per-layer coverage grid. The metric is *local sustained overlap*, not
 * total path overlap: a stroke is sampled along its length, and a maximal run of
 * samples sitting on cells that have already taken `maxPasses` passes is trimmed
 * out only when that run is longer than `minOverlapPx`. This draws the
 * crossing/coalescence distinction that matters for flow diagrams — streamlines
 * that merely *cross* an existing line share a cell or two (a short run, kept
 * whole), while lines that *coalesce* and run along a shared path get the
 * duplicated run cut out, keeping each line's unique upstream portion. The first
 * `maxPasses` coincident passes still build the intended texture. Deterministic
 * for a given input order. Skipped layers (texture/border) pass through
 * untouched.
 */
export function limitStrokeDensity(
  result: FlowLinesResult,
  options: DensityProtectOptions
): DensityProtectResult {
  const cellPx = Math.max(0.5, options.cellPx);
  const maxPasses = Math.max(1, Math.floor(options.maxPasses));
  const minOverlapPx = options.minOverlapPx ?? cellPx * 8;
  const minKeepPx = options.minKeepPx ?? cellPx * 3;
  const skip = new Set(options.skipLayers ?? []);
  const step = cellPx * 0.5;

  // One coverage grid per pen layer — overlap between different pens (drawn in
  // separate passes) isn't the pile-up we're guarding against.
  const grids = new Map<string, CoverageGrid>();
  const gridFor = (key: string): CoverageGrid => {
    let g = grids.get(key);
    if (!g) {
      g = new CoverageGrid(cellPx, result.width, result.height);
      grids.set(key, g);
    }
    return g;
  };

  const kept: FlowLine[] = [];
  const removed: FlowLine[] = [];
  let removedTravel = 0;

  // Record a drawn polyline's footprint so later strokes see the ink.
  const stamp = (grid: CoverageGrid, points: Point[]): void => {
    const cells = new Set<number>();
    for (let i = 0; i < points.length; i++) {
      if (i === 0) {
        cells.add(grid.index(points[0].x, points[0].y));
        continue;
      }
      const a = points[i - 1];
      const b = points[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
      for (let s = 1; s <= n; s++) {
        const t = s / n;
        cells.add(grid.index(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
      }
    }
    for (const cell of cells) grid.add(cell);
  };

  for (const line of result.lines) {
    const layerKey = line.layer ?? line.pen ?? 'default';
    if (line.points.length < 2 || skip.has(layerKey)) {
      kept.push(line);
      continue;
    }

    const grid = gridFor(layerKey);
    const samples = densify(line.points, step);

    // Flag each sample sitting on an already-saturated cell.
    const onSaturated = samples.map((p) => grid.countAt(grid.index(p.x, p.y)) >= maxPasses);

    // A saturated *run* is only cut when it's a sustained overlap (longer than
    // minOverlapPx). Short runs are crossings/touches — left intact.
    const cut = onSaturated.slice();
    let i = 0;
    while (i < samples.length) {
      if (!onSaturated[i]) {
        i++;
        continue;
      }
      let j = i;
      let runLen = 0;
      while (j + 1 < samples.length && onSaturated[j + 1]) {
        runLen += Math.hypot(samples[j + 1].x - samples[j].x, samples[j + 1].y - samples[j].y);
        j++;
      }
      if (runLen < minOverlapPx) {
        for (let k = i; k <= j; k++) cut[k] = false; // crossing — keep
      }
      i = j + 1;
    }

    // No sustained overlap — keep the original stroke untouched (exact geometry,
    // no resampling bloat), and record its footprint.
    if (!cut.some(Boolean)) {
      stamp(grid, line.points);
      kept.push(line);
      continue;
    }

    // Split into kept (fresh) and trimmed (overlapping) runs.
    const keptSegs: Point[][] = [];
    const dropSegs: Point[][] = [];
    let curKeep: Point[] = [];
    let curDrop: Point[] = [];
    for (let k = 0; k < samples.length; k++) {
      if (cut[k]) {
        if (curKeep.length) {
          keptSegs.push(curKeep);
          curKeep = [];
        }
        curDrop.push(samples[k]);
      } else {
        if (curDrop.length) {
          dropSegs.push(curDrop);
          curDrop = [];
        }
        curKeep.push(samples[k]);
      }
    }
    if (curKeep.length) keptSegs.push(curKeep);
    if (curDrop.length) dropSegs.push(curDrop);

    for (const seg of keptSegs) {
      // Drop dust left by trimming; only plot fragments worth a pen-down.
      if (seg.length >= 2 && lineLength(seg) >= minKeepPx) {
        stamp(grid, seg);
        kept.push({ ...line, points: seg });
      }
    }
    for (const seg of dropSegs) {
      if (seg.length >= 2) {
        removed.push({ ...line, points: seg });
        removedTravel += lineLength(seg);
      }
    }
  }

  return { result: { ...result, lines: kept }, removed, removedTravel };
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

  // Chains only grow within the same pen AND layer, so per-pen export layers
  // never bleed into one another.
  const findNext = (
    p: Point,
    pen: FlowLine['pen'],
    layer: FlowLine['layer']
  ): EndpointRef | null => {
    let best: EndpointRef | null = null;
    let bestDist = tolerance;
    grid.nearby(p, tolerance, (ref) => {
      if (used[ref.lineIndex]) return;
      if ((lines[ref.lineIndex].pen ?? 'fine') !== (pen ?? 'fine')) return;
      if (lines[ref.lineIndex].layer !== layer) return;
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
    const layer = lines[i].layer;

    // Grow forward from the chain's tail
    for (;;) {
      const next = findNext(chain[chain.length - 1], pen, layer);
      if (!next) break;
      used[next.lineIndex] = true;
      const pts = lines[next.lineIndex].points;
      chain = chain.concat(next.isStart ? pts : [...pts].reverse());
    }

    // Grow backward from the chain's head
    for (;;) {
      const next = findNext(chain[0], pen, layer);
      if (!next) break;
      used[next.lineIndex] = true;
      const pts = lines[next.lineIndex].points;
      chain = (next.isStart ? [...pts].reverse() : pts).concat(chain);
    }

    merged.push(withMeta(chain, lines[i]));
  }

  return merged;
}

/** Carry a line's pen/layer tags onto a rebuilt copy with new points */
function withMeta(points: Point[], src: FlowLine): FlowLine {
  const out: FlowLine = { points };
  if (src.pen) out.pen = src.pen;
  if (src.layer !== undefined) out.layer = src.layer;
  return out;
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
    ordered.push(withMeta(points, line));
    position = points[points.length - 1];
  }

  return ordered;
}
