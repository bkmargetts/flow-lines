import { createNoise } from './noise.js';
import type { FlowLine, FlowLinesResult, Point } from './flow-lines.js';

/**
 * Interleaved-grating texture. A block of evenly-spaced straight lines is
 * drawn in one ink, then the same grating is repeated for each further ink
 * (`colorCount`) phase-shifted by `spacing / colorCount` so the colours
 * interleave into each other's gaps. The inter-colour offset can be drifted
 * gradually — along the lines, across the block, and by noise — so the inks
 * weave between sitting on top of one another (coincident) and spreading into
 * an even multi-ink grating. That beating is the texture/noise.
 *
 * Pure and deterministic per `seed`. Every line is a real stroked polyline
 * tagged with a `band-NN` layer, so the drawing plots one pen per ink.
 */
export interface OverlappedLinesOptions {
  width: number;
  height: number;
  /** Clear border kept free of marks, px. */
  margin?: number;
  /** Line direction in degrees; 0 = vertical (lines run down the page). */
  angleDeg?: number;
  /** Line length as a fraction of the usable page span, 0..1. */
  lineLengthPct?: number;
  /** Gap between adjacent lines within one ink, px. */
  spacingPx?: number;
  /** Number of inks (interleaved gratings). */
  colorCount?: number;
  /**
   * Extra inter-colour offset built up from one end of each line to the
   * other, px. Non-zero bends the lines and weaves the inks down the page.
   */
  phaseDriftAlongPx?: number;
  /**
   * Extra inter-colour offset built up across the block (perpendicular),
   * px. Non-zero opens and closes the interleave across the page while every
   * line stays straight.
   */
  phaseDriftAcrossPx?: number;
  /** Noise-driven inter-colour offset amplitude, px. */
  phaseNoiseAmpPx?: number;
  /** Spatial frequency of the phase noise (cycles per px). */
  phaseNoiseScale?: number;
  /** Random per-point perpendicular shake, px. */
  jitterPx?: number;
  /** Peak low-frequency wobble of each line, px. */
  wobbleAmpPx?: number;
  /** Wobble wavelength along the line, px. */
  wobbleWavelengthPx?: number;
  /**
   * Width of an envelope at each block edge over which the offset deviation
   * (drift, noise, wobble, jitter) relaxes to the clean even interleave, px.
   * Smooths the ragged silhouette the offset leaves at the edges. 0 = off.
   */
  edgeSmoothPx?: number;
  /**
   * Shapes the pattern is clipped to: a point is kept only when inside the
   * union of these shapes. Empty/undefined = the whole page (no mask).
   */
  maskShapes?: MaskShape[];
  seed?: number;
}

/** A region the grating is clipped to. Coordinates are canvas px. */
export type MaskShape =
  | { type: 'strips'; angleDeg: number; widthPx: number; gapPx: number; phasePx?: number }
  | { type: 'band'; path: Point[]; halfWidthPx: number }
  | { type: 'rect'; x: number; y: number; w: number; h: number }
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number };

/** Squared distance from point (px,py) to segment (ax,ay)-(bx,by). */
function distSqToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy);
}

