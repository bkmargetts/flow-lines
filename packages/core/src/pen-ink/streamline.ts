import { FlowLine, Point } from '../flow-lines.js';
import { ImageField } from '../image-field.js';
import { D_TEST, D_SEED } from './options.js';

export interface PassConfig {
  angleOffset: number;
  isDrawable: (x: number, y: number) => boolean;
  spacingAt: (x: number, y: number) => number;
  stepLength: number;
  maxSteps: number;
  margin: number;
  minLineLength: number;
  seedSpacing: number;
  /** Resolve per-stroke style (direction, length budget) at the seed */
  paramsFor: (x: number, y: number, random: () => number) => StrokeParams;
}

/** Per-stroke parameters resolved at the seed */
export interface StrokeParams {
  angleOffset: number;
  maxArcLength: number;
  /** Place a stipple dot instead of tracing a stroke */
  dot?: boolean;
  /**
   * Spacing to the next dot, px. Stipple density carries the tone by
   * itself, so it needs a far tighter curve than hatch line spacing
   */
  dotSpacing?: number;
  /** Trace at this constant absolute direction instead of following the field */
  fixedAngle?: number;
  /** Extra per-step termination test (e.g. the stroke left its facet) */
  stopAt?: (x: number, y: number) => boolean;
  /** Random heading drift per integration step, radians (scribble) */
  headingJitter?: number;
  /** Per-stroke random source for heading drift */
  rand?: () => number;
}

/**
 * Trace one evenly-spaced streamline pass (Jobard-Lefer style): seeds spawn
 * beside accepted strokes at the local spacing distance, falling back to a
 * darkest-first grid scan so all regions get covered.
 */
export function tracePass(field: ImageField, seed: number, pass: PassConfig): FlowLine[] {
  const lines: FlowLine[] = [];
  const grid = new SpatialGrid(field.width, field.height, Math.max(2, pass.seedSpacing / 2));

  // Simple seeded random for scan jitter
  let s = (seed & 0x7fffffff) || 1;
  const random = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  // Grid-scan candidates, darkest first so coverage starts in the shadows
  const scanCandidates: { x: number; y: number; d: number }[] = [];
  for (let y = pass.margin; y < field.height - pass.margin; y += pass.seedSpacing) {
    for (let x = pass.margin; x < field.width - pass.margin; x += pass.seedSpacing) {
      const jx = x + (random() - 0.5) * pass.seedSpacing;
      const jy = y + (random() - 0.5) * pass.seedSpacing;
      if (!field.isInBounds(jx, jy, pass.margin)) continue;
      if (!pass.isDrawable(jx, jy)) continue;
      scanCandidates.push({ x: jx, y: jy, d: field.getDarkness(jx, jy) });
    }
  }
  scanCandidates.sort((a, b) => b.d - a.d);

  const candidateStack: Point[] = [];
  let scanIndex = 0;

  for (;;) {
    let candidate: Point | undefined = candidateStack.pop();
    if (!candidate) {
      if (scanIndex >= scanCandidates.length) break;
      candidate = scanCandidates[scanIndex++];
    }

    const params = pass.paramsFor(candidate.x, candidate.y, random);

    if (params.dot) {
      const dot = placeDot(field, grid, candidate, pass, params, random);
      if (dot) {
        lines.push(dot);
        // Spawn neighbours so stippling propagates at the local spacing
        const spacing = params.dotSpacing ?? pass.spacingAt(candidate.x, candidate.y);
        const baseAngle = random() * Math.PI * 2;
        for (let k = 0; k < 4; k++) {
          const a = baseAngle + (k * Math.PI) / 2 + (random() - 0.5) * 0.6;
          candidateStack.push({
            x: candidate.x + Math.cos(a) * spacing * 1.05,
            y: candidate.y + Math.sin(a) * spacing * 1.05,
          });
        }
      }
      continue;
    }

    const line = traceStreamline(field, grid, candidate, pass, params);
    if (!line) continue;

    lines.push(line);

    // Register stroke points and spawn neighbour seeds on both sides
    const spawnEvery = Math.max(1, Math.round(pass.seedSpacing / pass.stepLength));
    for (let i = 0; i < line.points.length; i++) {
      const p = line.points[i];
      grid.insert(p);

      if (i % spawnEvery === 0 && i > 0 && i < line.points.length - 1) {
        const prev = line.points[i - 1];
        const next = line.points[i + 1];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.hypot(dx, dy);
        if (len < 1e-9) continue;

        const offset = pass.spacingAt(p.x, p.y) * 1.05;
        const nx = (-dy / len) * offset;
        const ny = (dx / len) * offset;
        candidateStack.push({ x: p.x + nx, y: p.y + ny });
        candidateStack.push({ x: p.x - nx, y: p.y - ny });
      }
    }
  }

  return lines;
}

