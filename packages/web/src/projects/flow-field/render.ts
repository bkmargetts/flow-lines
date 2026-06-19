import {
  generateFlowLines,
  generateFlowLinesEven,
  type FlowLinesOptions,
} from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { FlowState } from './types';

/**
 * Pure render for the Flow Field module: state + page → lines. The shared
 * finishing (border, density, background texture, hold-off) is the
 * compositor's job now, so this returns just the streamlines and the pen it
 * wants. Painted seeds win over dense-fill; otherwise dense-fill packs evenly
 * and the default scatters `lineCount` random seeds.
 */
export function renderFlowField(state: FlowState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;

  const usePaintedPoints = state.paintMode && state.paintedPoints.length > 0;
  // Painted seeds are explicit intent, so they win over dense-fill.
  const useDenseFill = state.denseFill && !usePaintedPoints;

  const flowOptions: FlowLinesOptions = {
    width: page.widthPx,
    height: page.heightPx,
    lineCount: usePaintedPoints ? state.paintedPoints.length : state.lineCount,
    seed: state.seed,
    stepLength: state.stepLength,
    maxSteps: state.maxSteps,
    // The shared paper-border margin, in pixels at the page's density
    margin: marginPx,
    minLineLength: state.minLineLength,
    noiseScale: state.noiseScale,
    octaves: state.octaves,
    persistence: state.persistence,
    lacunarity: state.lacunarity,
    ...(usePaintedPoints && { startPoints: state.paintedPoints }),
  };

  const result = useDenseFill
    ? generateFlowLinesEven({
        width: flowOptions.width,
        height: flowOptions.height,
        separation: Math.max(1, state.lineSpacingMm * page.pxPerMm),
        seed: flowOptions.seed,
        stepLength: flowOptions.stepLength,
        maxSteps: flowOptions.maxSteps,
        margin: flowOptions.margin,
        minLineLength: flowOptions.minLineLength,
        noiseScale: flowOptions.noiseScale,
        octaves: flowOptions.octaves,
        persistence: flowOptions.persistence,
        lacunarity: flowOptions.lacunarity,
      })
    : generateFlowLines(flowOptions);

  return {
    lines: result.lines,
    strokeColor: state.strokeColor,
    strokeWidthPx: state.penWidthMm * page.pxPerMm,
  };
}
