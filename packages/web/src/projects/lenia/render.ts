import { generateLenia, type LeniaOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { sheetGridFactor } from '../../lib/sheet-scale';
import type { LeniaState } from './types';

/**
 * Pure render for the Lenia module: state + page → lines. The shared finishing
 * (border, density, hold-off) is the compositor's job, so this returns just the
 * drawing and the inks/pen it wants. Simulation params are unitless grid-space —
 * they are NOT converted to px. Multi-ink colours the core/mid/rim pen layers;
 * otherwise a single pen.
 */
export function renderLenia(state: LeniaState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  // Grow the sim grid with the sheet so cells — and creatures — stay near
  // their physical size instead of stretching to fill it. A4 is the anchor
  // (factor exactly 1 there, so smaller sheets and the goldens are
  // untouched); growth caps at 2× cols (4× area) because convolution cost
  // rises with the cell count. Populations scale with the grid area actually
  // gained so creature density holds.
  const sheetK = sheetGridFactor(page);
  const options: LeniaOptions = {
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
    kernelRadius: state.kernelRadius,
    mu: state.mu,
    sigma: state.sigma,
    timeRes: state.timeRes,
    beta: state.beta,
    seedPattern: state.seedPattern,
    seedSpots: Math.round(state.seedSpots * sheetK * sheetK),
    steps: state.steps,
    longExposure: state.longExposure,
    decay: state.decay,
    gamma: state.gamma,
    style: state.style,
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

  const result = generateLenia(options);
  return {
    lines: result.lines,
    strokeColor: state.multiInk ? state.coreColor : state.strokeColor,
    strokeWidthPx: state.penWidthMm * page.pxPerMm,
    layerColors: state.multiInk
      ? { core: state.coreColor, mid: state.midColor, rim: state.rimColor }
      : undefined,
  };
}