function inShape(shape: MaskShape, x: number, y: number): boolean {
  switch (shape.type) {
    case 'rect':
      return x >= shape.x && x <= shape.x + shape.w && y >= shape.y && y <= shape.y + shape.h;
    case 'ellipse': {
      if (shape.rx <= 0 || shape.ry <= 0) return false;
      const dx = (x - shape.cx) / shape.rx;
      const dy = (y - shape.cy) / shape.ry;
      return dx * dx + dy * dy <= 1;
    }
    case 'strips': {
      const period = shape.widthPx + shape.gapPx;
      if (period <= 0) return false;
      const rad = (shape.angleDeg * Math.PI) / 180;
      // Project onto the stripe normal; "on" bands repeat every period.
      const s = x * Math.cos(rad) + y * Math.sin(rad) - (shape.phasePx ?? 0);
      const m = ((s % period) + period) % period;
      return m < shape.widthPx;
    }
    case 'band': {
      const pts = shape.path;
      const r2 = shape.halfWidthPx * shape.halfWidthPx;
      if (pts.length === 0) return false;
      if (pts.length === 1) {
        const d = (x - pts[0].x) ** 2 + (y - pts[0].y) ** 2;
        return d <= r2;
      }
      for (let i = 1; i < pts.length; i++) {
        if (distSqToSegment(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <= r2) {
          return true;
        }
      }
      return false;
    }
  }
}

/** True when (x,y) is inside the union of `shapes` (or when there are none). */
export function pointInMask(shapes: MaskShape[] | undefined, x: number, y: number): boolean {
  if (!shapes || shapes.length === 0) return true;
  for (const s of shapes) if (inShape(s, x, y)) return true;
  return false;
}

/** Smoothstep ramp clamped to [0,1]. */
function smooth01(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

/** The export layer name for ink band index i (zero-padded so layers sort). */
export function bandLayerName(i: number): string {
  return `band-${String(i).padStart(2, '0')}`;
}

export function generateOverlappedLines(options: OverlappedLinesOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    angleDeg = 0,
    lineLengthPct = 1,
    spacingPx = 8,
    colorCount = 2,
    phaseDriftAlongPx = 0,
    phaseDriftAcrossPx = 0,
    phaseNoiseAmpPx = 0,
    phaseNoiseScale = 0.01,
    jitterPx = 0,
    wobbleAmpPx = 0,
    wobbleWavelengthPx = 120,
    edgeSmoothPx = 0,
    maskShapes,
    seed = Math.floor(Math.random() * 1000000),
  } = options;

  const noise = createNoise(seed);
  const colors = Math.max(1, Math.round(colorCount));
  const spacing = Math.max(0.5, spacingPx);
  // Even interleave: ink k sits k/colors of the way into the gap.
  const baseStep = spacing / colors;

  const cx = width / 2;
  const cy = height / 2;
  const rad = (angleDeg * Math.PI) / 180;
  // Line direction (0° = straight down) and its perpendicular.
  const dx = Math.sin(rad);
  const dy = Math.cos(rad);
  const px = Math.cos(rad);
  const py = -Math.sin(rad);

  const usableW = Math.max(0, width - 2 * margin);
  const usableH = Math.max(0, height - 2 * margin);
  // Half-extents of the usable rectangle along the line and across the block.
  const halfA = 0.5 * Math.max(0, Math.min(1, lineLengthPct)) *
    (Math.abs(dx) * usableW + Math.abs(dy) * usableH);
  const halfP = 0.5 * (Math.abs(px) * usableW + Math.abs(py) * usableH);

  const minX = margin;
  const minY = margin;
  const maxX = width - margin;
  const maxY = height - margin;
  const inBounds = (x: number, y: number): boolean =>
    x >= minX && x <= maxX && y >= minY && y <= maxY;

  const lines: FlowLine[] = [];
  if (halfA <= 0 || halfP <= 0 || colors < 1) {
    return { lines, width, height, seed };
  }

  // Sample finely enough that drifting / noisy lines stay smooth.
  const step = Math.max(2, Math.min(8, halfA / 12));

  // The interleave-spread field shared by every ink: ink k is offset by
  // k * field(a, b). field == baseStep is the even interleave; smaller pulls
  // the inks together, larger spreads them past each other.
  const field = (a: number, b: number): number =>
    baseStep +
    phaseDriftAlongPx * (a / halfA) +
    phaseDriftAcrossPx * (b / halfP) +
    phaseNoiseAmpPx * noise.noise2D(b * phaseNoiseScale, a * phaseNoiseScale);

  // Base grating positions across the block, centred.
  const firstB = -Math.ceil(halfP / spacing) * spacing;
  for (let b = firstB; b <= halfP + 1e-6; b += spacing) {
    for (let k = 0; k < colors; k++) {
      let run: Point[] = [];
      const flush = (): void => {
        if (run.length >= 2) lines.push({ points: run, layer: bandLayerName(k), pen: 'fine' });
        run = [];
      };
      // The perpendicular position at arc-length `a` (centreline + deviation).
      const pointAt = (a: number): Point => {
        const wob =
          wobbleAmpPx > 0
            ? wobbleAmpPx * noise.fbm(a / wobbleWavelengthPx, b * 0.013 + k * 1.7, 2, 0.5, 2.2)
            : 0;
        const jit = jitterPx > 0 ? jitterPx * noise.noise2D(a * 0.5 + k * 13.1, b * 0.5) : 0;
        // Clean even interleave (straight) plus the deviation that carries the
        // texture. An edge envelope relaxes the deviation to zero at the block
        // boundary so the ragged silhouette smooths to a clean rectangle.
        const deviation = k * (field(a, b) - baseStep) + wob + jit;
        const env =
          edgeSmoothPx > 0
            ? smooth01((halfA - Math.abs(a)) / edgeSmoothPx) *
              smooth01((halfP - Math.abs(b)) / edgeSmoothPx)
            : 1;
        const perp = b + k * baseStep + env * deviation;
        return { x: cx + dx * a + px * perp, y: cy + dy * a + py * perp };
      };
      const passes = (p: Point): boolean =>
        inBounds(p.x, p.y) && pointInMask(maskShapes, p.x, p.y);
      // Refine an inside→outside crossing to the boundary so line ends land on
      // the mask/page edge instead of stair-stepping to the nearest sample.
      const crossing = (aIn: number, aOut: number): Point => {
        let lo = aIn;
        let hi = aOut;
        for (let i = 0; i < 14; i++) {
          const mid = (lo + hi) / 2;
          if (passes(pointAt(mid))) lo = mid;
          else hi = mid;
        }
        return pointAt(lo);
      };

      let prevA: number | null = null;
      let prevPass = false;
      for (let a = -halfA; a <= halfA + 1e-6; a += step) {
        const p = pointAt(a);
        const pass = passes(p);
        if (pass) {
          if (prevA !== null && !prevPass) run.push(crossing(a, prevA));
          run.push(p);
        } else {
          if (prevPass && prevA !== null) {
            run.push(crossing(prevA, a));
            flush();
          } else {
            flush();
          }
        }
        prevA = a;
        prevPass = pass;
      }
      flush();
    }
  }

  return { lines, width, height, seed };
}
