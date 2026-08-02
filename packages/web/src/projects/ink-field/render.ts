import { generateInkField, type InkFieldOptions, type PageMetrics } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { buildPaletteLayerColors } from '../../lib/palette';
import type { InkFieldState } from './types';

/** Map the project state to core options (mm → px). */
function inkFieldToOptions(state: InkFieldState, page: PageMetrics, marginPx: number): InkFieldOptions {
  const ppm = page.pxPerMm;
  return {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    style: state.style,
    inkCount: state.colorCount,
    pitchPx: state.pitchMm * ppm,
    angleDeg: state.angleDeg,
    penWidthPx: state.penWidthMm * ppm,
    inkPhase: state.inkPhase,
    inkPitchDelta: state.inkPitchDelta,
    phaseDrift: state.phaseDrift,
    misregisterPx: state.misregisterMm * ppm,
    jitterPx: state.jitterMm * ppm,
    wobbleAmpPx: state.wobbleAmpMm * ppm,
    wobbleWavelengthPx: state.wobbleWavelengthMm * ppm,
    bandWidthPx: state.bandWidthMm * ppm,
    ribbonSegments: state.ribbonSegments,
    planeCount: state.planeCount,
    insetPatches: state.insetPatches,
    baseDensity: state.baseDensity,
    planeDensity: state.planeDensity,
    stripeCount: state.stripeCount,
    stripeSoftness: state.stripeSoftness,
    stripeBlocks: state.stripeBlocks,
    blockDuty: state.blockDuty,
    penTests: state.penTests,
    wearOrder: state.wearOrder,
    wearAngleDeg: state.wearAngleDeg,
    minSegmentLengthPx: state.minSegmentLengthMm * ppm,
    seed: state.seed,
  };
}

/**
 * Pure render for the Ink Field module: state + page → one `band-NN` pen per
 * ink. `blendInks` multiplies the band inks in the preview so physically
 * crossing colours show their blended hue — the compositor's per-layer
 * overprint toggle does the same across whole layers.
 */
export function renderInkField(state: InkFieldState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const result = generateInkField(inkFieldToOptions(state, page, marginPx));

  const layerColors = buildPaletteLayerColors(state.palette, state.colorCount, state.customRamp);
  const strokeColor = Object.values(layerColors)[0] ?? '#000000';

  let layerBlend: Record<string, string> | undefined;
  if (state.blendInks) {
    layerBlend = {};
    for (const key of Object.keys(layerColors)) {
      if (key.startsWith('band-')) layerBlend[key] = 'multiply';
    }
  }

  return {
    lines: result.lines,
    strokeColor,
    strokeWidthPx: state.penWidthMm * page.pxPerMm,
    layerColors,
    layerBlend,
  };
}
