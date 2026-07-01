import {
  generateConwayExposure,
  type ConwayExposureOptions,
} from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { ConwayState } from './types';

/**
 * Pure render for the Conway Long Exposure module: state + page → lines. The
 * shared finishing (border, density, hold-off) is the compositor's job, so this
 * returns just the drawing and the inks/pen it wants. Multi-ink colours the
 * present/ghost/trail pen layers; otherwise a single pen.
 */
export function renderConway(state: ConwayState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const options: ConwayExposureOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,
    seedCount: state.seedCount,
    cellSize: state.cellSize * page.pxPerMm,
    generations: state.generations,
    decay: state.decay,
    gamma: state.gamma,
    faintThreshold: state.faintThreshold,
    mediumThreshold: state.mediumThreshold,
    solidThreshold: state.solidThreshold,
    residueMaxCells: state.residueMaxCells,
    wobble: state.wobble,
    style: state.style,
    haloRadius: state.haloMm * page.pxPerMm,
    contourLevels: state.contourLevels,
    slipstreamSpacing: state.slipstreamSpacing,
    stippleDensity: state.stippleDensity,
    artStyle: state.artStyle,
    massCore: state.massCore,
    hatchAngle: state.hatchAngle,
    crossHatchAmount: state.crossHatchAmount,
    hatchJitter: state.hatchJitter,
    valueBands: state.valueBands,
    offCenter: state.offCenter,
    vignette: state.vignette,
  };

  const result = generateConwayExposure(options);
  return {
    lines: result.lines,
    strokeColor: state.multiInk ? state.presentColor : state.strokeColor,
    strokeWidthPx: state.penWidthMm * page.pxPerMm,
    layerColors: state.multiInk
      ? { present: state.presentColor, ghost: state.ghostColor, trail: state.trailColor }
      : undefined,
    sketch: { style: state.sketchStyle, intensity: state.sketch, seed: state.seed },
  };
}
