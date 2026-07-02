import { FlowField, FlowFieldOptions } from './flow-field.js';
import { randomSeed } from './lib/rng.js';

export interface Point {
  x: number;
  y: number;
}

export interface FlowLine {
  points: Point[];
  /**
   * Pen weight class. 'bold' lines (contours, accents) render thicker and
   * are exported as a separate SVG layer for multi-pen plotting
   */
  pen?: 'fine' | 'bold';
  /**
   * Optional named layer for per-pen export. When set, `toSVGLayers` groups
   * strokes by this key so each layer can be plotted with a different pen
   * (e.g. 'present' / 'ghost' / 'trail'). Falls back to `pen` then 'default'.
   */
  layer?: string;
}

export interface FlowLinesOptions extends Omit<FlowFieldOptions, 'resolution'> {
  lineCount: number;
  stepLength?: number;
  maxSteps?: number;
  margin?: number;
  minLineLength?: number;
  fieldResolution?: number;
  startPoints?: Point[];
}

export interface FlowLinesResult {
  lines: FlowLine[];
  width: number;
  height: number;
  seed: number;
}

/**
 * Generate flow lines based on a noise field
 */
export function generateFlowLines(options: FlowLinesOptions): FlowLinesResult {
  const {
    width,
    height,
    lineCount,
    stepLength = 2,
    maxSteps = 500,
    margin = 20,
    minLineLength = 10,
    fieldResolution = 10,
    seed = randomSeed(),
    noiseScale,
    octaves,
    persistence,
    lacunarity,
    startPoints,
  } = options;

  const field = new FlowField({
    width,
    height,
    resolution: fieldResolution,
    seed,
    noiseScale,
    octaves,
    persistence,
    lacunarity,
  });

  const lines: FlowLine[] = [];

  // Determine starting points
  const starts: Point[] = startPoints ?? generateStartPoints(
    width,
    height,
    lineCount,
    margin,
    seed
  );

  for (const start of starts) {
    const line = traceLine(field, start, stepLength, maxSteps, margin);

    if (line.points.length >= minLineLength) {
      lines.push(line);
    }
  }

  return {
    lines,
    width,
    height,
    seed,
  };
}

/**
 * Generate random starting points for flow lines
 */
function generateStartPoints(
  width: number,
  height: number,
  count: number,
  margin: number,
  seed: number
): Point[] {
  const points: Point[] = [];

  // Simple seeded random
  let s = seed;
  const random = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  for (let i = 0; i < count; i++) {
    points.push({
      x: margin + random() * (width - 2 * margin),
      y: margin + random() * (height - 2 * margin),
    });
  }

  return points;
}

/**
 * Trace a single flow line through the field
 */
function traceLine(
  field: FlowField,
  start: Point,
  stepLength: number,
  maxSteps: number,
  margin: number
): FlowLine {
  const points: Point[] = [{ ...start }];
  let current = { ...start };

  for (let i = 0; i < maxSteps; i++) {
    const vector = field.getVector(current.x, current.y);

    const next: Point = {
      x: current.x + vector.x * stepLength,
      y: current.y + vector.y * stepLength,
    };

    // Stop if out of bounds
    if (!field.isInBounds(next.x, next.y, margin)) {
      break;
    }

    points.push(next);
    current = next;
  }

  return { points };
}

export interface EvenFlowLinesOptions extends Omit<FlowLinesOptions, 'lineCount' | 'startPoints'> {
  /**
   * Target gap between neighbouring streamlines, px. Smaller = denser. This
   * is the knob that makes the field significantly denser: lines are packed
   * by even spacing rather than scattered from random seeds, so there are no
   * clumps or bald patches.
   */
  separation: number;
  /**
   * A growing line stops when it comes within `separation * testFactor` of
   * another line (default 0.5 — the classic Jobard–Lefer d_test = d_sep/2).
   */
  testFactor?: number;
}

/**
 * A spatial hash over streamline sample points, bucketed at the separation
 * distance so proximity queries only touch the 3×3 neighbouring cells.
 */
class ProximityGrid {
  private readonly cell: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly buckets: Point[][];

  constructor(width: number, height: number, cell: number) {
    this.cell = cell;
    this.cols = Math.max(1, Math.ceil(width / cell));
    this.rows = Math.max(1, Math.ceil(height / cell));
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  private index(x: number, y: number): number {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cell)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cell)));
    return cy * this.cols + cx;
  }

  add(p: Point): void {
    this.buckets[this.index(p.x, p.y)].push(p);
  }

  /** True if any stored point lies within `dist` of (x, y). */
  hasNear(x: number, y: number, dist: number): boolean {
    const d2 = dist * dist;
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cell)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cell)));
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      if (gy < 0 || gy >= this.rows) continue;
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        if (gx < 0 || gx >= this.cols) continue;
        for (const p of this.buckets[gy * this.cols + gx]) {
          const dx = p.x - x;
          const dy = p.y - y;
          if (dx * dx + dy * dy < d2) return true;
        }
      }
    }
    return false;
  }
}