/**
 * Place a stipple dot (a tiny closed loop the pen can draw in one touch)
 * if the spot is drawable and respects local spacing
 */
function placeDot(
  field: ImageField,
  grid: SpatialGrid,
  at: Point,
  pass: PassConfig,
  params: StrokeParams,
  random: () => number
): FlowLine | null {
  if (!field.isInBounds(at.x, at.y, pass.margin)) return null;
  if (!pass.isDrawable(at.x, at.y)) return null;
  const spacing = params.dotSpacing ?? pass.spacingAt(at.x, at.y);
  if (grid.hasPointWithin(at.x, at.y, spacing * D_SEED)) return null;

  const radius = 0.55 + random() * 0.35;
  const points: Point[] = [];
  const segments = 7;
  const phase = random() * Math.PI * 2;
  for (let i = 0; i <= segments; i++) {
    const t = phase + (i / segments) * Math.PI * 2;
    points.push({ x: at.x + Math.cos(t) * radius, y: at.y + Math.sin(t) * radius });
  }

  grid.insert(at);
  return { points };
}

function traceStreamline(
  field: ImageField,
  grid: SpatialGrid,
  start: Point,
  pass: PassConfig,
  params: StrokeParams
): FlowLine | null {
  if (!field.isInBounds(start.x, start.y, pass.margin)) return null;
  if (!pass.isDrawable(start.x, start.y)) return null;
  if (grid.hasPointWithin(start.x, start.y, pass.spacingAt(start.x, start.y) * D_SEED)) {
    return null;
  }

  const forward = integrate(field, grid, start, pass, params, 1);
  const backward = integrate(field, grid, start, pass, params, -1);

  backward.reverse();
  const points = [...backward, { ...start }, ...forward];

  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }

  if (length < pass.minLineLength) return null;

  return { points };
}

