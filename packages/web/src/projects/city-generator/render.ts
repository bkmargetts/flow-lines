import { generateCity, type CityOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { CityState } from './types';

/**
 * Pure render for the City Generator: state + page → lines. mm settings
 * convert to px at the page density; px sizes are pre-divided by zoom so
 * they land back at true size after the zoom transform, exactly as the
 * Landscape / Planet Generators do. Multi-ink via `layerColors`.
 */
export function renderCity(state: CityState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;
  const zoom = Math.max(0.2, state.zoom);
  const z = (px: number): number => px / zoom;

  const options: CityOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,

    order: state.order,

    blockCols: Math.round(state.blockCols),
    blockRows: Math.round(state.blockRows),
    lotSize: z(state.lotSizeMm * mm),
    street: z(state.streetMm * mm),
    density: state.density,
    downtown: state.downtown,

    buildingHeight: z(state.heightMm * mm),
    heightVariance: state.heightVariance,
    storey: Math.max(1.5, z(state.storeyMm * mm)),
    tiers: state.tiers,
    lean: state.lean,

    windows: state.windows,
    windowSize: Math.max(1.2, z(state.windowMm * mm)),

    shadeStrength: state.shadeStrength,
    hatchSpacing: Math.max(1, z(state.hatchSpacingMm * mm)),
    lightSide: state.lightSide,

    penWidth: z(state.penWidthMm * mm),
    wobble: z(state.wobbleMm * mm),
    sketch: state.sketch,
    sketchStyle: state.sketchStyle,
  };

  const result = generateCity(options);

  // Zoom: scale the whole city about the page centre, like the other generators.
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

  return {
    lines,
    strokeColor: state.contourColor,
    strokeWidthPx: state.penWidthMm * mm,
    layerColors: {
      contour: state.contourColor,
      edge: state.contourColor,
      roof: state.contourColor,
      window: state.windowColor,
      hatch: state.hatchColor,
    },
  };
}
