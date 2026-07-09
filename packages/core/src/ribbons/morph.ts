import { clamp01 } from '../lib/math.js';

/**
 * The knot↔tangle morph: one `order` value (0 = free-flowing tangle, 1 =
 * strict knot lattice) mapped to every derived quantity in the weave. The
 * invariant (borrowed from the city generator) that makes the master slider
 * feel like *morphing one weave* rather than re-rolling it: there is a single
 * canonical construction — the Celtic lattice — at every order value, and
 * every organic quantity is a random attribute drawn ONCE from a stable
 * sub-seed, then scaled by these factors. The randoms never re-roll as the
 * slider moves, only their reach changes. `F = 1 - order` is the flow energy
 * everything scales against.
 */
export interface WeaveMorph {
  order: number;
  /** Flow energy, `1 - order`. */
  F: number;

  /** Extra closed-loop smoothing iterations after the base corner rounding. */
  smoothIters: number;
  /** Global domain-warp amplitude, as a fraction of the lattice cell. */
  warpAmpFrac: number;
  /** Domain-warp noise wavelength, as a multiple of the lattice cell. */
  warpScaleFrac: number;
  /** Per-strand meander amplitude, as a fraction of the cell (knob folded in). */
  meanderAmpFrac: number;
  /** Edge-midpoint jitter, as a fraction of the cell (drawn once per edge). */
  jitterFrac: number;
  /** Multiplier on the `breaks` knob — loose weaves break up more readily. */
  breakScale: number;
  /** Multiplier on the wobble option — order 1 + wobble 0 is truly ruled. */
  wobbleScale: number;
}

/** Map the master slider (plus the meander ceiling knob) to every factor. */
export function buildWeaveMorph(order: number, meander: number): WeaveMorph {
  const q = clamp01(order);
  const F = 1 - q;
  return {
    order: q,
    F,

    smoothIters: Math.round(3 * F),
    // Keep the warp comfortably injective (amp ≪ wavelength): a folding warp
    // lays bands over themselves lengthwise, which no crossing logic can save.
    // The ceilings are set where order 0 still reads as a coherent weave —
    // past them the strands osculate everywhere and dissolve into scraps.
    warpAmpFrac: 0.04 + 0.36 * F * F,
    warpScaleFrac: 3.2 + 2.8 * F,
    meanderAmpFrac: 0.22 * F * F * clamp01(meander),
    jitterFrac: 0.22 * F,
    breakScale: 0.6 + 0.8 * F,
    wobbleScale: 0.2 + 0.8 * F,
  };
}
