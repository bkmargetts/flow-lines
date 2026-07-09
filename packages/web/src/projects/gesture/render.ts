import { generateGesture, type GestureOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { GestureState } from './types';

/**
 * Pure render for Gestural Ink: state + page → lines. The offset-pass pitch
 * follows the pen (0.85 · width so adjacent passes fuse into solid ink).
 */
export function renderGesture(state: GestureState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;

  const options: GestureOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,
    preset: state.preset,

    energy: state.energy,
    inkWeight: state.inkWeight,
    dryness: state.dryness,

    gestures: state.gestures,
    whips: state.whips,
    knots: state.knots,
    spatter: state.spatter,
    drips: state.drips,

    coverage: state.coverage,
    balance: state.balance,
    negativeSpace: state.negativeSpace,

    passSpacing: state.penWidthMm * mm * 0.85,
    wobble: state.wobble,
  };

  return {
    lines: generateGesture(options).lines,
    strokeColor: state.strokeColor,
    strokeWidthPx: state.penWidthMm * mm,
  };
}
