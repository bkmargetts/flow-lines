import { generateVenation, type VenationOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { buildPaletteLayerColors } from '../../lib/palette';
import type { VenationState } from './types';

/**
 * Pure render for the Leaf Venation module: state + page → a branching vein
 * network. Vein depth maps onto `band-NN` pen layers (so colour follows vein
 * order, like Colour Field); a single layer plots one pen. The compositor
 * handles border / density / hold-off and the multi-pen export.
 */
export function renderVenation(state: VenationState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const ppm = page.pxPerMm;

  const options: VenationOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,
    region: state.region,
    attractorCount: state.attractorCount,
    rootCount: state.rootCount,
    growthStep: state.growthStepMm * ppm,
    attractionDist: state.attractionDistMm * ppm,
    killDist: state.killDistMm * ppm,
    minBranchLength: state.minBranchLengthMm * ppm,
    maxIterations: state.maxIterations,
    directionBias: state.directionBias,
    biasNoiseScale: state.biasNoiseScale,
    layerCount: state.layerCount,
    boldTrunk: state.boldTrunk,
    optimize: state.optimize,
  };
  const result = generateVenation(options);

  // >1 layer: each vein-order band takes its own palette ink. Single layer:
  // drop layerColors so every stroke falls back to the one stroke colour.
  const layerColors =
    state.layerCount > 1
      ? buildPaletteLayerColors(state.palette, state.layerCount, state.customRamp)
      : undefined;
  const strokeColor = layerColors ? (Object.values(layerColors)[0] ?? state.strokeColor) : state.strokeColor;

  return {
    lines: result.lines,
    strokeColor,
    strokeWidthPx: state.penWidthMm * ppm,
    layerColors,
  };
}
