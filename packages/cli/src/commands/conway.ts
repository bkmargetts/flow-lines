import type { Command } from 'commander';
import {
  generateConwayExposure,
  type ConwayExposureOptions,
  type SVGOptions,
} from '@flow-lines/core';
import { addTileOptions, resolvePageFrame, writePlotOutput, PAPER_SPEC_HELP } from '../page.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';

export function registerConway(program: Command) {
  addTileOptions(addSketchOptions(program.command('conway')))
    .description(
      "Render a 'long exposure' of Conway's Game of Life from an R-pentomino: " +
        'the final config sits solid and crisp while its history fades into comet trails'
    )
    .option('-w, --width <number>', 'Canvas width in pixels (ignored with --paper)', '800')
    .option('-h, --height <number>', 'Canvas height in pixels (ignored with --paper)', '800')
    .option('--paper <size>', PAPER_SPEC_HELP)
    .option('--orientation <o>', 'Paper orientation: portrait or landscape', 'portrait')
    .option('--margin-mm <number>', 'Clear paper border in mm (with --paper)', '10')
    .option('--pen-width-mm <number>', 'Plotted pen width in mm (with --paper)', '0.3')
    .option('--resolution <number>', 'Render density in px per mm (with --paper)', '3')
    .option('-m, --margin <number>', 'Margin from canvas edges in px (without --paper)', '20')
    .option('-s, --seed <number>', 'Seed: R-pentomino placement/orientation + wobble')
    .option('--cell-size <number>', 'Pixels per cell (grid resolution); default ~width/100')
    .option('--generations <number>', 'Generations to simulate', '180')
    .option('--decay <number>', 'Per-generation exposure decay (0-1); higher = longer trails', '0.92')
    .option('--gamma <number>', 'Perceptual lift on faint trails (<1 brightens)', '0.45')
    .option(
      '--style <style>',
      'History render style: marks (discrete) | contour (organic ridges) | streaks (tracked comet trails) | slipstream (flow streamlines) | embers (stipple)',
      'marks'
    )
    .option('--halo-radius <number>', 'Reserved-paper sliver around the present in px (default ~cell*0.6)')
    .option('--contour-levels <number>', 'Nested iso levels for the contour style', '5')
    .option('--slipstream-spacing <number>', 'Slipstream: base streamline separation in grid cells', '0.9')
    .option('--stipple-density <number>', 'Embers: stipple dots per cell at full tone', '7')
    .option(
      '--split-layers',
      'Write one SVG per layer (present/ghost/trail) for multi-pen plotting, named <output>.<layer>.svg'
    )
    .option('--faint-threshold <number>', 'Tone below this leaves blank paper (0-1)', '0.1')
    .option('--medium-threshold <number>', 'Faint→medium tone boundary (0-1)', '0.32')
    .option('--solid-threshold <number>', 'Medium→solid tone boundary (0-1)', '0.62')
    .option('--residue-max-cells <number>', 'Final clusters this size or smaller draw as outlines', '6')
    .option('--wobble <number>', 'Hand-drawn wobble amplitude in px; default scales with cell size')
    .option('--stroke-color <color>', 'SVG stroke color', '#000000')
    .option('--stroke-width <number>', 'SVG stroke width (without --paper)', '1')
    .option('--background', 'Include background rectangle')
    .option('--background-color <color>', 'Background color', '#ffffff')
    .option('--no-optimize', 'Skip stroke chaining and pen-travel ordering')
    .option('-o, --output <file>', 'Output file path', 'conway-exposure.svg')
    .action((options) => {
      const frame = resolvePageFrame(options);
      const { width, height, marginPx, paperSvg, paperStrokeWidth } = frame;

      // More detonations on big sheets (mirrors the web app's sheetAreaFactor):
      // physical-area growth vs the A4 anchor, floored at 1 so A4-and-smaller
      // sheets keep the single centred blast exactly. Pixel-frame renders
      // (no --paper) have no physical size, so they stay at the default.
      const sheetFactor = frame.page
        ? Math.max(1, (frame.page.widthMm * frame.page.heightMm) / (210 * 297))
        : 1;

      const conwayOptions: ConwayExposureOptions = {
        width,
        height,
        margin: marginPx,
        seed: options.seed ? parseInt(options.seed, 10) : undefined,
        seedCount: Math.max(1, Math.round(sheetFactor)),
        cellSize: options.cellSize ? parseFloat(options.cellSize) : undefined,
        generations: parseInt(options.generations, 10),
        decay: parseFloat(options.decay),
        gamma: parseFloat(options.gamma),
        faintThreshold: parseFloat(options.faintThreshold),
        mediumThreshold: parseFloat(options.mediumThreshold),
        solidThreshold: parseFloat(options.solidThreshold),
        residueMaxCells: parseInt(options.residueMaxCells, 10),
        wobble: options.wobble ? parseFloat(options.wobble) : undefined,
        style: options.style as 'marks' | 'contour' | 'streaks' | 'slipstream' | 'embers',
        haloRadius: options.haloRadius ? parseFloat(options.haloRadius) : undefined,
        contourLevels: parseInt(options.contourLevels, 10),
        slipstreamSpacing: parseFloat(options.slipstreamSpacing),
        stippleDensity: parseFloat(options.stippleDensity),
        optimize: options.optimize,
      };

      console.log("Rendering Conway long-exposure...");
      console.log(`  Size: ${width}x${height}`);
      console.log(`  Generations: ${conwayOptions.generations}, decay: ${conwayOptions.decay}`);

      const result = applySketchFromFlags(
        generateConwayExposure(conwayOptions),
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
