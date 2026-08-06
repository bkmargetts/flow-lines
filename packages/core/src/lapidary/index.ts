import { FlowLinesResult } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { optimizePlot } from '../optimize.js';
import { randomSeed, subSeed } from '../lib/rng.js';
import { clamp } from '../lib/math.js';
import { buildRegions, LayoutConfig } from './layout.js';
import { fillRegion } from './textures.js';
import { carveRegions, PenAssignment } from './carve.js';

export type { LapidaryMode, LapidaryTexture, BandTexture } from './layout.js';
export type { PenAssignment } from './carve.js';
import type { LapidaryMode, LapidaryTexture, BandTexture } from './layout.js';

/**
 * Lapidary — layered pattern artworks in the style of a cut and polished
 * stone cross-section: organic regions, each filled with its own line
 * texture (ruled lines, wavy combing, dense hatch, mottled patchy hatch,
 * shallow cross-hatch, stipple, or held paper), separated by clean
 * reserved-paper seams the way stacked stencil layers hold off one another.
 *
 * Three arrangements: `agate` nests concentric blob bands around a centre
 * (the reference piece), `breccia` scatters overlapping fragments over the
 * field, `strata` splits the sheet into noisy horizontal beds.
 *
 * Ink: strokes are tagged `ink-<group>` (`inkLayerName`) across 1–4 pens,
 * either interleaved stroke-by-stroke within each region (the hand-fed
 * two-pen alternation of the reference) or one pen per region.
 */
export interface LapidaryOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: controls silhouettes, texture deal, angles, interleave */
  seed?: number;
  /**
   * Reference min dimension in px — clamps the dimension feature sizes
   * (seam width, line pitch, wobble) derive from, so the pattern keeps its
   * tuned physical scale on sheets larger than the tuning anchor. Same
   * contract as marbling's / fracture's.
   */
  refMinDim?: number;

  // ---- Arrangement ----
  /** Layout mode (default 'agate') */
  mode?: LapidaryMode;
  /** Region count incl. the background field: agate bands / breccia
   *  fragments+field / strata beds. 2..10 (default 5) */
  bands?: number;
  /** Silhouette irregularity 0..1 (default 0.55) */
  irregularity?: number;
  /** Outermost silhouette size as a fraction of the frame, 0.4..1 (default 0.9) */
  coverage?: number;
  /** Composition centre offset as a fraction of the half-extents, -0.5..0.5 */
  centerX?: number;
  centerY?: number;

  // ---- Seams ----
  /** Reserved-paper seam width between regions in px (default sizingDim/110) */
  haloPx?: number;
  /** Ink each region silhouette as a stroke (default false — in the
   *  reference the seam itself does the work) */
  outlines?: boolean;

  // ---- Textures ----
  /** Explicit outer→inner band textures, cycled if shorter than `bands`.
   *  Omitted = seeded deal that opens with 'lines' and never repeats a
   *  kind on adjacent bands. */
  textures?: Array<LapidaryTexture | BandTexture>;
  /** Base stroke direction in degrees (default 90 — the reference's ruled
   *  vertical field) */
  baseAngleDeg?: number;
  /** Seeded per-band drift off the base angle in degrees (default 25);
   *  the background band never drifts */
  angleDriftDeg?: number;
  /** Base line pitch in px (default sizingDim/150) */
  spacingPx?: number;
  /** 0..1 spread between dense and sparse bands (default 0.6) */
  densityContrast?: number;
  /** Wavy-texture amplitude 0..1 (default 0.5) */
  waviness?: number;
  /** Patchy/cross hole amount 0..1 (default 0.55) */
  patchiness?: number;

  // ---- Pens ----
  /** Pen count 1..4 (default 1) — strokes are tagged ink-0..ink-3 */
  pens?: number;
  /** 'interleave' alternates pens stroke-by-stroke within each region (the
   *  reference look); 'per-region' gives each region one pen (default
   *  'interleave') */
  penAssignment?: PenAssignment;

  // ---- Finish ----
  /** Hand-drawn wobble amplitude in px (default sizingDim/500); capped so
   *  it can never bend ink into a seam */
  wobble?: number;
  /** Chain strokes and order them to cut pen travel (default true) */
  optimize?: boolean;
}

/**
 * Curated looks. `specimen` is the reference artwork: ruled vertical field →
 * wavy ring → dense mottled ring → sparse angled hatch → open core, two pens
 * interleaved. Spread presets over `generateLapidary`'s options.
 */
