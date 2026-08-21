import { generateArctic, type ArcticOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { ArcticState } from './types';

/**
 * Pure render for the Arctic module: state + page → lines. The shared finishing
 * (border, density, hold-off) is the compositor's job, so this returns just the
 * drawing plus the inks and pen it wants. Multi-ink gives each domino class its
 * own pen layer; otherwise a single pen draws the lot.
 */
export function renderArctic(state: ArcticState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const options: ArcticOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,
    preset: state.preset,
    order: state.order,
    marks: state.marks,
    upright: state.upright,
    wobble: state.wobble,
  };

  const result = generateArctic(options);
  return {
    lines: result.lines,
    strokeColor: state.multiInk ? state.northColor : state.strokeColor,
    strokeWidthPx: state.penWidthMm * page.pxPerMm,
    layerColors: state.multiInk
      ? {
          'domino-n': state.northColor,
          'domino-s': state.southColor,
          'domino-e': state.eastColor,
          'domino-w': state.westColor,
        }
      : undefined,
  };
}
