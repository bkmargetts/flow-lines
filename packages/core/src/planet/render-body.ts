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
  const start = scene.lines.length;
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

  // Irregular small bodies: deform everything this body drew through one
  // radial warp — the limb becomes the lumpy silhouette and every mark
  // (hatch, craters, contours) follows the same deformation.
  if (ctx.warp) {
    const warp = ctx.warp;
    for (let i = start; i < scene.lines.length; i++) {
      const ln = scene.lines[i];
      scene.lines[i] = { ...ln, points: ln.points.map((p) => warp(p.x, p.y)) };
    }
  }
}
