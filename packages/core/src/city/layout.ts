import { createNoise } from '../noise.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { lerp, clamp, clamp01 } from '../lib/math.js';
import type { Morph } from './morph.js';
import { KX, KY, type Proj } from './project.js';

/**
 * City layout: a blockCols × blockRows grid of lots, one candidate building
 * per lot. Each cell owns a stable genome — a FIXED-LENGTH vector of random
 * draws from its own sub-seed — so a building keeps its identity (footprint,
 * lean direction, tier shape, window phase) as the master slider, density or
 * height knobs move. The morph only scales how far those draws reach.
 */

export interface TierSpec {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  z0: number;
  z1: number;
}

export interface BuildingSpec {
  /** Per-building seed for the drawing-craft rng streams. */
  seed: number;
  /** Stacked boxes, bottom→top (setback tiers; last may be a spire). */
  tiers: TierSpec[];
  /** Total height (px) — the spine's normalisation. */
  h: number;
  /** Fixed unit draws (-1..1) the morph scales into lean / bow. */
  leanU: number;
  leanV: number;
  bendU: number;
  bendV: number;
  /** Roof-wave decorrelation phase. */
  wavePhase: number;
  /** Storey height for this building (px). */
  storey: number;
  /** Window column phase 0..1. */
  winPhase: number;
  /** Per-building tone multiplier on the shadow-face hatch. */
  toneMul: number;
  /** Roof-detail draw: gates the parapet inset / lip (restraint — not every
   *  roof gets furniture). */
  parapetDraw: number;
  /** Painter's-algorithm sort key. Primary: grid diagonal (row + col) —
   *  footprints are jitter-clamped inside their cells, so diagonal order is a
   *  *correct* painter order (same-diagonal cells can never overlap in
   *  projection); the raw near-corner sum alone inverts between adjacent
   *  diagonals when a small set-back building meets a big neighbour, and the
   *  loser's lines cross straight through the winner. */
  depth: number;
}

export interface CityLayoutOptions {
  cols: number;
  rows: number;
  lot: number;
  street: number;
  density: number;
  downtown: number;
  heightMean: number;
  heightVariance: number;
  storey: number;
  tiers: number;
}

