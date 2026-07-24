import { makeRandom, subSeed } from '../lib/rng.js';
import { clamp } from '../lib/math.js';
import { ProximityGrid } from '../lib/spatial.js';
import type { SimplexNoise } from '../noise.js';
import type { PageRegion } from '../stickmen/region.js';
import { heartBoundRadius } from './heart.js';

export type HeartStyle = 'outline' | 'solid' | 'hatched' | 'broken';

/** Canonical draw order for the style CDF — never reorder: the single style
 *  draw maps through this list, so appending new styles keeps old seeds. */
export const HEART_STYLES: readonly HeartStyle[] = ['outline', 'solid', 'hatched', 'broken'];

export interface HeartSpec {
  x: number;
  y: number;
  /** Half-width of the heart (the lobes span ±16/17·r). */
  r: number;
  style: HeartStyle;
  rot: number;
  /** 0..1 — 0 tall and pointy, 1 wide and chubby. */
  plump: number;
  arrow: boolean;
  bold: boolean;
  /** Build-time genome draws (0..1): hatch angle jitter, hatch phase, crack
   *  shape ×5, arrow angle — fixed count so knobs never move anyone. */
  g: number[];
  /** Seed for the per-heart kid-hand rng (drawn unconditionally, LAST in the
   *  misc stream, so the age knob can never shift placement or identity). */
  childSeed: number;
  depth: number;
}

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** Two hearts whose centre distance plus radius difference is under this
 *  stay within a pen width of each other everywhere — they overdraw as one
 *  doubled outline. (Conservative for hearts: different rotations diverge,
 *  but the guard is cheap and a false nudge is invisible.) */
const DOUBLE_INK = 2;

export interface HeartLayoutOptions {
  count: number;
  clustering: number;
  /** Soft minimum gap between centres, px. Below the mean width ⇒ pile. */
  minSeparation: number;
  /** Soft region edge: only heart CENTRES are confined to the region, so
   *  hearts poke past the shape outline. Default (false) holds the whole
   *  heart inside — crisp shape silhouettes. */
  softEdge?: boolean;
  heartScale: number;
  scaleVariance: number;
  /** 0..0.5 — lower-on-page (nearer) hearts grow. */
  depthGrade: number;
  plumpness: number;
  plumpVariance: number;
  /** 0..1 rotation jitter — maps to ±~35° at 1. */
  tilt: number;
  /** 0..1 fraction pierced by a cupid's arrow. */
  arrows: number;
  /** 0..1 fraction given multi-pass bold outlines. */
  boldOutline: number;
  mix: Partial<Record<HeartStyle, number>>;
  /** Drawable box, page px. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  region?: PageRegion | null;
}

/**
 * Scatter `count` hearts across the drawable box (or a region). Each heart
 * owns independent fixed-draw sub-seed streams (position / style / pose /
 * size+extras) so one heart's rejection sampling never shifts another's
 * identity, and changing the mix or decor knobs never moves anyone. Same
 * idiom as `sports-balls/layout.ts`. Centres are inset by each heart's
 * bounding radius so the pile stays on the page; region containment
 * (centres) is a hard constraint, clustering and separation stay soft so
 * `count` is exact.
 */
export function placeHearts(o: HeartLayoutOptions, noise: SimplexNoise, seed: number): HeartSpec[] {
  const count = Math.max(1, Math.round(o.count));
  const region = o.region ?? null;
  const boxW = Math.max(1, o.x1 - o.x0);
  const boxH = Math.max(1, o.y1 - o.y0);
  const freq = 3 / Math.max(boxW, boxH);
  const cluster = clamp(o.clustering, 0, 1);
  const minSep = Math.max(0, o.minSeparation);
  const grid = new ProximityGrid(boxW, boxH, Math.max(1, minSep));

  // Enabled-weights CDF over the canonical style order. All-off falls back to
  // all-on so the generator never renders nothing.
  const weights = HEART_STYLES.map((s) => Math.max(0, o.mix[s] ?? 0));
  let total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    weights.fill(1);
    total = weights.length;
  }
  const pickStyle = (roll: number): HeartStyle => {
    let acc = 0;
    for (let k = 0; k < weights.length; k++) {
      acc += weights[k] / total;
      if (roll < acc) return HEART_STYLES[k];
    }
    return HEART_STYLES[weights.length - 1];
  };

  const variance = clamp(o.scaleVariance, 0, 1);
  const softEdge = o.softEdge ?? false;

