import { generateSandpile, type SandpileOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { SandpileState } from './types';

/**
 * Pure render for the Sandpile module: state + page → lines. The shared
 * finishing (border, density, hold-off) is the compositor's job, so this
 * returns just the drawing plus the ink and pen it wants. Every stroke is a
 * straight segment of the tropical curve, so there is one pen layer.
 */
export function renderSandpile(state: SandpileState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const options: SandpileOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,
    preset: state.preset,
    resolution: state.resolution,
    points: state.points,
    domain: state.domain,
    sides: state.sides,
    rotationDeg: state.rotationDeg,
    placement: state.placement,
    ringRadius: state.ringRadius,
    straightness: state.straightness,
    minSegment: state.minSegment,
    wobble: state.wobble,
  };

  const result = generateSandpile(options);
  return {
    lines: result.lines,
    strokeColor: state.strokeColor,
    strokeWidthPx: state.penWidthMm * page.pxPerMm,
  };
}
