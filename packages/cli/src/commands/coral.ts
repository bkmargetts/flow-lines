import type { Command } from 'commander';
import {
  generateCoral,
  type CoralOptions,
  type CoralPreset,
  type CoralSeedShape,
  type SVGOptions,
} from '@flow-lines/core';
import { addTileOptions, resolvePageFrame, writePlotOutput, PAPER_SPEC_HELP } from '../page.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';

export function registerCoral(program: Command) {
  addTileOptions(addSketchOptions(program.command('coral')))
    .description(
      'Render a differential-growth organism: a self-repelling loop buckles ' +
        'into coral folds, leaving onion-skin rings of its growth history behind ' +
        'a bold final silhouette'
    )
    .option('-w, --width <number>', 'Canvas width in pixels (ignored with --paper)', '800')
    .option('-h, --height <number>', 'Canvas height in pixels (ignored with --paper)', '800')
    .option('--paper <size>', PAPER_SPEC_HELP)
    .option('--orientation <o>', 'Paper orientation: portrait or landscape', 'portrait')
    .option('--margin-mm <number>', 'Clear paper border in mm (with --paper)', '10')
    .option('--pen-width-mm <number>', 'Plotted pen width in mm (with --paper)', '0.3')
    .option('--resolution <number>', 'Render density in px per mm (with --paper)', '3')
    .option('-m, --margin <number>', 'Margin from canvas edges in px (without --paper)', '20')
    .option('-s, --seed <number>', 'Seed: seed geometry, growth gate, stroke breaks')
    .option('--preset <name>', 'Look preset: reef | brain | lichen | bloom | maze', 'reef')
    .option('--iterations <number>', 'Growth steps — how long the organism has lived')
    .option('--growth <number>', 'Insertion rate (0-1); how eagerly the curve grows')
    .option(
      '--fold-div <number>',
      'Fold wavelength as a divisor of the min dimension — smaller is chunkier'
    )
    .option('--repulsion <number>', 'Fold wavelength: absolute repulsion radius in px')
    .option('--max-nodes <number>', 'Approximate node cap — growth stops here')
    .option('--noise-scale <number>', 'Growth-gate patch size as a fraction of the min dimension')
    .option('--patchiness <number>', 'How hard noise gates growth into patches (0-1)')
    .option('--curvature-bias <number>', 'Growth preference for outward tips (0-1)')
    .option('--jitter <number>', 'Random per-node nudge (0-1)')
    .option('--seed-shape <shape>', 'Initial geometry: circle | polygon | line | blobs')
    .option('--blobs <number>', "Colony count for the 'blobs' seed (2-6)")
    .option('--rings <number>', 'Onion-skin history rings kept; 0 = final silhouette only')
    .option('--fade <number>', 'How aggressively old rings fragment with age (0-1)')
    .option('--bold-passes <number>', 'Offset passes on the final silhouette (1-6)')
    .option('--taper <number>', 'End-taper fraction on bold offset passes')
    .option('--wobble <number>', 'Hand-drawn wobble amplitude in px; default scales with the folds')
    .option(
      '--split-layers',
      'Write one SVG per layer (edge/ring/relic) for multi-pen plotting, named <output>.<layer>.svg'
    )
    .option('--stroke-color <color>', 'SVG stroke color', '#000000')
    .option('--stroke-width <number>', 'SVG stroke width (without --paper)', '1')
    .option('--background', 'Include background rectangle')
    .option('--background-color <color>', 'Background color', '#ffffff')
    .option('--no-optimize', 'Skip stroke chaining and pen-travel ordering')
    .option('-o, --output <file>', 'Output file path', 'coral.svg')
    .action((options) => {
      const frame = resolvePageFrame(options);
      const { width, height, marginPx, paperSvg, paperStrokeWidth } = frame;

      const coralOptions: CoralOptions = {
        width,
        height,
        margin: marginPx,
        seed: options.seed ? parseInt(options.seed, 10) : undefined,
        preset: options.preset as CoralPreset,
        iterations: options.iterations ? parseInt(options.iterations, 10) : undefined,
        growth: options.growth ? parseFloat(options.growth) : undefined,
        foldDiv: options.foldDiv ? parseFloat(options.foldDiv) : undefined,
        repulsion: options.repulsion ? parseFloat(options.repulsion) : undefined,
        maxNodes: options.maxNodes ? parseInt(options.maxNodes, 10) : undefined,
        noiseScale: options.noiseScale ? parseFloat(options.noiseScale) : undefined,
        patchiness: options.patchiness ? parseFloat(options.patchiness) : undefined,
        curvatureBias: options.curvatureBias ? parseFloat(options.curvatureBias) : undefined,
        jitter: options.jitter ? parseFloat(options.jitter) : undefined,
        seedShape: options.seedShape as CoralSeedShape | undefined,
        blobs: options.blobs ? parseInt(options.blobs, 10) : undefined,
        rings: options.rings !== undefined ? parseInt(options.rings, 10) : undefined,
        fade: options.fade ? parseFloat(options.fade) : undefined,
        boldPasses: options.boldPasses ? parseInt(options.boldPasses, 10) : undefined,
        taper: options.taper ? parseFloat(options.taper) : undefined,
        wobble: options.wobble ? parseFloat(options.wobble) : undefined,
        optimize: options.optimize,
      };

      console.log('Rendering coral growth...');
      console.log(`  Size: ${width}x${height}`);
      console.log(`  Preset: ${coralOptions.preset}`);

      const result = applySketchFromFlags(
        generateCoral(coralOptions),
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
