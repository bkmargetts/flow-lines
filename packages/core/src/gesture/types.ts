import type { Point } from '../flow-lines.js';

export type GesturePreset = 'auto' | 'kline' | 'sumi' | 'hartung' | 'tangle';

export const TAU = Math.PI * 2;

/** Clamped 0..1 smoothstep. */
export function smoothstep01(v: number): number {
  const t = v < 0 ? 0 : v > 1 ? 1 : v;
  return t * t * (3 - 2 * t);
}

/**
 * A synthesized pen movement: points at even arc spacing plus per-point
 * speed (an asymmetric bell — the exit is the fast, flicked end) and
 * cumulative arc length.
 */
export interface Spine {
  points: Point[];
  speed: number[];
  arc: number[];
  length: number;
}

/** Parameters for one heading-integration pen movement. */
export interface SpineParams {
  start: Point;
  /** initial heading in radians */
  heading: number;
  /** target arc length in px */
  length: number;
  /** signed base curvature in rad/px — single-signed by construction */
  curvature: number;
  /** 0..1 — skews the speed bell and lengthens the exit taper */
  energy: number;
  /** t of the single calligraphic S-reversal, or -1 for none */
  reverseAt: number;
  /** noise decorrelation track (any distinct scalar per mark) */
  track: number;
}

/** A placed primary/counter gesture: its spine plus the ink to realize it. */
export interface PlacedGesture {
  spine: Spine;
  maxHalf: number;
  energy: number;
  track: number;
}

/** A placed calligraphic whip: a fast single-pass flick. */
export interface PlacedWhip {
  spine: Spine;
  energy: number;
  track: number;
}

/** A placed scribble knot: a dense orbiting-pen mass. */
export interface PlacedKnot {
  center: Point;
  radius: number;
  /** drift direction of the orbit center */
  heading: number;
  track: number;
}

/** Everything the composition engine decided; rendering just realizes it. */
export interface Composition {
  gestures: PlacedGesture[];
  whips: PlacedWhip[];
  knots: PlacedKnot[];
  /** the dominant compositional axis, for callers that echo it */
  thetaDom: number;
}

/**
 * Per-preset composition parameter table. Counts are inclusive ranges the
 * rng draws from; `sweep` is the total turn |κ0|·length in radians (a near-
 * straight bar at 0.1, a closed enso approaching 2π).
 */
export interface Archetype {
  gestures: [number, number];
  whips: [number, number];
  knots: [number, number];
  sweep: [number, number];
  /** primary length as a fraction of the work rect's min dimension */
  lengthFrac: [number, number];
  /** snap axes in radians for headings, or null for a free diagonal */
  headings: number[] | null;
  /** may the stroke run past the work rect (cropped at the margin)? */
  bleed: boolean;
  /** multiplier on the resolved max half-width */
  inkScale: number;
  /** pressure envelope: fraction of the stroke spent pressing down —
   *  kline bars are blunt, a sumi sweep breathes in */
  entryFrac: number;
  /** base release fraction (energy lengthens it further) */
  exitFrac: number;
  drynessBias: number;
  spatterBias: number;
  /** hartung: whips form one parallel bundle instead of echoing exits */
  whipBundle: boolean;
}
