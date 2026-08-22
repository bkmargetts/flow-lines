import { generateLifeTerraces, inkLayerName, type LifeTerracesOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { sheetAreaFactor } from '../../lib/sheet-scale';
import { CUSTOM_PALETTE, getLapidaryPalette } from '../lapidary/palettes';
import type { LifeTerracesState } from './types';

/** The inks the plot actually uses: a named palette carries its own pen
 *  count; 'custom' takes `pens` and the colour fields. */
export function resolveLifeTerracesInks(state: LifeTerracesState): string[] {
  const pal = state.palette === CUSTOM_PALETTE ? null : getLapidaryPalette(state.palette);
  if (pal) return pal.inks;
  const pens = Math.max(1, Math.min(4, Math.round(state.pens)));
  return [state.strokeColor, state.ink2Color, state.ink3Color, state.ink4Color].slice(0, pens);
}

/**
 * Pure render for Life Terraces: state + page → lines. mm settings convert to
 * px at the page density; the grid is physical (cellSizeMm), so detonations
 * scale with sheet area the conway way. Multi-ink via `layerColors`: the
 * terrace levels spread across the palette (`ink-<n>`), the crisp present
 * rides the first (darkest) pen.
 */
export function renderLifeTerraces(state: LifeTerracesState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;

  const inks = resolveLifeTerracesInks(state);
  const options: LifeTerracesOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,

    seedCount: Math.max(1, Math.round(state.seedCount * sheetAreaFactor(page))),
    cellSize: state.cellSizeMm * mm,
    generations: state.generations,
    decay: state.decay,
    gamma: state.gamma,
    offCenter: state.offCenter,

    levels: state.levels,
    faintThreshold: state.faintThreshold,
    seamWidth: state.seamMm * mm,
    outlines: state.outlines,
    outlineEmphasis: state.outlineEmphasis,

    spacing: state.spacing,
    densityContrast: state.densityContrast,
    strokeLength: state.strokeLength,
    waviness: state.waviness,
    taper: state.taper,
    continuous: state.continuous,

    massCore: state.massCore,
    hatchAngle: state.hatchAngle,
    crossHatchAmount: state.crossHatchAmount,
    residueMaxCells: state.residueMaxCells,
    haloRadius: state.haloMm * mm,

    pens: inks.length,
    penAssignment: state.penAssignment,

    wobble: state.wobbleMm * mm,
  };

  const result = generateLifeTerraces(options);

  const layerColors: Record<string, string> = { present: inks[0] };
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
