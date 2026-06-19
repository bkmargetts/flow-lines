import {
  generateComplexFlow,
  applyHandDrawnStyle,
  type ComplexFlowOptions,
  type FlowLinesResult,
} from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { buildPaletteLayerColors } from '../../lib/palette';
import type { ComplexFlowState } from './types';

/**
 * Pure render for the Complex Flow module (Savva-style poles & zeros): state +
 * page → streamlines. The shared finishing (border, density, background
 * texture, hold-off) is the compositor's job, so this returns just the drawing
 * and the inks/pen it wants. The colour palette becomes per-layer inks keyed by
 * the streamline bands.
 */
export function renderComplexFlow(state: ComplexFlowState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;

  const options: ComplexFlowOptions = {
    width: page.widthPx,
    height: page.heightPx,
    seed: state.seed,
    zeroCount: state.zeroCount,
    poleCount: state.poleCount,
    zeroLayout: state.zeroLayout,
    poleLayout: state.poleLayout,
    singularitySpread: state.singularitySpread,
    planeScale: state.planeScale,
    fieldRotation: (state.fieldRotationDeg * Math.PI) / 180,
    manualZerosPx: state.manualZeros,
    manualPolesPx: state.manualPoles,
    seedLayout: state.seedLayout,
    seedCount: state.seedCount,
    stepsPerDir: state.stepsPerDir,
    stepLength: state.stepLength,
    stepJitter: state.stepJitter,
    wobble: state.wobble,
    speedClampMax: state.speedClampMax,
    minLineLength: state.minLineLength,
    margin: marginPx,
    layerCount: state.layerCount,
    layerBy: state.layerBy,
  };

  let result: FlowLinesResult = generateComplexFlow(options);
  if (state.handDrawn) {
    result = applyHandDrawnStyle(result, { seed: state.seed, amplitude: 0.8 });
  }

  return {
    lines: result.lines,
    // Fallback ink for any band the palette doesn't cover (it always does).
    strokeColor: '#111111',
    strokeWidthPx: state.penWidthMm * page.pxPerMm,
    layerColors: buildPaletteLayerColors(state.palette, state.layerCount, state.customRamp),
  };
}
