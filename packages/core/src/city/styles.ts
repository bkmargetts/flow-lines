import type { FlowLine, Point } from '../flow-lines.js';
import type { SimplexNoise } from '../noise.js';
import { emitChimney } from './details.js';
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
  // Placeholder descriptors — filled in as each style lands. Until then a
  // non-tower style renders as towers rather than crashing.
  'greek-villa': { ...TOWERS },

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
  brownstone: { ...TOWERS },
  brutalist: { ...TOWERS },
};

/**
 * Roll one building's style in 'mixed' mode from its style genome draw `t`
 * and the cell's distance to the downtown centre `dd` (0 = core). Weighted
 * so the core stays towers and villas drift to the outskirts.
 */
export function rollMixedStyle(_t: number, _dd: number): BuildingStyle {
  return 'towers';
}
