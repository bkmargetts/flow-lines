import {
  generateHarmonograph,
  harmonographLayerName,
  type HarmonographOptions,
} from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { HarmonographState } from './types';

/**
 * Pure render for Harmonograph: state + page → lines. mm settings convert to
 * px at the page density; the figure itself is sheet-relative (`scale`), so
 * the composition holds at any sheet size. Multi-ink via `layerColors`:
 * passes, nested repeats and rings cycle through up to four pens, tagged
 * `ink-<n>`.
 */
export function renderHarmonograph(state: HarmonographState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;

  const groups = Math.max(1, Math.min(4, Math.round(state.inkGroups)));
  const options: HarmonographOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,
    preset: state.preset,
    mode: state.mode,

    scale: state.scale,
    jitter: state.jitter,
    inkGroups: groups,

    ratioNum: state.ratioNum,
    ratioDen: state.ratioDen,
    detune: state.detune,
    damping: state.damping,
    rotary: state.rotary,
    phaseDeg: state.phaseDeg,
    periods: state.periods,
    passes: state.passes,

    lobes: state.lobes,
    wheelOrder: state.wheelOrder,
    penOffset: state.penOffset,
    trochoidKind: state.trochoidKind,
    nest: state.nest,
    nestShrink: state.nestShrink,
    nestRotateDeg: state.nestRotateDeg,

    rings: state.rings,
    waves: state.waves,
    waveAmp: state.waveAmp,
    phaseAdvanceDeg: state.phaseAdvanceDeg,
    innerHole: state.innerHole,
    waves2: state.waves2,
    wave2Amp: state.wave2Amp,
    envelope: state.envelope,

    detail: state.detailMm * mm,
    wobble: state.wobbleMm * mm,
  };

  const result = generateHarmonograph(options);

  const inks = [state.strokeColor, state.ink2Color, state.ink3Color, state.ink4Color];
  const layerColors: Record<string, string> = {};
  for (let g = 0; g < groups; g++) layerColors[harmonographLayerName(g)] = inks[g];

  return {
    lines: result.lines,
    strokeColor: state.strokeColor,
    strokeWidthPx: state.penWidthMm * mm,
    layerColors,
  };
}
