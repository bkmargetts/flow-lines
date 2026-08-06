import type { Command } from 'commander';
import {
  generateLapidary,
  LAPIDARY_PRESETS,
  type LapidaryMode,
  type LapidaryOptions,
  type LapidaryShapes,
  type LapidaryTexture,
  type PenAssignment,
  type SVGOptions,
} from '@flow-lines/core';
import { addTileOptions, resolvePageFrame, writePlotOutput, PAPER_SPEC_HELP } from '../page.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';

const TEXTURE_KINDS = new Set(['lines', 'wavy', 'hatch', 'patchy', 'cross', 'stipple', 'blank']);

export function registerLapidary(program: Command) {
  addTileOptions(addSketchOptions(program.command('lapidary')))
    .description(
      'Render layered pattern artworks: organic regions — concentric agate ' +
        'bands, scattered breccia fragments or horizontal strata — each filled ' +
        'with its own line texture and split by clean reserved-paper seams, ' +
        'over 1-4 interleaved pens'
    )
    .option('-w, --width <number>', 'Canvas width in pixels (ignored with --paper)', '630')
    .option('-h, --height <number>', 'Canvas height in pixels (ignored with --paper)', '891')
    .option('--paper <size>', PAPER_SPEC_HELP)
    .option('--orientation <o>', 'Paper orientation: portrait or landscape', 'portrait')
    .option('--margin-mm <number>', 'Clear paper border in mm (with --paper)', '12')
    .option('--pen-width-mm <number>', 'Plotted pen width in mm (with --paper)', '0.35')
    .option('--resolution <number>', 'Render density in px per mm (with --paper)', '3')
    .option('-m, --margin <number>', 'Margin from canvas edges in px (without --paper)', '36')
    .option('-s, --seed <number>', 'Seed: silhouettes, texture deal, angles, interleave')
    .option(
      '--preset <name>',
      'Curated look: specimen | geode | breccia | terraces | mono (explicit flags override)'
    )
    .option('--mode <name>', 'Arrangement: agate | breccia | strata')
    .option('--bands <number>', 'Region count incl. the background field when present (2-10)')
    .option(
      '--shapes <style>',
      'Silhouette language: organic | angular | mixed (angular = straight-edged facets/shards; stepped terraces in strata)'
    )
    .option('--no-field', 'Skip the full-frame background band — shapes float on clean paper')
    .option('--irregularity <number>', 'Silhouette irregularity (0-1)')
    .option('--coverage <number>', 'Outer silhouette size as a fraction of the frame (0.4-1)')
    .option('--center-x <number>', 'Composition centre X offset (-0.5..0.5)')
    .option('--center-y <number>', 'Composition centre Y offset (-0.5..0.5)')
    .option('--halo <number>', 'Reserved-paper seam width in px')
    .option(
      '--textures <csv>',
      'Outer→inner band textures, cycled (lines,wavy,hatch,patchy,cross,stipple,blank); omit for a seeded deal'
    )
    .option('--angle <number>', 'Base stroke direction in degrees (90 = vertical)')
    .option('--angle-drift <number>', 'Seeded per-band drift off the base angle in degrees')
    .option('--spacing <number>', 'Base line pitch in px')
    .option('--density-contrast <number>', 'Spread between dense and sparse bands (0-1)')
    .option('--waviness <number>', 'Wavy-texture amplitude (0-1)')
    .option('--patchiness <number>', 'Patchy/cross hole amount (0-1)')
    .option('--pens <number>', 'Pen count (1-4), strokes tagged ink-0..ink-3')
    .option('--pen-assignment <mode>', 'interleave | per-region')
    .option('--outlines', 'Ink each region silhouette as a stroke')
    .option('--wobble <number>', 'Hand-drawn wobble amplitude in px')
    .option(
      '--split-layers',
      'Write one SVG per pen (ink-0..ink-3) for multi-pen plotting, named <output>.<layer>.svg'
    )
    .option('--stroke-color <color>', 'SVG stroke color', '#000000')
    .option('--stroke-width <number>', 'SVG stroke width (without --paper)', '1')
    .option('--background', 'Include background rectangle')
    .option('--background-color <color>', 'Background color', '#ffffff')
    .option('--no-optimize', 'Skip stroke chaining and pen-travel ordering')
    .option('-o, --output <file>', 'Output file path', 'lapidary.svg')
    .action((options) => {
      const frame = resolvePageFrame(options);
      const { width, height, marginPx, paperSvg, paperStrokeWidth } = frame;

      const preset = options.preset ? LAPIDARY_PRESETS[String(options.preset)] : undefined;
      if (options.preset && !preset) {
        console.error(
          `Unknown preset "${options.preset}". Valid: ${Object.keys(LAPIDARY_PRESETS).join(' | ')}`
        );
        process.exit(1);
      }

      let textures: LapidaryTexture[] | undefined;
      if (options.textures) {
        textures = String(options.textures)
          .split(',')
          .map((t) => t.trim()) as LapidaryTexture[];
        const bad = textures.find((t) => !TEXTURE_KINDS.has(t));
        if (bad) {
          console.error(`Unknown texture "${bad}". Valid: ${[...TEXTURE_KINDS].join(' | ')}`);
          process.exit(1);
        }
      }

      // Explicit flags override the preset — but only when actually given.
      const flagOptions: Partial<LapidaryOptions> = {
        mode: options.mode as LapidaryMode | undefined,
        // Commander's --no-field default is true; only an explicit --no-field
        // may override a preset's own `field` setting.
        field: options.field === false ? false : undefined,
        shapes: options.shapes as LapidaryShapes | undefined,
        bands: options.bands ? parseInt(options.bands, 10) : undefined,
        irregularity: options.irregularity ? parseFloat(options.irregularity) : undefined,
        coverage: options.coverage ? parseFloat(options.coverage) : undefined,
        centerX: options.centerX ? parseFloat(options.centerX) : undefined,
        centerY: options.centerY ? parseFloat(options.centerY) : undefined,
        haloPx: options.halo ? parseFloat(options.halo) : undefined,
        textures,
        baseAngleDeg: options.angle ? parseFloat(options.angle) : undefined,
        angleDriftDeg: options.angleDrift ? parseFloat(options.angleDrift) : undefined,
        spacingPx: options.spacing ? parseFloat(options.spacing) : undefined,
        densityContrast: options.densityContrast ? parseFloat(options.densityContrast) : undefined,
        waviness: options.waviness ? parseFloat(options.waviness) : undefined,
        patchiness: options.patchiness ? parseFloat(options.patchiness) : undefined,
        pens: options.pens ? parseInt(options.pens, 10) : undefined,
        penAssignment: options.penAssignment as PenAssignment | undefined,
        outlines: options.outlines ? true : undefined,
        wobble: options.wobble ? parseFloat(options.wobble) : undefined,
      };
      for (const key of Object.keys(flagOptions) as Array<keyof LapidaryOptions>) {
        if (flagOptions[key] === undefined) delete flagOptions[key];
      }

      const lapidaryOptions: LapidaryOptions = {
        ...preset,
        ...flagOptions,
        width,
        height,
        margin: marginPx,
        seed: options.seed ? parseInt(options.seed, 10) : undefined,
        optimize: options.optimize,
        // With --paper, anchor feature sizes at the A3 short edge so bigger
        // sheets keep the tuned physical seam/pitch scale; a no-op at
        // A4-and-below. Raw px mode: legacy behaviour, untouched.
        refMinDim: frame.page ? 297 * frame.page.pxPerMm : undefined,
      };

      console.log('Rendering lapidary...');
      console.log(`  Size: ${width}x${height}`);
      console.log(`  Mode: ${lapidaryOptions.mode ?? 'agate'}`);

      const result = applySketchFromFlags(
        generateLapidary(lapidaryOptions),
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
