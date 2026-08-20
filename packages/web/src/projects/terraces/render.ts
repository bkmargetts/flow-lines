import {
  generateTerraces,
  inkLayerName,
  TERRACES_DEFAULT_TEXTURES,
  type BandTexture,
  type LapidaryTexture,
  type TerracesOptions,
} from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { CUSTOM_PALETTE, getLapidaryPalette } from '../lapidary/palettes';
import type { TerracesState, TerracesTextureMix } from './types';

/** The curated bed-texture deals, top→bottom (cycled over the bed count).
 *  'fortification' is the core default — the reference look — so the web
 *  sheet and the CLI stay the same drawing; 'shuffle' hands the deal to the
 *  core's seeded picker via the empty list. */
const TEXTURE_MIXES: Record<TerracesTextureMix, Array<LapidaryTexture | BandTexture>> = {
  fortification: TERRACES_DEFAULT_TEXTURES,
  linework: [
    { kind: 'lines', spacingScale: 1.1 },
    { kind: 'wavy', spacingScale: 0.8 },
    { kind: 'lines', spacingScale: 0.7 },
    { kind: 'wavy', spacingScale: 1.2 },
  ],
  tonal: ['hatch', 'mottle', 'stipple', 'cross'],
  shuffle: [],
};

/** The inks the plot actually uses: a named palette carries its own pen
 *  count; 'custom' takes `pens` and the colour fields. */
export function resolveTerracesInks(state: TerracesState): string[] {
  const pal = state.palette === CUSTOM_PALETTE ? null : getLapidaryPalette(state.palette);
  if (pal) return pal.inks;
  const pens = Math.max(1, Math.min(4, Math.round(state.pens)));
  return [state.strokeColor, state.ink2Color, state.ink3Color, state.ink4Color].slice(0, pens);
}

/**
 * Pure render for Terraces: state + page → lines. mm settings convert to px
 * at the page density; feature sizes anchor at the A3 short edge on larger
 * sheets (the marbling idiom). Multi-ink via `layerColors`, `ink-<n>`.
 */
export function renderTerraces(state: TerracesState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;

  const inks = resolveTerracesInks(state);
  const options: TerracesOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,
    refMinDim: 297 * mm,

    bands: state.bands,
    irregularity: state.irregularity,
    steppiness: state.steppiness,

    faults: state.faults,
    faultThrow: state.faultThrow,
    faultIncline: state.faultIncline,

    haloPx: state.haloMm * mm,
    outlines: state.outlines,
    outlineEmphasis: state.outlineEmphasis,

    textures: TEXTURE_MIXES[state.textureMix],
    baseAngleDeg: state.angleDeg,
    angleDriftDeg: state.angleDriftDeg,
    spacingPx: state.spacingMm * mm,
    densityContrast: state.densityContrast,
    waviness: state.waviness,
    patchiness: state.patchiness,
    taper: state.taper,
    continuous: state.continuous,
    jitterDeg: state.jitterDeg,
    toneShape: state.toneShape,
    toneStrength: state.toneStrength,
    lightAngleDeg: state.lightAngleDeg,
    sheetTone: state.sheetTone,
    sheetToneStrength: state.sheetToneStrength,

    pens: inks.length,
    penAssignment: state.penAssignment,

    wobble: state.wobbleMm * mm,
  };

  const result = generateTerraces(options);

  const layerColors: Record<string, string> = {};
  inks.forEach((ink, g) => {
    layerColors[inkLayerName(g)] = ink;
  });

  return {
    lines: result.lines,
    strokeColor: inks[0],
    strokeWidthPx: state.penWidthMm * mm,
    layerColors,
  };
}
