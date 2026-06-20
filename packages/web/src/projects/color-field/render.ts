import {
  generateColorField,
  accentLayerName,
  type AccentSpec,
  type ColorFieldOptions,
  type PageMetrics,
} from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { buildPaletteLayerColors } from '../../lib/palette';
import type { ColorFieldState } from './types';

/** Map the project state to core options (mm → px), resolving accents. */
function colorFieldToOptions(state: ColorFieldState, page: PageMetrics, marginPx: number): ColorFieldOptions {
  const ppm = page.pxPerMm;
  // Only `bar` accents take an accent-NN pen layer; gaps just reserve paper.
  let barIndex = 0;
  const accents: AccentSpec[] = state.accents.map((a) => ({
    type: a.type,
    orientation: a.orientation,
    posPct: a.posPct,
    startPct: a.startPct,
    lenPct: a.lenPct,
    thicknessPx: a.thicknessMm * ppm,
    taper: a.taper,
    layerIndex: a.type === 'bar' ? barIndex++ : undefined,
  }));
  return {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    angleDeg: state.angleDeg,
    lineLengthPct: state.lineLengthPct,
    spacingPx: state.spacingMm * ppm,
    inkCount: state.colorCount,
    gradientMode: state.gradientMode,
    gradientAngleDeg: state.gradientAngleDeg,
    focalXPct: state.focalXPct,
    focalYPct: state.focalYPct,
    gradientRadiusPct: state.gradientRadiusPct,
    blend: state.blend,
    gradientNoiseAmpPx: state.gradientNoiseAmpMm * ppm,
    gradientNoiseScale: state.gradientNoiseScale,
    ditherScale: state.ditherScale,
    jitterPx: state.jitterMm * ppm,
    wobbleAmpPx: state.wobbleAmpMm * ppm,
    wobbleWavelengthPx: state.wobbleWavelengthMm * ppm,
    minSegmentLengthPx: state.minSegmentLengthMm * ppm,
    accents,
    penWidthPx: state.penWidthMm * ppm,
    seed: state.seed,
  };
}

/**
 * Pure render for the Colour Field module: state + page → banded gradient lines
 * (one `band-NN` pen per palette colour) plus any `accent-NN` bar layers. The
 * compositor handles border / density / hold-off and the multi-pen export.
 */
export function renderColorField(state: ColorFieldState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const result = generateColorField(colorFieldToOptions(state, page, marginPx));

  const layerColors: Record<string, string> = buildPaletteLayerColors(
    state.palette,
    state.colorCount,
    state.customRamp
  );
  // Each bar accent gets its own ink, keyed by the same accent-NN layer the core
  // tagged its strokes with.
  let barIndex = 0;
  for (const a of state.accents) {
    if (a.type === 'bar') layerColors[accentLayerName(barIndex++)] = a.color;
  }

  const strokeColor = Object.values(layerColors)[0] ?? '#000000';
  return {
    lines: result.lines,
    strokeColor,
    strokeWidthPx: state.penWidthMm * page.pxPerMm,
    layerColors,
  };
}
