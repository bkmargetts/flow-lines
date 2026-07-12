import type { Command } from 'commander';
import {
  applySketch,
  BASE_PX_PER_MM,
  type FlowLinesResult,
  type SketchStyle,
} from '@flow-lines/core';

/**
 * The unified hand-sketch finish, shared verbatim by every command: a global
 * pass over the finished output (after any generator-level sketch options,
 * which keep their own `--sketch*` flags where they exist) applied right
 * before the SVG is written. The `--hand-sketch*` names stay clear of the
 * module-level `--sketch`/`--sketch-style` on botanical/planet/landscape.
 */
export function addSketchOptions(cmd: Command): Command {
  return cmd
    .option(
      '--hand-sketch <number>',
      'Hand-sketch finish over the whole output: wobble, pen lifts, overshoot, overdraw (0-1)',
      '0'
    )
    .option(
      '--hand-sketch-style <s>',
      'Sketch character: loose | fine | gestural | scratchy',
      'loose'
    )
    .option('--hand-sketch-passes <number>', 'Overdraw passes (0 = auto from style)', '0')
    .option('--hand-sketch-overshoot <number>', 'End overshoot strength (0-1)', '0.35')
    .option('--hand-sketch-breaks <number>', 'Pen-lift break frequency (0-1)', '0.25')
    .option('--hand-sketch-seed <number>', 'Sketch seed (default: the render seed)');
}

/**
 * Apply the flags registered by `addSketchOptions` to a finished result — a
 * no-op when `--hand-sketch` is 0 (the default), so existing outputs are
 * byte-identical. `scale` keeps the look stable across render resolutions:
 * pass `resolution / BASE_PX_PER_MM` when plotting with --paper, else 1.
 */
export function applySketchFromFlags(
  result: FlowLinesResult,
  options: Record<string, string | undefined>,
  scale = 1
): FlowLinesResult {
  const intensity = parseFloat(options.handSketch ?? '0');
  if (!(intensity > 0)) return result;
  const passes = parseInt(options.handSketchPasses ?? '0', 10);
  return applySketch(result, {
    style: (options.handSketchStyle ?? 'loose') as SketchStyle,
    intensity,
    overshoot: parseFloat(options.handSketchOvershoot ?? '0.35'),
    breaks: parseFloat(options.handSketchBreaks ?? '0.25'),
    ...(passes > 0 ? { passes } : {}),
    seed: options.handSketchSeed != null ? parseInt(options.handSketchSeed, 10) : result.seed,
    scale,
    clipRect: { x0: 0, y0: 0, x1: result.width, y1: result.height },
  });
}

/** The scale argument for `applySketchFromFlags` from the shared page flags. */
export function sketchScale(options: { paper?: string; resolution?: string }): number {
  return options.paper ? parseFloat(options.resolution ?? `${BASE_PX_PER_MM}`) / BASE_PX_PER_MM : 1;
}
