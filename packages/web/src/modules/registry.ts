import type { Module } from './types';
import { fromTextureModule } from './from-texture';
import { classicTexture } from '../textures/classic';
import { gratingTexture } from '../textures/grating';
import { blankTexture } from '../textures/blank';
import { imageInkModule } from '../projects/image-ink';
import { flowFieldModule } from '../projects/flow-field';
import { conwayModule } from '../projects/conway';
import { complexFlowModule } from '../projects/complex-flow';
import { reactionDiffusionModule } from '../projects/reaction-diffusion';
import { leniaModule } from '../projects/lenia';
import { noiseTextureModule } from '../projects/noise-texture';

/**
 * Every module, in panel order — the single registry that replaces the old
 * `PROJECTS` + `TEXTURE_MODULES` split. Image→Ink leads (the default first
 * layer); the generative fields follow; the three former background textures
 * (wrapped in place) sit at the end.
 */
// `any` at the registry boundary: each module is internally typed, but the
// heterogeneous array + dynamic Controls rendering need a common element type
// (React component props are invariant, so `unknown` won't unify).
/* eslint-disable @typescript-eslint/no-explicit-any */
export const MODULES: Module<any>[] = [
  imageInkModule,
  flowFieldModule,
  conwayModule,
  complexFlowModule,
  reactionDiffusionModule,
  leniaModule,
  noiseTextureModule,
  fromTextureModule(classicTexture),
  fromTextureModule(gratingTexture),
  fromTextureModule(blankTexture),
];
/* eslint-enable @typescript-eslint/no-explicit-any */

const BY_ID = new Map(MODULES.map((m) => [m.id, m]));

/** The default module a fresh plot's single layer starts as. */
export const DEFAULT_MODULE_ID = 'image-ink';

export function getModule(id: string): Module {
  return BY_ID.get(id) ?? MODULES[0];
}