/**
 * Generate evenly-spaced flow lines (Jobard–Lefer). Streamlines are packed
 * a fixed `separation` apart: each accepted line spawns candidate seeds a
 * separation away on either side, and a growing line halts when it crowds an
 * existing one. The result fills the page uniformly at whatever density the
 * separation asks for, with none of the clumping or gaps of random seeding —
 * the way to make the field significantly, evenly denser.
 */
export function generateFlowLinesEven(options: EvenFlowLinesOptions): FlowLinesResult {
  const {
    width,
    height,
    separation,
    testFactor = 0.5,
    stepLength = 2,
    maxSteps = 500,
    margin = 20,
    minLineLength = 10,
    fieldResolution = 10,
    seed = randomSeed(),
    noiseScale,
    octaves,
    persistence,
    lacunarity,
  } = options;

  const field = new FlowField({
    width,
    height,
    resolution: fieldResolution,
    seed,
    noiseScale,
    octaves,
    persistence,
    lacunarity,
  });

  const dSep = Math.max(1, separation);
  const dTest = dSep * testFactor;
  const grid = new ProximityGrid(width, height, dSep);
  const lines: FlowLine[] = [];

  // Deterministic first seed near the centre, nudged by the seed value so
  // different seeds explore the field from different anchors.
  let s = seed;
  const random = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const firstSeed: Point = {
    x: margin + random() * (width - 2 * margin),
    y: margin + random() * (height - 2 * margin),
  };

  // FIFO queue of candidate seeds keeps growth deterministic.
  const queue: Point[] = [firstSeed];

  while (queue.length > 0) {
    const seedPoint = queue.shift()!;
    if (!field.isInBounds(seedPoint.x, seedPoint.y, margin)) continue;
    // Reject seeds that already sit too close to an existing line.
    if (grid.hasNear(seedPoint.x, seedPoint.y, dSep)) continue;

    const points = traceEven(field, seedPoint, stepLength, maxSteps, margin, dTest, grid);
    if (points.length < minLineLength) continue;

    // Commit the line and register its samples for future proximity tests.
    for (const p of points) grid.add(p);
    lines.push({ points });

    // Spawn candidate seeds a separation away on both sides of the line.
    for (let i = 0; i < points.length; i++) {
      const v = field.getVector(points[i].x, points[i].y);
      // Perpendicular to the local flow direction.
      const px = -v.y;
      const py = v.x;
      queue.push({ x: points[i].x + px * dSep, y: points[i].y + py * dSep });
      queue.push({ x: points[i].x - px * dSep, y: points[i].y - py * dSep });
    }
  }

  return { lines, width, height, seed };
}

/**
 * Trace a streamline both forward and backward from a seed, stopping each
 * direction when it leaves the frame or crowds an already-committed line (or
 * curls back onto itself).
 */
function traceEven(
  field: FlowField,
  seed: Point,
  stepLength: number,
  maxSteps: number,
  margin: number,
  dTest: number,
  grid: ProximityGrid
): Point[] {
  // How many of the line's own recent samples to ignore when checking for
  // self-crowding, so a straight line doesn't trip on the point behind it.
  const selfGap = Math.ceil(dTest / stepLength) + 2;

  const walk = (sign: number): Point[] => {
    const out: Point[] = [];
    let current = { ...seed };
    for (let i = 0; i < maxSteps; i++) {
      const vector = field.getVector(current.x, current.y);
      const next: Point = {
        x: current.x + sign * vector.x * stepLength,
        y: current.y + sign * vector.y * stepLength,
      };
      if (!field.isInBounds(next.x, next.y, margin)) break;
      // Crowding another committed line.
      if (grid.hasNear(next.x, next.y, dTest)) break;
      // Self-intersection: check against earlier samples of this same walk.
      let hitSelf = false;
      for (let j = 0; j < out.length - selfGap; j++) {
        const dx = out[j].x - next.x;
        const dy = out[j].y - next.y;
        if (dx * dx + dy * dy < dTest * dTest) {
          hitSelf = true;
          break;
        }
      }
      if (hitSelf) break;
      out.push(next);
      current = next;
    }
    return out;
  };

  // Backward half is reversed so the assembled line runs start-to-finish.
  const back = walk(-1).reverse();
  const fwd = walk(1);
  return [...back, seed, ...fwd];
}

/**
 * Generate flow lines with grid-based starting points
 */
export function generateFlowLinesGrid(options: Omit<FlowLinesOptions, 'startPoints' | 'lineCount'> & {
  gridSpacing: number;
}): FlowLinesResult {
  const { gridSpacing, margin = 20, ...rest } = options;

  const startPoints: Point[] = [];

  for (let y = margin; y < rest.height - margin; y += gridSpacing) {
    for (let x = margin; x < rest.width - margin; x += gridSpacing) {
      startPoints.push({ x, y });
    }
  }

  return generateFlowLines({
    ...rest,
    margin,
    lineCount: startPoints.length,
    startPoints,
  });
}
