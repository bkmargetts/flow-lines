import type { Command } from 'commander';
import {
  generateMarbling,
  type MarblingOptions,
  type MarblingPattern,
  type SVGOptions,
} from '@flow-lines/core';
import { addTileOptions, resolvePageFrame, writePlotOutput, PAPER_SPEC_HELP } from '../page.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';

export function registerMarbling(program: Command) {
  addTileOptions(addSketchOptions(program.command('marbling')))
    .description(
      'Render mathematical paper marbling (suminagashi/ebru): ink drops push ' +
        'nested rings outward through exact closed-form maps, then comb and ' +
        'vortex strokes shear the bath into the classical patterns'
    )
    .option('-w, --width <number>', 'Canvas width in pixels (ignored with --paper)', '800')
    .option('-h, --height <number>', 'Canvas height in pixels (ignored with --paper)', '800')
    .option('--paper <size>', PAPER_SPEC_HELP)
    .option('--orientation <o>', 'Paper orientation: portrait or landscape', 'portrait')
    .option('--margin-mm <number>', 'Clear paper border in mm (with --paper)', '10')
    .option('--pen-width-mm <number>', 'Plotted pen width in mm (with --paper)', '0.3')
    .option('--resolution <number>', 'Render density in px per mm (with --paper)', '3')
    .option('-m, --margin <number>', 'Margin from canvas edges in px (without --paper)', '20')
    .option('-s, --seed <number>', 'Seed: drop placement/sizes, comb slant, vortex centres')
    .option('--pattern <name>', 'Pattern: stone | nonpareil | feather | bouquet | vortex', 'nonpareil')
    .option('--drops <number>', 'Ink drops thrown before raking')
    .option('--drop-radius <number>', 'Mean drop radius in px')
    .option('--drop-jitter <number>', 'Per-drop radius jitter (0-1)')
    .option('--rings-per-drop <number>', 'Nested echo rings per drop (1-6)')
    .option('--ink-groups <number>', 'Pens the drops cycle through (1-4)')
    .option('--comb-spacing <number>', 'Comb tooth spacing in px')
    .option('--comb-strength <number>', 'Rake strength (0-1)')
    .option('--falloff <number>', 'Rake shear falloff in px at the base tooth spacing')
    .option('--wavy <number>', 'Wavy-comb amplitude (0-1, bouquet)')
    .option('--vortex-strength <number>', 'Vortex twist (0-1, vortex)')
    .option('--detail <number>', 'Max segment length in px after deformation')
    .option('--wobble <number>', 'Hand-drawn wobble amplitude in px (default 0)')
    .option(
      '--split-layers',
      'Write one SVG per ink group (ink-0..ink-3) for multi-pen plotting, named <output>.<layer>.svg'
    )
    .option('--stroke-color <color>', 'SVG stroke color', '#000000')
    .option('--stroke-width <number>', 'SVG stroke width (without --paper)', '1')
    .option('--background', 'Include background rectangle')
    .option('--background-color <color>', 'Background color', '#ffffff')
    .option('--no-optimize', 'Skip stroke chaining and pen-travel ordering')
    .option('-o, --output <file>', 'Output file path', 'marbling.svg')
    .action((options) => {
      const frame = resolvePageFrame(options);
      const { width, height, marginPx, paperSvg, paperStrokeWidth } = frame;

      const marblingOptions: MarblingOptions = {
        width,
        height,
        margin: marginPx,
        seed: options.seed ? parseInt(options.seed, 10) : undefined,
        pattern: options.pattern as MarblingPattern,
        drops: options.drops ? parseInt(options.drops, 10) : undefined,
        dropRadius: options.dropRadius ? parseFloat(options.dropRadius) : undefined,
        dropRadiusJitter: options.dropJitter ? parseFloat(options.dropJitter) : undefined,
        ringsPerDrop: options.ringsPerDrop ? parseInt(options.ringsPerDrop, 10) : undefined,
        inkGroups: options.inkGroups ? parseInt(options.inkGroups, 10) : undefined,
        combSpacing: options.combSpacing ? parseFloat(options.combSpacing) : undefined,
        combStrength: options.combStrength ? parseFloat(options.combStrength) : undefined,
        falloff: options.falloff ? parseFloat(options.falloff) : undefined,
        wavy: options.wavy ? parseFloat(options.wavy) : undefined,
        vortexStrength: options.vortexStrength ? parseFloat(options.vortexStrength) : undefined,
        detail: options.detail ? parseFloat(options.detail) : undefined,
        wobble: options.wobble ? parseFloat(options.wobble) : undefined,
        optimize: options.optimize,
        // With --paper, anchor feature sizes at the A3 short edge so bigger
        // sheets grow more drops at the same physical pattern scale; a no-op
        // at A4-and-below. Raw px mode: legacy behaviour, untouched.
        refMinDim: frame.page ? 297 * frame.page.pxPerMm : undefined,
      };

      console.log('Rendering marbling...');
      console.log(`  Size: ${width}x${height}`);
      console.log(`  Pattern: ${marblingOptions.pattern}`);

      const result = applySketchFromFlags(
        generateMarbling(marblingOptions),
        options,
        sketchScale(options)
      );

      console.log(`  Seed: ${result.seed}`);
      console.log(`  Generated ${result.lines.length} strokes`);

      const svgOptions: SVGOptions = {
        strokeColor: options.strokeColor,
        strokeWidth: paperStrokeWidth ?? parseFloat(options.strokeWidth),
        includeBackground: options.background ?? false,
        backgroundColor: options.backgroundColor,
        ...paperSvg,
      };

      writePlotOutput(result, frame, options, svgOptions);
    });
}
