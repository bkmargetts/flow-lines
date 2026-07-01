import { generateLenia, type LeniaOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
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
  const options: LeniaOptions = {
    width: page.widthPx,
    height: page.heightPx,
    // The shared paper-border margin, in pixels at the page's density
    margin: marginPx,
    seed: state.seed,
    // Simulation params are grid-space — never multiplied by pxPerMm.
    gridCols: state.gridCols,
    preset: state.preset,
    kernelRadius: state.kernelRadius,
    mu: state.mu,
    sigma: state.sigma,
    timeRes: state.timeRes,
    beta: state.beta,
    seedPattern: state.seedPattern,
    seedSpots: state.seedSpots,
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
    sketch: { style: state.sketchStyle, intensity: state.sketch, seed: state.seed },
  };
}
