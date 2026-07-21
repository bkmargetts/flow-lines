import { generateMeander, type MeanderOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { MeanderState } from './types';

/**
 * Pure render for the Meander module: state + page → lines. The shared
 * finishing (border, density, hold-off) is the compositor's job, so this
 * returns just the drawing and the inks/pen it wants. Multi-ink colours the
 * channel / trace / oxbow pen layers; otherwise a single pen.
 */
export function renderMeander(state: MeanderState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const options: MeanderOptions = {
    width: page.widthPx,
    height: page.heightPx,
    // The shared paper-border margin, in pixels at the page's density
    margin: marginPx,
    seed: state.seed,
    preset: state.preset,
    iterations: state.iterations,
    migration: state.migration,
    bendScale: state.bendScale,
    valleyWidth: state.valleyWidth,
    flowAngleDeg: state.flowAngleDeg,
    jitter: state.jitter,
    channelWidth: state.channelWidthMm * page.pxPerMm,
    traces: state.traces,
    fade: state.fade,
    oxbows: state.oxbows,
    flowLines: state.flowLines,
    boldPasses: state.boldPasses,
    wobble: state.wobble,
    // Anchor bend/spacing sizing at the A3 short edge (297mm) so bigger
    // sheets grow a longer river at the same physical scale; a no-op at
    // A4-and-below.
    refMinDim: 297 * page.pxPerMm,
  };

  const result = generateMeander(options);
  return {
    lines: result.lines,
    strokeColor: state.multiInk ? state.channelColor : state.strokeColor,
    strokeWidthPx: state.penWidthMm * page.pxPerMm,
    layerColors: state.multiInk
      ? {
          channel: state.channelColor,
          trace: state.traceColor,
          oxbow: state.oxbowColor,
        }
      : undefined,
  };
}
