import { makeRandom, subSeed } from '../lib/rng.js';
import { clamp } from '../lib/math.js';
import { KX, KY, type Proj } from '../city/project.js';
import { ProximityGrid } from '../vines/spatial.js';
import type { SimplexNoise } from '../noise.js';
import { POSE_DRAWS } from './poses.js';
import type { FigureSpec } from './figure.js';

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
  /** Drawable box (page px) the ground region is sized to fill. */
  boxW: number;
  boxH: number;
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
  // Region is sized to the drawable box, NOT to count. The 2:1 iso ground
  // diamond spans (2S wide × S tall); sizing S to fill the box's vertical span
  // means `count` alone sets how densely the fixed ground is packed — crank it
  // and the ground saturates. Horizontal overflow is clipped downstream.
  const S = Math.max(1, Math.max(o.boxH, o.boxW / 2) * Math.max(0.2, o.spread));
  const freq = 3 / S;
  const cluster = clamp(o.clustering, 0, 1);
  const minSep = Math.max(0, o.minSeparation);
  const grid = new ProximityGrid(S, S, Math.max(1, minSep));

  const specs: FigureSpec[] = [];
  for (let i = 0; i < count; i++) {
    const posRng = makeRandom(subSeed(seed, 4000 + i));
    const poseRng = makeRandom(subSeed(seed, 8000 + i));
    const miscRng = makeRandom(subSeed(seed, 12000 + i));

    // Position: reject too-clustered-away or too-close candidates, but always
    // place the figure (accept the last try) so `count` is exact.
    let cu = posRng() * S;
    let cv = posRng() * S;
    for (let t = 0; t < 14; t++) {
      const p = 0.5 + 0.5 * noise.noise2D(cu * freq, cv * freq);
      const accept = posRng() < 1 - cluster * (1 - p);
      const clear = minSep <= 0 || !grid.hasNear(cu, cv, minSep);
      if (accept && clear) break;
      cu = posRng() * S;
      cv = posRng() * S;
    }
    grid.add({ x: cu, y: cv });

    let facing: number;
    const fRoll = miscRng();
    if (o.facing === 'random') facing = fRoll * TAU;
    else facing = o.facingAngle + (miscRng() * 2 - 1) * o.facingJitter;

    const H = o.figureScale * (1 + (miscRng() * 2 - 1) * clamp(o.scaleVariance, 0, 1));

    const poseG: number[] = new Array(POSE_DRAWS);
    for (let k = 0; k < POSE_DRAWS; k++) poseG[k] = poseRng();

    specs.push({ u0: cu, v0: cv, facing, H: Math.max(1, H), poseG, depth: cu + cv });
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
