import { FlowLinesResult } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { optimizePlot } from '../optimize.js';
import { randomSeed, subSeed } from '../lib/rng.js';
import { clamp } from '../lib/math.js';
import { TUNING_DIM } from '../lapidary/layout.js';
import { fillRegion } from '../lapidary/textures.js';
import { carveRegions, PenAssignment } from '../lapidary/carve.js';
import { buildSheetTone, LapidarySheetTone } from '../lapidary/tone.js';
import { buildTerraceRegions, TerracesLayout } from './layout.js';

import type {
  BandTexture,
  LapidaryTexture,
  LapidaryToneShape,
} from '../lapidary/layout.js';

/**
 * Terraces — a geological cross-section drawn as stacked strata beds: the
 * sheet partitioned into horizontal beds, each filled with its own line
 * texture and separated by reserved-paper seams, with fault planes throwing
 * every bed boundary sideways so the whole stack shears — the beds pinch and
 * converge against the scarp, and the fortification-agate contour lamination
 * (the default texture deal) bends with them.
 *
 * Extracted from lapidary's `strata` mode to grow independently; the texture
 * fills, tone, and pen carve are shared with lapidary, the bed/fault geometry
 * is its own (`terraceCurves`). Beyond the strata inheritance it adds
 * dedicated fault knobs — `faultThrow` (displacement scale) and `faultIncline`
 * (committed plane tilt) — `steppiness`, which blends the bed boundaries
 * toward piecewise-flat terrace treads, and `continuous`, which swaps the
 * hand-fed dashing for unbroken flowing lines (sheet-wide, dealt per bed
 * with 'mixed', or pinned per bed in `textures`).
 *
 * Ink: strokes are tagged `ink-<group>` (`inkLayerName`) across 1–4 pens,
 * either interleaved stroke-by-stroke within each bed or one pen per bed.
 */
export interface TerracesOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: controls bed boundaries, faults, texture deal, angles, interleave */
  seed?: number;
  /**
   * Reference min dimension in px — clamps the dimension feature sizes
   * (seam width, line pitch, wobble, detail sampling) derive from, so the
   * pattern keeps its tuned physical scale on sheets larger than the tuning
   * anchor. Same contract as lapidary's / marbling's.
   */
  refMinDim?: number;

  // ---- Beds ----
  /** Bed count, 2..10 (default 6) */
  bands?: number;
  /** Bed-boundary irregularity 0..1 (default 0.55) — organic wander
   *  amplitude, stepped-level amplitude, and the fault throw's floor. */
  irregularity?: number;
  /** Blend the bed boundaries toward piecewise-flat terrace treads, 0..1
   *  (default 0): 0 keeps the organic fBm wander, 1 commits to 2-5 flat runs
   *  per boundary with near-vertical risers, in between the treads wobble. */
  steppiness?: number;

  // ---- Faults ----
  /** Fault planes thrown across the stack, 0..6 (default 2). Every bed
   *  boundary shifts by the fault's displacement on one side of the fault
   *  line — the near-vertical scarp walking through the beds is the
   *  geological tell. */
  faults?: number;
  /** Multiplier on each fault's seeded displacement, 0..2 (default 1).
   *  0 keeps the fault planes but flattens their throw to nothing. */
  faultThrow?: number;
  /** Signed fault-plane tilt, -1..1 (default 0): 0 keeps lapidary's whisper
   *  of seeded tilt jitter; toward ±1 the planes commit to leaning that way
   *  and the jitter quenches. */
  faultIncline?: number;

  // ---- Seams ----
  /** Reserved-paper seam width between beds in px (default sizingDim/110) */
  haloPx?: number;
  /** Ink each bed silhouette as a stroke (default false — the seam itself
   *  does the work). Outlines draw as bold, broken, slightly smoothed
   *  dashes. The top and bottom beds' page-edge sides are never outlined. */
  outlines?: boolean;
  /** How many trimmed offset passes of the single pen each outline dash is
   *  built from, 1..3 (default 2). */
  outlineEmphasis?: number;

  // ---- Textures ----
  /** Explicit top→bottom bed textures, cycled if shorter than `bands`.
   *  Omitted = the fortification deal (`TERRACES_DEFAULT_TEXTURES`); an
   *  empty array = the seeded deal that opens with 'lines' and never
   *  repeats a kind on adjacent beds. */
  textures?: Array<LapidaryTexture | BandTexture>;
  /** Base stroke direction in degrees (default 90 — ruled strokes standing
   *  perpendicular to the beds) */
  baseAngleDeg?: number;
  /** Seeded per-bed drift off the base angle in degrees (default 12);
   *  the top bed never drifts */
  angleDriftDeg?: number;
  /** Base line pitch in px (default sizingDim/150) */
  spacingPx?: number;
  /** 0..1 spread between dense and sparse beds (default 0.6) */
  densityContrast?: number;
  /** Line undulation 0..1 (default 0.5): wavy-texture amplitude, how far
   *  contour laminae drift off the bed walls they echo, and how hard grain
   *  dashes bend off the bed angle */
  waviness?: number;
  /** Patchy/cross hole amount and mottle weave amount, 0..1 (default 0.55) */
  patchiness?: number;
  /** Stroke end-taper amount 0..1 (default 0.7): seeded trims at both ends
   *  of every mark plus occasional mid-stroke pen lifts. Per bed via
   *  `BandTexture.taper`. */
  taper?: number;
  /** Draw the beds' marks as continuous flowing lines (default false): the
   *  hand-fed dashing — ruled rows broken into dashes, contour laminae
   *  broken into dashed arcs — and the taper mid-stroke pen lifts are all
   *  suppressed, so each row or lamina plots as one unbroken stroke
   *  (`taper` still trims the ends). 'mixed' deals each bed its own seeded
   *  coin, so some beds flow unbroken while their neighbours stay dashed.
   *  Per bed via `BandTexture.continuous` in `textures`, which beats both
   *  the sheet-wide flag and the mixed deal. */
  continuous?: boolean | 'mixed';
  /** Per-stroke rotation jitter in degrees, 0..3 (default 1.5); ruled
   *  'lines' beds are exempt. Per bed via `BandTexture.jitterDeg`. */
  jitterDeg?: number;
  /** Within-bed tone shape (default 'seam' — rows tighten against the bed
   *  walls, the fortification look's densified band walls). See lapidary's
   *  `LapidaryToneShape`. */
  toneShape?: LapidaryToneShape;
  /** Tone strength 0..1 (default 0.35); per bed via `BandTexture.tone`. */
  toneStrength?: number;
  /** Direction the light comes from in degrees, shared by the 'light' tone
   *  shape and `sheetTone: 'light'` (default -120 — upper left). */
  lightAngleDeg?: number;
  /** Sheet-wide lighting layered over every bed's own tone (default
   *  'none'): 'light' runs one planar ramp along `lightAngleDeg`;
   *  'vignette' holds the page centre light and darkens toward the rim. */
  sheetTone?: LapidarySheetTone;
  /** Sheet tone strength 0..1 (default 0.35); inert while 'none'. */
  sheetToneStrength?: number;

  // ---- Pens ----
  /** Pen count 1..4 (default 1) — strokes are tagged ink-0..ink-3 */
  pens?: number;
  /** 'interleave' alternates pens stroke-by-stroke within each bed;
   *  'per-region' gives each bed one pen (default 'interleave') */
  penAssignment?: PenAssignment;

  // ---- Finish ----
  /** Hand-drawn wobble amplitude in px (default sizingDim/500); capped so
   *  it can never bend ink into a seam */
  wobble?: number;
  /** Chain strokes and order them to cut pen travel (default true) */
  optimize?: boolean;
}

