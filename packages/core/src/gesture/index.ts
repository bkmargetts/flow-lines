import { FlowLine, FlowLinesResult } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { optimizePlot } from '../optimize.js';
import { createNoise } from '../noise.js';
import { makeRandom, randomSeed, subSeed } from '../lib/rng.js';
import { clipPolylineToRect } from '../lib/polyline.js';
import { clamp01 } from '../lib/math.js';
import type { GesturePreset } from './types.js';
import { ARCHETYPES, compose, pickArchetype } from './compose.js';
import { pressureWidths, renderStroke } from './stroke.js';
import { makeDrip, makeSpatter, renderKnot, renderWhip } from './marks.js';

export type { GesturePreset } from './types.js';

/**
 * Gestural ink abstraction — non-representational compositions in the
 * Franz Kline / Hans Hartung / sumi tradition: a few large, confident
 * sweeping strokes with pressure-tapered bodies and dry-brush breakup,
 * balanced against calligraphic whips, scribble knots, and spatter.
 *
 * The piece stands on three legs, one file each:
 *  - `spine.ts`   — a stroke is one arm movement: a heading integrated with
 *                   slowly-varying single-signed curvature (arcs that
 *                   breathe, never wiggle) and an asymmetric speed bell.
 *  - `stroke.ts`  — ink is the house single-pen bold: repeated offset passes
 *                   whose *lengths* shrink toward the tips (the taper), with
 *                   dry-brush breakup fraying the ribbon's edges before its
 *                   core, hardest in the fast exit tail.
 *  - `compose.ts` — what separates art from random strokes: archetype
 *                   parameter tables (kline / sumi / hartung / tangle),
 *                   scored candidate placement (asymmetric balance with a
 *                   deliberate lean, ink-over-ink crossing bonus), a
 *                   negative-space guarantee, and a hard ink budget so
 *                   restraint is structural, not tuned.
 *
 * Strokes are tagged `layer: 'gesture' | 'secondary' | 'spatter'` for
 * per-pen export. Deterministic per seed; plain stroked paths only.
 */
export interface GestureOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px — the composition works inside it (default 32) */
  margin?: number;
  /** Seed for the whole composition */
  seed?: number;
  /** Compositional archetype (default 'auto': a seeded pick) */
  preset?: GesturePreset;
  /** Primary gesture count; 0 = let the archetype decide (default 0) */
  gestures?: number;
  /** 0..1 — stroke speed: curvature range, flick length, S-reversal chance (default 0.6) */
  energy?: number;
  /** 0..1 — how heavy the primary strokes are (default 0.55) */
  inkWeight?: number;
  /** 0..1 — dry-brush breakup amount (default 0.5) */
  dryness?: number;
  /** 0..1 — spatter quantity off fast exits (default 0.4) */
  spatter?: number;
  /** Whip count; -1 = let the archetype decide (default -1) */
  whips?: number;
  /** Scribble-knot count; -1 = let the archetype decide (default -1) */
  knots?: number;
  /** 0..1 — probability a heavy stroke belly releases a drip (default 0.15) */
  drips?: number;
  /** 0..1 — hard ink budget as a fraction of the work area (default 0.35) */
  coverage?: number;
  /** 0..1 — how far the composition leans off perfect balance (default 0.4) */
  balance?: number;
  /** 0..1 — fraction of the frame guaranteed to stay quiet paper (default 0.45) */
  negativeSpace?: number;
  /** Offset-pass pitch in px; callers feed pen width · 0.85 (default 2.4) */
  passSpacing?: number;
  /** Hand-drawn wobble amplitude in px — low: the spines are already curved (default 0.5) */
  wobble?: number;
  /**
   * Reference min dimension in px — clamps the dimension mark sizes derive
   * from (gesture/whip lengths, knot radii, bundle pitch, max stroke width)
   * so marks keep their tuned physical size on sheets larger than the tuning
   * anchor, while placement still spans the real page. Callers pass
   * 297mm × pxPerMm (the largest previously-possible short edge); unset or
   * ≥ the page's min dimension is a no-op.
   */
  refMinDim?: number;
  /**
   * Sheet-area growth factor (physical area ÷ A4 area, floored at 1 —
   * default 1). Gesture/whip/knot counts are multiplied by it after their
   * archetype draws, so a bigger sheet carries more same-sized marks instead
   * of a fit-scaled enlargement. 1 is the exact identity.
   */
  sheetFactor?: number;
  /** Chain strokes and order them to cut pen travel (default true) */
  optimize?: boolean;
}

