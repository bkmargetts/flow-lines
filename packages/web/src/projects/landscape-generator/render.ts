import { generateLandscape, type LandscapeOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { LandscapeState } from './types';
import { getLandscapePalette } from './palettes';

/**
 * Pure render for the Landscape Generator: state + page → lines. mm settings
 * convert to px at the page density; fractions (horizon, sun position, water
 * share) map straight across. Spacings, pen width, wobble and every px size are
 * pre-divided by zoom so they land back at the true size after the zoom
 * transform, exactly as the Planet / Vine Generators do. Multi-ink via
 * `layerColors`.
 */
export function renderLandscape(state: LandscapeState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;
  const zoom = Math.max(0.2, state.zoom);
  const z = (px: number): number => px / zoom;
  const usableW = page.widthPx - 2 * marginPx;
  const usableH = page.heightPx - 2 * marginPx;

  const options: LandscapeOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,

    horizonFrac: state.horizonFrac,
    horizonWobble: z(state.horizonWobbleMm * mm),
    horizonFreq: state.horizonFreq,
    hasWater: state.hasWater,
    waterFrac: state.waterFrac,

    skyHatchSpacing: Math.max(1.5, z(state.skyHatchSpacingMm * mm)),
    skyToneTop: state.skyToneTop,
    skyToneHorizon: state.skyToneHorizon,

    sun: state.sun,
    sunX: marginPx + state.sunXFrac * usableW,
    sunY: marginPx + state.sunYFrac * usableH,
    sunRadius: z(state.sunRadiusMm * mm),
    sunHalo: state.sunHalo,
    moonRim: state.moonRim,
    sunRays: state.sunRays,
    reflection: state.reflection,
    reflectionWidth: z(state.reflectionWidthMm * mm),

    waterHatchSpacing: Math.max(1.5, z(state.waterHatchSpacingMm * mm)),
    waterDash: z(state.waterDashMm * mm),
    waterGap: z(state.waterGapMm * mm),

    ridgeCount: Math.round(state.ridgeCount),
    ridgeAmp: z(state.ridgeAmpMm * mm),
    ridgeFreq: state.ridgeFreq,
    ridgeOctaves: Math.round(state.ridgeOctaves),
    ridgePersistence: state.ridgePersistence,
    ridgeHatchSpacing: Math.max(1.5, z(state.ridgeHatchSpacingMm * mm)),
    ridgeHatchAngle: state.ridgeHatchAngle,
    slopeFollow: state.slopeFollow,
    formFollow: state.formFollow,

    headlands: Math.round(state.headlands),
    foreground: state.foreground,
    foregroundSide: state.foregroundSide,

    toneContrast: state.toneContrast,
    crossHatch: Math.round(state.crossHatch),
    hatchPatchiness: state.hatchPatchiness,
    taper: state.taper,

    clouds: state.clouds,
    trees: Math.round(state.trees),
    birds: Math.round(state.birds),

    rocks: Math.round(state.rocks),
    rockMaxSize: z(state.rockMaxSizeMm * mm),
    rockHatchSpacing: Math.max(1.2, z(state.rockHatchSpacingMm * mm)),

    penWidth: z(state.penWidthMm * mm),
    wobble: z(state.wobbleMm * mm),
    sketch: state.sketch,
    sketchStyle: state.sketchStyle,
  };

  const result = generateLandscape(options);

  // Zoom: scale the whole scene about the page centre, like the Planet Generator.
  const lines =
    zoom === 1
      ? result.lines
      : result.lines.map((ln) => ({
          ...ln,
          points: ln.points.map((p) => ({
            x: page.widthPx / 2 + (p.x - page.widthPx / 2) * zoom,
            y: page.heightPx / 2 + (p.y - page.heightPx / 2) * zoom,
          })),
        }));

  const pal = getLandscapePalette(state.palette);
  const layerColors = pal
    ? {
        sky: pal.sky,
        water: pal.water,
        reflection: pal.water,
        ridge: pal.ridge,
        headland: pal.ridge,
        foreground: pal.contour,
        contour: pal.contour,
        horizon: pal.contour,
        rock: pal.rock,
        cloud: pal.sky,
        tree: pal.ridge,
        bird: pal.contour,
        sun: pal.contour,
      }
    : {
        sky: state.skyColor,
        water: state.waterColor,
        reflection: state.waterColor,
        ridge: state.ridgeColor,
        headland: state.ridgeColor,
        foreground: state.contourColor,
        contour: state.contourColor,
        horizon: state.contourColor,
        rock: state.rockColor,
        cloud: state.skyColor,
        tree: state.ridgeColor,
        bird: state.contourColor,
        sun: state.contourColor,
      };

  return {
    lines,
    strokeColor: pal ? pal.contour : state.contourColor,
    strokeWidthPx: state.penWidthMm * mm,
    layerColors,
  };
}
