import type { LayerOutput, RenderEnv } from './types';
import { renderFlowField } from '../projects/flow-field/render';
import { renderBotanicalGenerator } from '../projects/botanical-generator/render';
import { renderPlanet } from '../projects/planet-generator/render';
import { renderLandscape } from '../projects/landscape-generator/render';
import { renderCity } from '../projects/city-generator/render';
import { renderStickmen } from '../projects/stickmen/render';
import { renderSportsBalls } from '../projects/sports-balls/render';
import { renderHearts } from '../projects/hearts/render';
import { renderTangles } from '../projects/tangles/render';
import { renderRibbonWeave } from '../projects/ribbon-weave/render';
import { renderGesture } from '../projects/gesture/render';
import { renderMachine } from '../projects/machine/render';
import { renderConway } from '../projects/conway/render';
import { renderComplexFlow } from '../projects/complex-flow/render';
import { renderReactionDiffusion } from '../projects/reaction-diffusion/render';
import { renderLenia } from '../projects/lenia/render';
import { renderPhysarum } from '../projects/physarum/render';
import { renderFracture } from '../projects/fracture/render';
import { renderNoiseTexture } from '../projects/noise-texture/render';
import { renderColorField } from '../projects/color-field/render';
import { renderMarbling } from '../projects/marbling/render';
import { renderMeander } from '../projects/meander/render';
import { renderCoral } from '../projects/coral/render';
import { renderWarpGrid } from '../projects/warp-grid/render';
import { renderImpactGrid } from '../projects/impact-grid/render';
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
  'botanical-generator': entry(renderBotanicalGenerator),
  'planet-generator': entry(renderPlanet),
  'landscape-generator': entry(renderLandscape),
  'city-generator': entry(renderCity),
  stickmen: entry(renderStickmen),
  'sports-balls': entry(renderSportsBalls),
  hearts: entry(renderHearts),
  'tangles': entry(renderTangles),
  'ribbon-weave': entry(renderRibbonWeave),
  gesture: entry(renderGesture),
  machine: entry(renderMachine),
  conway: entry(renderConway),
  'complex-flow': entry(renderComplexFlow),
  'reaction-diffusion': entry(renderReactionDiffusion),
  lenia: entry(renderLenia),
  physarum: entry(renderPhysarum),
  fracture: entry(renderFracture),
  'noise-texture': entry(renderNoiseTexture),
  'color-field': entry(renderColorField),
  marbling: entry(renderMarbling),
  meander: entry(renderMeander),
  coral: entry(renderCoral),
  'warp-grid': entry(renderWarpGrid),
  'impact-grid': entry(renderImpactGrid),
  classic: entry(renderClassicTexture, true),
  grating: entry(renderGratingTexture, true),
  blank: entry(renderBlankTexture, true),
};
