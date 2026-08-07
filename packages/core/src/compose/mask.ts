import type { FlowLine, Point } from '../flow-lines.js';
import { SimplexNoise } from '../noise.js';
import { traceIsoContours } from '../iso-contours.js';
import { smoothPolyline } from '../lib/polyline.js';

/**
 * A downsampled occupancy raster of "where a layer's ink is" — the shape a
 * stack of hatching, stipple, or outlines occupies on the page, merged into a
 * silhouette by disc-stamping every stroke sample at a merge radius. This is
 * how one layer's drawing becomes a stencil another layer can be clipped
 * inside or outside of, with no per-module knowledge of the geometry.
 */
export interface CoverageMask {
  cols: number;
  rows: number;
  /** Page pixels per raster cell. */
  cellPx: number;
  /** Row-major occupancy, 1 = covered. */
  data: Uint8Array;
  /** Covered-test in page px. Out-of-bounds points are uncovered. */
  inside(x: number, y: number): boolean;
}

export interface CoverageMaskOptions {
  /** Disc radius stamped around every stroke sample, in page px — merges
   *  hatch lines into one solid silhouette. */
  radiusPx: number;
  /** Raster cell size in page px. Default `max(2, round(radiusPx / 3))`,
   *  floored so the raster never exceeds ~4M cells on large pages. */
  cellPx?: number;
}

/** Cell-count ceiling: an A2 sheet at high resolution stays bounded. */
const MAX_CELLS = 4_000_000;

function maskFromRaster(cols: number, rows: number, cellPx: number, data: Uint8Array): CoverageMask {
  return {
    cols,
    rows,
    cellPx,
    data,
    inside(x: number, y: number): boolean {
      const ci = Math.floor(x / cellPx);
      const cj = Math.floor(y / cellPx);
      if (ci < 0 || ci >= cols || cj < 0 || cj >= rows) return false;
      return data[cj * cols + ci] === 1;
    },
  };
}

/** Resolve the raster geometry for a page: the same cell sizing (including
 *  the MAX_CELLS coarsening) whether the mask is built one-shot or
 *  accumulated, so the two paths raster identically. */
function resolveRaster(
  widthPx: number,
  heightPx: number,
  options: CoverageMaskOptions
): { radius: number; cellPx: number; cols: number; rows: number } {
  const radius = Math.max(0.5, options.radiusPx);
  let cellPx = options.cellPx ?? Math.max(2, Math.round(radius / 3));
  // Cap the raster for very large pages; a coarser grid degrades gracefully.
  while ((Math.ceil(widthPx / cellPx) + 1) * (Math.ceil(heightPx / cellPx) + 1) > MAX_CELLS) {
    cellPx *= 2;
  }
  const cols = Math.max(1, Math.ceil(widthPx / cellPx));
  const rows = Math.max(1, Math.ceil(heightPx / cellPx));
  return { radius, cellPx, cols, rows };
}

/** Disc-stamp densified line samples into an occupancy raster in place. */
function stampLinesInto(
  data: Uint8Array,
  cols: number,
  rows: number,
  cellPx: number,
  radius: number,
  lines: FlowLine[]
): void {
  const r = Math.ceil(radius / cellPx);
  const radius2 = radius * radius;

  const stamp = (x: number, y: number): void => {
    const ci = Math.floor(x / cellPx);
    const cj = Math.floor(y / cellPx);
    for (let dj = -r; dj <= r; dj++) {
      const cy = cj + dj;
      if (cy < 0 || cy >= rows) continue;
      for (let di = -r; di <= r; di++) {
        const cx = ci + di;
        if (cx < 0 || cx >= cols) continue;
        // Disc, so the silhouette boundary is round rather than blocky.
        if ((di * cellPx) ** 2 + (dj * cellPx) ** 2 <= radius2 + cellPx * cellPx) {
          data[cy * cols + cx] = 1;
        }
      }
    }
  };

  for (const line of lines) {
    const pts = line.points;
    if (pts.length === 0) continue;
    stamp(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(len / cellPx));
      for (let s = 1; s <= steps; s++) {
        stamp(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps);
      }
    }
  }
}

