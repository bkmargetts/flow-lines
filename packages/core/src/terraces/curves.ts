import { Point } from '../flow-lines.js';
import { createNoise } from '../noise.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { lerp } from '../lib/math.js';

/**
 * Bed-boundary curves for the terraces sheet, top→bottom on a shared x grid.
 * A fork of lapidary's `strataCurves` with the terrace knobs threaded through:
 *
 * - `steppiness` blends each boundary between the organic fBm wander and a
 *   piecewise-constant stepped level function (2-5 seeded x breakpoints, each
 *   run at its own level): flat treads with near-vertical risers at 1,
 *   wobbling treads in between. The stepped levels draw from their own
 *   per-curve stream, so dialing steppiness never reshuffles the organic
 *   geometry underneath.
 * - `faults` throws that many fault planes across the stack: every curve
 *   shifts by the fault's displacement on one side of a (slightly inclined)
 *   fault line, so each bed boundary shows the same near-vertical scarp — the
 *   geological tell. `faultThrow` scales the seeded displacement;
 *   `faultIncline` commits the plane's tilt, quenching the seeded tilt jitter
 *   as it approaches ±1. Fault randomness draws from its own stream in a
 *   fixed order, so knob changes never move the fault positions, and
 *   `faults: 0` leaves the curves byte-identical.
 *
 * With every knob at its neutral value (steppiness 0, faultThrow 1,
 * faultIncline 0) the output is byte-identical to lapidary's organic strata
 * path — pinned by the parity test in terraces.test.ts.
 */
export function terraceCurves(
  seed: number,
  count: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  irregularity: number,
  minGapPx: number,
  steppiness: number,
  faults: number,
  faultThrow: number,
  faultIncline: number
): Point[][] {
  const rng = makeRandom(subSeed(seed, 2));
  const noise = createNoise(subSeed(seed, 3));
  const innerH = y1 - y0;
  const bandH = innerH / (count + 1);
  const amp = irregularity * bandH * 0.55;
  const lambda = Math.max(40, (x1 - x0) / 2.5);
  const step = Math.max(4, (x1 - x0) / 160);
  const curves: Point[][] = [];
  for (let k = 0; k < count; k++) {
    const baseY = y0 + bandH * (k + 1) + (rng() - 0.5) * bandH * 0.5;
    // Stepped level function: 2-5 seeded breakpoints, each run at its own
    // level. Built from its own per-curve stream so the main stream's draw
    // sequence stays that of the organic path regardless of steppiness.
    let levelAt: ((x: number) => number) | null = null;
    if (steppiness > 0) {
      const srng = makeRandom(subSeed(seed, 30 + k));
      const stepAmp = irregularity * bandH * 0.8;
      const jumps = 2 + Math.floor(srng() * 4);
      const cuts: number[] = [];
      for (let j = 0; j < jumps; j++) cuts.push(x0 + (x1 - x0) * (0.1 + 0.8 * srng()));
      cuts.sort((p, q) => p - q);
      const levels = [baseY + (srng() - 0.5) * stepAmp * 2];
      for (let j = 0; j < jumps; j++) levels.push(baseY + (srng() - 0.5) * stepAmp * 2);
      levelAt = (x: number): number => {
        let idx = 0;
        while (idx < cuts.length && x >= cuts[idx]) idx++;
        return levels[idx];
      };
    }
    const pts: Point[] = [];
    for (let x = x0; x <= x1 + step * 0.5; x += step) {
      const xc = Math.min(x, x1);
      const organicY = baseY + amp * noise.fbm(xc / lambda, k * 7.7, 2, 0.5, 2);
      let y = levelAt ? lerp(organicY, levelAt(xc), steppiness) : organicY;
      y = Math.min(y1 - minGapPx * 0.5, Math.max(y0 + minGapPx * 0.5, y));
      if (k > 0) {
        const prev = curves[k - 1][pts.length];
        if (prev) y = Math.max(y, prev.y + minGapPx);
      }
      pts.push({ x: xc, y });
      if (xc >= x1) break;
    }
    curves.push(pts);
  }
  if (faults > 0 && curves.length > 0) {
    const frng = makeRandom(subSeed(seed, 8));
    for (let f = 0; f < faults; f++) {
      const xf = x0 + (0.15 + 0.7 * frng()) * (x1 - x0);
      const throwY =
        (frng() < 0.5 ? -1 : 1) *
        bandH *
        (0.25 + 0.45 * frng()) *
        Math.max(0.4, irregularity) *
        faultThrow;
      // A slight dip inclines the fault plane, so the scarp walks sideways
      // as it descends through the beds instead of stacking dead-vertical.
      // The committed tilt quenches the seeded jitter as |faultIncline|→1.
      const tiltJitter = (frng() - 0.5) * 0.3;
      const slope = faultIncline * 0.45 + tiltJitter * (1 - Math.abs(faultIncline));
      for (let k = 0; k < curves.length; k++) {
        const threshold = xf + k * bandH * slope;
        for (const p of curves[k]) {
          if (p.x >= threshold) p.y += throwY;
        }
      }
    }
    // Re-impose the bounds and the top-down monotonic gap the shifts broke.
    for (let k = 0; k < curves.length; k++) {
      for (let i = 0; i < curves[k].length; i++) {
        const p = curves[k][i];
        p.y = Math.min(y1 - minGapPx * 0.5, Math.max(y0 + minGapPx * 0.5, p.y));
        if (k > 0) p.y = Math.max(p.y, curves[k - 1][i].y + minGapPx);
      }
    }
  }
  return curves;
}
