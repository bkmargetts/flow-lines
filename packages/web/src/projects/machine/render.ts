import { generateMachine, type MachineOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { MachineState } from './types';

/** Pure render for the Machine: state + page → lines. mm settings convert to
 *  px at the page density. */
export function renderMachine(state: MachineState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;

  const options: MachineOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,

    complexity: state.complexity,
    connectivity: state.connectivity,
    gearSize: Math.max(8 * mm, state.gearSizeMm * mm),
    scaleVariety: state.scaleVariety,
    mechanisms: state.mechanisms,
    frameDensity: state.frameDensity,
    cutaways: Math.max(0, Math.min(3, Math.round(state.cutaways))),
    hiddenLines: state.hiddenLines,

    hatchSpacing: Math.max(0.5, state.hatchMm * mm),
    shading: state.shading,

    penWidth: state.penWidthMm * mm,
    wobble: state.wobbleMm * mm,
    sketch: state.sketch,
    sketchStyle: state.sketchStyle,
  };

  const result = generateMachine(options);

  return {
    lines: result.lines,
    strokeColor: state.strokeColor,
    strokeWidthPx: state.penWidthMm * mm,
  };
}
