import type { Module } from './types';
import { fromTextureModule } from './from-texture';
import { classicTexture } from '../textures/classic';
import { gratingTexture } from '../textures/grating';
import { blankTexture } from '../textures/blank';

/**
 * Every module, in panel order — the single registry that replaces the old
 * `PROJECTS` + `TEXTURE_MODULES` split. The generative projects (image-ink,
 * flow-field, conway, …) are appended as they're migrated; the three former
 * background textures are wrapped in place.
 */
// `any` at the registry boundary: each module is internally typed, but the
// heterogeneous array + dynamic Controls rendering need a common element type
// (React component props are invariant, so `unknown` won't unify).
/* eslint-disable @typescript-eslint/no-explicit-any */
export const MODULES: Module<any>[] = [
  fromTextureModule(classicTexture),
  fromTextureModule(gratingTexture),
  fromTextureModule(blankTexture),
];
/* eslint-enable @typescript-eslint/no-explicit-any */

const BY_ID = new Map(MODULES.map((m) => [m.id, m]));

/** The default module a fresh plot's single layer starts as. */
export const DEFAULT_MODULE_ID = 'classic';

export function getModule(id: string): Module {
  return BY_ID.get(id) ?? MODULES[0];
}
