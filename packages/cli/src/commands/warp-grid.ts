import type { Command } from 'commander';
import {
  generateWarpGrid,
  type WarpBasePattern,
  type WarpDeformerKind,
  type WarpGridOptions,
  type WarpGridPreset,
  type SVGOptions,
} from '@flow-lines/core';
import { addTileOptions, resolvePageFrame, writePlotOutput, PAPER_SPEC_HELP } from '../page.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';

export function registerWarpGrid(program: Command) {
  addTileOptions(addSketchOptions(program.command('warp-grid')))
    .description(
      'Render op-art warped gratings: a flat line field (parallel lines, ' +
        'waves, rings, or rays) deformed by hidden forms — domes, ridge ' +
        'trains, vortices, lenses, rolling noise — so the grating reads as ' +
        'volumes emerging from the page'
    )
    .option('-w, --width <number>', 'Canvas width in pixels (ignored with --paper)', '800')
    .option('-h, --height <number>', 'Canvas height in pixels (ignored with --paper)', '800')
    .option('--paper <size>', PAPER_SPEC_HELP)
    .option('--orientation <o>', 'Paper orientation: portrait or landscape', 'portrait')
    .option('--margin-mm <number>', 'Clear paper border in mm (with --paper)', '10')
    .option('--pen-width-mm <number>', 'Plotted pen width in mm (with --paper)', '0.3')
    .option('--resolution <number>', 'Render density in px per mm (with --paper)', '3')
    .option('-m, --margin <number>', 'Margin from canvas edges in px (without --paper)', '20')
    .option('-s, --seed <number>', 'Seed: deformer placement, sizes, strengths, signs')
    .option('--preset <name>', 'Look: dome | current | vortex | relief | pinch | blaze', 'dome')
    .option('--pattern <name>', 'Base grating: lines | waves | circles | rays (default preset)')
    .option('--spacing <number>', 'Line pitch in px')
    .option('--angle <number>', 'Base line direction in degrees (lines/waves)')
    .option('--wave-amp <number>', 'Built-in sine amplitude as a fraction of pitch (waves, 0-1)')
    .option('--wavelength <number>', 'Sine wavelength in px (waves base and ridge trains)')
    .option('--deformers <number>', 'Hidden-form count (0-8)')
    .option('--kinds <list>', 'Allowed form kinds, comma-separated: dome,ridge,noise,vortex,lens')
    .option('--strength <number>', 'Per-form strength (0-1)')
    .option('--relief <number>', 'Relief shift scale (0-1)')
    .option('--scale <number>', 'Form radius as a fraction of the min dimension')
    .option('--noise-scale <number>', 'Noise feature size as a fraction of the min dimension')
    .option('--drop-floor <number>', 'Pen-lift compression floor as a fraction of pitch (0-1)')
    .option(
      '--occlude <on|off>',
      'Hidden-line removal: nearer relief hides lines behind it (lines/waves; default preset)'
    )
    .option('--edge-calm <number>', 'Flat-grating band width at the margin (0-1)')
    .option('--detail <number>', 'Sample step along lines in px')
    .option('--wobble <number>', 'Hand-drawn wobble amplitude in px (default 0)')
    .option('--stroke-color <color>', 'SVG stroke color', '#000000')
    .option('--stroke-width <number>', 'SVG stroke width (without --paper)', '1')
    .option('--background', 'Include background rectangle')
    .option('--background-color <color>', 'Background color', '#ffffff')
    .option('--no-optimize', 'Skip stroke chaining and pen-travel ordering')
    .option('-o, --output <file>', 'Output file path', 'warp-grid.svg')
    .action((options) => {
      const frame = resolvePageFrame(options);
      const { width, height, marginPx, paperSvg, paperStrokeWidth } = frame;

      const warpOptions: WarpGridOptions = {
        width,
        height,
        margin: marginPx,
        seed: options.seed ? parseInt(options.seed, 10) : undefined,
        preset: options.preset as WarpGridPreset,
        basePattern: options.pattern ? (options.pattern as WarpBasePattern) : undefined,
        spacing: options.spacing ? parseFloat(options.spacing) : undefined,
        angle: options.angle !== undefined ? parseFloat(options.angle) : undefined,
        waveAmp: options.waveAmp ? parseFloat(options.waveAmp) : undefined,
        wavelength: options.wavelength ? parseFloat(options.wavelength) : undefined,
        deformers: options.deformers !== undefined ? parseInt(options.deformers, 10) : undefined,
        kinds: options.kinds
          ? (options.kinds.split(',').map((k: string) => k.trim()) as WarpDeformerKind[])
          : undefined,
        strength: options.strength ? parseFloat(options.strength) : undefined,
        relief: options.relief !== undefined ? parseFloat(options.relief) : undefined,
        scale: options.scale ? parseFloat(options.scale) : undefined,
        noiseScale: options.noiseScale ? parseFloat(options.noiseScale) : undefined,
        dropFloor: options.dropFloor !== undefined ? parseFloat(options.dropFloor) : undefined,
        occlude: options.occlude !== undefined ? options.occlude === 'on' : undefined,
        edgeCalm: options.edgeCalm !== undefined ? parseFloat(options.edgeCalm) : undefined,
        detail: options.detail ? parseFloat(options.detail) : undefined,
        wobble: options.wobble ? parseFloat(options.wobble) : undefined,
        optimize: options.optimize,
      };

      console.log('Rendering warp grid...');
      console.log(`  Size: ${width}x${height}`);
      console.log(`  Preset: ${warpOptions.preset}`);

      const result = applySketchFromFlags(
        generateWarpGrid(warpOptions),
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
