import { clamp01 } from '../lib/math.js';
import { DEG } from '../landscape/hatching.js';

/**
 * The flow↔rigid morph: one `order` value (0 = flowing/organic, 1 =
 * rigid/robotic) mapped to every derived quantity in the city. The invariant
 * that makes the master slider feel like *morphing one city* rather than
 * re-rolling it: every organic quantity is a per-building random attribute
 * drawn ONCE from the cell's sub-seed, then scaled by these factors — the
 * randoms never re-roll as the slider moves, only their reach changes.
 * `F = 1 - order` is the flow energy everything scales against.
 */
export interface Morph {
  order: number;
  /** Flow energy, `1 - order`. */
  F: number;

  // Layout
  /** Cell-centre placement jitter as a fraction of the lot size. */
  placementJitterFrac: number;
  /** Footprint size variance: w = lot * (1 - footprintVar * draw). */
  footprintVar: number;
  /** Extra vacancy probability on top of (1 - density). */
  skipExtra: number;
  /** Scale on the height-distribution sigma (rigid cities are more uniform). */
  heightSigmaScale: number;
  /** 0..1 blend toward storey-quantized heights — the rigid tell. */
  storeySnap: number;

  // Building geometry (the spine)
  /** Peak lateral lean as a fraction of building height. */
  leanFrac: number;
  /** Peak bow (t² term) as a fraction of building height. */
  bendFrac: number;
  /** Roof/parapet wave amplitude in px (flat at order = 1). */
  waveAmp: number;

  // Windows
  /** Per-row horizontal drift as a fraction of the window pitch. */
  rowDrift: number;
  /** Window corner jitter as a fraction of the window size. */
  winJitter: number;
  /** Probability a window is skipped entirely (clumped by noise). */
  winDropout: number;
  /** Probability each window edge decays away (full rects → sills → ticks). */
  edgeDrop: number;

  // Hatch craft
  /** Stroke-end taper / break amount (Craft.taper). */
  taper: number;
  /** Per-stroke angle jitter in radians. */
  jitterAng: number;
  /** Hatch spacing irregularity (fractional). */
  spacingVar: number;
  /** Per-building hatch-angle wander off exact 45°, in degrees. */
  hatchWanderDeg: number;

  // Finish
  /** Multiplier on the wobble option — order 1 + wobble 0 is truly ruled. */
  wobbleScale: number;
}

function sstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Map the master slider (plus the lean ceiling knob) to every derived factor. */
export function buildMorph(order: number, leanKnob: number): Morph {
  const q = clamp01(order);
  const F = 1 - q;
  return {
    order: q,
    F,

    placementJitterFrac: 0.35 * F * F,
    footprintVar: 0.06 + 0.4 * F,
    skipExtra: 0.03 + 0.15 * F,
    heightSigmaScale: 0.35 + 0.65 * F,
    storeySnap: sstep(0.4, 0.9, q),

    // Lean lands early (a mid-slider city should already sway); the bow — the
    // loudest organic tell — arrives late on the way down from rigid.
    leanFrac: 0.22 * leanKnob * Math.pow(F, 1.2),
    bendFrac: 0.14 * leanKnob * Math.pow(F, 1.7),
    waveAmp: (0.8 + 2.8 * F) * F,

    rowDrift: 0.3 * F,
    winJitter: 0.25 * F,
    winDropout: 0.03 + 0.22 * F,
    edgeDrop: 0.8 * sstep(0.35, 1, F),

    taper: 0.15 + 0.7 * F,
    jitterAng: (0.3 + 2.2 * F) * DEG,
    spacingVar: 0.25 * F,
    hatchWanderDeg: 12 * F,

    wobbleScale: 0.15 + 0.85 * F,
  };
}
