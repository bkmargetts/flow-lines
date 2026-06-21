import { createNoise } from './noise.js';
import { bandLayerName, pointInMask, type MaskShape } from './overlapped-lines.js';
import type { FlowLine, FlowLinesResult, Point } from './flow-lines.js';

/**
 * Colour-field texture — a soft, atmospheric gradient built the way the grating
 * builds texture: by *combining* inks in the same space, not by banding them
 * into separate zones. Every ink is an interleaved grating present across the
 * whole field; what varies across the page is each ink's *density*. A gradient
 * coordinate (linear at any angle, or radial from a focal point) places the
 * palette inks along it, each with an overlapping weight bump, and a noise
 * dither thins each ink's strokes to that local weight. Where two inks overlap
 * at partial density they interleave and optically mix into the in-between hue,
 * so a yellow→blue gradient really passes through green — the colour comes from
 * the shifting balance of mixed inks, never from a hard boundary.
 *
 * Stays plottable: tone/colour is carried by line density (dithered presence),
 * never stroke width; each ink is a real `band-NN` pen layer, each accent an
 * `accent-NN` layer. Pure and deterministic per `seed`.
 */
export interface ColorFieldOptions {
  width: number;
  height: number;
  /** Clear border kept free of marks, px. */
  margin?: number;
  /** Line direction in degrees; 0 = vertical (lines run down the page). */
  angleDeg?: number;
  /** Line length as a fraction of the usable page span, 0..1. */
  lineLengthPct?: number;
  /** Base gap between adjacent lines within one ink, px. */
  spacingPx?: number;
  /** Number of inks (interleaved gratings) sampled along the gradient. */
  inkCount?: number;

  /** How the palette is laid across the page. */
  gradientMode?: 'linear' | 'radial';
  /** Direction of a linear gradient in degrees; 0 = top→bottom (vertical). */
  gradientAngleDeg?: number;
  /** Focal point of a radial gradient, as fractions of the usable page, 0..1. */
  focalXPct?: number;
  focalYPct?: number;
  /** Radius of a radial gradient as a fraction of the usable half-extent. */
  gradientRadiusPct?: number;
  /**
   * Overlap width of each ink's weight bump, in gradient-coordinate units
   * relative to the even ink spacing (1 ≈ adjacent inks just touch; >1 mixes
   * more colours at once for a softer blend).
   */
  blend?: number;
  /** Organic warp of the gradient coordinate (displaces it), px. */
  gradientNoiseAmpPx?: number;
  /** Spatial frequency of the gradient warp noise (cycles per px). */
  gradientNoiseScale?: number;
  /** Spatial frequency of the density dither that breaks the lines (cycles per px). */
  ditherScale?: number;
  /**
   * Coverage, 0..1 — the fraction of each line that is inked. 1 = solid lines
   * (no white paper between strokes within a colour); lower leaves organic
   * breaks. Density is governed by this and `spacingPx`, independent of the
   * number of colours.
   */
  fill?: number;
  /**
   * Overprint: where two colours are co-dominant they both draw on the same
   * line and stack, so a multiply render shows their blended hue (physical
   * overprint). Off → exactly one colour per stroke (chosen by the local
   * weights), giving full coverage with an interleaved optical mix.
   */
  overprint?: boolean;
  /**
   * Number of cross-hatch directions (1 = single direction). Extra directions
   * are evenly spaced by `180/crossHatch`, so the strokes intersect into a woven
   * grid. Default 1.
   */
  crossHatch?: number;
  /**
   * Fan each ink to its own angle so different-coloured lines cross and overlap
   * (degrees, total spread across the inks). 0 = all inks share the direction.
   */
  inkAngleSpreadDeg?: number;

  /** Random per-point perpendicular shake, px. */
  jitterPx?: number;
  /** Peak low-frequency wobble of each line, px. */
  wobbleAmpPx?: number;
  /** Wobble wavelength along the line, px. */
  wobbleWavelengthPx?: number;
  /** Drop emitted polylines shorter than this, px (kills dither specks). */
  minSegmentLengthPx?: number;

  /** Geometric accents drawn over (bar) or cut into (gap) the field. */
  accents?: AccentSpec[];
  /** Pen width, px — sets the pass spacing when filling `bar` accents. */
  penWidthPx?: number;
  /** Shapes the field is clipped to (union); undefined = the whole page. */
  maskShapes?: MaskShape[];
  seed?: number;
}

