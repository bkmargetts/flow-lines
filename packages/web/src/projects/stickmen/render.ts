import { generateStickmen, type StickmenOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { StickmenState } from './types';
import { clipLinesToRect } from './clip';

const DEG = Math.PI / 180;

/**
 * Pure render for the Stick Men generator: state + page → lines. mm settings
 * convert to px at the page density; px sizes are pre-divided by zoom so they
 * land back at true size after the zoom transform, exactly as the City /
 * Landscape / Planet Generators do.
 */
export function renderStickmen(state: StickmenState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;
  const zoom = Math.max(0.2, state.zoom);
  const z = (px: number): number => px / zoom;

  const options: StickmenOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,

    count: Math.round(state.count),
    spread: state.spread,
    clustering: state.clustering,
    minSeparation: z(state.minSeparationMm * mm),
    facing: state.facing,
    facingAngle: state.facingAngleDeg * DEG,
    facingJitter: state.facingJitterDeg * DEG,

    figureScale: z(state.figureHeightMm * mm),
    scaleVariance: state.scaleVariance,
    limbCurve: state.limbCurve,
    penWidth: z(state.penWidthMm * mm),

    poseEnergy: state.poseEnergy,

    occlude: state.occlude,
    groundContact: state.groundContact,
    wobble: z(state.wobbleMm * mm),
  };

  const result = generateStickmen(options);

  // Zoom: scale the whole crowd about the page centre, like the other generators.
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
