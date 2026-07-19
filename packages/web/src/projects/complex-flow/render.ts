import {
  generateComplexFlow,
  applyHandDrawnStyle,
  type ComplexFlowOptions,
  type FlowLinesResult,
} from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { buildPaletteLayerColors } from '../../lib/palette';
import { sheetAreaFactor } from '../../lib/sheet-scale';
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
  // The composition — a few big swirls spanning the sheet — IS this module's
  // identity, so the plane map stays page-relative and the swirls grow with
  // the paper. What must not thin out is the ink: streamline count and each
  // streamline's step count both ride the sheet's linear growth, so total
  // ink length rides the area and an A0 field carries the same stroke
  // coverage an A4 gets, with arcs long enough to traverse the grown swirls
  // (×1 at A4 and below, goldens untouched).
  const linF = Math.sqrt(sheetAreaFactor(page));

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
    seedCount: Math.round(state.seedCount * linF),
    stepsPerDir: Math.round(state.stepsPerDir * linF),
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
