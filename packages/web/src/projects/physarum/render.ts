import { generatePhysarum, type PhysarumOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { sheetGridFactor } from '../../lib/sheet-scale';
import type { PhysarumState } from './types';

/**
 * Pure render for the Physarum module: state + page → lines. The shared
 * finishing (border, density, hold-off) is the compositor's job, so this returns
 * just the drawing and the inks/pen it wants. Simulation params are unitless
 * grid-space — they are NOT converted to px. Multi-ink colours the core/mid/rim
 * pen layers; otherwise a single pen.
 */
export function renderPhysarum(state: PhysarumState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  // Grow the sim grid with the sheet so vein pitch stays near its physical
  // size instead of stretching. A4 is the anchor (factor exactly 1 there);
  // growth caps at 2× cols (4× area) to bound sim cost. Agents scale with
  // the grid area actually gained so trail density — and vein weight —
  // holds.
  const sheetK = sheetGridFactor(page);
  const options: PhysarumOptions = {
    width: page.widthPx,
    height: page.heightPx,
    // The shared paper-border margin, in pixels at the page's density
    margin: marginPx,
    seed: state.seed,
    // Simulation params are grid-space — never multiplied by pxPerMm.
    gridCols: Math.round(state.gridCols * sheetK),
    // A bigger grid needs a proportionally bigger step budget or the sim
    // never develops; ×1 at A4 and below, so existing output is untouched.
    budgetScale: sheetK * sheetK,
    preset: state.preset,
    agentCount: Math.round(state.agentCount * sheetK * sheetK),
    sensorAngleDeg: state.sensorAngleDeg,
    sensorDistance: state.sensorDistance,
    rotationAngleDeg: state.rotationAngleDeg,
    stepSize: state.stepSize,
    depositAmount: state.depositAmount,
    decay: state.decay,
    diffuseRate: state.diffuseRate,
    steps: state.steps,
    startLayout: state.startLayout,
    style: state.style,
    sampleEvery: state.sampleEvery,
    minPathLength: state.minPathLength,
    pathFraction: state.pathFraction,
    contourLevels: state.contourLevels,
    blurSigma: state.blurSigma,
    isoLow: state.isoLow,
    isoHigh: state.isoHigh,
    fillThreshold: state.fillThreshold,
    artStyle: state.artStyle,
    hatchAngle: state.hatchAngle,
    crossHatchAmount: state.crossHatchAmount,
    hatchJitter: state.hatchJitter,
    valueBands: state.valueBands,
    vignette: state.vignette,
    wobble: state.wobble,
  };

  const result = generatePhysarum(options);
  return {
    lines: result.lines,
    strokeColor: state.multiInk ? state.coreColor : state.strokeColor,
    strokeWidthPx: state.penWidthMm * page.pxPerMm,
    layerColors: state.multiInk
      ? { core: state.coreColor, mid: state.midColor, rim: state.rimColor }
      : undefined,
  };
}
