import { makeRandom, subSeed } from '../lib/rng.js';
import { clamp, lerp } from '../lib/math.js';
import { ProximityGrid } from '../vines/spatial.js';
import type { SimplexNoise } from '../noise.js';
import type { PageRegion } from '../stickmen/region.js';

export type BallType = 'soccer' | 'basketball' | 'volleyball' | 'baseball' | 'tennis' | 'pingpong';

/** Canonical draw order for the type CDF — never reorder: the single type
 *  draw maps through this list, so appending new types keeps old seeds. */
export const BALL_TYPES: readonly BallType[] = [
  'soccer',
  'basketball',
  'volleyball',
  'baseball',
  'tennis',
  'pingpong',
];

/** Real-world diameters relative to a football (soccer ball, ~22cm). */
export const REAL_RATIO: Record<BallType, number> = {
  soccer: 1,
  basketball: 1.09,
  volleyball: 0.95,
  baseball: 0.33,
  tennis: 0.3,
  pingpong: 0.18,
};

export interface BallSpec {
  x: number;
  y: number;
  r: number;
  type: BallType;
  /** 3-draw rotation genome (0..1 each) — scaled by `spin` at build time. */
  rotG: [number, number, number];
  depth: number;
}

export interface BallLayoutOptions {
  count: number;
  clustering: number;
  /** Soft minimum gap between centres, px. Below the mean diameter ⇒ pile. */
  minSeparation: number;
  ballScale: number;
  scaleVariance: number;
  /** 0 = uniform diameters, 1 = real-world relative diameters. */
  trueSizes: number;
  /** 0..0.5 — lower-on-page (nearer) balls grow. */
  depthGrade: number;
  mix: Partial<Record<BallType, number>>;
  /** Drawable box, page px. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  region?: PageRegion | null;
}

/**
 * Scatter `count` balls across the drawable box (or a region). Each ball owns
 * independent fixed-draw sub-seed streams (position / type / rotation / size)
 * so one ball's rejection sampling never shifts another's identity, and
 * changing the mix or spin knobs never moves anyone. Same idiom as
 * `stickmen/layout.ts`. Centres are inset by each ball's radius so the crowd
 * stays on the page; region containment (centres) is a hard constraint,
 * clustering and separation stay soft so `count` is exact.
 */
export function placeBalls(o: BallLayoutOptions, noise: SimplexNoise, seed: number): BallSpec[] {
  const count = Math.max(1, Math.round(o.count));
  const region = o.region ?? null;
  const boxW = Math.max(1, o.x1 - o.x0);
  const boxH = Math.max(1, o.y1 - o.y0);
  const freq = 3 / Math.max(boxW, boxH);
  const cluster = clamp(o.clustering, 0, 1);
  const minSep = Math.max(0, o.minSeparation);
  const grid = new ProximityGrid(boxW, boxH, Math.max(1, minSep));

  // Enabled-weights CDF over the canonical type order. All-off falls back to
  // all-on so the generator never renders nothing.
  const weights = BALL_TYPES.map((t) => Math.max(0, o.mix[t] ?? 0));
  let total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    weights.fill(1);
    total = weights.length;
  }
  const pickType = (roll: number): BallType => {
    let acc = 0;
    for (let k = 0; k < weights.length; k++) {
      acc += weights[k] / total;
      if (roll < acc) return BALL_TYPES[k];
    }
    return BALL_TYPES[weights.length - 1];
  };

  const trueSizes = clamp(o.trueSizes, 0, 1);
  const variance = clamp(o.scaleVariance, 0, 1);

  const inRegion = (x: number, y: number): boolean => !region || region.contains(x, y);

  // Deterministic (rng-free) fallback for degenerate / near-empty regions:
  // the first contained cell centre of a coarse scan, else the box centre —
  // so `count` stays exact instead of looping forever.
  const fallback = (): { x: number; y: number } => {
    const N = 16;
    for (let gy = 0; gy < N; gy++) {
      for (let gx = 0; gx < N; gx++) {
        const x = o.x0 + ((gx + 0.5) / N) * boxW;
        const y = o.y0 + ((gy + 0.5) / N) * boxH;
        if (inRegion(x, y)) return { x, y };
      }
    }
    return { x: o.x0 + boxW / 2, y: o.y0 + boxH / 2 };
  };

  const specs: BallSpec[] = [];
  for (let i = 0; i < count; i++) {
    const posRng = makeRandom(subSeed(seed, 4000 + i));
    const typeRng = makeRandom(subSeed(seed, 8000 + i));
    const rotRng = makeRandom(subSeed(seed, 12000 + i));
    const miscRng = makeRandom(subSeed(seed, 16000 + i));

    // Identity first (type, size, rotation) — fixed draw counts per stream —
    // then position, whose window is inset by this ball's own radius.
    const type = pickType(typeRng());
    const ratio = Math.max(0.15, lerp(1, REAL_RATIO[type], trueSizes));
    const r = Math.max(2.5, (o.ballScale / 2) * ratio * (1 + (miscRng() * 2 - 1) * variance));
    const rotG: [number, number, number] = [rotRng(), rotRng(), rotRng()];

    // Sampling window: the drawable box inset by the radius (plus a little
    // wobble allowance) so the ball's ink stays on the page. If the box is
    // narrower than the ball, pin to the centre line.
    const inset = r + 2;
    const sx0 = Math.min(o.x0 + inset, (o.x0 + o.x1) / 2);
    const sy0 = Math.min(o.y0 + inset, (o.y0 + o.y1) / 2);
    const sw = Math.max(0, o.x1 - inset - sx0);
    const sh = Math.max(0, o.y1 - inset - sy0);

    // One candidate: uniform over the inset box; with a region, rejection-
    // sampled until the centre is contained (HARD — clustering/minSep below
    // stay soft).
    const sample = (): { x: number; y: number } => {
      if (!region) return { x: sx0 + posRng() * sw, y: sy0 + posRng() * sh };
      for (let t = 0; t < 60; t++) {
        const x = sx0 + posRng() * sw;
        const y = sy0 + posRng() * sh;
        if (inRegion(x, y)) return { x, y };
      }
      return fallback();
    };

    // Position: reject too-clustered-away or too-close candidates, but always
    // place the ball (accept the last try) so `count` is exact.
    let { x: cx, y: cy } = sample();
    for (let t = 0; t < 14; t++) {
      const p = 0.5 + 0.5 * noise.noise2D(cx * freq, cy * freq);
      const accept = posRng() < 1 - cluster * (1 - p);
      const clear = minSep <= 0 || !grid.hasNear(cx - o.x0, cy - o.y0, minSep);
      if (accept && clear) break;
      ({ x: cx, y: cy } = sample());
    }
    grid.add({ x: cx - o.x0, y: cy - o.y0 });

    specs.push({ x: cx, y: cy, r, type, rotG, depth: cy });
  }

  // Depth size grading: a deterministic function of position (identities are
  // already fixed), normalised over this crowd's depth span so the knob means
  // the same thing whatever the region size.
  const grade = clamp(o.depthGrade, 0, 0.5);
  if (grade > 0 && specs.length > 1) {
    let dMin = Infinity;
    let dMax = -Infinity;
    for (const s of specs) {
      if (s.depth < dMin) dMin = s.depth;
      if (s.depth > dMax) dMax = s.depth;
    }
    const span = dMax - dMin;
    if (span > 0) {
      for (const s of specs) {
        const d = (s.depth - dMin) / span;
        s.r = Math.max(2.5, s.r * (1 + grade * (d - 0.5)));
      }
    }
  }

  specs.sort((a, b) => a.depth - b.depth);
  return specs;
}