export function layoutCity(o: CityLayoutOptions, morph: Morph, seed: number): BuildingSpec[] {
  const pitch = o.lot + o.street;
  const vacancy = createNoise(subSeed(seed, 7));
  const gRng = makeRandom(subSeed(seed, 1));
  // Downtown centre: a noise-free draw in the middle band of the grid.
  const dcU = (0.3 + 0.4 * gRng()) * o.cols * pitch;
  const dcV = (0.3 + 0.4 * gRng()) * o.rows * pitch;
  const dcR = 0.42 * Math.max(o.cols, o.rows) * pitch;

  const specs: BuildingSpec[] = [];
  for (let r = 0; r < o.rows; r++) {
    for (let c = 0; c < o.cols; c++) {
      const cellSeed = subSeed(seed, 13 + r * o.cols + c);
      const rng = makeRandom(cellSeed);
      // The genome: every draw happens for every cell, always in this order,
      // whether or not the value ends up used — a skipped draw would shift
      // the stream and re-roll the whole city when a knob moves.
      const g = {
        jU: rng() * 2 - 1,
        jV: rng() * 2 - 1,
        w: rng(),
        d: rng(),
        h1: rng(),
        h2: rng(),
        h3: rng(),
        leanU: rng() * 2 - 1,
        leanV: rng() * 2 - 1,
        bendU: rng() * 2 - 1,
        bendV: rng() * 2 - 1,
        wavePhase: rng(),
        tier1: rng(),
        tier2: rng(),
        split1: rng(),
        split2: rng(),
        insets: [rng(), rng(), rng(), rng(), rng(), rng(), rng(), rng()],
        spire: rng(),
        storeyVar: rng() * 2 - 1,
        winPhase: rng(),
        tone: rng(),
        skip: rng(),
        parapet: rng(),
      };

      // Vacancy: the density knob plus a flow-scaled extra, gated through
      // low-frequency noise so gaps clump into plazas instead of salt-and-pepper.
      const gate = 0.5 + 0.5 * vacancy.noise2D(c * 0.33, r * 0.33);
      const pSkip = clamp01((1 - o.density + morph.skipExtra) * (0.35 + 1.3 * gate));
      if (g.skip < pSkip) continue;

      // Footprint: snaps to the lot at order 1, shrinks/varies at the flow end.
      const w = o.lot * clamp(1 - morph.footprintVar * g.w, 0.4, 1);
      const d = o.lot * clamp(1 - morph.footprintVar * g.d, 0.4, 1);
      // Placement: jitter is clamped so footprints never cross lot pitch —
      // colliding buildings read as a glitch, not as organic.
      const jMaxU = Math.max(0, (pitch - w) / 2 - 1);
      const jMaxV = Math.max(0, (pitch - d) / 2 - 1);
      const cu = (c + 0.5) * pitch + g.jU * Math.min(jMaxU, morph.placementJitterFrac * o.lot);
      const cv = (r + 0.5) * pitch + g.jV * Math.min(jMaxV, morph.placementJitterFrac * o.lot);
      const u0 = cu - w / 2;
      const u1 = cu + w / 2;
      const v0 = cv - d / 2;
      const v1 = cv + d / 2;

      // Height: downtown envelope × lognormal-ish draw, then storey-snapped
      // toward the rigid end. Three uniforms sum to a decent gaussian.
      const dd = Math.hypot(cu - dcU, cv - dcV) / dcR;
      const envelope = lerp(1, 0.55 + 1.55 * Math.exp(-dd * dd * 1.8), clamp01(o.downtown));
      const gauss = (g.h1 + g.h2 + g.h3 - 1.5) * 2;
      const sigma = 0.55 * o.heightVariance * morph.heightSigmaScale;
      const storey = o.storey * (1 + 0.15 * morph.F * g.storeyVar);
      let h = o.heightMean * envelope * Math.exp(sigma * gauss);
      // Rare spire-tall towers at the flow end.
      if (g.spire < 0.05 * morph.F) h *= 1.6;
      h = clamp(h, 1.6 * storey, o.heightMean * 3.2);
      const hQ = Math.max(storey, Math.round(h / storey) * storey);
      h = lerp(h, hQ, morph.storeySnap);

      // Tiers: setback boxes for tall buildings. Split fractions and per-side
      // insets interpolate between irregular draws (flow) and crisp equal
      // ziggurat steps (rigid).
      const tiers: TierSpec[] = [];
      let nT = 1;
      if (h > 4 * storey && g.tier1 < o.tiers) nT = 2;
      if (h > 6 * storey && nT === 2 && g.tier2 < o.tiers * 0.6) nT = 3;
      const splits: number[] = [];
      if (nT === 1) splits.push(1);
      else if (nT === 2) splits.push(lerp(0.45 + 0.35 * g.split1, 0.62, morph.order));
      else {
        splits.push(lerp(0.35 + 0.3 * g.split1, 0.5, morph.order));
        splits.push(lerp(splits[0] + 0.15 + 0.25 * g.split2, 0.8, morph.order));
      }
      let f0 = { u0, u1, v0, v1 };
      let z = 0;
      for (let k = 0; k < nT; k++) {
        const zTop = k === nT - 1 ? h : h * splits[k];
        tiers.push({ ...f0, z0: z, z1: zTop });
        if (k < nT - 1) {
          const iw = f0.u1 - f0.u0;
          const id = f0.v1 - f0.v0;
          const ins = (i: number): number => lerp(0.05 + 0.25 * g.insets[i], 0.13, morph.order);
          f0 = {
            u0: f0.u0 + iw * ins(k * 4),
            u1: f0.u1 - iw * ins(k * 4 + 1),
            v0: f0.v0 + id * ins(k * 4 + 2),
            v1: f0.v1 - id * ins(k * 4 + 3),
          };
          z = zTop;
        }
      }

      specs.push({
        seed: cellSeed,
        tiers,
        h,
        leanU: g.leanU,
        leanV: g.leanV,
        bendU: g.bendU,
        bendV: g.bendV,
        wavePhase: g.wavePhase,
        storey,
        winPhase: g.winPhase,
        toneMul: 0.85 + 0.45 * g.tone,
        parapetDraw: g.parapet,
        depth: (r + c) * 1e7 + (u1 + v1),
      });
    }
  }
  // Painter's algorithm: back (small u+v) first.
  specs.sort((a, b) => a.depth - b.depth);
  return specs;
}

/**
 * Fit the projected city into the drawable box: conservative projected bounds
 * (including lean/bow reach and the roof wave), a downscale-only factor
 * applied to every linear world dimension, and the page-space offsets that
 * centre the result. Downscale-only keeps mm knobs honest — a small city
 * sits centred rather than being blown up.
 */
export function fitCity(
  specs: BuildingSpec[],
  morph: Morph,
  frame: { x0: number; y0: number; x1: number; y1: number }
): { scale: number; proj: Proj } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const b of specs) {
    const reach = (morph.leanFrac + morph.bendFrac) * b.h;
    for (const t of b.tiers) {
      minX = Math.min(minX, (t.u0 - t.v1) * KX - 2 * reach);
      maxX = Math.max(maxX, (t.u1 - t.v0) * KX + 2 * reach);
      minY = Math.min(minY, (t.u0 + t.v0) * KY - t.z1 - morph.waveAmp - reach);
      maxY = Math.max(maxY, (t.u1 + t.v1) * KY - t.z0);
    }
  }
  if (!isFinite(minX)) {
    return { scale: 1, proj: { offX: (frame.x0 + frame.x1) / 2, offY: (frame.y0 + frame.y1) / 2 } };
  }
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const scale = Math.min(1, (frame.x1 - frame.x0) / bw, (frame.y1 - frame.y0) / bh);
  if (scale < 1) {
    for (const b of specs) {
      b.h *= scale;
      b.storey *= scale;
      for (const t of b.tiers) {
        t.u0 *= scale;
        t.u1 *= scale;
        t.v0 *= scale;
        t.v1 *= scale;
        t.z0 *= scale;
        t.z1 *= scale;
      }
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
