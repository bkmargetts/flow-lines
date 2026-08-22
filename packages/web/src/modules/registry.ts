import type { Module } from './types';
import { classicTexture } from '../textures/classic';
import { gratingTexture } from '../textures/grating';
import { blankTexture } from '../textures/blank';
import { imageInkModule } from '../projects/image-ink';
import { flowFieldModule } from '../projects/flow-field';
import { botanicalGeneratorModule } from '../projects/botanical-generator';
import { planetGeneratorModule } from '../projects/planet-generator';
import { landscapeGeneratorModule } from '../projects/landscape-generator';
import { cityGeneratorModule } from '../projects/city-generator';
import { stickmenModule } from '../projects/stickmen';
import { sportsBallsModule } from '../projects/sports-balls';
import { heartsModule } from '../projects/hearts';
import { tanglesModule } from '../projects/tangles';
import { ribbonWeaveModule } from '../projects/ribbon-weave';
import { gestureModule } from '../projects/gesture';
import { machineModule } from '../projects/machine';
import { conwayModule } from '../projects/conway';
import { complexFlowModule } from '../projects/complex-flow';
import { reactionDiffusionModule } from '../projects/reaction-diffusion';
import { leniaModule } from '../projects/lenia';
import { physarumModule } from '../projects/physarum';
import { fractureModule } from '../projects/fracture';
import { noiseTextureModule } from '../projects/noise-texture';
import { colorFieldModule } from '../projects/color-field';
import { inkFieldModule } from '../projects/ink-field';
import { marblingModule } from '../projects/marbling';
import { meanderModule } from '../projects/meander';
import { coralModule } from '../projects/coral';
import { warpGridModule } from '../projects/warp-grid';
import { harmonographModule } from '../projects/harmonograph';
import { impactGridModule } from '../projects/impact-grid';
import { lapidaryModule } from '../projects/lapidary';
import { terracesModule } from '../projects/terraces';
import { arcticModule } from '../projects/arctic';

/**
 * Every module, in panel order — the one flat registry the layer stack draws
 * from. Image→Ink leads (the default first layer); the generative fields
 * follow; the three background textures — ordinary pure modules like the
 * rest — sit at the end.
 */
// `any` at the registry boundary: each module is internally typed, but the
// heterogeneous array + dynamic Controls rendering need a common element type
// (React component props are invariant, so `unknown` won't unify).
/* eslint-disable @typescript-eslint/no-explicit-any */
export const MODULES: Module<any>[] = [
  imageInkModule,
  flowFieldModule,
  botanicalGeneratorModule,
  planetGeneratorModule,
  landscapeGeneratorModule,
  cityGeneratorModule,
  stickmenModule,
  sportsBallsModule,
  heartsModule,
  tanglesModule,
  ribbonWeaveModule,
  gestureModule,
  machineModule,
  conwayModule,
  complexFlowModule,
  reactionDiffusionModule,
  leniaModule,
  physarumModule,
  fractureModule,
  noiseTextureModule,
  colorFieldModule,
  inkFieldModule,
  marblingModule,
  meanderModule,
  coralModule,
  warpGridModule,
  harmonographModule,
  impactGridModule,
  lapidaryModule,
  terracesModule,
  arcticModule,
  classicTexture,
  gratingTexture,
  blankTexture,
];
/* eslint-enable @typescript-eslint/no-explicit-any */

const BY_ID = new Map(MODULES.map((m) => [m.id, m]));

/** The default module a fresh plot's single layer starts as. */
export const DEFAULT_MODULE_ID = 'image-ink';

export function getModule(id: string): Module {
  return BY_ID.get(id) ?? MODULES[0];
}
