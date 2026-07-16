import { FlowLine } from '../flow-lines.js';
import { randomSeed } from '../lib/rng.js';
import { DEG, norm } from './vec3.js';
import { DEFAULTS } from './body.js';
import { bodyKy, makeSceneCtx, type ResolvedOptions } from './context.js';
import { renderBody } from './render-body.js';
import { renderRings } from './rings.js';
import { renderCometTail } from './comet.js';
import { composeLayout } from './layouts.js';
import {
  renderStarfield,
  renderAtmosphere,
  renderPlateFrame,
  renderScaleBar,
  renderTitleCaption,
  applyFinish,
  fitBodyToMargin,
} from './furniture.js';
import type { PlanetOptions } from './types.js';

/**
 * Procedural planets drawn as plottable pen-and-ink: a sphere shaded by
 * form-following cross-contour hatching (curved strokes that wrap the globe and
 * thicken into the shadow), confident traced contours for coastlines / band
 * edges / crater rims, stipple texture, and optional rings, craters, a
 * starfield and a companion moon. Everything is single-pen stroked polylines,
 * deterministic per seed — no fills, no stroke-width tricks. Mirrors the Botanical
 * Generator: heavy algorithm here in core, a thin web/CLI wrapper feeds it.
 *
 * One concern per file: `context.ts` holds the scene/body state every renderer
 * shares, `shading.ts` the tonal hatch, `features.ts` the traced/placed surface
 * features, `rings.ts`/`layouts.ts`/`furniture.ts` the rest. Emission order into
 * `scene.lines` is pinned by the golden hashes — this orchestrator (and
 * `render-body.ts`) preserve the original sequence.
 */

export type { PlanetOptions, PlanetType, PlanetLayout } from './types.js';

export function generatePlanet(options: PlanetOptions): {
  lines: FlowLine[];
  width: number;
  height: number;
} {
  const o: ResolvedOptions = { ...DEFAULTS, ...options };
  const seed = options.seed ?? randomSeed();
  const scene = makeSceneCtx(o, seed);
  const { cx, cy, R, L, width, height } = scene;

  // Scene background: starfield (behind everything), then atmosphere/corona
  // around the primary limb (behind the body strokes).
  renderStarfield(scene);
  renderAtmosphere(scene);

  if (o.layout !== 'single') {
    composeLayout(scene);
  } else {
    // Companion-moon geometry first: an eclipsing moon must shadow the
    // primary, and the eclipse is only physical with the moon on the lit side.
    // The moon's depth is inferred from how far up-light it sits, floating it
    // toward the light ray so its umbra lands on the visible lit face (an
    // aligned moon shadows the sub-light point — the classic eclipse plate).
    const ma = o.moonAngle * DEG;
    const mx = cx + Math.cos(ma) * o.moonDist * R;
    const my = cy + Math.sin(ma) * o.moonDist * R;
    const mR = Math.max(6, o.moonRadiusFrac * R);
    const ld = Math.hypot(L.x, L.y);
    const upLight = ld > 1e-6 ? ((mx - cx) * L.x + (my - cy) * L.y) / ld : 0;
    const mz = ld > 1e-6 ? upLight * (L.z / ld) : 0;
    const shadowCasters =
      o.moon && o.eclipse && upLight > 0 ? [{ cx: mx, cy: my, R: mR, z: mz }] : undefined;

    // The primary planet.
    renderBody(scene, {
      cx,
      cy,
      R,
      bodyType: o.planetType,
      bodySeed: seed,
      craters: o.craters,
      ...(shadowCasters ? { shadowCasters } : {}),
    });

    // Comet coma + tail fan anti-sunward behind the nucleus.
    renderCometTail(scene);

    // Rings (Saturn): a flat disc of bands tilted toward edge-on, occluded
    // where it passes behind the sphere.
    const kyMain = bodyKy(o.planetType, o.oblateness);
    if (o.rings) renderRings(scene, cx, cy, R, L, kyMain);

    // Companion moon.
    if (o.moon) {
      renderBody(scene, {
        cx: mx,
        cy: my,
        R: mR,
        bodyType: 'moon',
        bodySeed: seed + 4242,
        craters: true,
        occluders: [kyMain !== 1 ? { cx, cy, R, ky: kyMain } : { cx, cy, R }],
      });
    }
  }

  // Engraved-plate furniture, then the hand-drawn finish, then fit the body
  // inside the margin (furniture stays pinned).
  renderPlateFrame(scene);
  renderScaleBar(scene);
  renderTitleCaption(scene);

  let finished = applyFinish(scene);
  finished = fitBodyToMargin(scene, finished);

  return { lines: finished, width, height };
}
