import type { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  generateGesture,
  toSVG,
  toSVGLayers,
  type GestureOptions,
  type GesturePreset,
  type SVGOptions,
} from '@flow-lines/core';
import { resolvePageFrame } from '../page.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';

export function registerGesture(program: Command) {
  addSketchOptions(program.command('gesture'))
    .description(
      'Render a gestural ink abstraction (Kline / Hartung / sumi): a few confident ' +
        'swept strokes with dry-brush breakup, whips, scribble knots, and spatter'
    )
    .option('-w, --width <number>', 'Canvas width in pixels (ignored with --paper)', '800')
    .option('-h, --height <number>', 'Canvas height in pixels (ignored with --paper)', '1131')
    .option(
      '--paper <size>',
      'Plot to a physical sheet (a6,a5,a4,a3,letter,legal,tabloid); overrides --width/--height and exports the SVG in mm'
    )
    .option('--orientation <o>', 'Paper orientation: portrait or landscape', 'portrait')
    .option('--margin-mm <number>', 'Clear paper border in mm (with --paper)', '10')
    .option('--pen-width-mm <number>', 'Plotted pen width in mm (with --paper)', '0.5')
    .option('--resolution <number>', 'Render density in px per mm (with --paper)', '3')
    .option('-m, --margin <number>', 'Margin from canvas edges in px (without --paper)', '32')
    .option('-s, --seed <number>', 'Seed for the whole composition')
    .option(
      '--preset <preset>',
      'Compositional archetype: auto | kline (black bars) | sumi (one sweep) | hartung (whip bundle) | tangle (scribble knot)',
      'auto'
    )
    .option('--gestures <number>', 'Primary gesture count; 0 = archetype decides', '0')
    .option('--energy <number>', 'Stroke speed 0-1: curvature, flicks, S-reversals', '0.6')
    .option('--ink-weight <number>', 'How heavy the primary strokes are (0-1)', '0.55')
    .option('--dryness <number>', 'Dry-brush breakup amount (0-1)', '0.5')
    .option('--spatter <number>', 'Spatter quantity off fast exits (0-1)', '0.4')
    .option('--whips <number>', 'Whip count; -1 = archetype decides', '-1')
    .option('--knots <number>', 'Scribble-knot count; -1 = archetype decides', '-1')
    .option('--drips <number>', 'Probability a heavy belly releases a drip (0-1)', '0.15')
    .option('--coverage <number>', 'Hard ink budget as a fraction of the work area (0-1)', '0.35')
    .option('--balance <number>', 'How far the composition leans off perfect balance (0-1)', '0.4')
    .option('--negative-space <number>', 'Fraction of the frame guaranteed quiet paper (0-1)', '0.45')
    .option(
      '--pass-spacing <number>',
      'Offset-pass pitch in px; default pen width · 0.85 with --paper, else 2.4'
    )
    .option('--wobble <number>', 'Hand-drawn wobble amplitude in px', '0.5')
    .option(
      '--split-layers',
      'Write one SVG per layer (gesture/secondary/spatter) for multi-pen plotting, named <output>.<layer>.svg'
    )
    .option('--stroke-color <color>', 'SVG stroke color', '#000000')
    .option('--stroke-width <number>', 'SVG stroke width (without --paper)', '2')
    .option('--background', 'Include background rectangle')
    .option('--background-color <color>', 'Background color', '#ffffff')
    .option('--no-optimize', 'Skip stroke chaining and pen-travel ordering')
    .option('-o, --output <file>', 'Output file path', 'gesture.svg')
    .action((options) => {
      const { width, height, marginPx, paperSvg, paperStrokeWidth } = resolvePageFrame(options);

      const gestureOptions: GestureOptions = {
        width,
        height,
        margin: marginPx,
        seed: options.seed ? parseInt(options.seed, 10) : undefined,
        preset: options.preset as GesturePreset,
        gestures: parseInt(options.gestures, 10),
        energy: parseFloat(options.energy),
        inkWeight: parseFloat(options.inkWeight),
        dryness: parseFloat(options.dryness),
        spatter: parseFloat(options.spatter),
        whips: parseInt(options.whips, 10),
        knots: parseInt(options.knots, 10),
        drips: parseFloat(options.drips),
        coverage: parseFloat(options.coverage),
        balance: parseFloat(options.balance),
        negativeSpace: parseFloat(options.negativeSpace),
        passSpacing: options.passSpacing
          ? parseFloat(options.passSpacing)
          : paperStrokeWidth !== undefined
            ? paperStrokeWidth * 0.85
            : undefined,
        wobble: parseFloat(options.wobble),
        optimize: options.optimize,
      };

      console.log('Rendering gestural ink abstraction...');
      console.log(`  Size: ${width}x${height}`);
      console.log(`  Preset: ${gestureOptions.preset}`);

      const result = applySketchFromFlags(generateGesture(gestureOptions), options, sketchScale(options));

      console.log(`  Seed: ${result.seed}`);
      console.log(`  Generated ${result.lines.length} strokes`);

      const svgOptions: SVGOptions = {
        strokeColor: options.strokeColor,
        strokeWidth: paperStrokeWidth ?? parseFloat(options.strokeWidth),
        includeBackground: options.background ?? false,
        backgroundColor: options.backgroundColor,
        ...paperSvg,
      };

      if (options.splitLayers) {
        // Strip a trailing .svg so layers land as <base>.<layer>.svg
        const base = resolve(process.cwd(), options.output.replace(/\.svg$/i, ''));
        const layers = toSVGLayers(result, svgOptions);
        for (const { layer, svg } of layers) {
          const layerPath = `${base}.${layer}.svg`;
          writeFileSync(layerPath, svg, 'utf-8');
          console.log(`  Saved layer '${layer}' to: ${layerPath}`);
        }
      } else {
        const svg = toSVG(result, svgOptions);
        const outputPath = resolve(process.cwd(), options.output);
        writeFileSync(outputPath, svg, 'utf-8');
        console.log(`\nSaved to: ${outputPath}`);
      }
    });
}
