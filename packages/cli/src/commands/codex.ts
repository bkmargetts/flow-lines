import type { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateMachineCodex, toSVG, type MachineCodexOptions, type SVGOptions } from '@flow-lines/core';
import { resolvePageFrame } from '../page.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';

export function registerCodex(program: Command) {
  addSketchOptions(program.command('codex'))
    .description('Generate impossible machine plates — da Vinci-style contraptions as codex/patent drawings')
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
    .option('--complexity <number>', 'One lone wheel at 0, a full contraption at 1', '0.65')
    .option('--gear-size <number>', 'Mean big-wheel radius in px (at the base 3px/mm density)', '95')
    .option('--mechanisms <number>', 'Belt / linkage / spring / weight extras (0-1)', '0.7')
    .option('--no-hidden-lines', 'Skip dashed hidden lines where parts overlap')
    .option('--no-cutaway', 'Skip the section cutaway wedge')
    // plate
    .option('--style <s>', 'codex (aged, asemic script) | patent (ruled plate)', 'codex')
    .option('--annotations <number>', 'Dimensions, leader callouts, centerlines (0-1)', '0.6')
    .option('--marginalia <number>', 'Script coverage in the margin blocks (0-1)', '0.6')
    .option('--detail-insets <number>', 'Zoomed detail figures (0-2)', '1')
    .option('--title <text>', 'Plate title (default: invented per seed; pass "" for none)')
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
    .option('-o, --output <file>', 'Output file path', 'codex.svg')
    .action((options) => {
      const { width, height, marginPx, paperSvg, paperStrokeWidth } = resolvePageFrame(options);
      // Size flags are px at the base render density; scale with --resolution
      // so a plate looks the same at any px-per-mm.
      const scale = sketchScale(options);

      const codexOptions: MachineCodexOptions = {
        width,
        height,
        margin: marginPx,
        seed: options.seed ? parseInt(options.seed, 10) : undefined,
        complexity: parseFloat(options.complexity),
        gearSize: parseFloat(options.gearSize) * scale,
        mechanisms: parseFloat(options.mechanisms),
        hiddenLines: options.hiddenLines,
        cutaway: options.cutaway,
        style: options.style as MachineCodexOptions['style'],
        annotations: parseFloat(options.annotations),
        marginalia: parseFloat(options.marginalia),
        detailInsets: parseInt(options.detailInsets, 10),
        ...(options.title !== undefined ? { title: options.title } : {}),
        hatchSpacing: parseFloat(options.hatchSpacing) * scale,
        shading: parseFloat(options.shading),
        penWidth: paperStrokeWidth ?? parseFloat(options.strokeWidth),
        wobble: parseFloat(options.wobble),
        sketch: parseFloat(options.sketch),
        sketchStyle: options.sketchStyle as MachineCodexOptions['sketchStyle'],
      };

      console.log('Generating machine codex...');
      console.log(`  Size: ${width}x${height}, style: ${codexOptions.style}`);

      const result = generateMachineCodex(codexOptions);
      console.log(`  Generated ${result.lines.length} lines`);

      const svgOptions: SVGOptions = {
        strokeColor: options.strokeColor,
        strokeWidth: paperStrokeWidth ?? parseFloat(options.strokeWidth),
        includeBackground: options.background ?? false,
        backgroundColor: options.backgroundColor,
        optimizePaths: options.optimize,
        ...paperSvg,
      };

      const svg = toSVG(
        applySketchFromFlags({ ...result, seed: codexOptions.seed ?? 0 }, options, sketchScale(options)),
        svgOptions
      );
      const outputPath = resolve(process.cwd(), options.output);
      writeFileSync(outputPath, svg, 'utf-8');
      console.log(`\nSaved to: ${outputPath}`);
    });
}
