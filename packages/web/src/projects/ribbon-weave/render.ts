import { generateRibbonWeave, type RibbonWeaveOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { RibbonWeaveState } from './types';

/**
 * Pure render for the Ribbon Weave: state + page → lines. mm settings
 * convert to px at the page density. Multi-ink via `layerColors`: with one
 * pen group the marks keep their semantic layers (`edge` / `rung` / `shade` /
 * `shadow`); with 2–3 groups each strand family gets a `g<n>-` prefix and
 * its own ink.
 */
export function renderRibbonWeave(state: RibbonWeaveState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;

  const groups = Math.max(1, Math.min(3, Math.round(state.inkGroups)));
  const options: RibbonWeaveOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,

    order: state.order,

    cell: Math.max(6 * mm, state.cellMm * mm),
    bandWidth: state.bandMm * mm,
    breaks: state.breaks,
    edge: state.edge,
    meander: state.meander,

    rungs: state.rungs,
    rungCurve: state.rungCurve,
    shading: state.shading,
    shadowHatch: state.shadowHatch,
    lightAngle: (state.lightAngleDeg * Math.PI) / 180,
    gap: state.gapMm * mm,
    twists: state.twists,

    inkGroups: groups,

    penWidth: state.penWidthMm * mm,
    wobble: state.wobbleMm * mm,
    sketch: state.sketch,
    sketchStyle: state.sketchStyle,
  };

  const result = generateRibbonWeave(options);

  let layerColors: Record<string, string>;
  if (groups > 1) {
    const inks = [state.strokeColor, state.ink2Color, state.ink3Color];
    layerColors = {};
    for (let g = 0; g < groups; g++) {
      for (const layer of ['edge', 'rung', 'shade', 'shadow']) {
        layerColors[`g${g}-${layer}`] = inks[g];
      }
    }
  } else {
    layerColors = {
      edge: state.strokeColor,
      rung: state.strokeColor,
      shade: state.shadeColor,
      shadow: state.shadeColor,
    };
  }

  return {
    lines: result.lines,
    strokeColor: state.strokeColor,
    strokeWidthPx: state.penWidthMm * mm,
    layerColors,
  };
}
