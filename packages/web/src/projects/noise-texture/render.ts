import { generateOverlappedLines } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { gratingToOverlapOptions, gratingBandColors } from '../../textures/grating/shared';
import type { NoiseTextureState } from './types';

/**
 * Pure render for the Noise Texture module: state + page → lines. The shared
 * finishing (border, density, hold-off) is the compositor's job, so this returns
 * just the interleaved grating drawing and the per-band inks it wants. This is a
 * multi-ink layer — `layerColors` carries the `band-NN` palette and `strokeColor`
 * is just the first band as a fallback for any unkeyed line.
 */
export function renderNoiseTexture(state: NoiseTextureState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const result = generateOverlappedLines(gratingToOverlapOptions(state, page, marginPx));
  const layerColors = gratingBandColors(state);
  const strokeColor = Object.values(layerColors)[0] ?? '#000000';
  return {
    lines: result.lines,
    strokeColor,
    strokeWidthPx: state.penWidthMm * page.pxPerMm,
    layerColors,
    sketch: { style: state.sketchStyle, intensity: state.sketch, seed: state.seed },
  };
}