/**
 * The default texture deal: the fortification-agate sequence adapted for
 * strata beds — ruled fields alternating with dashed contour lamination
 * (onion-skin loops that follow the bed walls and bend across every fault)
 * and one stippled bed. Angles ride `baseAngleDeg` + drift, so the angle
 * knob steers the whole sheet.
 */
export const TERRACES_DEFAULT_TEXTURES: Array<LapidaryTexture | BandTexture> = [
  { kind: 'lines', spacingScale: 1.2 },
  { kind: 'contour', spacingScale: 1 },
  { kind: 'contour', spacingScale: 0.7 },
  { kind: 'lines', spacingScale: 1.4 },
  { kind: 'contour', spacingScale: 0.9 },
  { kind: 'stipple', spacingScale: 1.1 },
];

/**
 * Curated looks. `terraces` is the reference: the defaults themselves —
 * fortification lamination over two faults. Spread presets over
 * `generateTerraces`'s options.
 */
export const TERRACES_PRESETS: Record<string, Partial<TerracesOptions>> = {
  terraces: {},
  benches: {
    steppiness: 0.85,
    faults: 1,
    faultIncline: 0.3,
  },
  rift: {
    faults: 4,
    faultThrow: 1.6,
    faultIncline: 0.5,
    bands: 7,
  },
  shale: {
    textures: [],
    bands: 8,
    faults: 0,
    angleDriftDeg: 20,
  },
};

