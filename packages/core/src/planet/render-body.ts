import type { BodyParams } from './body.js';
import { makeBodyCtx, type SceneCtx } from './context.js';
import { renderHatch, renderTerminatorEmphasis, renderStipple, renderLimb } from './shading.js';
import {
  renderContours,
  renderEclipseOutline,
  renderRivers,
  renderRilles,
  renderAurora,
  renderClouds,
  renderStorms,
  renderCraters,
  renderMountains,
  renderGraticule,
} from './features.js';

/** Render one spherical body (planet or moon) into the scene. The call order
 *  is the emission order — it is pinned by the golden hashes. */
export function renderBody(scene: SceneCtx, b: BodyParams): void {
  const ctx = makeBodyCtx(scene, b);
  renderHatch(ctx);
  renderTerminatorEmphasis(ctx);
  renderContours(ctx);
  renderEclipseOutline(ctx);
  renderRivers(ctx);
  renderRilles(ctx);
  renderClouds(ctx);
  renderStorms(ctx);
  renderStipple(ctx);
  renderCraters(ctx);
  renderMountains(ctx);
  renderGraticule(ctx);
  renderAurora(ctx);
  renderLimb(ctx);
}
