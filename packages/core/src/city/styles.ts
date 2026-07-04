import type { FlowLine, Point } from '../flow-lines.js';
import type { SimplexNoise } from '../noise.js';
import { emitChimney, emitColonnade, emitCornice, emitStoop } from './details.js';
import type { Morph } from './morph.js';
import type { BuildingSpec, TierSpec } from './layout.js';
import type { Proj, Spine, Face } from './project.js';
import type { FaceCraft } from './facade.js';
import type { IsoDrawOptions } from './buildings.js';

/**
 * Building styles: a whole-city architectural vocabulary (plus 'mixed', which
 * rolls one per building). Dispatch is a descriptor table, not a switch —
 * `layoutCity` consumes the massing half, `drawIsoCity` the drawing half, and
 * each style may add bespoke details through one `extras` closure.
 *
 * The 'towers' descriptor is the identity: `massing: null` routes layout
 * through the literal pre-styles code path and every drawing factor is an
 * exact ×1 / unchanged threshold, so the default city is byte-identical to
 * the generator before styles existed (the city goldens pin this).
 *
 * Style randomness never touches the cell genome: it draws from a dedicated
 * per-cell stream (`styleG`), so existing seeds keep their cities.
 */

export type BuildingStyle = 'towers' | 'greek-villa' | 'old-town' | 'brownstone' | 'brutalist';
export type CityStyle = BuildingStyle | 'mixed';

export const CITY_STYLES: readonly CityStyle[] = [
  'towers',
  'greek-villa',
  'old-town',
  'brownstone',
  'brutalist',
  'mixed',
];

/** Massing overrides consumed by layoutCity. `null` = the towers path verbatim. */
export interface StyleMassing {
  /** Height = storey count × storey (plus any roof rise) — low-rise styles
   *  are inherently storey-snapped. */
  storeys: { min: number; max: number };
  /** Scale on the storey height — classical orders are taller than office
   *  floors. Windows, details and roof rises all follow it. */
  storeyMul?: number;
  /** Probability a building is a low slab pinned to the bottom of the storey
   *  range (the brutalist low-slab / mid-monolith bimodality). */
  slabP?: number;
  /** Footprint = lot × (base + var × genome draw), per axis. */
  footW: { base: number; var: number };
  footD: { base: number; var: number };
  /** Scale on the morph's placement jitter. */
  jitterMul: number;
  /** Scale on the vacancy probability (villas breathe, terraces pack). */
  vacancyMul: number;
  /** Downtown envelope exponent: 1 = ride it like towers, 0 = ignore it. */
  envelopePow: number;
  tiers: 'none' | 'cantilever';
  roof: 'flat' | 'gable' | 'pediment';
}

/** Facade treatment per style. */
export interface StyleWindows {
  lit: 'grid' | 'strip' | 'none';
  shadow: 'ticks' | 'none';
  pitchMul: number;
  /** Window width as a fraction of the column pitch (towers: 0.55). */
  widthFrac: number;
  /** Window height as a fraction of the storey (towers: 0.45). */
  heightFrac: number;
  densityMul: number;
  /** Scale on the morph's window corner jitter. */
  jitterMul: number;
}

/** Everything a style's bespoke-detail emitter can reach, handed to it once
 *  per building after the tier loop. */
export interface StyleExtrasCtx {
  out: FlowLine[];
  pr: Proj;
  b: BuildingSpec;
  spine: Spine;
  morph: Morph;
  craft: FaceCraft;
  noise: SimplexNoise;
  draw: IsoDrawOptions;
  lit: Face;
  shadow: Face;
  topTier: TierSpec;
  budget: { left: number };
  /** Erase already-drawn lines behind a closed ring (a detail that adds mass,
   *  e.g. a chimney, must occlude like a tier does). */
  occlude(ring: Point[]): void;
}

export interface StyleDef {
  massing: StyleMassing | null;
  /** Reach multipliers on the morph's spine / roof-wave factors — 1 leaves
   *  the flow↔rigid axis untouched, 0 removes a feature that is structurally
   *  wrong for the style (a gable has no parapet wave). */
  leanMul: number;
  bendMul: number;
  waveMul: number;
  /** Multiplier on the shadow-face hatch tone. */
  toneMul: number;
  /** shadeStrength threshold above which the shadow hatch cross-hatches. */
  crossAt: number;
  /** Whether roomier crowns get parapet furniture. */
  parapet: boolean;
  windows: StyleWindows;
  extras?: (ctx: StyleExtrasCtx) => void;
}

const TOWER_WINDOWS: StyleWindows = {
  lit: 'grid',
  shadow: 'ticks',
  pitchMul: 1,
  widthFrac: 0.55,
  heightFrac: 0.45,
  densityMul: 1,
  jitterMul: 1,
};

/** The identity descriptor — the pre-styles generator, exactly. */
const TOWERS: StyleDef = {
  massing: null,
  leanMul: 1,
  bendMul: 1,
  waveMul: 1,
  toneMul: 1,
  crossAt: 0.7,
  parapet: true,
  windows: TOWER_WINDOWS,
};