/** Render a gestural ink composition as plottable single-pen strokes. */
export function generateGesture(options: GestureOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 32,
    seed = randomSeed(),
    preset = 'auto',
    energy: energyOpt = 0.6,
    inkWeight = 0.55,
    spatter = 0.4,
    drips = 0.15,
    coverage = 0.35,
    balance = 0.4,
    negativeSpace = 0.45,
    passSpacing = 2.4,
    wobble = 0.5,
    optimize = true,
  } = options;

  const empty = (): FlowLinesResult => ({ lines: [], width, height, seed });
  const workW = width - 2 * margin;
  const workH = height - 2 * margin;
  if (workW < 40 || workH < 40) return empty();
  const minDim = Math.min(workW, workH);
  // Mark sizes anchor at refMinDim on oversized sheets (identity wherever
  // minDim is smaller); counts grow with the sheet's area factor instead.
  const sizingDim = Math.min(minDim, options.refMinDim ?? Infinity);
  const sheetFactor = Math.max(1, options.sheetFactor ?? 1);

  const rng = makeRandom(seed);
  const noise = createNoise(seed + 4243);

  // Fixed rng draw order: archetype first, then counts (drawn even when
  // overridden, so toggling one option never reshuffles the rest).
  const archPick = rng();
  const resolved = preset === 'auto' ? pickArchetype(archPick) : preset;
  const arch = ARCHETYPES[resolved];
  const gestureDraw = rng();
  const whipDraw = rng();
  const knotDraw = rng();
  const intIn = (range: [number, number], u: number): number =>
    range[0] + Math.floor(u * (range[1] - range[0] + 1)) % (range[1] - range[0] + 1);
  // Counts scale with the sheet's area factor AFTER the archetype draws (the
  // rng stream never shifts; ×1 is the exact identity) — a big sheet asks for
  // more same-sized marks, and the placement vetoes still enforce restraint.
  const scaleCount = (n: number): number => Math.round(n * sheetFactor);
  const gestureCount = scaleCount(
    Math.max(
      1,
      options.gestures && options.gestures > 0 ? Math.round(options.gestures) : intIn(arch.gestures, gestureDraw)
    )
  );
  const whipCount = scaleCount(
    options.whips !== undefined && options.whips >= 0 ? Math.round(options.whips) : intIn(arch.whips, whipDraw)
  );
  const knotCount = scaleCount(
    options.knots !== undefined && options.knots >= 0 ? Math.round(options.knots) : intIn(arch.knots, knotDraw)
  );

  const energy = clamp01(energyOpt);
  const dryness = clamp01((options.dryness ?? 0.5) + arch.drynessBias);
  const spatterAmt = clamp01(spatter + arch.spatterBias);
  // Cap the half-width at what the lane cap can actually fill solid.
  const maxHalf = Math.min(sizingDim * (0.015 + 0.085 * clamp01(inkWeight)) * arch.inkScale, 18 * passSpacing);

  const comp = compose(
    {
      width,
      height,
      margin,
      arch,
      gestureCount,
      whipCount,
      knotCount,
      energy,
      maxHalf,
      coverage: clamp01(coverage),
      balance: clamp01(balance),
      negativeSpace: clamp01(negativeSpace),
      passSpacing,
      refMinDim: options.refMinDim,
    },
    rng,
    noise
  );

  const lines: FlowLine[] = [];

  // Primaries.
  const strokeStyle = (track: number, half: number, e: number) => ({
    maxHalf: half,
    passSpacing,
    dryness,
    entryFrac: arch.entryFrac,
    exitFrac: arch.exitFrac + 0.2 * e,
    noise,
    track,
    layer: 'gesture',
  });
  for (const g of comp.gestures) {
    lines.push(...renderStroke(g.spine, strokeStyle(g.track, g.maxHalf, g.energy)));
  }

  // Whips and knots.
  for (const wh of comp.whips) lines.push(...renderWhip(wh, passSpacing));
  comp.knots.forEach((k, i) => {
    lines.push(renderKnot(k, noise, makeRandom(subSeed(seed, 500 + i))));
  });

  // Spatter off every fast release (primaries and whips), globally capped —
  // the cap rides the sheet factor so big sheets keep their spatter share.
  let spatterBudget = Math.round(80 * sheetFactor);
  if (spatterAmt > 0) {
    const sources = [
      ...comp.gestures.map((g) => ({ spine: g.spine, energy: g.energy, half: g.maxHalf })),
      ...comp.whips.map((w) => ({ spine: w.spine, energy: w.energy, half: passSpacing * 3 })),
    ];
    sources.forEach((s, i) => {
      if (spatterBudget <= 0) return;
      if (s.energy < 0.35) return;
      const drops = makeSpatter(s.spine, spatterAmt, s.half, passSpacing, makeRandom(subSeed(seed, 700 + i)));
      const kept = drops.slice(0, spatterBudget);
      spatterBudget -= kept.length;
      lines.push(...kept);
    });
  }

  // Drips off the heaviest bellies — page-down, whatever the stroke's angle.
  if (drips > 0 && comp.gestures.length > 0) {
    const globalMax = Math.max(...comp.gestures.map((g) => g.maxHalf));
    comp.gestures.forEach((g, i) => {
      if (g.maxHalf < 0.6 * globalMax) return;
      const dripRng = makeRandom(subSeed(seed, 900 + i));
      if (dripRng() >= drips) return;
      const w = pressureWidths(g.spine, strokeStyle(g.track, g.maxHalf, g.energy));
      let belly = 0;
      for (let m = 1; m < w.length; m++) if (w[m] > w[belly]) belly = m;
      lines.push(
        ...makeDrip(g.spine.points[belly], workH * 0.14, passSpacing, noise, 990 + i * 3.1, dripRng)
      );
    });
  }

  // Crop everything at the margin — a kline bar bleeding past the frame is
  // part of the language, but the paper border stays paper.
  const clipped: FlowLine[] = [];
  for (const line of lines) {
    for (const run of clipPolylineToRect(line.points, margin, margin, width - margin, height - margin)) {
      clipped.push({ ...line, points: run });
    }
  }

  let result: FlowLinesResult = { lines: clipped, width, height, seed };

  // The spines are already curved and per-lane decorrelated — wobble here
  // only breaks pass registration, so it stays low, and spatter stays crisp
  // (0.05, not 0: a 0 multiplier is treated as unset upstream).
  result = applyHandDrawnStyle(result, {
    amplitude: wobble,
    wavelength: 140,
    seed,
    layerAmplitude: { gesture: 0.5, spatter: 0.05 },
  });

  if (optimize) result = optimizePlot(result);

  return result;
}
