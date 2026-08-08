import type { Command } from 'commander';
import {
  generateLapidary,
  LAPIDARY_PRESETS,
  VEIN_LAYER,
  type LapidaryMode,
  type LapidaryOptions,
  type LapidaryShapes,
  type LapidaryTexture,
  type BandTexture,
  type PenAssignment,
  type SpiralDirection,
  type SpiralForm,
  type SpiralJoin,
  type SVGOptions,
} from '@flow-lines/core';
import { addTileOptions, resolvePageFrame, writePlotOutput, PAPER_SPEC_HELP } from '../page.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';
import { LAPIDARY_PALETTES } from '../palettes.js';

const TEXTURE_KINDS = new Set([
  'lines',
  'wavy',
  'contour',
  'crystal',
  'hatch',
  'patchy',
  'cross',
  'stipple',
  'mottle',
  'grain',
  'blank',
]);

export function registerLapidary(program: Command) {
  addTileOptions(addSketchOptions(program.command('lapidary')))
    .description(
      'Render layered pattern artworks: organic regions — concentric agate ' +
        'bands, scattered breccia fragments, horizontal strata or a spiral ' +
        'ribbon winding into the centre — each filled with its own line ' +
        'texture and split by clean reserved-paper seams, over 1-4 ' +
        'interleaved pens'
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
      `Curated look: ${Object.keys(LAPIDARY_PRESETS).join(' | ')} (explicit flags override)`
    )
    .option('--mode <name>', 'Arrangement: agate | breccia | strata | spiral')
    .option(
      '--bands <number>',
      'Region count incl. the background field when present (2-10); spiral windings in spiral mode'
    )
    .option(
      '--shapes <style>',
      'Silhouette language: organic | angular | mixed (angular = straight-edged facets/shards; stepped terraces in strata)'
    )
    .option('--no-field', 'Skip the full-frame background band — shapes float on clean paper')
    .option('--irregularity <number>', 'Silhouette irregularity (0-1)')
    .option('--faults <number>', 'Vertical fault planes across the strata stack (0-4, strata only)')
    .option(
      '--veins',
      'Trace the seams between breccia fragments on the dedicated "vein" accent layer (kintsugi; breccia only)'
    )
    .option('--no-veins', 'Switch veins off (overrides a preset that enables them)')
    .option('--coverage <number>', 'Outer silhouette size as a fraction of the frame (0.4-1)')
    .option('--center-x <number>', 'Composition centre X offset (-0.5..0.5)')
    .option('--center-y <number>', 'Composition centre Y offset (-0.5..0.5)')
    .option(
      '--spiral-form <form>',
      'Spiral cross-section: circular | rectangular (superellipse coil matching the sheet aspect; spiral only)'
    )
    .option(
      '--spiral-direction <dir>',
      'inward winds from the rim to the centre; outward unwinds from it, loosening toward the edge (spiral only)'
    )
    .option(
      '--spiral-join <join>',
      'cells (carved reserved-paper seams between ribbon cells) | blend (textures morph seamlessly; spiral only)'
    )
    .option(
      '--spiral-width <number>',
      'Ribbon width as a fraction of the local winding pitch (0.15-0.9, spiral only)'
    )
    .option(
      '--spiral-taper <number>',
      'Signed width taper toward the leading end (-1..1; positive thins, negative grows; spiral only)'
    )
    .option(
      '--spiral-pulse <number>',
      'Low-frequency organic width modulation along the arc (0-1, spiral only)'
    )
    .option('--halo <number>', 'Reserved-paper seam width in px')
    .option(
      '--textures <csv>',
      'Outer→inner band textures, cycled (lines,wavy,contour,crystal,hatch,patchy,cross,stipple,mottle,grain,blank); ' +
        'omit for a seeded deal. Per-band overrides: kind[:angle[:spacingScale]], ' +
        'e.g. lines:45,hatch:125:0.6,wavy::0.8'
    )
    .option('--angle <number>', 'Base stroke direction in degrees (90 = vertical)')
    .option('--angle-drift <number>', 'Seeded per-band drift off the base angle in degrees')
    .option('--spacing <number>', 'Base line pitch in px')
    .option('--density-contrast <number>', 'Spread between dense and sparse bands (0-1)')
    .option(
      '--waviness <number>',
      'Wavy-texture amplitude / contour-band undulation / grain-dash bend (0-1)'
    )
    .option(
      '--patchiness <number>',
      'Patchy/cross hole amount and mottle weave amount (0-1; cross floors its gate at 0.25)'
    )
    .option('--pens <number>', 'Pen count (1-4), strokes tagged ink-0..ink-3')
    .option('--pen-assignment <mode>', 'interleave | per-region')
    .option(
      '--palette <p>',
      `Curated pen set: ${Object.keys(LAPIDARY_PALETTES).join(' | ')} — sets the pen count ` +
        'and per-pen colours incl. the vein accent (--pens and --vein-color override)'
    )
    .option('--vein-color <color>', 'Ink colour for the "vein" accent layer')
    .option('--outlines', 'Ink each region silhouette as a stroke (the background field is never outlined)')
    .option('--no-outlines', 'Switch outlines off (overrides a preset that enables them)')
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

      const palette = options.palette ? LAPIDARY_PALETTES[String(options.palette)] : undefined;
      if (options.palette && !palette) {
        console.error(
          `Unknown palette "${options.palette}". Valid: ${Object.keys(LAPIDARY_PALETTES).join(' | ')}`
        );
        process.exit(1);
      }

      let textures: Array<LapidaryTexture | BandTexture> | undefined;
      if (options.textures) {
        textures = String(options.textures)
          .split(',')
          .map((item) => {
            const [kind, angle, spacingScale] = item.trim().split(':');
            if (!TEXTURE_KINDS.has(kind)) {
              console.error(`Unknown texture "${kind}". Valid: ${[...TEXTURE_KINDS].join(' | ')}`);
              process.exit(1);
            }
            // A bare kind stays a plain string — the exact pre-override path.
            if (angle === undefined && spacingScale === undefined) {
              return kind as LapidaryTexture;
            }
            const spec: BandTexture = { kind: kind as LapidaryTexture };
            if (angle !== undefined && angle !== '') {
              spec.angleDeg = parseFloat(angle);
              if (Number.isNaN(spec.angleDeg)) {
                console.error(`Bad angle "${angle}" in --textures item "${item.trim()}"`);
                process.exit(1);
              }
            }
            if (spacingScale !== undefined && spacingScale !== '') {
              spec.spacingScale = parseFloat(spacingScale);
              if (Number.isNaN(spec.spacingScale)) {
                console.error(`Bad spacing scale "${spacingScale}" in --textures item "${item.trim()}"`);
                process.exit(1);
              }
            }
            return spec;
          });
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
        faults: options.faults ? parseInt(options.faults, 10) : undefined,
        // Three-state: --veins true, --no-veins false, neither leaves the
        // preset's value in charge (commander sets nothing when both forms
        // are registered and neither is passed).
        veins: typeof options.veins === 'boolean' ? options.veins : undefined,
        coverage: options.coverage ? parseFloat(options.coverage) : undefined,
        centerX: options.centerX ? parseFloat(options.centerX) : undefined,
        centerY: options.centerY ? parseFloat(options.centerY) : undefined,
        haloPx: options.halo ? parseFloat(options.halo) : undefined,
        spiralForm: options.spiralForm as SpiralForm | undefined,
        spiralDirection: options.spiralDirection as SpiralDirection | undefined,
        spiralJoin: options.spiralJoin as SpiralJoin | undefined,
        spiralWidth: options.spiralWidth ? parseFloat(options.spiralWidth) : undefined,
        spiralTaper: options.spiralTaper ? parseFloat(options.spiralTaper) : undefined,
        spiralPulse: options.spiralPulse ? parseFloat(options.spiralPulse) : undefined,
        textures,
        baseAngleDeg: options.angle ? parseFloat(options.angle) : undefined,
        angleDriftDeg: options.angleDrift ? parseFloat(options.angleDrift) : undefined,
        spacingPx: options.spacing ? parseFloat(options.spacing) : undefined,
        densityContrast: options.densityContrast ? parseFloat(options.densityContrast) : undefined,
        waviness: options.waviness ? parseFloat(options.waviness) : undefined,
        patchiness: options.patchiness ? parseFloat(options.patchiness) : undefined,
        pens: options.pens ? parseInt(options.pens, 10) : undefined,
        penAssignment: options.penAssignment as PenAssignment | undefined,
        outlines: typeof options.outlines === 'boolean' ? options.outlines : undefined,
        wobble: options.wobble ? parseFloat(options.wobble) : undefined,
      };
      for (const key of Object.keys(flagOptions) as Array<keyof LapidaryOptions>) {
        if (flagOptions[key] === undefined) delete flagOptions[key];
      }

      const lapidaryOptions: LapidaryOptions = {
        ...preset,
        // The palette carries the pen count (as in the web app) — it beats a
        // preset's pens so every stroke gets a mapped colour, but an explicit
        // --pens (in flagOptions) still wins.
        ...(palette ? { pens: palette.inks.length } : {}),
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

      // Strata bands always partition the full sheet — flag options that only
      // shape agate/breccia silhouettes so the ignore isn't silent (the web
      // Controls disable the same sliders in strata).
      const resolvedMode = lapidaryOptions.mode ?? 'agate';
      if (resolvedMode === 'strata') {
        const ignored: string[] = [];
        if (options.coverage) ignored.push('--coverage');
        if (options.centerX) ignored.push('--center-x');
        if (options.centerY) ignored.push('--center-y');
        if (options.field === false) ignored.push('--no-field');
        if (ignored.length > 0) {
          console.error(`Note: strata spans the full sheet; ${ignored.join(', ')} ignored`);
        }
      }
      if (resolvedMode !== 'breccia' && options.veins) {
        console.error('Note: veins are breccia-only; --veins ignored');
      }
      if (resolvedMode !== 'strata' && options.faults) {
        console.error('Note: faults are strata-only; --faults ignored');
      }
      if (resolvedMode !== 'spiral') {
        const spiralFlags: string[] = [];
        if (options.spiralForm) spiralFlags.push('--spiral-form');
        if (options.spiralDirection) spiralFlags.push('--spiral-direction');
        if (options.spiralJoin) spiralFlags.push('--spiral-join');
        if (options.spiralWidth) spiralFlags.push('--spiral-width');
        if (options.spiralTaper) spiralFlags.push('--spiral-taper');
        if (options.spiralPulse) spiralFlags.push('--spiral-pulse');
        if (spiralFlags.length > 0) {
          console.error(`Note: spiral options are spiral-only; ${spiralFlags.join(', ')} ignored`);
        }
      }

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

      const veinColor = options.veinColor ? String(options.veinColor) : palette?.vein;
      let layerColors: Record<string, string> | undefined;
      if (palette || veinColor) {
        layerColors = {};
        palette?.inks.forEach((ink, i) => {
          layerColors![`ink-${i}`] = ink;
        });
        if (veinColor) layerColors[VEIN_LAYER] = veinColor;
      }

      const svgOptions: SVGOptions = {
        strokeColor: palette ? palette.inks[0] : options.strokeColor,
        strokeWidth: paperStrokeWidth ?? parseFloat(options.strokeWidth),
        includeBackground: options.background ?? false,
        backgroundColor: options.backgroundColor,
        layerColors,
        ...paperSvg,
      };

      writePlotOutput(result, frame, options, svgOptions);
    });
}
