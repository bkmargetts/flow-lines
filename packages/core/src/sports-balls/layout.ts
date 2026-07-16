import { makeRandom, subSeed } from '../lib/rng.js';
import { clamp, lerp } from '../lib/math.js';
import { ProximityGrid } from '../lib/spatial.js';
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

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** Two circles whose centre distance plus radius difference is under this
 *  stay within a pen width of each other everywhere — they overdraw as one
 *  doubled outline. */
const DOUBLE_INK = 2;

export interface BallLayoutOptions {
  count: number;
  clustering: number;
  /** Soft minimum gap between centres, px. Below the mean diameter ⇒ pile. */
  minSeparation: number;
  /** Soft region edge: only ball CENTRES are confined to the region, so
   *  balls poke up to a radius past the shape outline (the stickmen-feet
   *  look). Default (false) holds the whole ball inside — crisp shapes. */
  softEdge?: boolean;
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
  const softEdge = o.softEdge ?? false;

  const centreIn = (x: number, y: number): boolean => !region || region.contains(x, y);
  // Whole-ball containment: centre plus 12 rim points — exact for convex
  // shapes, close enough in a heart's cleft or a star's notches.
  const RIM = 12;
  const ballIn = (x: number, y: number, r: number): boolean => {
    if (!region) return true;
    if (!region.contains(x, y)) return false;
    for (let k = 0; k < RIM; k++) {
      const a = (k / RIM) * TAU;
      if (!region.contains(x + Math.cos(a) * r, y + Math.sin(a) * r)) return false;
    }
    return true;
  };

  // Deterministic (rng-free) fallback for degenerate / near-empty regions:
  // the first centre-contained cell of a coarse scan over the sampling
  // window, else the window centre — so `count` stays exact instead of
  // looping forever.
  const fallback = (wx0: number, wy0: number, sw: number, sh: number): { x: number; y: number } => {
    const N = 16;
    for (let gy = 0; gy < N; gy++) {
      for (let gx = 0; gx < N; gx++) {
        const x = wx0 + ((gx + 0.5) / N) * sw;
        const y = wy0 + ((gy + 0.5) / N) * sh;
        if (centreIn(x, y)) return { x, y };
      }
    }
    return { x: wx0 + sw / 2, y: wy0 + sh / 2 };
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
    // wobble allowance) so the ball's ink stays on the page — intersected
    // with the region's bbox when a shape is set: rejection-sampling a small
    // shape against the whole page would exhaust the tries and stack balls
    // on the fallback point. Degenerate windows collapse to their midline.
    const inset = r + 2;
    let wx0 = o.x0 + inset;
    let wy0 = o.y0 + inset;
    let wx1 = o.x1 - inset;
    let wy1 = o.y1 - inset;
    if (region) {
      wx0 = Math.max(wx0, region.bbox.x0);
      wy0 = Math.max(wy0, region.bbox.y0);
      wx1 = Math.min(wx1, region.bbox.x1);
      wy1 = Math.min(wy1, region.bbox.y1);
    }
    if (wx1 < wx0) wx0 = wx1 = (wx0 + wx1) / 2;
    if (wy1 < wy0) wy0 = wy1 = (wy0 + wy1) / 2;
    const sw = wx1 - wx0;
    const sh = wy1 - wy0;

    // One candidate: uniform over the window; with a region, rejection-
    // sampled until contained (HARD — clustering/minSep below stay soft).
    // Whole-ball containment may be unsatisfiable (a ball larger than the
    // shape), so it degrades to centre containment before the deterministic
    // fallback rather than stacking everyone on one point.
    const sample = (): { x: number; y: number } => {
      if (!region) return { x: wx0 + posRng() * sw, y: wy0 + posRng() * sh };
      for (let t = 0; t < 60; t++) {
        const x = wx0 + posRng() * sw;
        const y = wy0 + posRng() * sh;
        if (softEdge ? centreIn(x, y) : ballIn(x, y, r)) return { x, y };
      }
      if (!softEdge) {
        for (let t = 0; t < 60; t++) {
          const x = wx0 + posRng() * sw;
          const y = wy0 + posRng() * sh;
          if (centreIn(x, y)) return { x, y };
        }
      }
      return fallback(wx0, wy0, sw, sh);
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

    // Double-ink guard: a ball whose circle nearly coincides with an
    // already-placed one (centres AND radii within a couple of px) overdraws
    // it as one doubled outline. It happens — distinct per-ball streams are
    // shifted copies of the one shared LCG cycle, so rare exact collisions
    // are real, and a saturated small region crams similar balls together.
    // Near centres with DIFFERENT radii are fine (concentric circles read as
    // a pile). Nudge deterministically (rng-free) around a golden-angle
    // spiral to the first clear spot that keeps this ball's own containment;
    // regions too small to separate keep the stack so `count` stays exact.
    // (Depth grading later rescales radii by ≤ ±25%, not enough to re-pair
    // a cleared ball.)
    const doubled = (x: number, y: number): boolean => {
      for (const s of specs) {
        if (Math.abs(s.r - r) + Math.hypot(s.x - x, s.y - y) < DOUBLE_INK) return true;
      }
      return false;
    };
    if (doubled(cx, cy)) {
      const crisp = region !== null && !softEdge && ballIn(cx, cy, r);
      for (let t = 1; t <= 40; t++) {
        const a = t * GOLDEN_ANGLE;
        const d = 2.5 + t * 0.75;
        const nx = cx + Math.cos(a) * d;
        const ny = cy + Math.sin(a) * d;
        if (nx < wx0 || nx > wx1 || ny < wy0 || ny > wy1) continue;
        if (!centreIn(nx, ny)) continue;
        if (crisp && !ballIn(nx, ny, r)) continue;
        if (doubled(nx, ny)) continue;
        cx = nx;
        cy = ny;
        break;
      }
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
        const graded = Math.max(2.5, s.r * (1 + grade * (d - 0.5)));
        if (graded <= s.r) {
          s.r = graded; // shrinking never violates placement
          continue;
        }
        // Growth happens AFTER containment was checked, so cap it at the
        // page inset (placement guarantees edge ≥ r) and, for crisp-edged
        // regions, refuse growth that would poke the ball past the shape.
        const edge = Math.min(s.x - o.x0, o.x1 - s.x, s.y - o.y0, o.y1 - s.y) - 2;
        let grown = Math.min(graded, Math.max(s.r, edge));
        if (region && !softEdge && grown > s.r && !ballIn(s.x, s.y, grown)) grown = s.r;
        s.r = grown;
      }
    }
  }

  specs.sort((a, b) => a.depth - b.depth);
  return specs;
}