function integrate(
  field: ImageField,
  grid: SpatialGrid,
  start: Point,
  pass: PassConfig,
  params: StrokeParams,
  sign: 1 | -1
): Point[] {
  const points: Point[] = [];
  const h = pass.stepLength;
  const halfSteps = Math.min(
    Math.ceil(pass.maxSteps / 2),
    Math.max(1, Math.ceil(params.maxArcLength / 2 / h))
  );

  let x = start.x;
  let y = start.y;

  const theta0 =
    params.fixedAngle ?? field.getOrientation(x, y) + params.angleOffset;
  let prevDx = Math.cos(theta0) * sign;
  let prevDy = Math.sin(theta0) * sign;

  // Loop guard: steps to skip when checking proximity against own points
  const selfSkip = Math.ceil((pass.spacingAt(start.x, start.y) * 2.5) / h);

  for (let i = 0; i < halfSteps; i++) {
    const theta =
      params.fixedAngle ?? field.getOrientation(x, y) + params.angleOffset;
    let dx = Math.cos(theta);
    let dy = Math.sin(theta);

    // Orientation is pi-periodic — keep the direction consistent
    if (dx * prevDx + dy * prevDy < 0) {
      dx = -dx;
      dy = -dy;
    }

    // Midpoint (RK2) step for smoother curves
    const mx = x + dx * h * 0.5;
    const my = y + dy * h * 0.5;
    if (!field.isInBounds(mx, my, pass.margin)) break;

    const thetaMid =
      params.fixedAngle ?? field.getOrientation(mx, my) + params.angleOffset;
    let mdx = Math.cos(thetaMid);
    let mdy = Math.sin(thetaMid);
    if (mdx * dx + mdy * dy < 0) {
      mdx = -mdx;
      mdy = -mdy;
    }

    if (params.headingJitter && params.rand) {
      const drift = (params.rand() - 0.5) * 2 * params.headingJitter;
      const cd = Math.cos(drift);
      const sd = Math.sin(drift);
      const rx = mdx * cd - mdy * sd;
      const ry = mdx * sd + mdy * cd;
      mdx = rx;
      mdy = ry;
    }

    const nx = x + mdx * h;
    const ny = y + mdy * h;

    if (!field.isInBounds(nx, ny, pass.margin)) break;
    if (!pass.isDrawable(nx, ny)) break;
    if (grid.hasPointWithin(nx, ny, pass.spacingAt(nx, ny) * D_TEST)) break;

    // Strokes stop at depth discontinuities — hatching must not slide
    // across a silhouette onto a different surface
    if (field.getDepthEdge(nx, ny) > 0.45) break;

    // Per-stroke termination, e.g. the stroke crossed its facet border
    if (params.stopAt && params.stopAt(nx, ny)) break;

    // Stop instead of drawing a sharp kink (scribbles may turn harder)
    if (mdx * prevDx + mdy * prevDy < (params.headingJitter ? -0.4 : 0.2)) break;

    // Stop if the stroke curls back onto itself
    if (i % 3 === 0 && points.length > selfSkip) {
      const limit = points.length - selfSkip;
      const minDist = pass.spacingAt(nx, ny) * 0.6;
      let looped = false;
      for (let j = 0; j < limit; j += 2) {
        if (Math.hypot(points[j].x - nx, points[j].y - ny) < minDist) {
          looped = true;
          break;
        }
      }
      if (looped) break;
    }

    points.push({ x: nx, y: ny });
    x = nx;
    y = ny;
    prevDx = mdx;
    prevDy = mdy;
  }

  return points;
}

/**
 * Uniform hash grid for nearest-neighbour distance rejection
 */
class SpatialGrid {
  private cellSize: number;
  private cols: number;
  private rows: number;
  private cells: Map<number, Point[]> = new Map();

  constructor(width: number, height: number, cellSize: number) {
    this.cellSize = cellSize;
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
  }

  insert(p: Point): void {
    const key = this.keyFor(p.x, p.y);
    const cell = this.cells.get(key);
    if (cell) {
      cell.push(p);
    } else {
      this.cells.set(key, [p]);
    }
  }

  hasPointWithin(x: number, y: number, radius: number): boolean {
    const r = Math.ceil(radius / this.cellSize);
    const col = this.clampCol(Math.floor(x / this.cellSize));
    const row = this.clampRow(Math.floor(y / this.cellSize));
    const radiusSq = radius * radius;

    for (let cy = Math.max(0, row - r); cy <= Math.min(this.rows - 1, row + r); cy++) {
      for (let cx = Math.max(0, col - r); cx <= Math.min(this.cols - 1, col + r); cx++) {
        const cell = this.cells.get(cy * this.cols + cx);
        if (!cell) continue;
        for (const p of cell) {
          const dx = p.x - x;
          const dy = p.y - y;
          if (dx * dx + dy * dy < radiusSq) return true;
        }
      }
    }

    return false;
  }

  private keyFor(x: number, y: number): number {
    return this.clampRow(Math.floor(y / this.cellSize)) * this.cols +
      this.clampCol(Math.floor(x / this.cellSize));
  }

  private clampCol(c: number): number {
    return Math.max(0, Math.min(this.cols - 1, c));
  }

  private clampRow(r: number): number {
    return Math.max(0, Math.min(this.rows - 1, r));
  }
}
