import { generateMarbling, inkLayerName, type MarblingOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { MarblingState } from './types';

/**
 * Pure render for Marbling: state + page → lines. mm settings convert to px
 * at the page density; feature sizes anchor at the A3 short edge on larger
 * sheets (the fracture idiom). Multi-ink via `layerColors`: drops cycle
 * through up to four pens, tagged `ink-<n>`.
 */
export function renderMarbling(state: MarblingState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;

  const groups = Math.max(1, Math.min(4, Math.round(state.inkGroups)));
  const options: MarblingOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,
    pattern: state.preset,
    refMinDim: 297 * mm,

    drops: state.drops,
    dropRadius: state.dropSizeMm * mm,
    dropRadiusJitter: state.dropJitter,
    ringsPerDrop: state.ringsPerDrop,
    inkGroups: groups,

    combSpacing: state.combSpacingMm * mm,
    combStrength: state.swirl,
    falloff: state.falloffMm * mm,
    wavy: state.wavy,
    vortexStrength: state.vortex,

    detail: state.detailMm * mm,
    wobble: state.wobbleMm * mm,
  };

  const result = generateMarbling(options);

  const inks = [state.strokeColor, state.ink2Color, state.ink3Color, state.ink4Color];
  const layerColors: Record<string, string> = {};
  for (let g = 0; g < groups; g++) layerColors[inkLayerName(g)] = inks[g];

  return {
    lines: result.lines,
    strokeColor: state.strokeColor,
    strokeWidthPx: state.penWidthMm * mm,
    layerColors,
  };
}
