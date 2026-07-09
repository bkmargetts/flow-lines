import type { LayerOutput, RenderEnv } from './types';
import { renderFlowField } from '../projects/flow-field/render';
import { renderVineGenerator } from '../projects/vine-generator/render';
import { renderPlanet } from '../projects/planet-generator/render';
import { renderLandscape } from '../projects/landscape-generator/render';
import { renderCity } from '../projects/city-generator/render';
import { renderStickmen } from '../projects/stickmen/render';
import { renderRibbonWeave } from '../projects/ribbon-weave/render';
import { renderGesture } from '../projects/gesture/render';
import { renderConway } from '../projects/conway/render';
import { renderComplexFlow } from '../projects/complex-flow/render';
import { renderReactionDiffusion } from '../projects/reaction-diffusion/render';
import { renderLenia } from '../projects/lenia/render';
import { renderPhysarum } from '../projects/physarum/render';
import { renderNoiseTexture } from '../projects/noise-texture/render';
import { renderColorField } from '../projects/color-field/render';
import { renderClassicTexture } from '../textures/classic/render';
import { renderGratingTexture } from '../textures/grating/render';
import { renderBlankTexture } from '../textures/blank/render';

/**
 * The worker-safe face of the module registry: every pure module's `render`,
 * keyed by module id, importing ONLY the React-free `render.ts` files — no
 * Controls, no React — so the composite worker can bundle it. `consumesAvoid`
 * mirrors each module object's flag; `render-registry.test.ts` pins both the
 * id set and the flags against `modules/registry.ts` so they cannot drift.
 */

/** A pure render function, widened over state the same way the registry
 *  widens Module (each render is internally typed; the lookup is by id). */
type AnyRender = (state: unknown, env: RenderEnv) => LayerOutput | null;

export interface RenderEntry {
  render: AnyRender;
  /** The module natively reserves paper around `env.avoid` (textures). */
  consumesAvoid?: boolean;
}

const entry = <S,>(
  render: (state: S, env: RenderEnv) => LayerOutput | null,
  consumesAvoid?: boolean
): RenderEntry => ({ render: render as AnyRender, ...(consumesAvoid ? { consumesAvoid } : {}) });

export const RENDERERS: Record<string, RenderEntry> = {
  'flow-field': entry(renderFlowField),
  'vine-generator': entry(renderVineGenerator),
  'planet-generator': entry(renderPlanet),
  'landscape-generator': entry(renderLandscape),
  'city-generator': entry(renderCity),
  stickmen: entry(renderStickmen),
  'ribbon-weave': entry(renderRibbonWeave),
  gesture: entry(renderGesture),
  conway: entry(renderConway),
  'complex-flow': entry(renderComplexFlow),
  'reaction-diffusion': entry(renderReactionDiffusion),
  lenia: entry(renderLenia),
  physarum: entry(renderPhysarum),
  'noise-texture': entry(renderNoiseTexture),
  'color-field': entry(renderColorField),
  classic: entry(renderClassicTexture, true),
  grating: entry(renderGratingTexture, true),
  blank: entry(renderBlankTexture, true),
};
