import { makeRandom, subSeed } from '../lib/rng.js';
import { clamp } from '../lib/math.js';
import { KX, KY, type Proj } from '../city/project.js';
import { ProximityGrid } from '../vines/spatial.js';
import type { SimplexNoise } from '../noise.js';
import { POSE_DRAWS } from './poses.js';
import { PROP_DRAWS } from './skeleton.js';
import type { FigureSpec } from './figure.js';
import type { PageRegion } from './region.js';

const TAU = Math.PI * 2;

export type FacingMode = 'random' | 'toward' | 'procession';

export interface LayoutOptions {
  count: number;
  /** Ground-region multiplier: >1 spreads the ground out (smaller figures on
   *  page), <1 pulls it in. It does NOT scale with count — so `count` is a
   *  true density knob: more figures on a fixed ground = saturation. */
  spread: number;
  /** 0 = even scatter, 1 = figures clump into noise-driven groups. */
  clustering: number;
  /** Soft minimum gap between ground anchors, world px. */
  minSeparation: number;
  facing: FacingMode;
  facingAngle: number;
  facingJitter: number;
  /** Mean standing height, world px. */
  figureScale: number;
  scaleVariance: number;
  /** 0..0.5 — nearer figures grow, farther shrink, on top of scaleVariance.
   *  A perspective cue the honest iso projection doesn't provide. */
  depthGrade: number;
  /** Drawable box (page px) the ground region is sized to fill. */
  boxW: number;
  boxH: number;
  /** Compiled page-space region confining ground anchors (feet). When set,
   *  candidates are sampled under the identity projection (page x = u−v,
   *  y = (u+v)·KY) so containment is testable during placement; `spread` is
   *  inert. Null/undefined = the legacy square ground. */
  region?: PageRegion | null;
}

/** Conservative figure extents (fractions of H) for the fit bbox. */
const REACH = 0.5; // lateral / forward arm reach + splay
const Z_TOP = 1.3; // head top / raised wrist

/**
 * Scatter `count` figures across a square ground region. Each figure owns
 * independent sub-seed streams (position / pose / misc) so one figure's
 * rejection sampling never shifts another's identity, and changing the pose or
 * facing knobs never moves anyone. Clustering biases acceptance toward the
 * high side of a low-frequency noise field so figures gather into loose
 * groups; a proximity grid keeps them from fully stacking. Depth-sorted
 * back-to-front by the ground key u+v.
 */
