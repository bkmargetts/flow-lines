import type { MaskShape, OverlappedLinesOptions, PageMetrics, Point } from '@flow-lines/core';
import { buildPaletteLayerColors } from '../../lib/palette';

/**
 * The generative grating settings, shared by the standalone Noise Texture
 * project and the background-texture module. Project-only extras (pen width,
 * the drawn-line band path + draw mode) live on the project's own state.
 */
export type GratingMaskMode = 'none' | 'strips' | 'band' | 'rect' | 'ellipse' | 'blob';

export interface GratingParams {
  angleDeg: number;
  lineLengthPct: number;
  spacingMm: number;
  palette: string;
  customRamp: string[];
  colorCount: number;
  phaseDriftAlongMm: number;
  phaseDriftAcrossMm: number;
  phaseNoiseAmpMm: number;
  phaseNoiseScale: number;
  jitterMm: number;
  wobbleAmpMm: number;
  wobbleWavelengthMm: number;
  edgeSmoothMm: number;
  seed: number;
  maskMode: GratingMaskMode;
  stripAngleDeg: number;
  stripWidthMm: number;
  stripGapMm: number;
  bandWidthMm: number;
  /** The drawn band centreline, in canvas px (for the 'band' mask). */
  maskPath: Point[];
  /** Whether dragging the canvas appends to the band path (`maskPath`). */
  drawMode: boolean;
  maskWidthPct: number;
  maskHeightPct: number;
  /** Boundary irregularity for the 'blob' mask, 0..1. */
  maskIrregularity: number;
}

export const defaultGratingParams: GratingParams = {
  angleDeg: 0,
  lineLengthPct: 1,
  spacingMm: 2,
  palette: 'riso',
  customRamp: ['#111111', '#e2231a'],
  colorCount: 2,
  phaseDriftAlongMm: 0,
  phaseDriftAcrossMm: 1.5,
  phaseNoiseAmpMm: 0.6,
  phaseNoiseScale: 0.01,
  jitterMm: 0.1,
  wobbleAmpMm: 0,
  wobbleWavelengthMm: 30,
  edgeSmoothMm: 0,
  seed: 1,
  maskMode: 'none',
  stripAngleDeg: 45,
  stripWidthMm: 12,
  stripGapMm: 12,
  bandWidthMm: 15,
  maskPath: [],
  drawMode: false,
  maskWidthPct: 0.6,
  maskHeightPct: 0.6,
  maskIrregularity: 0.35,
};

/** Roll a fresh grating — spacing, angle, drift, noise and hand qualities all
 *  land inside their slider ranges, biased off the extremes. The palette/ink
 *  prefs and the entire mask block are left alone (the 'band' mask needs a
 *  user-drawn path, so rolling maskMode could blank the layer). Serves both
 *  the Noise Texture project and the grating background texture. Exported for
 *  the genome test. */
export function randomGratingGenome(rng: () => number): Partial<GratingParams> {
  return {
    spacingMm: Number((1 + 0.1 * Math.floor(rng() * 41)).toFixed(1)),
    angleDeg: 5 * Math.floor(rng() * 37),
    lineLengthPct: (50 + 5 * Math.floor(rng() * 11)) / 100,
    phaseDriftAcrossMm: Number((0.1 * Math.floor(rng() * 41)).toFixed(1)),
    phaseDriftAlongMm: Number((0.1 * Math.floor(rng() * 31)).toFixed(1)),
    phaseNoiseAmpMm: Number((0.1 * Math.floor(rng() * 26)).toFixed(1)),
    phaseNoiseScale: Number((0.002 + 0.001 * Math.floor(rng() * 29)).toFixed(3)),
    edgeSmoothMm: rng() < 0.6 ? 0 : 5 + Math.floor(rng() * 21),
    jitterMm: Number((0.05 * Math.floor(rng() * 11)).toFixed(2)),
    wobbleAmpMm: Number((0.1 * Math.floor(rng() * 16)).toFixed(1)),
  };
}

