import { generateVentHoses, type VentHosesOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { sheetAreaFactor } from '../../lib/sheet-scale';
import type { VentHosesState } from './types';
import { clipLinesToRect } from '../stickmen/clip';

const DEG = Math.PI / 180;

/**
 * Pure render for the Vent Hoses generator: state + page → lines. mm
 * settings convert to px at the page density; hose radii are physical so a
 * duct plots the same diameter on any sheet. The clip is a defensive trim —
 * hoses bleed off the frame by design and the core already clips, but
 * wobble can nudge a point past the margin.
 */
export function renderVentHoses(state: VentHosesState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;

  const options: VentHosesOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,

    // Pile density holds on big sheets: more hoses at the same physical
    // diameter (×1 at A4 and below — goldens untouched).
    count: Math.round(state.count * sheetAreaFactor(page)),
    radiusMin: state.radiusMinMm * mm,
    radiusMax: Math.max(state.radiusMinMm, state.radiusMaxMm) * mm,
    wander: state.wander,
    cuffChance: state.cuffChance,
    clearance: state.clearanceMm * mm,

    ringDensity: state.ringDensity,
    ringCurve: state.ringCurve,
    shading: state.shading,
    lightAngle: state.lightAngleDeg * DEG,
    shadowHatch: state.shadowHatch,
    weaveBias: state.weaveBias,
    gap: state.gapMm * mm,

    penWidth: state.penWidthMm * mm,
    wobble: state.wobbleMm * mm,
  };

  const result = generateVentHoses(options);
  const lines = clipLinesToRect(
    result.lines,
    marginPx,
    marginPx,
    page.widthPx - marginPx,
    page.heightPx - marginPx
  );

  return {
    lines,
    strokeColor: state.strokeColor,
    strokeWidthPx: state.penWidthMm * mm,
    layerColors: {
      edge: state.strokeColor,
      ring: state.strokeColor,
      shade: state.strokeColor,
      shadow: state.strokeColor,
    },
  };
}
