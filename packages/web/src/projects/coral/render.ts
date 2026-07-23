import { generateCoral, type CoralOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { CoralState } from './types';

/**
 * Pure render for the Coral module: state + page → lines. The shared
 * finishing (border, density, hold-off) is the compositor's job, so this
 * returns just the drawing and the inks/pen it wants. Multi-ink colours the
 * edge / ring / relic pen layers; otherwise a single pen.
 */
export function renderCoral(state: CoralState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const options: CoralOptions = {
    width: page.widthPx,
    height: page.heightPx,
    // The shared paper-border margin, in pixels at the page's density
    margin: marginPx,
    seed: state.seed,
    preset: state.preset,
    iterations: state.iterations,
    growth: state.growth,
    repulsion: state.repulsionMm * page.pxPerMm,
    maxNodes: state.maxNodes,
    noiseScale: state.noiseScale,
    patchiness: state.patchiness,
    curvatureBias: state.curvatureBias,
    jitter: state.jitter,
    seedShape: state.seedShape,
    blobs: state.blobs,
    rings: state.rings,
    fade: state.fade,
    boldPasses: state.boldPasses,
    wobble: state.wobble,
    // Anchor seed/fold sizing at the A3 short edge (297mm) so bigger sheets
    // grow a larger organism at the same physical fold scale; a no-op at
    // A4-and-below.
    refMinDim: 297 * page.pxPerMm,
  };

  const result = generateCoral(options);
  return {
    lines: result.lines,
    strokeColor: state.multiInk ? state.edgeColor : state.strokeColor,
    strokeWidthPx: state.penWidthMm * page.pxPerMm,
    layerColors: state.multiInk
      ? {
          edge: state.edgeColor,
          ring: state.ringColor,
          relic: state.relicColor,
        }
      : undefined,
  };
}
