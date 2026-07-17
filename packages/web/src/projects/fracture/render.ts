import { generateFracture, type FractureOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { FractureState } from './types';

/**
 * Pure render for the Fracture module: state + page → lines. The shared
 * finishing (border, density, hold-off) is the compositor's job, so this
 * returns just the drawing and the inks/pen it wants. Multi-ink colours the
 * crack-primary / crack-fine / plate pen layers; otherwise a single pen.
 */
export function renderFracture(state: FractureState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const options: FractureOptions = {
    width: page.widthPx,
    height: page.heightPx,
    // The shared paper-border margin, in pixels at the page's density
    margin: marginPx,
    seed: state.seed,
    preset: state.preset,
    generations: state.generations,
    crackDensity: state.crackDensity,
    stressScale: state.stressScale,
    straightness: state.straightness,
    jitter: state.jitter,
    anisotropy: state.anisotropy,
    anisotropyAngleDeg: state.anisotropyAngleDeg,
    arrestThreshold: state.arrestThreshold,
    edgeNucleation: state.edgeNucleation,
    boldPasses: state.boldPasses,
    plateHatch: state.plateHatch,
    hatchCoverage: state.hatchCoverage,
    hatchAngleDeg: state.hatchAngleDeg,
    edgeCurl: state.edgeCurl,
    wobble: state.wobble,
  };

  const result = generateFracture(options);
  return {
    lines: result.lines,
    strokeColor: state.multiInk ? state.primaryColor : state.strokeColor,
    strokeWidthPx: state.penWidthMm * page.pxPerMm,
    layerColors: state.multiInk
      ? {
          'crack-primary': state.primaryColor,
          'crack-fine': state.fineColor,
          plate: state.plateColor,
        }
      : undefined,
  };
}
