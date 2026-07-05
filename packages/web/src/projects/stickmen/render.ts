import { generateStickmen, type StickmenOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { StickmenState } from './types';
import { clipLinesToRect } from './clip';

const DEG = Math.PI / 180;

/**
 * Pure render for the Stick Men generator: state + page → lines. mm settings
 * convert to px at the page density. Zoom is a true camera magnification: the
 * crowd is generated once at page scale (zoom-independent), then every point is
 * uniformly scaled about the page centre — so figures AND spacing grow together
 * on zoom-in, and zoom-out shrinks everything and reveals the off-page crowd.
 * (The other generators pre-divide sizes by zoom because they fit-to-page; this
 * one is sized to the page directly, so a plain post-scale is the honest zoom.)
 */
export function renderStickmen(state: StickmenState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;
  const zoom = Math.max(0.2, state.zoom);

  const options: StickmenOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,

    count: Math.round(state.count),
    spread: state.spread,
    clustering: state.clustering,
    minSeparation: state.minSeparationMm * mm,
    facing: state.facing,
    facingAngle: state.facingAngleDeg * DEG,
    facingJitter: state.facingJitterDeg * DEG,

    figureScale: state.figureHeightMm * mm,
    scaleVariance: state.scaleVariance,
    limbCurve: state.limbCurve,
    penWidth: state.penWidthMm * mm,

    poseEnergy: state.poseEnergy,

    occlude: state.occlude,
    groundContact: state.groundContact,
    wobble: state.wobbleMm * mm,
  };

  const result = generateStickmen(options);

  // Zoom: uniformly scale the whole crowd about the page centre — figures and
  // spacing together, a real camera zoom.
  const zoomed =
    zoom === 1
      ? result.lines
      : result.lines.map((ln) => ({
          ...ln,
          points: ln.points.map((p) => ({
            x: page.widthPx / 2 + (p.x - page.widthPx / 2) * zoom,
            y: page.heightPx / 2 + (p.y - page.heightPx / 2) * zoom,
          })),
        }));

  // The core leaves the crowd unclipped (the ground overflows the sheet on
  // purpose). Clip to the drawable box HERE, after zoom, so the page and the
  // exported plot stay inside the sheet — and zooming out pulls the previously
  // off-page figures into the box, revealing them.
  const lines = clipLinesToRect(zoomed, marginPx, marginPx, page.widthPx - marginPx, page.heightPx - marginPx);

  return {
    lines,
    strokeColor: state.strokeColor,
    strokeWidthPx: state.penWidthMm * mm,
    layerColors: {
      figure: state.strokeColor,
      head: state.strokeColor,
      contact: state.strokeColor,
    },
  };
}