export const STYLES: Record<BuildingStyle, StyleDef> = {
  towers: TOWERS,

  /** Greek villa: low 1–2 storey houses on roomy lots, a colonnaded portico
   *  under an entablature instead of a window grid, most crowned with a low
   *  classical pediment (the rest keep a flat Mediterranean roof). */
  'greek-villa': {
    massing: {
      storeys: { min: 1, max: 2 },
      storeyMul: 1.45,
      footW: { base: 0.75, var: 0.25 },
      footD: { base: 0.62, var: 0.28 },
      jitterMul: 1,
      vacancyMul: 1.6,
      envelopePow: 0,
      tiers: 'none',
      roof: 'pediment',
    },
    leanMul: 0.6,
    bendMul: 0.6,
    waveMul: 0.4,
    toneMul: 0.95,
    crossAt: 0.8,
    parapet: false,
    windows: {
      lit: 'none',
      shadow: 'ticks',
      pitchMul: 1,
      widthFrac: 0.5,
      heightFrac: 0.45,
      densityMul: 0.8,
      jitterMul: 1,
    },
    extras: (ctx) => {
      emitColonnade(ctx.out, ctx.lit, ctx.craft, {
        pitch: 0.62 * ctx.b.storey,
        capDrop: 0.3 * ctx.b.storey,
        inset: Math.max(1.5, 0.08 * ctx.lit.W),
        budget: ctx.budget,
      });
      // The entablature wraps around onto the shadow face as a plain band.
      emitCornice(ctx.out, ctx.shadow, ctx.craft, { drop: 0.3 * ctx.b.storey, double: true });
    },
  },

  /** European old town: narrow row houses packed nearly wall to wall, gable
   *  roofs with the ridge down the long axis, small irregular windows,
   *  chimneys. Leans and bows keep their full morph reach — a swaying row of
   *  medieval houses is the whole charm. */
  'old-town': {
    massing: {
      storeys: { min: 2, max: 4 },
      footW: { base: 0.5, var: 0.2 },
      footD: { base: 0.88, var: 0.12 },
      jitterMul: 0.25,
      vacancyMul: 0.85,
      envelopePow: 0,
      tiers: 'none',
      roof: 'gable',
    },
    leanMul: 1,
    bendMul: 1,
    waveMul: 0,
    toneMul: 1.05,
    crossAt: 0.7,
    parapet: false,
    windows: {
      lit: 'grid',
      shadow: 'ticks',
      pitchMul: 0.85,
      widthFrac: 0.42,
      heightFrac: 0.5,
      densityMul: 0.9,
      jitterMul: 1.8,
    },
    extras: (ctx) => {
      // Chimneys on most roofs, placed off-centre along the ridge.
      if (ctx.b.roof.kind !== 'gable' || ctx.b.styleG[3] >= 0.75) return;
      emitChimney(ctx.out, ctx.pr, ctx.b, ctx.spine, ctx.topTier, ctx.b.roof, ctx.b.styleG[4], ctx.occlude);
    },
  },
  /** Brownstone terrace: uniform mid-rise rows packed tight along the
   *  street, regular window grids, a double cornice under a calm parapet
   *  roof, and a stoop with steps up to the door. */
  brownstone: {
    massing: {
      storeys: { min: 4, max: 6 },
      footW: { base: 0.92, var: 0.08 },
      footD: { base: 0.6, var: 0.2 },
      jitterMul: 0.15,
      vacancyMul: 0.6,
      envelopePow: 0,
      tiers: 'none',
      roof: 'flat',
    },
    leanMul: 0.5,
    bendMul: 0.4,
    waveMul: 0.5,
    toneMul: 1,
    crossAt: 0.7,
    parapet: true,
    windows: {
      lit: 'grid',
      shadow: 'ticks',
      pitchMul: 1,
      widthFrac: 0.5,
      heightFrac: 0.45,
      densityMul: 1.1,
      jitterMul: 0.5,
    },
    extras: (ctx) => {
      emitCornice(ctx.out, ctx.lit, ctx.craft, { drop: 0.22 * ctx.b.storey, double: true });
      emitCornice(ctx.out, ctx.shadow, ctx.craft, { drop: 0.22 * ctx.b.storey, double: true });
      if (ctx.b.styleG[3] < 0.8) {
        emitStoop(ctx.out, ctx.pr, ctx.b, ctx.spine, ctx.topTier, ctx.draw.lightSide, ctx.craft, {
          doorT: ctx.b.styleG[4],
        });
      }
    },
  },
  /** Futurist concrete: squarish monoliths and low slabs, a cantilevered
   *  upper mass on many, sparse strip windows on the lit face and a dark
   *  cross-hatched shadow mass. Nearly rigid at any order. */
  brutalist: {
    massing: {
      storeys: { min: 2, max: 8 },
      slabP: 0.4,
      footW: { base: 0.7, var: 0.3 },
      footD: { base: 0.7, var: 0.3 },
      jitterMul: 0.6,
      vacancyMul: 1.1,
      envelopePow: 1,
      tiers: 'cantilever',
      roof: 'flat',
    },
    leanMul: 0.3,
    bendMul: 0.2,
    waveMul: 0,
    toneMul: 1.15,
    crossAt: 0.55,
    parapet: false,
    windows: {
      lit: 'strip',
      shadow: 'none',
      pitchMul: 1,
      widthFrac: 0.5,
      heightFrac: 0.45,
      densityMul: 0.7,
      jitterMul: 0.3,
    },
  },
};

/**
 * Roll one building's style in 'mixed' mode from its style genome draw `t`
 * and the cell's distance to the downtown centre `dd` (0 = core). Weighted
 * so the core stays towers and villas drift to the outskirts; everything
 * shares the same storey, grid and light so the mix reads as one city.
 */
export function rollMixedStyle(t: number, dd: number): BuildingStyle {
  const near = Math.exp(-dd * dd * 1.6);
  const weights: [BuildingStyle, number][] = [
    ['towers', 0.22 + 0.55 * near],
    ['brownstone', 0.26],
    ['old-town', 0.24],
    ['brutalist', 0.14],
    ['greek-villa', 0.05 + 0.18 * (1 - near)],
  ];
  let total = 0;
  for (const [, wt] of weights) total += wt;
  let x = t * total;
  for (const [s, wt] of weights) {
    x -= wt;
    if (x <= 0) return s;
  }
  return 'towers';
}
