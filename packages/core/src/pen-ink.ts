import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { ImageField } from './image-field.js';
import { GrayscaleImage } from './image.js';
import { applyHandDrawnStyle } from './hand-drawn.js';

export interface PenInkOptions {
  /** Output width in px (default 800) */
  width?: number;
  /** Output height in px (default: derived from the image aspect ratio) */
  height?: number;
  /** Margin from canvas edges (default 20) */
  margin?: number;
  /** Random seed for reproducibility */
  seed?: number;

  /** Number of hatching layers, 1-4. Darker areas receive more layers (default 3) */
  layers?: number;
  /** Stroke spacing in the darkest areas, px (default 2.5) */
  minSpacing?: number;
  /** Stroke spacing in the lightest hatched areas, px (default 14) */
  maxSpacing?: number;
  /** Darkness below which paper is left blank, 0-1 (default 0.08) */
  whiteCutoff?: number;
  /** Tone response curve; >1 pushes density into shadows (default 1) */
  toneGamma?: number;

  /** Fallback hatch angle in degrees for flat regions (default -45) */
  hatchAngle?: number;
  /** Follow image contours (true) or hatch at fixed angles only (default true) */
  followTone?: boolean;
  /** Structure tensor smoothing — higher gives smoother, longer strokes (default 4) */
  fieldSmoothing?: number;
  /** Auto-stretch image contrast (default true) */
  normalizeContrast?: boolean;
  /** Max dimension of the internal working raster (default 600) */
  workingSize?: number;

  /** Trace dark edges as outlines (default true) */
  drawOutlines?: boolean;
  /** Edge strength threshold for outlines, 0-1 (default 0.35) */
  outlineThreshold?: number;

  /** Integration step length in px (default 1.5) */
  stepLength?: number;
  /** Max steps per stroke direction (default: enough to cross the canvas) */
  maxSteps?: number;
  /** Minimum stroke length in px (default 4) */
  minLineLength?: number;

  /** Hand-drawn wobble amplitude in px; 0 disables (default 0.8) */
  wobble?: number;
}

/** Angle offsets (degrees) for successive hatch layers */
const LAYER_ANGLES = [0, 75, -40, 105];

/** A point may not be drawn closer than this fraction of local spacing to another stroke */
const D_TEST = 0.72;
/** A new seed must be at least this fraction of local spacing from existing strokes */
const D_SEED = 0.95;

interface PassConfig {
  angleOffset: number;
  isDrawable: (x: number, y: number) => boolean;
  spacingAt: (x: number, y: number) => number;
  stepLength: number;
  maxSteps: number;
  margin: number;
  minLineLength: number;
  seedSpacing: number;
}

/**
 * Render a grayscale image as pen-and-ink style strokes.
 *
 * Tone is built up from layers of evenly-spaced streamlines traced through
 * the image's contour orientation field; local stroke spacing tightens with
 * darkness, additional layers cross-hatch the shadows, and strong edges are
 * traced as outlines. Optionally applies a hand-drawn wobble at the end.
 */
