import { generateStickmen, type StickmenOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { StickmenState } from './types';

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
  const lines =
    zoom === 1
      ? result.lines
      : result.lines.map((ln) => ({
          ...ln,
          points: ln.points.map((p) => ({
            x: page.widthPx / 2 + (p.x - page.widthPx / 2) * zoom,
            y: page.heightPx / 2 + (p.y - page.heightPx / 2) * zoom,
          })),
        }));

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
