import { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { clamp } from '../lib/math.js';
import { TrochoidKind } from './types.js';
import { TracedLine, decimate, stepFor } from './sample.js';

/**
 * Spirograph trochoids: a wheel of radius r rolling inside (hypo) or outside
 * (epi) a fixed unit ring, pen at `penOffset·r` from the wheel centre. The
 * wheel ratio is reduced to lowest terms p/q, giving p lobes and exact
 * closure after q revolutions — every curve here is a closed loop, which is
 * why the generator reorders rather than chains strokes. `nest` repeats the
 * loop shrunk and rotated into wheelwork mandalas, cycling the pens.
 */
export interface TrochoidParams {
  seed: number;
  lobes: number;
  wheelOrder: number;
  penOffset: number;
  kind: TrochoidKind;
  nest: number;
  nestShrink: number;
  nestRotateDeg: number;
  inkGroups: number;
  jitter: number;
  /** Target chord length in unit space */
  detail: number;
  /** Collinearity decimation tolerance in unit space */
  decimateTol: number;
  pointCap: number;
}

function gcd(a: number, b: number): number {
  while (b > 0) [a, b] = [b, a % b];
  return a;
}

export function traceTrochoid(p: TrochoidParams): TracedLine[] {
  let lobes = clamp(Math.round(p.lobes), 2, 64);
  let order = clamp(Math.round(p.wheelOrder), 1, 32);
  // A hypotrochoid wheel must fit inside the ring: force q < p, then reduce.
  if (p.kind === 'hypo' && order >= lobes) order = Math.max(1, lobes - 1);
  const g = gcd(lobes, order);
  lobes /= g;
  order /= g;

  const R = 1;
  const r = (order / lobes) * R;
  const d = p.penOffset * r;
  const c = p.kind === 'hypo' ? R - r : R + r;
  const wheelRatio = c / r;
  const maxR = c + d;
  const span = Math.PI * 2 * order;

  const rng = makeRandom(subSeed(p.seed, 40));
  const rotStep =
    p.nestRotateDeg !== 0
      ? (p.nestRotateDeg * Math.PI) / 180
      : ((rng() - 0.5) * 2 * Math.PI) / lobes;

  // Unit-space speed bound: |dP/dθ| ≤ c + d·(c/r), shrunk per nested repeat.
  const vMax = (c + d * wheelRatio) / maxR;
  // Point budget across repeats: repeat i draws at scale s^i, so its point
  // need shrinks by the same factor — the geometric sum prices the whole nest.
  const nest = clamp(Math.round(p.nest), 1, 24);
  const s = clamp(p.nestShrink, 0.5, 1);
  let scaleSum = 0;
  for (let i = 0; i < nest; i++) scaleSum += Math.pow(s, i);
  const dt = stepFor(p.detail, vMax, span * scaleSum, p.pointCap);

  const lines: TracedLine[] = [];
  for (let i = 0; i < nest; i++) {
    const scale = Math.pow(s, i);
    const rot = i * rotStep + p.jitter * (rng() - 0.5) * 0.2;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const step = dt / scale;
    const steps = Math.max(8, Math.ceil(span / step));

    const points: Point[] = [];
    for (let k = 0; k < steps; k++) {
      const theta = (k / steps) * span;
      const wx =
        p.kind === 'hypo'
          ? c * Math.cos(theta) + d * Math.cos(wheelRatio * theta)
          : c * Math.cos(theta) - d * Math.cos(wheelRatio * theta);
      const wy = c * Math.sin(theta) - d * Math.sin(wheelRatio * theta);
      const x = (wx / maxR) * scale;
      const y = (wy / maxR) * scale;
      points.push({ x: x * cos - y * sin, y: x * sin + y * cos });
    }
    const out = decimate(points, p.decimateTol);
    // Exact closure: the loop ends where it began.
    out.push({ ...out[0] });
    lines.push({ points: out, group: i % p.inkGroups });
  }

  return lines;
}