export const LAPIDARY_PRESETS: Record<string, Partial<LapidaryOptions>> = {
  specimen: {
    mode: 'agate',
    bands: 5,
    pens: 2,
    textures: [
      { kind: 'lines', spacingScale: 1.1 },
      { kind: 'wavy', angleDeg: 90, spacingScale: 0.75, waviness: 0.9 },
      { kind: 'patchy', spacingScale: 0.5 },
      { kind: 'hatch', angleDeg: 125, spacingScale: 1.4 },
      { kind: 'lines', angleDeg: 90, spacingScale: 1.3 },
    ],
  },
  geode: {
    mode: 'agate',
    bands: 7,
    pens: 3,
    coverage: 0.95,
    textures: ['lines', 'cross', 'stipple', 'hatch', 'blank', 'patchy', 'lines'],
  },
  breccia: {
    mode: 'breccia',
    bands: 8,
    pens: 3,
    penAssignment: 'per-region',
  },
  terraces: {
    mode: 'strata',
    bands: 6,
    pens: 2,
    baseAngleDeg: 0,
    angleDriftDeg: 14,
  },
  mono: {
    mode: 'agate',
    bands: 5,
    pens: 1,
    textures: [
      { kind: 'lines', spacingScale: 1.1 },
      { kind: 'wavy', angleDeg: 90, spacingScale: 0.75, waviness: 0.9 },
      { kind: 'patchy', spacingScale: 0.5 },
      { kind: 'hatch', angleDeg: 125, spacingScale: 1.4 },
      { kind: 'lines', angleDeg: 90, spacingScale: 1.3 },
    ],
  },
};

/** Render a lapidary sheet as plottable per-pen strokes. */
export function generateLapidary(options: LapidaryOptions): FlowLinesResult {
  const { width, height, margin = 0, seed = randomSeed(), optimize = true } = options;

  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;
  const innerW = x1 - x0;
  const innerH = y1 - y0;
  if (innerW < 16 || innerH < 16) return { lines: [], width, height, seed };
  const minDim = Math.min(innerW, innerH);
  const sizingDim = Math.min(minDim, options.refMinDim ?? Infinity);

  const haloPx = Math.max(1.5, options.haloPx ?? sizingDim / 110);
  const spacingPx = Math.max(1.2, options.spacingPx ?? sizingDim / 150);

  const layout: LayoutConfig = {
    seed,
    mode: options.mode ?? 'agate',
    rect: { x0, y0, x1, y1 },
    bands: clamp(Math.round(options.bands ?? 5), 2, 10),
    irregularity: clamp(options.irregularity ?? 0.55, 0, 1),
    coverage: clamp(options.coverage ?? 0.9, 0.4, 1),
    centerX: clamp(options.centerX ?? 0, -0.5, 0.5),
    centerY: clamp(options.centerY ?? 0, -0.5, 0.5),
    haloPx,
    spacingPx,
    textures: options.textures,
    baseAngleDeg: options.baseAngleDeg ?? 90,
    angleDriftDeg: options.angleDriftDeg ?? 25,
    densityContrast: clamp(options.densityContrast ?? 0.6, 0, 1),
    waviness: clamp(options.waviness ?? 0.5, 0, 1),
    patchiness: clamp(options.patchiness ?? 0.55, 0, 1),
  };

  const { regions, geometricGaps } = buildRegions(layout);
  const lines = carveRegions(regions, fillRegion, {
    width,
    height,
    haloPx,
    seed,
    pens: clamp(Math.round(options.pens ?? 1), 1, 4),
    penAssignment: options.penAssignment ?? 'interleave',
    outlines: options.outlines ?? false,
    geometricGaps,
  });

  let result: FlowLinesResult = { lines, width, height, seed };

  const wobble = options.wobble ?? sizingDim / 500;
  if (wobble > 0) {
    result = applyHandDrawnStyle(result, {
      amplitude: wobble,
      wavelength: 70,
      seed: subSeed(seed, 501),
      // The seams are reserved paper carved before the hand pass; the wobble
      // tail must never bend surviving ink back into them.
      maxDisplacement: haloPx * 0.35,
    });
  }

  if (optimize) {
    // Chain within pens, but never far enough to bridge a seam.
    result = optimizePlot(result, { mergeTolerance: Math.min(1.5, haloPx * 0.4) });
  }

  return result;
}
