import { generateMachineCodex, type MachineCodexOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { MachineCodexState } from './types';

/** Pure render for the Machine Codex: state + page → lines. mm settings
 *  convert to px at the page density; a blank title means "invent one per
 *  seed" (the core distinguishes undefined from ''). */
export function renderMachineCodex(state: MachineCodexState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;

  const title = state.title.trim();
  const options: MachineCodexOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,

    complexity: state.complexity,
    style: state.style,
    gearSize: Math.max(8 * mm, state.gearSizeMm * mm),
    mechanisms: state.mechanisms,
    hiddenLines: state.hiddenLines,
    cutaway: state.cutaway,

    annotations: state.annotations,
    marginalia: state.marginalia,
    detailInsets: Math.max(0, Math.min(2, Math.round(state.detailInsets))),
    ...(title ? { title } : {}),

    hatchSpacing: Math.max(0.5, state.hatchMm * mm),
    shading: state.shading,

    penWidth: state.penWidthMm * mm,
    wobble: state.wobbleMm * mm,
    sketch: state.sketch,
    sketchStyle: state.sketchStyle,
  };

  const result = generateMachineCodex(options);

  return {
    lines: result.lines,
    strokeColor: state.strokeColor,
    strokeWidthPx: state.penWidthMm * mm,
  };
}