export function imageToPenInk(
  image: GrayscaleImage,
  options: PenInkOptions = {}
): FlowLinesResult {
  const width = options.width ?? 800;
  const height = options.height ?? Math.max(1, Math.round((width * image.height) / image.width));
  const margin = options.margin ?? 20;
  const seed = options.seed ?? Math.floor(Math.random() * 1000000);

  const layers = Math.max(1, Math.min(4, Math.round(options.layers ?? 3)));
  const minSpacing = options.minSpacing ?? 2.5;
  const maxSpacing = Math.max(options.maxSpacing ?? 14, minSpacing + 0.1);
  const whiteCutoff = options.whiteCutoff ?? 0.08;
  const toneGamma = options.toneGamma ?? 1;

  const stepLength = options.stepLength ?? 1.5;
  const maxSteps = options.maxSteps ?? Math.ceil((Math.max(width, height) * 1.5) / stepLength);
  const minLineLength = options.minLineLength ?? 4;

  const drawOutlines = options.drawOutlines ?? true;
  const outlineThreshold = options.outlineThreshold ?? 0.35;

  const wobble = options.wobble ?? 0.8;

  const field = new ImageField(image, {
    width,
    height,
    workingSize: options.workingSize,
    fieldSmoothing: options.fieldSmoothing,
    hatchAngle: ((options.hatchAngle ?? -45) * Math.PI) / 180,
    followTone: options.followTone,
    normalizeContrast: options.normalizeContrast,
  });

  const lines: FlowLine[] = [];

  // Tone layers: layer i only hatches where darkness exceeds its threshold,
  // so shadows accumulate cross-hatched coverage.
  for (let layer = 0; layer < layers; layer++) {
    const threshold = whiteCutoff + (layer / layers) * (0.92 - whiteCutoff);
    const angleOffset = (LAYER_ANGLES[layer] * Math.PI) / 180;

    const spacingAt = (x: number, y: number): number => {
      const d = field.getDarkness(x, y);
      const u = Math.min(1, Math.max(0, (d - whiteCutoff) / (1 - whiteCutoff)));
      const t = Math.pow(u, toneGamma);
      return maxSpacing + (minSpacing - maxSpacing) * t;
    };

    lines.push(
      ...tracePass(field, seed + layer * 7919, {
        angleOffset,
        isDrawable: (x, y) => field.getDarkness(x, y) >= threshold,
        spacingAt,
        stepLength,
        maxSteps,
        margin,
        minLineLength,
        seedSpacing: Math.max(minSpacing * 2, maxSpacing / 2),
      })
    );
  }

  // Outline pass: follow strong edges with tight, fixed spacing
  if (drawOutlines) {
    const outlineSpacing = Math.max(1.2, minSpacing * 0.8);
    lines.push(
      ...tracePass(field, seed + 104729, {
        angleOffset: 0,
        isDrawable: (x, y) => field.getEdgeStrength(x, y) >= outlineThreshold,
        spacingAt: () => outlineSpacing,
        stepLength: Math.min(stepLength, 1.5),
        maxSteps,
        margin,
        minLineLength: Math.max(minLineLength, 6),
        seedSpacing: 4,
      })
    );
  }

  let result: FlowLinesResult = { lines, width, height, seed };

  if (wobble > 0) {
    result = applyHandDrawnStyle(result, { amplitude: wobble, seed });
  }

  return result;
}

/**
 * Trace one evenly-spaced streamline pass (Jobard-Lefer style): seeds spawn
 * beside accepted strokes at the local spacing distance, falling back to a
 * darkest-first grid scan so all regions get covered.
 */
function tracePass(field: ImageField, seed: number, pass: PassConfig): FlowLine[] {
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

    const line = traceStreamline(field, grid, candidate, pass);
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

function traceStreamline(
  field: ImageField,
  grid: SpatialGrid,
  start: Point,
  pass: PassConfig
): FlowLine | null {
  if (!field.isInBounds(start.x, start.y, pass.margin)) return null;
  if (!pass.isDrawable(start.x, start.y)) return null;
  if (grid.hasPointWithin(start.x, start.y, pass.spacingAt(start.x, start.y) * D_SEED)) {
    return null;
  }

  const forward = integrate(field, grid, start, pass, 1);
  const backward = integrate(field, grid, start, pass, -1);

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
  sign: 1 | -1
): Point[] {
  const points: Point[] = [];
  const halfSteps = Math.ceil(pass.maxSteps / 2);
  const h = pass.stepLength;

  let x = start.x;
  let y = start.y;

  const theta0 = field.getOrientation(x, y) + pass.angleOffset;
  let prevDx = Math.cos(theta0) * sign;
  let prevDy = Math.sin(theta0) * sign;

  // Loop guard: steps to skip when checking proximity against own points
  const selfSkip = Math.ceil((pass.spacingAt(start.x, start.y) * 2.5) / h);

  for (let i = 0; i < halfSteps; i++) {
    const theta = field.getOrientation(x, y) + pass.angleOffset;
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

    const thetaMid = field.getOrientation(mx, my) + pass.angleOffset;
    let mdx = Math.cos(thetaMid);
    let mdy = Math.sin(thetaMid);
    if (mdx * dx + mdy * dy < 0) {
      mdx = -mdx;
      mdy = -mdy;
    }

    const nx = x + mdx * h;
    const ny = y + mdy * h;

    if (!field.isInBounds(nx, ny, pass.margin)) break;
    if (!pass.isDrawable(nx, ny)) break;
    if (grid.hasPointWithin(nx, ny, pass.spacingAt(nx, ny) * D_TEST)) break;

    // Stop instead of drawing a sharp kink
    if (mdx * prevDx + mdy * prevDy < 0.2) break;

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
