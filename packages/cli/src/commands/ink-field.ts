import type { Command } from 'commander';
import { generateInkField, type InkFieldOptions, type SVGOptions } from '@flow-lines/core';
import { addTileOptions, resolvePageFrame, writePlotOutput, PAPER_SPEC_HELP } from '../page.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';

/** The export layer name for ink index i (matches core's bandLayerName). */
const bandLayer = (i: number): string => `band-${String(i).padStart(2, '0')}`;

const DEFAULT_INK_COLORS = ['#1b48c8', '#111111', '#e2231a', '#0aa64f'];

export function registerInkField(program: Command) {
  addTileOptions(addSketchOptions(program.command('ink-field')))
    .description(
      'Render a material-forward multi-ink field (after Joel Cammarata): a ' +
        'drafted ribbon band braided by vernier pitch differences, a lattice ' +
        'carrying colour planes purely by ink density, or drifting stripe ' +
        'bands — every ink a band-NN pen layer built to physically overprint'
    )
    .option('-w, --width <number>', 'Canvas width in pixels (ignored with --paper)', '800')
    .option('-h, --height <number>', 'Canvas height in pixels (ignored with --paper)', '1066')
    .option('--paper <size>', PAPER_SPEC_HELP)
    .option('--orientation <o>', 'Paper orientation: portrait or landscape', 'portrait')
    .option('--margin-mm <number>', 'Clear paper border in mm (with --paper)', '10')
    .option('--pen-width-mm <number>', 'Plotted pen width in mm (with --paper)', '0.35')
    .option('--resolution <number>', 'Render density in px per mm (with --paper)', '3')
    .option('-m, --margin <number>', 'Margin from canvas edges in px (without --paper)', '30')
    .option('-s, --seed <number>', 'Seed: skeleton, colour planes, misregistration')
    .option('--style <name>', 'Style: ribbon | lattice | stripes', 'ribbon')
    .option('--inks <number>', 'Number of inks / pen layers (1-4)', '3')
    .option('--pitch-mm <number>', 'Gap between lines within one ink, mm', '0.8')
    .option('--angle <deg>', 'Stroke direction for lattice/stripes; 0 = vertical', '0')
    .option('--ink-phase <number>', 'Lateral offset between inks, fraction of pitch', '0.35')
    .option('--pitch-delta <number>', 'Vernier pitch differential between inks (braid)', '0.03')
    .option('--phase-drift <number>', 'Per-ink drift along the band, pitch units', '1.2')
    .option('--misregister-mm <number>', 'Whole-ink misregistration amplitude, mm', '0.3')
    .option('--wobble-mm <number>', 'Low-frequency line wobble, mm', '0')
    .option('--jitter-mm <number>', 'Per-point shake, mm', '0')
    .option('--band-width-mm <number>', 'Ribbon: band width, mm', '30')
    .option('--segments <number>', 'Ribbon: drafted skeleton segments (2-8)', '5')
    .option('--planes <number>', 'Lattice: colour planes (0-4)', '3')
    .option('--patches <number>', 'Lattice: light inset patches (0-2)', '1')
    .option('--base-density <number>', 'Lattice: background coverage (0-1)', '0.45')
    .option('--plane-density <number>', 'Lattice: dominant-ink coverage in a plane (0-1)', '0.9')
    .option('--stripes <number>', 'Stripes: bands along the stroke direction', '9')
    .option('--softness <number>', 'Stripes: band-edge overlap (0-1)', '0.45')
    .option('--blocks', 'Stripes: quantise into ruled dark/light blocks')
    .option('--block-duty <number>', 'Stripes: dark-block fraction (0-1)', '0.5')
    .option('--no-pen-tests', 'Skip the per-ink pen-test dots in the margin')
    .option(
      '--plot-order <mode>',
      'Plot order as a wear gradient: travel | sweep | center-out | center-in ' +
        '(pen wear follows stroke order; non-travel modes trade pen travel for a composed gradient)',
      'travel'
    )
    .option('--plot-order-angle <deg>', 'Sweep direction; 0 plots top→bottom', '0')
    .option(
      '--ink-colors <list>',
      'Comma-separated hex colours, one per ink (preview + split layer naming)',
      DEFAULT_INK_COLORS.join(',')
    )
    .option('--no-blend-inks', 'Skip mix-blend multiply on the preview (crossing inks paint opaque)')
    .option(
      '--split-layers',
      'Write one SVG per ink (band-00..band-03) for multi-pen plotting, named <output>.<layer>.svg'
    )
    .option('--stroke-width <number>', 'SVG stroke width (without --paper)', '1')
    .option('--background', 'Include background rectangle')
    .option('--background-color <color>', 'Background color', '#ffffff')
    .option('--no-optimize', 'Skip pen-travel ordering')
    .option('-o, --output <file>', 'Output file path', 'ink-field.svg')
    .action((options) => {
      const frame = resolvePageFrame(options);
      const { width, height, marginPx, paperSvg, paperStrokeWidth } = frame;
      // mm-denominated knobs scale with the page density; raw px mode uses the
      // same 3 px/mm the --resolution default would give.
      const ppm = frame.page ? frame.page.pxPerMm : 3;

      const orderMode = (options.plotOrder as string) ?? 'travel';
      const wearOrder =
        orderMode === 'sweep'
          ? ('sweep' as const)
          : orderMode === 'center-out'
            ? ('centerOut' as const)
            : orderMode === 'center-in'
              ? ('centerIn' as const)
              : ('none' as const);

      const inkFieldOptions: InkFieldOptions = {
        width,
        height,
        margin: marginPx,
        style: options.style as InkFieldOptions['style'],
        inkCount: parseInt(options.inks, 10),
        pitchPx: parseFloat(options.pitchMm) * ppm,
        angleDeg: parseFloat(options.angle),
        penWidthPx: paperStrokeWidth ?? parseFloat(options.strokeWidth),
        inkPhase: parseFloat(options.inkPhase),
        inkPitchDelta: parseFloat(options.pitchDelta),
        phaseDrift: parseFloat(options.phaseDrift),
        misregisterPx: parseFloat(options.misregisterMm) * ppm,
        jitterPx: parseFloat(options.jitterMm) * ppm,
        wobbleAmpPx: parseFloat(options.wobbleMm) * ppm,
        bandWidthPx: parseFloat(options.bandWidthMm) * ppm,
        ribbonSegments: parseInt(options.segments, 10),
        planeCount: parseInt(options.planes, 10),
        insetPatches: parseInt(options.patches, 10),
        baseDensity: parseFloat(options.baseDensity),
        planeDensity: parseFloat(options.planeDensity),
        stripeCount: parseInt(options.stripes, 10),
        stripeSoftness: parseFloat(options.softness),
        stripeBlocks: options.blocks ?? false,
        blockDuty: parseFloat(options.blockDuty),
        penTests: options.penTests,
        wearOrder,
        wearAngleDeg: parseFloat(options.plotOrderAngle),
        seed: options.seed ? parseInt(options.seed, 10) : undefined,
        optimize: options.optimize,
      };

      console.log('Rendering ink field...');
      console.log(`  Size: ${width}x${height}`);
      console.log(`  Style: ${inkFieldOptions.style}`);

      const result = applySketchFromFlags(
        generateInkField(inkFieldOptions),
        options,
        sketchScale(options)
      );

      console.log(`  Seed: ${result.seed}`);
      console.log(`  Generated ${result.lines.length} strokes`);

      const inks = Math.max(1, Math.min(4, parseInt(options.inks, 10) || 3));
      const colors = String(options.inkColors)
        .split(',')
        .map((c: string) => c.trim())
        .filter(Boolean);
      const layerColors: Record<string, string> = {};
      const layerBlend: Record<string, string> = {};
      for (let i = 0; i < inks; i++) {
        layerColors[bandLayer(i)] = colors[i] ?? colors[colors.length - 1] ?? '#111111';
        if (options.blendInks) layerBlend[bandLayer(i)] = 'multiply';
      }

      const svgOptions: SVGOptions = {
        strokeColor: layerColors[bandLayer(0)],
        strokeWidth: paperStrokeWidth ?? parseFloat(options.strokeWidth),
        includeBackground: options.background ?? false,
        backgroundColor: options.backgroundColor,
        layerColors,
        ...(options.blendInks ? { layerBlend } : {}),
        ...paperSvg,
      };

      writePlotOutput(result, frame, options, svgOptions);
    });
}
