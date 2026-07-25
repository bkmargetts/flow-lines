import type { Command } from 'commander';
import { generateMachine, type MachineOptions, type SVGOptions } from '@flow-lines/core';
import { addTileOptions, resolvePageFrame, writePlotOutput } from '../page.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';

export function registerMachine(program: Command) {
  addTileOptions(addSketchOptions(program.command('machine')))
    .description('Generate page-sized, hugely complex generative machines — meshing gear trains, belts, ropes and weights')
    .option('-w, --width <number>', 'Canvas width in pixels (ignored with --paper)', '800')
    .option('-h, --height <number>', 'Canvas height in pixels (ignored with --paper)', '1000')
    .option('--paper <size>', 'Plot to a physical sheet (a6,a5,a4,a3,letter,legal,tabloid); exports the SVG in mm')
    .option('--orientation <o>', 'Paper orientation: portrait or landscape', 'portrait')
    .option('--margin-mm <number>', 'Clear paper border in mm (with --paper)', '12')
    .option('--pen-width-mm <number>', 'Plotted pen width in mm (with --paper)', '0.3')
    .option('--resolution <number>', 'Render density in px per mm (with --paper)', '3')
    .option('-m, --margin <number>', 'Margin from canvas edges in px (without --paper)', '36')
    .option('-s, --seed <number>', 'Random seed for reproducibility')
    // machine
    .option('--complexity <number>', 'One small mechanism at 0; the page packed to the margins at 1', '0.85')
    .option('--connectivity <number>', '1: one interconnected mega-machine; 0: a wall of overlapping mechanisms', '0.9')
    .option('--gear-size <number>', 'Base big-wheel radius in px (at the base 3px/mm density)', '95')
    .option('--scale-variety <number>', 'Per-cluster tooth-size spread (0-1)', '0.6')
    .option('--mechanisms <number>', 'Belt / linkage / spring / weight extras (0-1)', '0.7')
    .option('--frame-density <number>', 'Timber scaffold density (0-1)', '0.7')
    .option('--cutaways <number>', 'Section cutaway wedges (0-3)', '2')
    .option('--no-hidden-lines', 'Skip dashed hidden lines where parts overlap')
    // tone
    .option('--hatch-spacing <number>', 'Base hatch spacing in px', '3.2')
    .option('--shading <number>', 'Shadow-side tone (0-1)', '0.6')
    // ink
    .option('--stroke-color <color>', 'Stroke color', '#1a1a1a')
    .option('--stroke-width <number>', 'SVG stroke width (without --paper)', '1.2')
    .option('--wobble <number>', 'Hand-drawn wobble amplitude in px', '0.8')
    .option('--sketch <number>', 'Hand-drawn sketch overdraw intensity (0-1)', '0.25')
    .option('--sketch-style <s>', 'Sketch character: loose | fine | gestural | scratchy', 'loose')
    .option('--background', 'Include background rectangle')
    .option('--background-color <color>', 'Background color', '#ffffff')
    .option('--no-optimize', 'Skip stroke chaining and pen-travel ordering')
    .option('-o, --output <file>', 'Output file path', 'machine.svg')
    .action((options) => {
      const frame = resolvePageFrame(options);
      const { width, height, marginPx, paperSvg, paperStrokeWidth } = frame;
      // Size flags are px at the base render density; scale with --resolution
      // so a machine looks the same at any px-per-mm.
      const scale = sketchScale(options);

      const machineOptions: MachineOptions = {
        width,
        height,
        margin: marginPx,
        seed: options.seed ? parseInt(options.seed, 10) : undefined,
        complexity: parseFloat(options.complexity),
        connectivity: parseFloat(options.connectivity),
        gearSize: parseFloat(options.gearSize) * scale,
        scaleVariety: parseFloat(options.scaleVariety),
        mechanisms: parseFloat(options.mechanisms),
        frameDensity: parseFloat(options.frameDensity),
        cutaways: parseInt(options.cutaways, 10),
        // Part-count ceilings grow with the physical sheet (mirrors the web
        // app's sheetAreaFactor): area vs the A4 anchor, floored at 1 so
        // A4-and-smaller keeps the tuned caps; pixel frames (no --paper)
        // have no physical size and stay at the default. Spread conditionally
        // so an explicit undefined never clobbers the core default.
        ...(frame.page
          ? { sheetFactor: Math.max(1, (frame.page.widthMm * frame.page.heightMm) / (210 * 297)) }
          : {}),
        hiddenLines: options.hiddenLines,
        hatchSpacing: parseFloat(options.hatchSpacing) * scale,
        shading: parseFloat(options.shading),
        penWidth: paperStrokeWidth ?? parseFloat(options.strokeWidth),
        wobble: parseFloat(options.wobble),
        sketch: parseFloat(options.sketch),
        sketchStyle: options.sketchStyle as MachineOptions['sketchStyle'],
      };

      console.log('Generating machine...');
      console.log(`  Size: ${width}x${height}, complexity ${machineOptions.complexity}, connectivity ${machineOptions.connectivity}`);

      const result = generateMachine(machineOptions);
      console.log(`  Generated ${result.lines.length} lines`);

      const svgOptions: SVGOptions = {
        strokeColor: options.strokeColor,
        strokeWidth: paperStrokeWidth ?? parseFloat(options.strokeWidth),
        includeBackground: options.background ?? false,
        backgroundColor: options.backgroundColor,
        optimizePaths: options.optimize,
        ...paperSvg,
      };

      writePlotOutput(
        applySketchFromFlags({ ...result, seed: machineOptions.seed ?? 0 }, options, scale),
        frame,
        options,
        svgOptions
      );
    });
}
