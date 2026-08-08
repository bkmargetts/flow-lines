import {
  generateLapidary,
  inkLayerName,
  LAPIDARY_PRESETS,
  VEIN_LAYER,
  type BandTexture,
  type LapidaryOptions,
  type LapidaryTexture,
} from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { CUSTOM_PALETTE, getLapidaryPalette } from './palettes';
import type { LapidaryState, LapidaryTextureMix } from './types';

/** The curated band-texture deals, outer→inner (cycled over the band count).
 *  'specimen'/'geode'/'facet' reuse the core presets' tables so the web look
 *  and the CLI preset stay the same drawing. */
const TEXTURE_MIXES: Record<
  Exclude<LapidaryTextureMix, 'shuffle'>,
  Array<LapidaryTexture | BandTexture>
> = {
  specimen: LAPIDARY_PRESETS.specimen.textures!,
  geode: LAPIDARY_PRESETS.geode.textures!,
  fortification: LAPIDARY_PRESETS.fortification.textures!,
  facet: LAPIDARY_PRESETS.facet.textures!,
  ammonite: LAPIDARY_PRESETS.ammonite.textures!,
  linework: [
    { kind: 'lines', spacingScale: 1.1 },
    { kind: 'wavy', spacingScale: 0.8 },
    { kind: 'lines', spacingScale: 0.7 },
    { kind: 'wavy', spacingScale: 1.2 },
  ],
  tonal: ['hatch', 'mottle', 'stipple', 'cross'],
};

/** The inks the plot actually uses: a named palette carries its own pen
 *  count; 'custom' takes `pens` and the colour fields. */
export function resolveLapidaryInks(state: LapidaryState): string[] {
  const pal = state.palette === CUSTOM_PALETTE ? null : getLapidaryPalette(state.palette);
  if (pal) return pal.inks;
  const pens = Math.max(1, Math.min(4, Math.round(state.pens)));
  return [state.strokeColor, state.ink2Color, state.ink3Color, state.ink4Color].slice(0, pens);
}

/** The kintsugi accent ink: a named palette carries its own vein colour;
 *  'custom' takes the veinColor field. */
export function resolveLapidaryVein(state: LapidaryState): string {
  const pal = state.palette === CUSTOM_PALETTE ? null : getLapidaryPalette(state.palette);
  return pal?.vein ?? state.veinColor;
}

/**
 * Pure render for Lapidary: state + page → lines. mm settings convert to px
 * at the page density; feature sizes anchor at the A3 short edge on larger
 * sheets (the marbling idiom). Multi-ink via `layerColors`, `ink-<n>`.
 */
export function renderLapidary(state: LapidaryState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;

  const inks = resolveLapidaryInks(state);
  const options: LapidaryOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,
    refMinDim: 297 * mm,

    mode: state.mode,
    bands: state.bands,
    field: state.field,
    shapes: state.shapes,
    irregularity: state.irregularity,
    coverage: state.coverage,
    centerX: state.centerX,
    centerY: state.centerY,
    faults: state.faults,
    veins: state.veins,
    spiralForm: state.spiralForm,
    spiralDirection: state.spiralDirection,
    spiralJoin: state.spiralJoin,
    spiralWidth: state.spiralWidth,
    spiralTaper: state.spiralTaper,
    spiralPulse: state.spiralPulse,

    haloPx: state.haloMm * mm,
    outlines: state.outlines,

    textures: state.textureMix === 'shuffle' ? undefined : TEXTURE_MIXES[state.textureMix],
    baseAngleDeg: state.angleDeg,
    angleDriftDeg: state.angleDriftDeg,
    spacingPx: state.spacingMm * mm,
    densityContrast: state.densityContrast,
    waviness: state.waviness,
    patchiness: state.patchiness,

    pens: inks.length,
    penAssignment: state.penAssignment,

    wobble: state.wobbleMm * mm,
  };

  const result = generateLapidary(options);

  const layerColors: Record<string, string> = {};
  inks.forEach((ink, g) => {
    layerColors[inkLayerName(g)] = ink;
  });
  // Harmless when veins are off — no stroke carries the layer.
  layerColors[VEIN_LAYER] = resolveLapidaryVein(state);

  return {
    lines: result.lines,
    strokeColor: inks[0],
    strokeWidthPx: state.penWidthMm * mm,
    layerColors,
  };
}
