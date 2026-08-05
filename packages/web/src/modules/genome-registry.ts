import { randomFlowGenome } from '../projects/flow-field/Controls';
import { randomBotanicalGenome } from '../projects/botanical-generator/presets';
import { randomPlanetGenome } from '../projects/planet-generator/presets';
import { randomLandscapeGenome } from '../projects/landscape-generator/presets';
import { randomCityGenome } from '../projects/city-generator/presets';
import { randomStickmenGenome } from '../projects/stickmen/Controls';
import { randomSportsBallsGenome } from '../projects/sports-balls/Controls';
import { randomHeartsGenome } from '../projects/hearts/Controls';
import { randomTanglesGenome } from '../projects/tangles/Controls';
import { randomRibbonGenome } from '../projects/ribbon-weave/presets';
import { randomGestureGenome } from '../projects/gesture/Controls';
import { randomMachineGenome } from '../projects/machine/presets';
import { randomConwayGenome } from '../projects/conway/Controls';
import { randomComplexFlowGenome } from '../projects/complex-flow/Controls';
import { randomRDGenome } from '../projects/reaction-diffusion/Controls';
import { randomLeniaGenome } from '../projects/lenia/Controls';
import { randomPhysarumGenome } from '../projects/physarum/Controls';
import { randomFractureGenome } from '../projects/fracture/Controls';
import { randomColorFieldGenome } from '../projects/color-field/Controls';
import { randomInkFieldGenome } from '../projects/ink-field/Controls';
import { randomMarblingGenome } from '../projects/marbling/presets';
import { randomMeanderGenome } from '../projects/meander/Controls';
import { randomCoralGenome } from '../projects/coral/Controls';
import { randomWarpGridGenome } from '../projects/warp-grid/presets';
import { randomHarmonographGenome } from '../projects/harmonograph/presets';
import { randomImpactGridGenome } from '../projects/impact-grid/types';
import { randomClassicGenome } from '../textures/classic/Controls';
import { randomGratingGenome } from '../textures/grating/shared';

/**
 * The main-thread face of the per-module randomise genomes: every pure
 * module's `random<X>Genome`, keyed by module id, for the stack-level
 * "generate artwork" roller (`lib/random-artwork.ts`). About half the genomes
 * live inside `Controls.tsx` files, so this file transitively imports React —
 * NEVER import it from worker code (composite-worker / render-registry).
 *
 * `random-artwork.test.ts` pins the id set against `modules/registry.ts`
 * (every pure module except the blank template), so a new module can't ship
 * without joining the artwork pool.
 */

export type Genome = (rng: () => number) => Record<string, unknown>;

/** How the stack roller colours a layer of this module. Per-module genomes
 *  never touch ink (the genomes.test.ts contract); the roller owns it:
 *  - 'stroke'  — random ink hex into every `*color` state field + pen width;
 *  - 'palette' — roll the lib/palette `palette` id (or a custom ramp);
 *  - 'self'    — the genome already rolls the module's own named palette. */
export type InkPlan = 'stroke' | 'palette' | 'self';

export interface ArtworkEntry {
  genome: Genome;
  ink: InkPlan;
  /** Slow simulation — the roller caps how many share a stack and clamps the
   *  worst grid/step knobs after the genome roll. */
  heavy?: boolean;
  /** Dense silhouette — eligible as the shape source of a stencil clip. */
  clipAnchor?: boolean;
}

const entry = (
  genome: (rng: () => number) => Record<string, unknown>,
  ink: InkPlan,
  flags: Pick<ArtworkEntry, 'heavy' | 'clipAnchor'> = {}
): ArtworkEntry => ({ genome, ink, ...flags });

export const ARTWORK_POOL: Record<string, ArtworkEntry> = {
  'flow-field': entry(randomFlowGenome, 'stroke'),
  'botanical-generator': entry(randomBotanicalGenome, 'self', { clipAnchor: true }),
  'planet-generator': entry(randomPlanetGenome, 'self', { clipAnchor: true }),
  'landscape-generator': entry(randomLandscapeGenome, 'self', { clipAnchor: true }),
  'city-generator': entry(randomCityGenome, 'stroke', { clipAnchor: true }),
  stickmen: entry(randomStickmenGenome, 'stroke'),
  'sports-balls': entry(randomSportsBallsGenome, 'stroke'),
  hearts: entry(randomHeartsGenome, 'stroke', { clipAnchor: true }),
  tangles: entry(randomTanglesGenome, 'stroke', { clipAnchor: true }),
  'ribbon-weave': entry(randomRibbonGenome, 'stroke'),
  gesture: entry(randomGestureGenome, 'stroke'),
  machine: entry(randomMachineGenome, 'stroke', { clipAnchor: true }),
  conway: entry(randomConwayGenome, 'stroke'),
  'complex-flow': entry(randomComplexFlowGenome, 'palette'),
  'reaction-diffusion': entry(randomRDGenome, 'stroke', { heavy: true }),
  lenia: entry(randomLeniaGenome, 'stroke', { heavy: true }),
  physarum: entry(randomPhysarumGenome, 'stroke', { heavy: true }),
  fracture: entry(randomFractureGenome, 'stroke'),
  'noise-texture': entry(randomGratingGenome, 'palette'),
  'color-field': entry(randomColorFieldGenome, 'palette'),
  'ink-field': entry(randomInkFieldGenome, 'palette'),
  marbling: entry(randomMarblingGenome, 'stroke'),
  meander: entry(randomMeanderGenome, 'stroke'),
  coral: entry(randomCoralGenome, 'stroke', { clipAnchor: true }),
  'warp-grid': entry(randomWarpGridGenome, 'stroke'),
  harmonograph: entry(randomHarmonographGenome, 'stroke'),
  'impact-grid': entry(randomImpactGridGenome, 'self', { clipAnchor: true }),
  classic: entry(randomClassicGenome, 'stroke'),
  grating: entry(randomGratingGenome, 'palette'),
};