/**
 * Build a layer's coverage mask by disc-stamping densified line samples into a
 * downsampled occupancy grid (the `texture.ts` halo-mask pattern).
 */
export function buildCoverageMask(
  lines: FlowLine[],
  widthPx: number,
  heightPx: number,
  options: CoverageMaskOptions
): CoverageMask {
  const { radius, cellPx, cols, rows } = resolveRaster(widthPx, heightPx, options);
  const data = new Uint8Array(cols * rows);
  stampLinesInto(data, cols, rows, cellPx, radius, lines);
  return maskFromRaster(cols, rows, cellPx, data);
}

export interface CoverageAccumulator {
  /** Union more strokes into the mask. */
  stamp(lines: FlowLine[]): void;
  /** Live view over the accumulating raster — valid across stamps. */
  mask: CoverageMask;
}

/**
 * A coverage mask built up over successive `stamp` calls instead of one shot.
 * Disc stamping is an idempotent, order-independent union, so the raster is
 * byte-identical to `buildCoverageMask` over the concatenated strokes — but a
 * caller that alternates clip-then-add (the lapidary carve) pays for each
 * stroke once instead of re-rasterizing the whole accumulation per step.
 */
export function createCoverageAccumulator(
  widthPx: number,
  heightPx: number,
  options: CoverageMaskOptions
): CoverageAccumulator {
  const { radius, cellPx, cols, rows } = resolveRaster(widthPx, heightPx, options);
  const data = new Uint8Array(cols * rows);
  return {
    stamp(lines: FlowLine[]): void {
      stampLinesInto(data, cols, rows, cellPx, radius, lines);
    },
    mask: maskFromRaster(cols, rows, cellPx, data),
  };
}

/**
 * Grow (`offsetPx > 0`) or shrink (`< 0`) a mask by a disc — the signed
 * inset/outset control on stencil clips. Only boundary cells are stamped, so
 * cost tracks the silhouette perimeter, not its area.
 */
export function morphMask(mask: CoverageMask, offsetPx: number): CoverageMask {
  const { cols, rows, cellPx } = mask;
  const r = Math.round(Math.abs(offsetPx) / cellPx);
  if (r === 0) return mask;
  const erode = offsetPx < 0;
  // Erosion = complement-dilate-complement, so one dilation kernel serves both.
  const src = erode ? invert(mask.data) : mask.data;
  const out = src.slice();
  const r2 = r * r;
  for (let cj = 0; cj < rows; cj++) {
    for (let ci = 0; ci < cols; ci++) {
      if (src[cj * cols + ci] !== 1) continue;
      if (!isBoundary(src, cols, rows, ci, cj)) continue;
      for (let dj = -r; dj <= r; dj++) {
        const cy = cj + dj;
        if (cy < 0 || cy >= rows) continue;
        for (let di = -r; di <= r; di++) {
          const cx = ci + di;
          if (cx < 0 || cx >= cols) continue;
          if (di * di + dj * dj <= r2) out[cy * cols + cx] = 1;
        }
      }
    }
  }
  return maskFromRaster(cols, rows, cellPx, erode ? invert(out) : out);
}

function invert(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] === 1 ? 0 : 1;
  return out;
}

/** A covered cell with at least one uncovered 4-neighbour (page edge counts). */
function isBoundary(data: Uint8Array, cols: number, rows: number, ci: number, cj: number): boolean {
  if (ci === 0 || ci === cols - 1 || cj === 0 || cj === rows - 1) return true;
  return (
    data[cj * cols + ci - 1] === 0 ||
    data[cj * cols + ci + 1] === 0 ||
    data[(cj - 1) * cols + ci] === 0 ||
    data[(cj + 1) * cols + ci] === 0
  );
}

export interface MaskClipOptions {
  /** Keep the runs inside the mask, or outside it. */
  mode: 'inside' | 'outside';
  /** Organic edge: domain-warp amplitude in px (0 = crisp edge). The clip
   *  test samples the mask at a noise-displaced position, so the cut edge
   *  wanders deterministically instead of hugging the silhouette. */
  featherPx?: number;
  /** Feather noise wavelength in px. Default `8 × featherPx`. */
  featherScalePx?: number;
  /** Feather noise seed. Default 0. */
  featherSeed?: number;
  /** Dust filter: drop kept runs shorter than this. Default `2 × cellPx`. */
  minKeepPx?: number;
}