  const centreIn = (x: number, y: number): boolean => !region || region.contains(x, y);
  // Whole-heart containment: centre plus 12 points on the bounding circle —
  // conservative around the cleft, exact enough everywhere else.
  const RIM = 12;
  const heartIn = (x: number, y: number, bound: number): boolean => {
    if (!region) return true;
    if (!region.contains(x, y)) return false;
    for (let k = 0; k < RIM; k++) {
      const a = (k / RIM) * TAU;
      if (!region.contains(x + Math.cos(a) * bound, y + Math.sin(a) * bound)) return false;
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

  const specs: HeartSpec[] = [];
  for (let i = 0; i < count; i++) {
    const posRng = makeRandom(subSeed(seed, 4000 + i));
    const styleRng = makeRandom(subSeed(seed, 8000 + i));
    const poseRng = makeRandom(subSeed(seed, 12000 + i));
    const miscRng = makeRandom(subSeed(seed, 16000 + i));

    // Identity first (style, pose, size, extras) — fixed draw counts per
    // stream — then position, whose window is inset by this heart's own
    // bounding radius.
    const style = pickStyle(styleRng());
    const rot = (poseRng() * 2 - 1) * clamp(o.tilt, 0, 1) * 0.6;
    const plump = clamp(o.plumpness + (poseRng() * 2 - 1) * o.plumpVariance * 0.5, 0, 1);
    const r = Math.max(2.5, (o.heartScale / 2) * (1 + (miscRng() * 2 - 1) * variance));
    const arrow = miscRng() < o.arrows;
    const bold = miscRng() < o.boldOutline;
    const g = Array.from({ length: 8 }, () => miscRng());
    const childSeed = Math.floor(miscRng() * 1e9);
    const bound = heartBoundRadius(r, plump);

    // Sampling window: the drawable box inset by the bounding radius (plus a
    // little wobble allowance) so the heart's ink stays on the page —
    // intersected with the region's bbox when a shape is set: rejection-
    // sampling a small shape against the whole page would exhaust the tries
    // and stack hearts on the fallback point. Degenerate windows collapse to
    // their midline.
    const inset = bound + 2;
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
    // Whole-heart containment may be unsatisfiable (a heart larger than the
    // shape), so it degrades to centre containment before the deterministic
    // fallback rather than stacking everyone on one point.
    const sample = (): { x: number; y: number } => {
      if (!region) return { x: wx0 + posRng() * sw, y: wy0 + posRng() * sh };
      for (let t = 0; t < 60; t++) {
        const x = wx0 + posRng() * sw;
        const y = wy0 + posRng() * sh;
        if (softEdge ? centreIn(x, y) : heartIn(x, y, bound)) return { x, y };
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
    // place the heart (accept the last try) so `count` is exact.
    let { x: cx, y: cy } = sample();
    for (let t = 0; t < 14; t++) {
      const p = 0.5 + 0.5 * noise.noise2D(cx * freq, cy * freq);
      const accept = posRng() < 1 - cluster * (1 - p);
      const clear = minSep <= 0 || !grid.hasNear(cx - o.x0, cy - o.y0, minSep);
      if (accept && clear) break;
      ({ x: cx, y: cy } = sample());
    }

    // Double-ink guard: a heart whose outline nearly coincides with an
    // already-placed one (centres AND radii within a couple of px) overdraws
    // it as one doubled outline. Distinct per-heart streams are shifted
    // copies of the one shared LCG cycle, so rare exact collisions are real,
    // and a saturated small region crams similar hearts together. Nudge
    // deterministically (rng-free) around a golden-angle spiral to the first
    // clear spot that keeps this heart's own containment; regions too small
    // to separate keep the stack so `count` stays exact.
    const doubled = (x: number, y: number): boolean => {
      for (const s of specs) {
        if (Math.abs(s.r - r) + Math.hypot(s.x - x, s.y - y) < DOUBLE_INK) return true;
      }
      return false;
    };
    if (doubled(cx, cy)) {
      const crisp = region !== null && !softEdge && heartIn(cx, cy, bound);
      for (let t = 1; t <= 40; t++) {
        const a = t * GOLDEN_ANGLE;
        const d = 2.5 + t * 0.75;
        const nx = cx + Math.cos(a) * d;
        const ny = cy + Math.sin(a) * d;
        if (nx < wx0 || nx > wx1 || ny < wy0 || ny > wy1) continue;
        if (!centreIn(nx, ny)) continue;
        if (crisp && !heartIn(nx, ny, bound)) continue;
        if (doubled(nx, ny)) continue;
        cx = nx;
        cy = ny;
        break;
      }
    }
    grid.add({ x: cx - o.x0, y: cy - o.y0 });

    specs.push({ x: cx, y: cy, r, style, rot, plump, arrow, bold, g, childSeed, depth: cy });
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
        // page inset (placement guarantees edge ≥ bound) and, for crisp-
        // edged regions, refuse growth that would poke past the shape.
        const af = heartBoundRadius(1, s.plump);
        const edge = Math.min(s.x - o.x0, o.x1 - s.x, s.y - o.y0, o.y1 - s.y) - 2;
        let grown = Math.min(graded, Math.max(s.r, edge / af));
        if (region && !softEdge && grown > s.r && !heartIn(s.x, s.y, heartBoundRadius(grown, s.plump))) {
          grown = s.r;
        }
        s.r = grown;
      }
    }
  }

  specs.sort((a, b) => a.depth - b.depth);
  return specs;
}
