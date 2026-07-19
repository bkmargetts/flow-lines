import {
  generateReactionDiffusion,
  type ReactionDiffusionOptions,
} from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { sheetGridFactor } from '../../lib/sheet-scale';
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
  // Grow the sim grid with the sheet so the pattern's cell size stays near
  // physical instead of stretching. A4 is the anchor (factor exactly 1
  // there); growth caps at 2× cols (4× area) to bound sim cost. Seeds scale
  // with the grid area gained so spot density holds.
  const sheetK = sheetGridFactor(page);
  const options: ReactionDiffusionOptions = {
    width: page.widthPx,
    height: page.heightPx,
    // The shared paper-border margin, in pixels at the page's density
    margin: marginPx,
    seed: state.seed,
    // Simulation params are grid-space — never multiplied by pxPerMm.
    gridCols: Math.round(state.gridCols * sheetK),
    preset: state.preset,
    feed: state.feed,
    kill: state.kill,
    steps: state.steps,
    du: state.du,
    dv: state.dv,
    seedSpots: Math.round(state.seedSpots * sheetK * sheetK),
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
