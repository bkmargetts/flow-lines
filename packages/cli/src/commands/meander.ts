import type { Command } from 'commander';
import {
  generateMeander,
  type MeanderOptions,
  type MeanderPreset,
  type SVGOptions,
} from '@flow-lines/core';
import { addTileOptions, resolvePageFrame, writePlotOutput, PAPER_SPEC_HELP } from '../page.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';

export function registerMeander(program: Command) {
  addTileOptions(addSketchOptions(program.command('meander')))
    .description(
      'Render a meandering river\'s life as Fisk-style cartography: the channel ' +
        'migrates by bank erosion, pinches off oxbow lakes, and leaves scroll-bar ' +
        'traces of every former course behind'
    )
    .option('-w, --width <number>', 'Canvas width in pixels (ignored with --paper)', '800')
    .option('-h, --height <number>', 'Canvas height in pixels (ignored with --paper)', '800')
    .option('--paper <size>', PAPER_SPEC_HELP)
    .option('--orientation <o>', 'Paper orientation: portrait or landscape', 'portrait')
    .option('--margin-mm <number>', 'Clear paper border in mm (with --paper)', '10')
    .option('--pen-width-mm <number>', 'Plotted pen width in mm (with --paper)', '0.3')
    .option('--resolution <number>', 'Render density in px per mm (with --paper)', '3')
    .option('-m, --margin <number>', 'Margin from canvas edges in px (without --paper)', '20')
    .option('-s, --seed <number>', 'Seed: initial course, bank noise, stroke breaks')
    .option('--preset <name>', 'Look preset: atlas | young | tangle', 'atlas')
    .option('--iterations <number>', 'Migration steps — how long the river has lived')
    .option('--migration <number>', 'Migration rate (0-1); how fast bends grow and wander')
    .option('--bend-scale <number>', 'Emergent bend scale as a fraction of the min dimension')
    .option('--valley-width <number>', 'Valley belt width as a fraction of the min dimension')
    .option('--flow-angle <number>', 'Flow axis angle in degrees; 0 runs left to right')
    .option('--jitter <number>', 'Perpendicular bank noise (0-1)')
    .option('--channel-width <number>', 'Channel width in px')
    .option('--traces <number>', 'Historical centerline traces kept')
    .option('--fade <number>', 'How aggressively old traces fragment with age (0-1)')
    .option('--no-oxbows', 'Drop the abandoned loops instead of keeping oxbow lakes')
    .option('--flow-lines <number>', 'Broken interior flow lines inside the channel (0-5)')
    .option('--bold-passes <number>', 'Offset passes on the channel banks')
    .option('--taper <number>', 'End-taper fraction on bold offset passes')
    .option('--wobble <number>', 'Hand-drawn wobble amplitude in px; default scales with the channel')
    .option(
      '--split-layers',
      'Write one SVG per layer (channel/trace/oxbow) for multi-pen plotting, named <output>.<layer>.svg'
    )
    .option('--stroke-color <color>', 'SVG stroke color', '#000000')
    .option('--stroke-width <number>', 'SVG stroke width (without --paper)', '1')
    .option('--background', 'Include background rectangle')
    .option('--background-color <color>', 'Background color', '#ffffff')
    .option('--no-optimize', 'Skip stroke chaining and pen-travel ordering')
    .option('-o, --output <file>', 'Output file path', 'meander.svg')
    .action((options) => {
      const frame = resolvePageFrame(options);
      const { width, height, marginPx, paperSvg, paperStrokeWidth } = frame;

      const meanderOptions: MeanderOptions = {
        width,
        height,
        margin: marginPx,
        seed: options.seed ? parseInt(options.seed, 10) : undefined,
        preset: options.preset as MeanderPreset,
        iterations: options.iterations ? parseInt(options.iterations, 10) : undefined,
        migration: options.migration ? parseFloat(options.migration) : undefined,
        bendScale: options.bendScale ? parseFloat(options.bendScale) : undefined,
        valleyWidth: options.valleyWidth ? parseFloat(options.valleyWidth) : undefined,
        flowAngleDeg: options.flowAngle ? parseFloat(options.flowAngle) : undefined,
        jitter: options.jitter ? parseFloat(options.jitter) : undefined,
        channelWidth: options.channelWidth ? parseFloat(options.channelWidth) : undefined,
        traces: options.traces ? parseInt(options.traces, 10) : undefined,
        fade: options.fade ? parseFloat(options.fade) : undefined,
        oxbows: options.oxbows === false ? false : undefined,
        flowLines: options.flowLines ? parseInt(options.flowLines, 10) : undefined,
        boldPasses: options.boldPasses ? parseInt(options.boldPasses, 10) : undefined,
        taper: options.taper ? parseFloat(options.taper) : undefined,
        wobble: options.wobble ? parseFloat(options.wobble) : undefined,
        optimize: options.optimize,
        // With --paper, anchor feature sizes at the largest previously-possible
        // short edge (A3, 297mm) so bigger sheets grow a longer river at the
        // same physical channel scale; a no-op at A4-and-below. Raw px mode:
        // page-derived sizing, untouched.
        refMinDim: frame.page ? 297 * frame.page.pxPerMm : undefined,
      };

      console.log('Rendering meander belt...');
      console.log(`  Size: ${width}x${height}`);
      console.log(`  Preset: ${meanderOptions.preset}`);

      const result = applySketchFromFlags(
        generateMeander(meanderOptions),
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