/**
 * Clip polylines against a coverage mask, keeping maximal runs on the chosen
 * side. Samples are densified at half the mask cell so no crossing is missed,
 * and each boundary crossing is refined by bisection so cut ends land on the
 * silhouette edge instead of the nearest sample.
 */
export function clipLinesToMask(
  lines: FlowLine[],
  mask: CoverageMask,
  options: MaskClipOptions
): FlowLine[] {
  const wantInside = options.mode === 'inside';
  const featherPx = options.featherPx ?? 0;
  const minKeep = options.minKeepPx ?? mask.cellPx * 2;

  let warp: ((p: Point) => Point) | null = null;
  if (featherPx > 0) {
    const noise = new SimplexNoise(options.featherSeed ?? 0);
    const scale = Math.max(1, options.featherScalePx ?? featherPx * 8);
    warp = (p: Point) => ({
      // Two decorrelated channels of the same noise field (offset far apart).
      x: p.x + noise.noise2D(p.x / scale, p.y / scale) * featherPx,
      y: p.y + noise.noise2D(p.x / scale + 137.31, p.y / scale + 291.77) * featherPx,
    });
  }

  const keep = (p: Point): boolean => {
    const q = warp ? warp(p) : p;
    return mask.inside(q.x, q.y) === wantInside;
  };

  /** Refine the crossing between a kept and a dropped point (8 bisections). */
  const refine = (kept: Point, dropped: Point): Point => {
    let a = kept;
    let b = dropped;
    for (let i = 0; i < 8; i++) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (keep(mid)) a = mid;
      else b = mid;
    }
    return a;
  };

  const step = Math.max(0.5, mask.cellPx * 0.5);
  const out: FlowLine[] = [];
  for (const line of lines) {
    const pts = line.points;
    if (pts.length < 2) {
      if (pts.length && keep(pts[0])) out.push(line);
      continue;
    }
    let run: Point[] = [];
    const flush = (boundary?: Point) => {
      if (boundary) run.push(boundary);
      if (run.length >= 2 && runLength(run) >= minKeep) out.push({ ...line, points: run });
      run = [];
    };
    let prev: Point | null = null;
    const visit = (p: Point) => {
      if (keep(p)) {
        // Entering the kept side: refine backwards to the boundary.
        if (run.length === 0 && prev && !keep(prev)) run.push(refine(p, prev));
        run.push(p);
      } else {
        if (run.length > 0) flush(refine(run[run.length - 1], p));
      }
      prev = p;
    };
    visit(pts[0]);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
      for (let s = 1; s <= n; s++) {
        const t = s / n;
        visit({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    flush();
  }
  return out;
}

function runLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

export interface MaskOutlineOptions {
  /** 1-2-1 smoothing passes over the traced boundary. Default 2. */
  smoothIterations?: number;
  /** Drop boundary loops shorter than this, in px. Default `6 × cellPx`. */
  minLoopPx?: number;
}

/**
 * Trace a mask's silhouette boundary as page-space polylines (marching
 * squares over the occupancy raster, then smoothed) — the halo-outline
 * stroke, drawn the way the sky module inks carved cloud edges.
 */
export function traceMaskOutline(mask: CoverageMask, options: MaskOutlineOptions = {}): Point[][] {
  const { cols, rows, cellPx } = mask;
  const smoothIterations = options.smoothIterations ?? 2;
  const minLoopPx = options.minLoopPx ?? cellPx * 6;
  const data = new Float32Array(cols * rows);
  for (let i = 0; i < data.length; i++) data[i] = mask.data[i];
  const loops = traceIsoContours({ width: cols, height: rows, data }, 0.5);
  const out: Point[][] = [];
  for (const loop of loops) {
    // Raster coords sit on cell corners; map to page px at cell centres.
    let pts = loop.map((p) => ({ x: (p.x + 0.5) * cellPx, y: (p.y + 0.5) * cellPx }));
    if (smoothIterations > 0) pts = smoothPolyline(pts, smoothIterations);
    if (pts.length >= 2 && runLength(pts) >= minLoopPx) out.push(pts);
  }
  return out;
}
