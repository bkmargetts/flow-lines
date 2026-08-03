import {
  generateConwayExposure,
  type ConwayExposureOptions,
} from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { sheetAreaFactor } from '../../lib/sheet-scale';
import { buildPaletteLayerColors } from '../../lib/palette';
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
    // More detonations on big sheets: the grid is physical (cellSize in mm),
    // so one R-pentomino blast on A0 would sit alone in the middle of a 4×
    // sheet. Exactly state.seedCount at A4 and below.
    seedCount: Math.max(1, Math.round(state.seedCount * sheetAreaFactor(page))),
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
    weaveInks: state.weaveInks,
    weavePitch: state.weavePitchMm * page.pxPerMm,
    weaveAngle: state.weaveAngle,
    weaveSeparation: state.weaveSeparation,
    weaveVernier: state.weaveVernier,
    weaveBend: state.weaveBend,
    weavePitchSwell: state.weavePitchSwell,
    weaveWobble: state.weaveWobbleMm * page.pxPerMm,
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
  const presentInk = state.multiInk ? state.presentColor : state.strokeColor;

  // The weave grating plots its inks on band-NN layers (like Ink Field), with
  // the crisp present keeping its own pen. Ghost/trail inks don't apply.
  if (state.style === 'weave') {
    const layerColors: Record<string, string> = {
      ...buildPaletteLayerColors(state.weavePalette, state.weaveInks, state.weaveCustomRamp),
      present: presentInk,
    };
    let layerBlend: Record<string, string> | undefined;
    if (state.weaveBlend) {
      layerBlend = {};
      for (const key of Object.keys(layerColors)) {
        if (key.startsWith('band-')) layerBlend[key] = 'multiply';
      }
    }
    return {
      lines: result.lines,
      strokeColor: presentInk,
      strokeWidthPx: state.penWidthMm * page.pxPerMm,
      layerColors,
      layerBlend,
    };
  }

  return {
    lines: result.lines,
    strokeColor: presentInk,
    strokeWidthPx: state.penWidthMm * page.pxPerMm,
    layerColors: state.multiInk
      ? { present: state.presentColor, ghost: state.ghostColor, trail: state.trailColor }
      : undefined,
  };
}