/**
 * A geometric accent. Resolved to an axis-aligned rectangle from the usable
 * page: a `bar` is inked as its own pen layer; a `gap` reserves clean paper the
 * field breaks around.
 */
export interface AccentSpec {
  type: 'bar' | 'gap';
  orientation: 'vertical' | 'horizontal';
  /** Position across the page (fraction of usable width for vertical, of
   *  usable height for horizontal), 0..1. */
  posPct: number;
  /** Start of the accent along its length axis, 0..1. */
  startPct: number;
  /** Length along its axis, 0..1. */
  lenPct: number;
  /** Thickness across its axis, px. */
  thicknessPx: number;
  /** Taper the bar's ends to soft points (bars only). */
  taper?: boolean;
  /** Which `accent-NN` pen layer a bar plots on; colour supplied separately. */
  layerIndex?: number;
}

/** The export layer name for accent index i (zero-padded so layers sort). */
export function accentLayerName(i: number): string {
  return `accent-${String(i).padStart(2, '0')}`;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The canvas-px rectangle an accent covers within the usable page. */
function accentRect(a: AccentSpec, margin: number, width: number, height: number): Rect {
  const x0 = margin;
  const y0 = margin;
  const uw = Math.max(0, width - 2 * margin);
  const uh = Math.max(0, height - 2 * margin);
  const half = a.thicknessPx / 2;
  if (a.orientation === 'vertical') {
    const cx = x0 + a.posPct * uw;
    return {
      x0: cx - half,
      x1: cx + half,
      y0: y0 + a.startPct * uh,
      y1: y0 + (a.startPct + a.lenPct) * uh,
    };
  }
  const cy = y0 + a.posPct * uh;
  return {
    x0: x0 + a.startPct * uw,
    x1: x0 + (a.startPct + a.lenPct) * uw,
    y0: cy - half,
    y1: cy + half,
  };
}

function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

/** Total length of a polyline, px. */
function polylineLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

/** Fill a bar accent with repeated parallel pen passes along its long axis. */
function buildAccentBar(rect: Rect, penWidthPx: number, taper: boolean, layer: string): FlowLine[] {
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  if (w <= 0 || h <= 0) return [];
  const vertical = h >= w; // strokes run along the longer axis
  const thickness = vertical ? w : h;
  const length = vertical ? h : w;
  // Pass spacing slightly under the pen width so neighbouring passes overlap
  // into a solid — bold = repeated offset passes, never a wide stroke.
  const step = Math.max(0.5, penWidthPx * 0.7);
  const passes = Math.max(2, Math.ceil(thickness / step) + 1);
  const endTaper = taper ? Math.min(length * 0.15, thickness) : 0;
  const lines: FlowLine[] = [];
  for (let i = 0; i < passes; i++) {
    const cross = passes > 1 ? i / (passes - 1) : 0.5; // 0..1 across the thickness
    const cf = Math.abs(cross - 0.5) * 2; // 0 centre, 1 at either edge
    const inset = endTaper * cf;
    if (inset * 2 >= length) continue; // taper consumed the whole pass
    if (vertical) {
      const x = rect.x0 + cross * thickness;
      lines.push({ points: [{ x, y: rect.y0 + inset }, { x, y: rect.y1 - inset }], layer, pen: 'bold' });
    } else {
      const y = rect.y0 + cross * thickness;
      lines.push({ points: [{ x: rect.x0 + inset, y }, { x: rect.x1 - inset, y }], layer, pen: 'bold' });
    }
  }
  return lines;
}

export function generateColorField(options: ColorFieldOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    angleDeg = 0,
    lineLengthPct = 1,
    spacingPx = 8,
    inkCount = 4,
    gradientMode = 'linear',
    gradientAngleDeg = 0,
    focalXPct = 0.5,
    focalYPct = 0.5,
    gradientRadiusPct = 0.7,
    blend = 1.3,
    gradientNoiseAmpPx = 0,
    gradientNoiseScale = 0.004,
    ditherScale = 0.04,
    fill = 1,
    overprint = false,
    crossHatch = 1,
    inkAngleSpreadDeg = 0,
    jitterPx = 0,
    wobbleAmpPx = 0,
    wobbleWavelengthPx = 120,
    minSegmentLengthPx = 0,
    accents = [],
    penWidthPx = 1.2,
    maskShapes,
    seed = Math.floor(Math.random() * 1000000),
  } = options;

  const noise = createNoise(seed);
  const inks = Math.max(1, Math.round(inkCount));
  const spacing = Math.max(0.5, spacingPx);
  const fillClamped = Math.max(0, Math.min(1, fill));

  const cx = width / 2;
  const cy = height / 2;

  const usableW = Math.max(0, width - 2 * margin);
  const usableH = Math.max(0, height - 2 * margin);

  const minX = margin;
  const minY = margin;
  const maxX = width - margin;
  const maxY = height - margin;
  const inBounds = (x: number, y: number): boolean => x >= minX && x <= maxX && y >= minY && y <= maxY;

  // --- gradient coordinate: position → t in [0,1] along the palette ---
  const gRad = (gradientAngleDeg * Math.PI) / 180;
  const gx = Math.sin(gRad);
  const gy = Math.cos(gRad);
  const halfSpan = 0.5 * (Math.abs(gx) * usableW + Math.abs(gy) * usableH) || 1;
  const fx = margin + focalXPct * usableW;
  const fy = margin + focalYPct * usableH;
  const radius = Math.max(1, gradientRadiusPct * Math.max(usableW, usableH) * 0.5 * 1.41);
  const gradientT = (x: number, y: number): number => {
    const warp = gradientNoiseAmpPx > 0 ? gradientNoiseAmpPx * noise.noise2D(x * gradientNoiseScale, y * gradientNoiseScale) : 0;
    let t: number;
    if (gradientMode === 'radial') {
      const d = Math.hypot(x - fx, y - fy) + warp;
      t = d / radius;
    } else {
      const proj = (x - cx) * gx + (y - cy) * gy + warp;
      t = 0.5 + proj / (2 * halfSpan);
    }
    return t < 0 ? 0 : t > 1 ? 1 : t;
  };

  // Ink k is centred at t = k/(inks-1); its weight bump overlaps its neighbours
  // so adjacent inks coexist and mix. Wider `blend` → more colours at once.
  const bumpHalfWidth = inks > 1 ? (blend * 1) / (inks - 1) : 1;
  const weightK = (t: number, k: number): number => {
    const tk = inks > 1 ? k / (inks - 1) : 0.5;
    const w = 1 - Math.abs(t - tk) / bumpHalfWidth;
    return w < 0 ? 0 : w > 1 ? 1 : w;
  };

  const lines: FlowLine[] = [];

  // Geometric accents: gaps become exclusion rects; bars are inked separately.
  const gapRects: Rect[] = [];
  const barLines: FlowLine[] = [];
  for (const a of accents) {
    const rect = accentRect(a, margin, width, height);
    if (a.type === 'gap') gapRects.push(rect);
    else barLines.push(...buildAccentBar(rect, penWidthPx, a.taper ?? false, accentLayerName(a.layerIndex ?? 0)));
  }
  const inAnyGap = (x: number, y: number): boolean => {
    for (const r of gapRects) if (inRect(r, x, y)) return true;
    return false;
  };

  if (usableW <= 0 || usableH <= 0) {
    return { lines: barLines, width, height, seed };
  }

  // Coverage dither stretched along the line; overprint co-dominance threshold.
  // Both are independent of the pass direction.
  const overprintMin = 0.3;

  // Emit one directional grating. `onlyInk == null` draws every ink (colour
  // chosen per stroke by the local weights); a number draws just that ink where
  // it is the local pick — used when each colour is fanned to its own angle.
  // `phase` offsets the noise so stacked/crossing passes don't coincide.
  const emitPass = (passAngleDeg: number, onlyInk: number | null, phase: number): void => {
    const rad = (passAngleDeg * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = Math.cos(rad);
    const px = Math.cos(rad);
    const py = -Math.sin(rad);
    const halfA =
      0.5 * Math.max(0, Math.min(1, lineLengthPct)) * (Math.abs(dx) * usableW + Math.abs(dy) * usableH);
    const halfP = 0.5 * (Math.abs(px) * usableW + Math.abs(py) * usableH);
    if (halfA <= 0 || halfP <= 0) return;
    const step = Math.max(2, Math.min(8, halfA / 12));
    const alongScale = ditherScale * 0.3;
    const firstB = -Math.ceil(halfP / spacing) * spacing;
    const kFrom = onlyInk == null ? 0 : onlyInk;
    const kTo = onlyInk == null ? inks - 1 : onlyInk;

    for (let b = firstB; b <= halfP + 1e-6; b += spacing) {
      const pointAt = (a: number): Point => {
        const wob =
          wobbleAmpPx > 0 ? wobbleAmpPx * noise.fbm(a / wobbleWavelengthPx, b * 0.013 + 1.7 + phase, 2, 0.5, 2.2) : 0;
        const jit = jitterPx > 0 ? jitterPx * noise.noise2D(a * 0.5, b * 0.5 + phase) : 0;
        const perp = b + wob + jit;
        return { x: cx + dx * a + px * perp, y: cy + dy * a + py * perp };
      };
      const drawableAt = (a: number): boolean => {
        const p = pointAt(a);
        return inBounds(p.x, p.y) && pointInMask(maskShapes, p.x, p.y) && !inAnyGap(p.x, p.y);
      };
      // Coverage: keep the sample when the dither (per-line staggered by `b*0.5`)
      // falls under `fill`. fill=1 → solid lines.
      const coveredAt = (a: number): boolean =>
        fillClamped >= 1 || 0.5 * (noise.noise2D(b * ditherScale + phase, a * alongScale + b * 0.5) + 1) < fillClamped;
      // Colour-pick value: decorrelated across neighbours (mixing) and coherent
      // along the line; scale follows `ditherScale` (the mix-grain control).
      const colNoiseAt = (a: number): number =>
        0.5 * (noise.noise2D(b * ditherScale * 1.8 + 17 + phase, a * ditherScale * 0.27) + 1);
      // Which inks ink this sample: the weighted-pick colour, plus (overprint)
      // any co-dominant ink so they stack and the multiply render blends them.
      const drawsHere = (k: number, a: number): boolean => {
        const p = pointAt(a);
        const t = gradientT(p.x, p.y);
        let sum = 0;
        for (let j = 0; j < inks; j++) sum += weightK(t, j);
        if (sum <= 0) return false;
        if (overprint && weightK(t, k) / sum >= overprintMin) return true;
        const cN = colNoiseAt(a);
        let cum = 0;
        let pick = inks - 1;
        for (let j = 0; j < inks; j++) {
          cum += weightK(t, j) / sum;
          if (cN < cum) {
            pick = j;
            break;
          }
        }
        return k === pick;
      };

      for (let k = kFrom; k <= kTo; k++) {
        // One predicate so every transition — geometry, coverage, or colour
        // change — is bisection-refined to its boundary, not the coarse step grid.
        const passesA = (a: number): boolean => drawableAt(a) && coveredAt(a) && drawsHere(k, a);
        const crossing = (aIn: number, aOut: number): Point => {
          let lo = aIn;
          let hi = aOut;
          for (let i = 0; i < 14; i++) {
            const mid = (lo + hi) / 2;
            if (passesA(mid)) lo = mid;
            else hi = mid;
          }
          return pointAt(lo);
        };

        let run: Point[] = [];
        const flush = (): void => {
          if (run.length >= 2 && polylineLength(run) >= minSegmentLengthPx) {
            lines.push({ points: run, layer: bandLayerName(k), pen: 'fine' });
          }
          run = [];
        };

        let prevA: number | null = null;
        let prevPass = false;
        for (let a = -halfA; a <= halfA + 1e-6; a += step) {
          const pass = passesA(a);
          if (pass) {
            if (!prevPass && prevA !== null) run.push(crossing(a, prevA));
            run.push(pointAt(a));
          } else if (prevPass && prevA !== null) {
            run.push(crossing(prevA, a));
            flush();
          }
          prevA = a;
          prevPass = pass;
        }
        flush();
      }
    }
  };

  // Build the passes: `crossHatch` directions evenly spaced by 180/dirs; when
  // `inkAngleSpreadDeg` > 0 each colour is fanned to its own angle so the
  // different inks physically cross and overlap.
  const dirs = Math.max(1, Math.round(crossHatch));
  const dirSpread = 180 / dirs;
  let passIndex = 0;
  for (let d = 0; d < dirs; d++) {
    const baseAngle = angleDeg + d * dirSpread;
    if (inkAngleSpreadDeg <= 0 || inks < 2) {
      emitPass(baseAngle, null, passIndex++ * 1000);
    } else {
      for (let k = 0; k < inks; k++) {
        const fan = (k / (inks - 1) - 0.5) * inkAngleSpreadDeg;
        emitPass(baseAngle + fan, k, passIndex++ * 1000);
      }
    }
  }

  lines.push(...barLines);
  return { lines, width, height, seed };
}
