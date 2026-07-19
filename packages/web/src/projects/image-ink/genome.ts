import type { InkSettings } from './types';

/**
 * Roll a fresh interpretation of the photo — the artistic levers (hatch
 * direction, spacing, tone curve, texture style, stroke shaping) within
 * tasteful ranges. Everything that gates the photo's own data stays put:
 * the ML-influence knobs (focus, mask, depth, portrait), the preset-committed
 * artistic decisions and the pen/ink prefs are never rolled — a roll
 * reinterprets the photo, it doesn't forget what the user told us about it.
 * The caller owns `seed` (and clears the preset highlight). Exported for the
 * genome test.
 */
export function randomImageInkGenome(rng: () => number): Partial<InkSettings> {
  const r = (lo: number, hi: number) => lo + rng() * (hi - lo);
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rng() * xs.length)];
  return {
    hatchAngle: Math.round(r(-90, 90) / 5) * 5,
    wobble: Math.round(r(0.3, 2.2) * 10) / 10,
    layers: pick([2, 2, 3, 3, 4]),
    minSpacing: Math.round(r(2, 3.5) * 10) / 10,
    maxSpacing: Math.round(r(10, 22)),
    toneGamma: Math.round(r(1.1, 1.9) * 20) / 20,
    textureStrokes: Math.round(r(0.2, 1) * 20) / 20,
    textureStyle: pick(['ticks', 'ticks', 'ticks', 'stipple', 'scribble']),
    crossContour: rng() < 0.2,
    skyStipple: rng() < 0.3,
    maxStrokeLength: pick([0, 0, 40, 60, 80]),
    detailEmphasis: Math.round(r(0.2, 0.5) * 20) / 20,
  };
}