export function placeFigures(o: LayoutOptions, noise: SimplexNoise, seed: number): FigureSpec[] {
  const count = Math.max(1, Math.round(o.count));
  const region = o.region ?? null;

  // World sampling box. Legacy: a square [0,S]² sized to the drawable box,
  // NOT to count. The 2:1 iso ground diamond spans (2S wide × S tall); sizing
  // S to fill the box's vertical span means `count` alone sets how densely
  // the fixed ground is packed — crank it and the ground saturates.
  // Horizontal overflow is clipped downstream.
  // With a region: the inverse projection (under the identity Proj, at z=0:
  // u = (x/KX + y/KY)/2, v = (y/KY − x/KX)/2) of the region's page bbox.
  let uMin = 0;
  let vMin = 0;
  let uSpan: number;
  let vSpan: number;
  if (region) {
    const { x0, y0, x1, y1 } = region.bbox;
    uMin = (x0 / KX + y0 / KY) / 2;
    const uMax = (x1 / KX + y1 / KY) / 2;
    vMin = (y0 / KY - x1 / KX) / 2;
    const vMax = (y1 / KY - x0 / KX) / 2;
    uSpan = Math.max(1, uMax - uMin);
    vSpan = Math.max(1, vMax - vMin);
  } else {
    const S = Math.max(1, Math.max(o.boxH, o.boxW / 2) * Math.max(0.2, o.spread));
    uSpan = S;
    vSpan = S;
  }
  const freq = 3 / Math.max(uSpan, vSpan);
  const cluster = clamp(o.clustering, 0, 1);
  const minSep = Math.max(0, o.minSeparation);
  const grid = new ProximityGrid(uSpan, vSpan, Math.max(1, minSep));

  // Anchor is inside a region when its page projection (feet, z=0) is.
  const inRegion = (u: number, v: number): boolean =>
    !region || region.contains((u - v) * KX, (u + v) * KY);

  // Deterministic (rng-free) fallback for degenerate / near-empty regions:
  // the first contained cell centre of a coarse scan, else the box centre —
  // so `count` stays exact instead of looping forever.
  const fallback = (): { u: number; v: number } => {
    const N = 16;
    for (let gy = 0; gy < N; gy++) {
      for (let gx = 0; gx < N; gx++) {
        const u = uMin + ((gx + 0.5) / N) * uSpan;
        const v = vMin + ((gy + 0.5) / N) * vSpan;
        if (inRegion(u, v)) return { u, v };
      }
    }
    return { u: uMin + uSpan / 2, v: vMin + vSpan / 2 };
  };

  const specs: FigureSpec[] = [];
  for (let i = 0; i < count; i++) {
    const posRng = makeRandom(subSeed(seed, 4000 + i));
    const poseRng = makeRandom(subSeed(seed, 8000 + i));
    const miscRng = makeRandom(subSeed(seed, 12000 + i));
    // Proportions get their own stream (not miscRng — its draw count varies
    // by facing branch, and body shape must not change when facing knobs do).
    const propRng = makeRandom(subSeed(seed, 16000 + i));

    // One candidate: uniform over the world box; with a region, rejection-
    // sampled until contained (HARD constraint — clustering/minSep below stay
    // soft). Legacy draws exactly two rng values, byte-identical to v1.
    const sample = (): { u: number; v: number } => {
      if (!region) return { u: posRng() * uSpan, v: posRng() * vSpan };
      for (let t = 0; t < 60; t++) {
        const u = uMin + posRng() * uSpan;
        const v = vMin + posRng() * vSpan;
        if (inRegion(u, v)) return { u, v };
      }
      return fallback();
    };

    // Position: reject too-clustered-away or too-close candidates, but always
    // place the figure (accept the last try) so `count` is exact.
    let { u: cu, v: cv } = sample();
    for (let t = 0; t < 14; t++) {
      const p = 0.5 + 0.5 * noise.noise2D(cu * freq, cv * freq);
      const accept = posRng() < 1 - cluster * (1 - p);
      const clear = minSep <= 0 || !grid.hasNear(cu - uMin, cv - vMin, minSep);
      if (accept && clear) break;
      ({ u: cu, v: cv } = sample());
    }
    grid.add({ x: cu - uMin, y: cv - vMin });

    let facing: number;
    const fRoll = miscRng();
    if (o.facing === 'random') facing = fRoll * TAU;
    else facing = o.facingAngle + (miscRng() * 2 - 1) * o.facingJitter;

    const H = o.figureScale * (1 + (miscRng() * 2 - 1) * clamp(o.scaleVariance, 0, 1));

    const poseG: number[] = new Array(POSE_DRAWS);
    for (let k = 0; k < POSE_DRAWS; k++) poseG[k] = poseRng();
    const propG: number[] = new Array(PROP_DRAWS);
    for (let k = 0; k < PROP_DRAWS; k++) propG[k] = propRng();

    specs.push({ u0: cu, v0: cv, facing, H: Math.max(1, H), poseG, propG, depth: cu + cv });
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
        s.H = Math.max(1, s.H * (1 + grade * (d - 0.5)));
      }
    }
  }

  specs.sort((a, b) => a.depth - b.depth);
  return specs;
}

/**
 * Fit the crowd to the drawable box. The ground region is already sized to the
 * box (2:1 iso diamond, wider than the page), so we fit the *vertical* span
 * only — the diamond is meant to overflow left/right and be clipped, filling
 * the frame. A height-only downscale guards against oversized figures poking
 * out the top; horizontal centring lets the overflow clip symmetrically.
 */
export function fitFigures(
  specs: FigureSpec[],
  frame: { x0: number; y0: number; x1: number; y1: number }
): { scale: number; proj: Proj } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of specs) {
    const r = REACH * s.H;
    const dU = s.u0 - s.v0;
    const sUV = s.u0 + s.v0;
    minX = Math.min(minX, (dU - 2 * r) * KX);
    maxX = Math.max(maxX, (dU + 2 * r) * KX);
    minY = Math.min(minY, (sUV - 2 * r) * KY - Z_TOP * s.H);
    maxY = Math.max(maxY, (sUV + 2 * r) * KY);
  }
  if (!isFinite(minX)) {
    return { scale: 1, proj: { offX: (frame.x0 + frame.x1) / 2, offY: (frame.y0 + frame.y1) / 2 } };
  }
  const bh = Math.max(1, maxY - minY);
  // Height-only fit: allow the wide ground to overflow the page width (clipped).
  const scale = Math.min(1, (frame.y1 - frame.y0) / bh);
  if (scale < 1) {
    for (const s of specs) {
      s.u0 *= scale;
      s.v0 *= scale;
      s.H *= scale;
      s.depth *= scale;
    }
  }
  return {
    scale,
    proj: {
      offX: (frame.x0 + frame.x1) / 2 - (scale * (minX + maxX)) / 2,
      offY: (frame.y0 + frame.y1) / 2 - (scale * (minY + maxY)) / 2,
    },
  };
}