/**
 * Parametric clip shapes (strips / rect / ellipse) in canvas px. The drawn-line
 * 'band' mask needs a user-drawn path, so the caller supplies that separately.
 */
export function parametricMaskShapes(
  p: GratingParams,
  page: PageMetrics,
  marginPx: number
): MaskShape[] | undefined {
  const ppm = page.pxPerMm;
  switch (p.maskMode) {
    case 'strips':
      return [
        {
          type: 'strips',
          angleDeg: p.stripAngleDeg,
          widthPx: Math.max(0.5, p.stripWidthMm * ppm),
          gapPx: Math.max(0, p.stripGapMm * ppm),
        },
      ];
    case 'rect':
    case 'ellipse':
    case 'blob': {
      const w = (page.widthPx - 2 * marginPx) * p.maskWidthPct;
      const h = (page.heightPx - 2 * marginPx) * p.maskHeightPct;
      const cx = page.widthPx / 2;
      const cy = page.heightPx / 2;
      if (p.maskMode === 'blob') {
        // Shape seed = pattern seed: the same seed reproduces the same
        // drawing, boundary included, matching the SeedControl's promise.
        return [
          {
            type: 'blob',
            cx,
            cy,
            rx: w / 2,
            ry: h / 2,
            irregularity: p.maskIrregularity,
            seed: p.seed,
          },
        ];
      }
      return p.maskMode === 'rect'
        ? [{ type: 'rect', x: cx - w / 2, y: cy - h / 2, w, h }]
        : [{ type: 'ellipse', cx, cy, rx: w / 2, ry: h / 2 }];
    }
    default:
      return undefined;
  }
}

/** All clip shapes for the grating — parametric strips/rect/ellipse plus the
 * drawn-line band (from `maskPath`). */
export function gratingMaskShapes(
  p: GratingParams,
  page: PageMetrics,
  marginPx: number
): MaskShape[] | undefined {
  const shapes = parametricMaskShapes(p, page, marginPx) ?? [];
  if (p.maskMode === 'band' && p.maskPath.length >= 1) {
    shapes.push({ type: 'band', path: p.maskPath, halfWidthPx: p.bandWidthMm * page.pxPerMm });
  }
  return shapes.length > 0 ? shapes : undefined;
}

/** Map grating params to core options (masks built from the params). */
export function gratingToOverlapOptions(
  p: GratingParams,
  page: PageMetrics,
  marginPx: number
): OverlappedLinesOptions {
  const ppm = page.pxPerMm;
  const maskShapes = gratingMaskShapes(p, page, marginPx);
  return {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    angleDeg: p.angleDeg,
    lineLengthPct: p.lineLengthPct,
    spacingPx: p.spacingMm * ppm,
    colorCount: p.colorCount,
    phaseDriftAlongPx: p.phaseDriftAlongMm * ppm,
    phaseDriftAcrossPx: p.phaseDriftAcrossMm * ppm,
    phaseNoiseAmpPx: p.phaseNoiseAmpMm * ppm,
    phaseNoiseScale: p.phaseNoiseScale,
    jitterPx: p.jitterMm * ppm,
    wobbleAmpPx: p.wobbleAmpMm * ppm,
    wobbleWavelengthPx: p.wobbleWavelengthMm * ppm,
    edgeSmoothPx: p.edgeSmoothMm * ppm,
    maskShapes,
    seed: p.seed,
  };
}

/** `band-NN` colours for the standalone project's drawing layers. */
export function gratingBandColors(p: GratingParams): Record<string, string> {
  return buildPaletteLayerColors(p.palette, p.colorCount, p.customRamp);
}

/** `texture-NN` colours for the background-texture module's pen layers. */
export function gratingTextureColors(p: GratingParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(gratingBandColors(p))) {
    out[k.replace('band-', 'texture-')] = v;
  }
  return out;
}
