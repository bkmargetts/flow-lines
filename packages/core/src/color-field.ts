import { createNoise } from './noise.js';
import { bandLayerName, pointInMask, type MaskShape } from './overlapped-lines.js';
import type { FlowLine, FlowLinesResult, Point } from './flow-lines.js';

/**
 * Colour-field texture — dense directional lines arranged into a soft,
 * atmospheric gradient of stacked colour bands (a Rothko-style colour field).
 *
 * Unlike the interleaved grating (`overlapped-lines.ts`), which assigns colour
 * by *interleave index* and modulates an inter-colour offset, here every line
 * runs the full page and is split by *position* into `bandCount` bands stacked
 * along the cross-axis (for vertical lines: horizontal bands, top→bottom). Band
 * boundaries undulate (low-frequency noise) and feather (a noise-dithered
 * transition zone) so adjacent bands interleave into a soft gradient — the
 * organic key. Tone is carried by line density (a vertical density gradient and
 * a noise wander), never by stroke width, so the drawing stays plottable: each
 * band is a real `band-NN` pen layer, each accent an `accent-NN` layer.
 *
 * An optional set of geometric *accents* cut through the field: a `bar` (a
 * contrasting solid built from repeated pen passes — the project's bold-line
 * convention, not a wide stroke) or a `gap` (reserved clean paper the field
 * lines break around). Pure and deterministic per `seed`.
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
  /** Base gap between adjacent lines, px. */
  spacingPx?: number;
  /** Number of colour bands stacked along the cross-axis (= palette layers). */
  bandCount?: number;
  /** Peak undulation of the band boundaries, in arc-length px. */
  bandWaveAmpPx?: number;
  /** Wavelength of the boundary undulation, px. */
  bandWaveLengthPx?: number;
  /** Width of the noise-dithered transition zone straddling each boundary, px. */
  featherPx?: number;
  /** Spatial frequency of the feather dither noise (cycles per px). */
  featherNoiseScale?: number;
  /**
   * Density multiplier from top (1) to bottom: >1 adds an interleaved pass over
   * the lower part of the page so deep bands read denser/darker. Clamped to 3.
   */
  densityGradient?: number;
  /** Per-line across-position wander as a fraction of spacing, 0..1. */
  densityNoiseAmt?: number;
  /** Spatial frequency of the density wander noise (cycles per px). */
  densityNoiseScale?: number;
  /** Random per-point perpendicular shake, px. */
  jitterPx?: number;
  /** Peak low-frequency wobble of each line, px. */
  wobbleAmpPx?: number;
  /** Wobble wavelength along the line, px. */
  wobbleWavelengthPx?: number;
  /** Drop emitted polylines shorter than this, px (kills feather slivers). */
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
      lines.push({
        points: [
          { x, y: rect.y0 + inset },
          { x, y: rect.y1 - inset },
        ],
        layer,
        pen: 'bold',
      });
    } else {
      const y = rect.y0 + cross * thickness;
      lines.push({
        points: [
          { x: rect.x0 + inset, y },
          { x: rect.x1 - inset, y },
        ],
        layer,
        pen: 'bold',
      });
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
    bandCount = 4,
    bandWaveAmpPx = 0,
    bandWaveLengthPx = 240,
    featherPx = 0,
    featherNoiseScale = 0.02,
    densityGradient = 1,
    densityNoiseAmt = 0,
    densityNoiseScale = 0.01,
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
  const bands = Math.max(1, Math.round(bandCount));
  const spacing = Math.max(0.5, spacingPx);

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
  const halfA =
    0.5 * Math.max(0, Math.min(1, lineLengthPct)) * (Math.abs(dx) * usableW + Math.abs(dy) * usableH);
  const halfP = 0.5 * (Math.abs(px) * usableW + Math.abs(py) * usableH);

  const minX = margin;
  const minY = margin;
  const maxX = width - margin;
  const maxY = height - margin;
  const inBounds = (x: number, y: number): boolean => x >= minX && x <= maxX && y >= minY && y <= maxY;

  const lines: FlowLine[] = [];

  // Geometric accents: gaps become exclusion rects (field breaks around them);
  // bars are inked separately as their own pen layer.
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

  if (halfA <= 0 || halfP <= 0) {
    return { lines: barLines, width, height, seed };
  }

  // Sample finely enough that wavy / wobbling lines stay smooth.
  const step = Math.max(2, Math.min(8, halfA / 12));

  // Normalised position along the line, 0 at the top, 1 at the bottom.
  const frac01 = (a: number): number => (a + halfA) / (2 * halfA);

  // The colour band at arc-length `a` on the line through across-position `b`.
  const bandAt = (a: number, b: number): number => {
    const wave = bandWaveAmpPx > 0 ? bandWaveAmpPx * noise.noise2D(b / bandWaveLengthPx, a / bandWaveLengthPx) : 0;
    const uShift = (a + wave + halfA) / (2 * halfA);
    const fBand = uShift * bands;
    let i = Math.floor(fBand);
    const frac = fBand - Math.floor(fBand); // 0..1 within the band cell
    if (featherPx > 0 && bands > 1) {
      const cellPx = (2 * halfA) / bands;
      const featherFrac = Math.min(0.5, featherPx / cellPx);
      const distUpper = 1 - frac; // toward the next band (i+1)
      const distLower = frac; // toward the previous band (i-1)
      if (distUpper < featherFrac) {
        // P(flip) = 0.5 at the boundary, fading to 0 at the zone edge.
        const t = distUpper / featherFrac;
        if (noise.noise2D(b * featherNoiseScale, a * featherNoiseScale) > t) i += 1;
      } else if (distLower < featherFrac) {
        const t = distLower / featherFrac;
        if (noise.noise2D(b * featherNoiseScale + 31.7, a * featherNoiseScale + 13.3) > t) i -= 1;
      }
    }
    return Math.max(0, Math.min(bands - 1, i));
  };

  // Interleaved passes. The base pass covers the whole page; a density gradient
  // adds one half-spacing-offset pass over the lower part so deep bands read
  // denser. `lowerOnly` is the frac01 threshold below which a pass draws nothing.
  const grad = Math.max(1, Math.min(3, densityGradient));
  const passDefs =
    grad > 1
      ? [
          { offset: 0, lowerOnly: 0 },
          { offset: spacing / 2, lowerOnly: 1 - Math.min(1, (grad - 1) / 2) },
        ]
      : [{ offset: 0, lowerOnly: 0 }];

  for (const pd of passDefs) {
    const firstB = -Math.ceil(halfP / spacing) * spacing + pd.offset;
    for (let bRaw = firstB; bRaw <= halfP + 1e-6; bRaw += spacing) {
      // Per-line across-position wander (squeegee bunching), fixed along the line.
      const b =
        densityNoiseAmt > 0 ? bRaw + densityNoiseAmt * spacing * noise.noise2D(bRaw * densityNoiseScale, 7.3) : bRaw;

      const pointAt = (a: number): Point => {
        const wob =
          wobbleAmpPx > 0 ? wobbleAmpPx * noise.fbm(a / wobbleWavelengthPx, b * 0.013 + 1.7, 2, 0.5, 2.2) : 0;
        const jit = jitterPx > 0 ? jitterPx * noise.noise2D(a * 0.5 + b * 0.31, b * 0.5) : 0;
        const perp = b + wob + jit;
        return { x: cx + dx * a + px * perp, y: cy + dy * a + py * perp };
      };
      // A sample is drawable when on the page, inside the mask, outside every
      // gap, and (for the gradient pass) below the density threshold.
      const passesA = (a: number): boolean => {
        if (frac01(a) < pd.lowerOnly) return false;
        const p = pointAt(a);
        return inBounds(p.x, p.y) && pointInMask(maskShapes, p.x, p.y) && !inAnyGap(p.x, p.y);
      };
      // Refine an inside→outside crossing to the boundary (page / mask / gap /
      // density edge) so line ends land on it instead of the sampling step.
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
      let runBand = 0;
      const flush = (): void => {
        if (run.length >= 2 && polylineLength(run) >= minSegmentLengthPx) {
          lines.push({ points: run, layer: bandLayerName(runBand), pen: 'fine' });
        }
        run = [];
      };

      let prevA: number | null = null;
      let prevPass = false;
      for (let a = -halfA; a <= halfA + 1e-6; a += step) {
        const pass = passesA(a);
        if (pass) {
          const band = bandAt(a, b);
          const p = pointAt(a);
          if (!prevPass) {
            if (prevA !== null) run.push(crossing(a, prevA));
            runBand = band;
          } else if (band !== runBand) {
            // Band change within a continuous run: split at this point so the
            // two segments share it exactly (no seam gap or overlap).
            run.push(p);
            flush();
            runBand = band;
          }
          run.push(p);
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

  lines.push(...barLines);
  return { lines, width, height, seed };
}
