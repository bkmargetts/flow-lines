import { generateWarpGrid, type WarpGridOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { WarpGridState } from './types';

/**
 * Pure render for Warp Grid: state + page → lines. mm settings convert to px
 * at the page density; form sizes are sheet-relative fractions (the coral
 * idiom — the composition holds at any sheet size). The core preset still
 * rides along for its taste defaults (sign-flip bias); every exposed knob
 * overrides it explicitly.
 */
export function renderWarpGrid(state: WarpGridState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;

  const options: WarpGridOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,
    preset: state.preset,

    basePattern: state.pattern,
    spacing: state.spacingMm * mm,
    angle: state.angle,
    waveAmp: state.waveAmp,
    wavelength: state.wavelengthMm * mm,

    deformers: state.deformers,
    strength: state.strength,
    relief: state.relief,
    scale: state.scale,
    noiseScale: state.noiseScale,

    dropFloor: state.dropFloor,
    occlude: state.occlude,
    edgeCalm: state.edgeCalm,

    detail: state.detailMm * mm,
    wobble: state.wobbleMm * mm,
  };

  const result = generateWarpGrid(options);

  return {
    lines: result.lines,
    strokeColor: state.strokeColor,
    strokeWidthPx: state.penWidthMm * mm,
  };
}
