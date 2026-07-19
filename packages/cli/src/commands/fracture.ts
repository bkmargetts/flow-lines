import type { Command } from 'commander';
import {
  generateFracture,
  type FractureOptions,
  type FracturePreset,
  type SVGOptions,
} from '@flow-lines/core';
import { addTileOptions, resolvePageFrame, writePlotOutput, PAPER_SPEC_HELP } from '../page.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';

export function registerFracture(program: Command) {
  addTileOptions(addSketchOptions(program.command('fracture')))
    .description(
      'Render an emergent crack-propagation network (mud cracks, glaze crazing): ' +
        'cracks nucleate at stress maxima, meet earlier cracks at right angles, ' +
        'and tessellate the sheet into facet-hatched plates'
    )
    .option('-w, --width <number>', 'Canvas width in pixels (ignored with --paper)', '800')
    .option('-h, --height <number>', 'Canvas height in pixels (ignored with --paper)', '800')
    .option('--paper <size>', PAPER_SPEC_HELP)
    .option('--orientation <o>', 'Paper orientation: portrait or landscape', 'portrait')
    .option('--margin-mm <number>', 'Clear paper border in mm (with --paper)', '10')
    .option('--pen-width-mm <number>', 'Plotted pen width in mm (with --paper)', '0.3')
    .option('--resolution <number>', 'Render density in px per mm (with --paper)', '3')
    .option('-m, --margin <number>', 'Margin from canvas edges in px (without --paper)', '20')
    .option('-s, --seed <number>', 'Seed: stress field, nucleation, tip wander, hatch angles')
    .option('--preset <name>', 'Look preset: mud | crazing | shatter', 'mud')
    .option('--generations <number>', 'Crack generations (hierarchy depth, 1-4)')
    .option('--crack-density <number>', 'Nucleation density (0-1)')
    .option('--stress-scale <number>', 'Stress-noise feature size as a fraction of the min dimension')
    .option('--straightness <number>', 'Tip inertia (0-1); high = straight confident primaries')
    .option('--jitter <number>', 'Per-step heading jitter (0-1)')
    .option('--anisotropy <number>', 'Alignment of crack directions to one axis (0-1)')
    .option('--anisotropy-angle <number>', 'Preferred crack axis in degrees')
    .option('--arrest-threshold <number>', 'Stress below this arrests a tip (0-1)')
    .option('--capture-radius <number>', 'T-junction sensing distance in px')
    .option('--edge-nucleation <number>', 'Fraction of primary cracks seeded on the border (0-1)')
    .option('--bold-passes <number>', 'Offset passes on primary cracks')
    .option('--taper <number>', 'End-taper fraction on bold offset passes')
    .option('--no-plate-hatch', 'Skip facet-hatching the plates between cracks')
    .option('--hatch-spacing <number>', 'Plate hatch spacing in px')
    .option('--hatch-coverage <number>', 'Fraction of plates that get hatched (0-1)')
    .option('--hatch-angle <number>', 'Base plate hatch angle in degrees')
    .option('--edge-curl <number>', 'Tighter hatch band along crack edges (0-1)')
    .option('--wobble <number>', 'Hand-drawn wobble amplitude in px; default scales with step')
    .option(
      '--split-layers',
      'Write one SVG per layer (crack-primary/crack-fine/plate) for multi-pen plotting, named <output>.<layer>.svg'
    )
    .option('--stroke-color <color>', 'SVG stroke color', '#000000')
    .option('--stroke-width <number>', 'SVG stroke width (without --paper)', '1')
    .option('--background', 'Include background rectangle')
    .option('--background-color <color>', 'Background color', '#ffffff')
    .option('--no-optimize', 'Skip stroke chaining and pen-travel ordering')
    .option('-o, --output <file>', 'Output file path', 'fracture.svg')
    .action((options) => {
      const frame = resolvePageFrame(options);
      const { width, height, marginPx, paperSvg, paperStrokeWidth } = frame;

      const fractureOptions: FractureOptions = {
        width,
        height,
        margin: marginPx,
        seed: options.seed ? parseInt(options.seed, 10) : undefined,
        preset: options.preset as FracturePreset,
        generations: options.generations ? parseInt(options.generations, 10) : undefined,
        crackDensity: options.crackDensity ? parseFloat(options.crackDensity) : undefined,
        stressScale: options.stressScale ? parseFloat(options.stressScale) : undefined,
        straightness: options.straightness ? parseFloat(options.straightness) : undefined,
        jitter: options.jitter ? parseFloat(options.jitter) : undefined,
        anisotropy: options.anisotropy ? parseFloat(options.anisotropy) : undefined,
        anisotropyAngleDeg: options.anisotropyAngle ? parseFloat(options.anisotropyAngle) : undefined,
        arrestThreshold: options.arrestThreshold ? parseFloat(options.arrestThreshold) : undefined,
        captureRadius: options.captureRadius ? parseFloat(options.captureRadius) : undefined,
        edgeNucleation: options.edgeNucleation ? parseFloat(options.edgeNucleation) : undefined,
        boldPasses: options.boldPasses ? parseInt(options.boldPasses, 10) : undefined,
        taper: options.taper ? parseFloat(options.taper) : undefined,
        plateHatch: options.plateHatch === false ? false : undefined,
        hatchSpacing: options.hatchSpacing ? parseFloat(options.hatchSpacing) : undefined,
        hatchCoverage: options.hatchCoverage ? parseFloat(options.hatchCoverage) : undefined,
        hatchAngleDeg: options.hatchAngle ? parseFloat(options.hatchAngle) : undefined,
        edgeCurl: options.edgeCurl ? parseFloat(options.edgeCurl) : undefined,
        wobble: options.wobble ? parseFloat(options.wobble) : undefined,
        optimize: options.optimize,
      };

      console.log('Rendering fracture network...');
      console.log(`  Size: ${width}x${height}`);
      console.log(`  Preset: ${fractureOptions.preset}`);

      const result = applySketchFromFlags(
        generateFracture(fractureOptions),
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
