import {
  generateReactionDiffusion,
  type ReactionDiffusionOptions,
} from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { RDState } from './types';

/**
 * Pure render for the Reaction–Diffusion module: state + page → lines. The
 * shared finishing (border, density, hold-off) is the compositor's job, so this
 * returns just the drawing and the inks/pen it wants. Multi-ink colours the
 * core/mid/rim pen layers; otherwise a single pen. Simulation params are
 * unitless grid-space — never multiplied by pxPerMm.
 */
export function renderReactionDiffusion(
  state: RDState,
  env: RenderEnv,
): LayerOutput {
  const { page, marginPx } = env;
  const options: ReactionDiffusionOptions = {
    width: page.widthPx,
    height: page.heightPx,
    // The shared paper-border margin, in pixels at the page's density
    margin: marginPx,
    seed: state.seed,
    // Simulation params are grid-space — never multiplied by pxPerMm.
    gridCols: state.gridCols,
    preset: state.preset,
    feed: state.feed,
    kill: state.kill,
    steps: state.steps,
    du: state.du,
    dv: state.dv,
    seedSpots: state.seedSpots,
    seedLayout: state.seedLayout,
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

  const result = generateReactionDiffusion(options);
  return {
    lines: result.lines,
    strokeColor: state.multiInk ? state.coreColor : state.strokeColor,
    strokeWidthPx: state.penWidthMm * page.pxPerMm,
    layerColors: state.multiInk
      ? { core: state.coreColor, mid: state.midColor, rim: state.rimColor }
      : undefined,
  };
}