/** Render a terraces sheet as plottable per-pen strokes. */
export function generateTerraces(options: TerracesOptions): FlowLinesResult {
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
  const featureScale = sizingDim / TUNING_DIM;

  const layout: TerracesLayout = {
    seed,
    rect: { x0, y0, x1, y1 },
    bands: clamp(Math.round(options.bands ?? 6), 2, 10),
    irregularity: clamp(options.irregularity ?? 0.55, 0, 1),
    steppiness: clamp(options.steppiness ?? 0, 0, 1),
    faults: clamp(Math.round(options.faults ?? 2), 0, 6),
    faultThrow: clamp(options.faultThrow ?? 1, 0, 2),
    faultIncline: clamp(options.faultIncline ?? 0, -1, 1),
    haloPx,
    spacingPx,
    textures: options.textures ?? TERRACES_DEFAULT_TEXTURES,
    baseAngleDeg: options.baseAngleDeg ?? 90,
    angleDriftDeg: options.angleDriftDeg ?? 12,
    densityContrast: clamp(options.densityContrast ?? 0.6, 0, 1),
    waviness: clamp(options.waviness ?? 0.5, 0, 1),
    patchiness: clamp(options.patchiness ?? 0.55, 0, 1),
    taper: clamp(options.taper ?? 0.7, 0, 1),
    continuous: options.continuous ?? false,
    jitterDeg: clamp(options.jitterDeg ?? 1.5, 0, 3),
    toneShape: options.toneShape ?? 'seam',
    toneStrength: clamp(options.toneStrength ?? 0.35, 0, 1),
    lightAngleDeg: options.lightAngleDeg ?? -120,
    featureScale,
  };

  const pens = clamp(Math.round(options.pens ?? 1), 1, 4);
  const regions = buildTerraceRegions(layout);
  // The sheet-wide lighting layer: one page-space darkness offset added to
  // every bed's own tone (null = off, the byte-identical default path).
  const sheetTone = buildSheetTone({
    shape: options.sheetTone ?? 'none',
    strength: clamp(options.sheetToneStrength ?? 0.35, 0, 1),
    angleRad: (layout.lightAngleDeg * Math.PI) / 180,
    rect: layout.rect,
    focusX: x0 + innerW / 2,
    focusY: y0 + innerH / 2,
  });
  const { lines, groups } = carveRegions(regions, (r) => fillRegion(r, sheetTone), {
    width,
    height,
    haloPx,
    seed,
    pens,
    penAssignment: options.penAssignment ?? 'interleave',
    outlines: options.outlines ?? false,
    outlineEmphasis: clamp(Math.round(options.outlineEmphasis ?? 2), 1, 3),
    // The bed polygons carry their seam gaps geometrically — no mask carve.
    geometricGaps: true,
    featureScale,
  });

  let result: FlowLinesResult = { lines, width, height, seed };

  const wobble = options.wobble ?? sizingDim / 500;
  if (wobble > 0) {
    // One hand pass per texture class instead of one flat pass for the whole
    // sheet (lapidary's idiom): a 1px stipple tick must not be bent by the
    // same 70px wave as a page-long ruled line. Amplitudes are relative to
    // the wobble option; every class keeps the inviolable seam cap, and each
    // gets its own decorrelated seed stream (520+k).
    const CLASSES: Array<{ kinds: string[]; amp: number; wl: number }> = [
      { kinds: ['lines', 'hatch', 'patchy', 'cross'], amp: 1, wl: 70 }, // the datum
      { kinds: ['contour', 'wavy'], amp: 0.8, wl: 95 }, // long calm undulation
      { kinds: ['stipple'], amp: 0.3, wl: 24 },
      { kinds: ['grain', 'crystal'], amp: 0.6, wl: 40 },
      { kinds: ['mottle'], amp: 1, wl: 70 }, // the weave expects the sheet datum
      { kinds: ['solid'], amp: 0.25, wl: 70 }, // calm, or paper opens between rows
    ];
    const classIndex = new Map<string, number>();
    CLASSES.forEach((c, k) => c.kinds.forEach((kind) => classIndex.set(kind, k)));
    const byClass = new Map<number, number[]>();
    for (const g of groups) {
      const k = classIndex.get(g.kind as string);
      if (k === undefined) continue;
      const idxs = byClass.get(k) ?? [];
      for (let i = g.start; i < g.end; i++) idxs.push(i);
      byClass.set(k, idxs);
    }
    for (let k = 0; k < CLASSES.length; k++) {
      const idxs = byClass.get(k);
      if (!idxs || idxs.length === 0) continue;
      const styled = applyHandDrawnStyle(
        { lines: idxs.map((i) => lines[i]), width, height, seed },
        {
          amplitude: wobble * CLASSES[k].amp,
          wavelength: Math.max(8, CLASSES[k].wl * featureScale),
          seed: subSeed(seed, 520 + k),
          // The seams are reserved paper carved before the hand pass; the
          // wobble tail must never bend surviving ink back into them.
          maxDisplacement: haloPx * 0.35,
        }
      );
      idxs.forEach((i, j) => {
        lines[i] = styled.lines[j];
      });
    }
    result = { lines, width, height, seed };
  }

  if (optimize) {
    // Chain within pens, but never far enough to bridge a seam.
    result = optimizePlot(result, { mergeTolerance: Math.min(1.5, haloPx * 0.4) });
  }

  return result;
}
