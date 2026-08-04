import type { Command } from 'commander';
import {
  generateHarmonograph,
  type HarmonographMode,
  type HarmonographOptions,
  type HarmonographPreset,
  type RosetteEnvelope,
  type SVGOptions,
  type TrochoidKind,
} from '@flow-lines/core';
import { addTileOptions, resolvePageFrame, writePlotOutput, PAPER_SPEC_HELP } from '../page.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';

export function registerHarmonograph(program: Command) {
  addTileOptions(addSketchOptions(program.command('harmonograph')))
    .description(
      'Render the classic curve-drawing machines: damped-pendulum ' +
        'harmonographs, spirograph trochoids, and engine-turned guilloché ' +
        'rosettes — closed-form curves that cycle up to four pens'
    )
    .option('-w, --width <number>', 'Canvas width in pixels (ignored with --paper)', '800')
    .option('-h, --height <number>', 'Canvas height in pixels (ignored with --paper)', '800')
    .option('--paper <size>', PAPER_SPEC_HELP)
    .option('--orientation <o>', 'Paper orientation: portrait or landscape', 'portrait')
    .option('--margin-mm <number>', 'Clear paper border in mm (with --paper)', '10')
    .option('--pen-width-mm <number>', 'Plotted pen width in mm (with --paper)', '0.3')
    .option('--resolution <number>', 'Render density in px per mm (with --paper)', '3')
    .option('-m, --margin <number>', 'Margin from canvas edges in px (without --paper)', '20')
    .option('-s, --seed <number>', 'Seed: phase jitter, damping asymmetry, nest rotation')
    .option(
      '--preset <name>',
      'Look: lissajous | pendulum | rotary | spiro | wheelwork | rosette | engine-turn',
      'pendulum'
    )
    .option('--mode <name>', 'Machine: harmonograph | spirograph | rosette (default preset)')
    .option('--scale <number>', 'Figure size as a fraction of the inner sheet (0-1)')
    .option('--jitter <number>', 'Seeded drift of phases and waves (0-1)')
    .option('--ink-groups <number>', 'Pens the passes/repeats/rings cycle through (1-4)')
    .option('--ratio-num <number>', 'Pendulum frequency ratio numerator (y)')
    .option('--ratio-den <number>', 'Pendulum frequency ratio denominator (x)')
    .option('--detune <number>', 'Beat drift added to the ratio (0-0.05)')
    .option('--damping <number>', 'Decay over the whole trace (0-1, 0 = Lissajous)')
    .option('--rotary <number>', 'Rotary-pendulum blend (0-1)')
    .option('--phase <number>', 'Lateral phase offset in degrees')
    .option('--periods <number>', 'Base-pendulum periods traced (2-200)')
    .option('--passes <number>', 'Repeated decayed traces (default = ink groups)')
    .option('--lobes <number>', 'Trochoid lobes p of the p/q wheel ratio')
    .option('--wheel-order <number>', 'Wheel order q — the curve closes after q turns')
    .option('--pen-offset <number>', 'Pen distance as a fraction of the wheel radius (0-1.5)')
    .option('--trochoid-kind <name>', 'Wheel rolling inside or outside: hypo | epi')
    .option('--nest <number>', 'Nested repeats of the closed curve (1-24)')
    .option('--nest-shrink <number>', 'Per-repeat shrink factor (0.5-1)')
    .option('--nest-rotate <number>', 'Per-repeat rotation in degrees (0 = seeded)')
    .option('--rings <number>', 'Rosette rings (1-120)')
    .option('--waves <number>', 'Wave harmonic around each ring')
    .option('--wave-amp <number>', 'Wave depth as a fraction of the ring pitch (0-1)')
    .option('--phase-advance <number>', 'Per-ring wave phase advance in degrees — the weave')
    .option('--inner-hole <number>', 'Clear centre as a fraction of the figure radius (0-0.9)')
    .option('--waves2 <number>', 'Second wave harmonic (0 = off)')
    .option('--wave2-amp <number>', 'Second-harmonic depth as a fraction of the ring pitch (0-1)')
    .option('--envelope <name>', 'Wave-depth envelope across the band: flat | bloom | edge')
    .option('--detail <number>', 'Target chord length in px')
    .option('--wobble <number>', 'Hand-drawn wobble amplitude in px (default 0)')
    .option(
      '--split-layers',
      'Write one SVG per ink group (ink-0..ink-3) for multi-pen plotting, named <output>.<layer>.svg'
    )
    .option('--stroke-color <color>', 'SVG stroke color', '#000000')
    .option('--stroke-width <number>', 'SVG stroke width (without --paper)', '1')
    .option('--background', 'Include background rectangle')
    .option('--background-color <color>', 'Background color', '#ffffff')
    .option('--no-optimize', 'Skip stroke chaining and pen-travel ordering')
    .option('-o, --output <file>', 'Output file path', 'harmonograph.svg')
    .action((options) => {
      const frame = resolvePageFrame(options);
      const { width, height, marginPx, paperSvg, paperStrokeWidth } = frame;

      const harmonographOptions: HarmonographOptions = {
        width,
        height,
        margin: marginPx,
        seed: options.seed ? parseInt(options.seed, 10) : undefined,
        preset: options.preset as HarmonographPreset,
        mode: options.mode ? (options.mode as HarmonographMode) : undefined,
        scale: options.scale ? parseFloat(options.scale) : undefined,
        jitter: options.jitter !== undefined ? parseFloat(options.jitter) : undefined,
        inkGroups: options.inkGroups ? parseInt(options.inkGroups, 10) : undefined,
        ratioNum: options.ratioNum ? parseInt(options.ratioNum, 10) : undefined,
        ratioDen: options.ratioDen ? parseInt(options.ratioDen, 10) : undefined,
        detune: options.detune !== undefined ? parseFloat(options.detune) : undefined,
        damping: options.damping !== undefined ? parseFloat(options.damping) : undefined,
        rotary: options.rotary !== undefined ? parseFloat(options.rotary) : undefined,
        phaseDeg: options.phase !== undefined ? parseFloat(options.phase) : undefined,
        periods: options.periods ? parseFloat(options.periods) : undefined,
        passes: options.passes ? parseInt(options.passes, 10) : undefined,
        lobes: options.lobes ? parseInt(options.lobes, 10) : undefined,
        wheelOrder: options.wheelOrder ? parseInt(options.wheelOrder, 10) : undefined,
        penOffset: options.penOffset !== undefined ? parseFloat(options.penOffset) : undefined,
        trochoidKind: options.trochoidKind ? (options.trochoidKind as TrochoidKind) : undefined,
        nest: options.nest ? parseInt(options.nest, 10) : undefined,
        nestShrink: options.nestShrink ? parseFloat(options.nestShrink) : undefined,
        nestRotateDeg: options.nestRotate !== undefined ? parseFloat(options.nestRotate) : undefined,
        rings: options.rings ? parseInt(options.rings, 10) : undefined,
        waves: options.waves ? parseInt(options.waves, 10) : undefined,
        waveAmp: options.waveAmp !== undefined ? parseFloat(options.waveAmp) : undefined,
        phaseAdvanceDeg:
          options.phaseAdvance !== undefined ? parseFloat(options.phaseAdvance) : undefined,
        innerHole: options.innerHole !== undefined ? parseFloat(options.innerHole) : undefined,
        waves2: options.waves2 !== undefined ? parseInt(options.waves2, 10) : undefined,
        wave2Amp: options.wave2Amp !== undefined ? parseFloat(options.wave2Amp) : undefined,
        envelope: options.envelope ? (options.envelope as RosetteEnvelope) : undefined,
        detail: options.detail ? parseFloat(options.detail) : undefined,
        wobble: options.wobble ? parseFloat(options.wobble) : undefined,
        optimize: options.optimize,
      };

      console.log('Rendering harmonograph...');
      console.log(`  Size: ${width}x${height}`);
      console.log(`  Preset: ${harmonographOptions.preset}`);

      const result = applySketchFromFlags(
        generateHarmonograph(harmonographOptions),
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
