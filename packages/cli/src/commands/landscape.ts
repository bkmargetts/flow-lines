import type { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateLandscape, toSVG, type LandscapeOptions, type SVGOptions } from '@flow-lines/core';
import { LANDSCAPE_PALETTES, LANDSCAPE_SCENES } from '../palettes.js';
import { resolvePageFrame } from '../page.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';

export function registerLandscape(program: Command) {
  addSketchOptions(program.command('landscape'))
    .description('Generate procedural, plottable pen-and-ink landscapes')
    .option('-w, --width <number>', 'Canvas width in pixels (ignored with --paper)', '630')
    .option('-h, --height <number>', 'Canvas height in pixels (ignored with --paper)', '720')
    .option('--paper <size>', 'Plot to a physical sheet (a6,a5,a4,a3,letter,legal,tabloid); exports the SVG in mm')
    .option('--orientation <o>', 'Paper orientation: portrait or landscape', 'portrait')
    .option('--margin-mm <number>', 'Clear paper border in mm (with --paper)', '12')
    .option('--pen-width-mm <number>', 'Plotted pen width in mm (with --paper)', '0.45')
    .option('--resolution <number>', 'Render density in px per mm (with --paper)', '3')
    .option('-m, --margin <number>', 'Margin from canvas edges in px (without --paper)', '24')
    .option('-s, --seed <number>', 'Random seed for reproducibility')
    .option('--scene <s>', 'coastal-sunset | misty-ranges | rolling-hills | desert-dunes | alpine-lake')
    // composition (no defaults: a --scene preset fills these, explicit flags override)
    .option('--horizon-frac <number>', 'Horizon height as a fraction of the frame (0-1; default 0.46)')
    .option('--horizon-wobble <number>', 'Horizon undulation amplitude in px (default 6)')
    .option('--horizon-freq <number>', 'Horizon noise frequency (default 2.2)')
    .option('--no-water', 'Land below the horizon instead of water')
    .option('--water-frac <number>', 'Share of the below-horizon space given to water (0-1; default 0.6)')
    // sky / sun
    .option('--sky-spacing <number>', 'Vertical sky hatch spacing in px', '6')
    .option('--sky-tone-top <number>', 'Sky hatch coverage at the top 0..1 (default 0.32)')
    .option('--sky-tone-horizon <number>', 'Sky hatch coverage at the horizon 0..1 (default 0.58)')
    .option('--no-sun', 'Do not hold a sun/moon as negative space')
    .option('--sun-x <number>', 'Sun centre x in px (defaults to ~middle)')
    .option('--sun-y <number>', 'Sun centre y in px (defaults to upper sky)')
    .option('--sun-radius <number>', 'Sun radius in px', '42')
    .option('--sun-halo <number>', 'Soft halo as a fraction of the radius (0-1.5)', '0.7')
    .option('--sun-rays', 'Short radial glow strokes around the sun')
    .option('--moon-rim', 'Draw a faint rim (moon) instead of bare paper')
    .option('--no-reflection', 'Skip mirror shimmer in the water')
    .option('--reflection-width <number>', 'Sun reflection column half-width in px', '26')
    // water
    .option('--water-spacing <number>', 'Horizontal water hatch spacing in px', '6')
    .option('--water-dash <number>', 'Mean water dash length in px', '36')
    .option('--water-gap <number>', 'Mean water dash gap in px', '10')
    // ridges (count/amp/freq/persistence/angle have no default: --scene fills them)
    .option('--ridge-count <number>', 'Receding ridge silhouettes (land scenes; default 3)')
    .option('--ridge-amp <number>', 'Front-ridge amplitude in px (default 34)')
    .option('--ridge-freq <number>', 'Ridge noise frequency (default 2.4)')
    .option('--ridge-octaves <number>', 'Ridge noise octaves', '4')
    .option('--ridge-persistence <number>', 'Ridge noise roughness (0.3-0.75; default 0.5)')
    .option('--ridge-spacing <number>', 'Ridge hatch spacing in px', '4.5')
    .option('--ridge-angle <number>', 'Straight-hatch angle in degrees (when not form-following; default 80)')
    .option('--no-form-follow', 'Straight hatch instead of cross-contour comb')
    .option('--slope-follow', 'Tilt straight ridge hatch toward its descent')
    .option('--ridge-sharpness <number>', 'Rolling swell → peaked, skewed summits 0..1 (default 0.3)')
    .option('--atmosphere <number>', 'Depth haze: far ridges lighter, hatch fades to mist 0..1 (default 0.4)')
    // compositional depth
    .option('--headlands <number>', 'Overlapping receding headlands on water (default per --scene)')
    .option('--foreground <number>', 'Dark foreground landform size 0..1 (default 0)')
    .option('--foreground-side <s>', 'Foreground landform side: left | right (default per --scene)')
    .option('--focus <number>', 'Focal hierarchy: darks/detail gather at a focal point 0..1 (default 0.35)')
    .option('--focus-x <number>', 'Focal column x in px (defaults to the sun)')
    // hatch craft
    .option('--tone-contrast <number>', 'Light/shadow modulation 0..1 (default 0.5)')
    .option('--cross-hatch <number>', 'Extra shadow hatch layers 0..2 (default 1)')
    .option('--patchiness <number>', 'Break shadow into hand-sized patches 0..1', '0.5')
    .option('--taper <number>', 'Stroke-end taper / break / jitter 0..1', '0.5')
    // detail marks
    .option('--clouds <number>', 'Carved-cloud coverage 0..1 (default 0)')
    .option('--trees <number>', 'Foliage clumps on the nearest crest (default 0)')
    .option('--tree-style <s>', 'Tree vocabulary: mixed | round | conifer | scrub (default mixed)')
    .option('--birds <number>', 'Gull marks in the sky (default 0)')
    // rocks
    .option('--rocks <number>', 'Small rocks / islands (default 0, or per --scene)')
    .option('--rock-max-size <number>', 'Max rock size in px', '46')
    .option('--rock-spacing <number>', 'Rock hatch spacing in px', '4')
    // ink / finishing
    .option('--palette <p>', 'Multi-pen palette: ink | sunset | graphite | sanguine | cyanotype', 'ink')
    .option('--stroke-width <number>', 'SVG stroke width (without --paper)', '1.2')
    .option('--wobble <number>', 'Hand-drawn wobble amplitude in px', '0.6')
    .option('--sketch <number>', 'Hand-drawn sketch overdraw intensity (0-1)', '0')
    .option('--sketch-style <s>', 'Sketch character: loose | fine | gestural | scratchy', 'loose')
    .option('--background', 'Include background rectangle')
    .option('--background-color <color>', 'Background color', '#ffffff')
    .option('--no-optimize', 'Skip stroke chaining and pen-travel ordering')
    .option('-o, --output <file>', 'Output file path', 'landscape.svg')
    .action((options) => {
      const { width, height, marginPx, paperSvg, paperStrokeWidth } = resolvePageFrame(options);

      // A --scene preset seeds the defaults; explicit flags still override it.
      const scene = options.scene ? LANDSCAPE_SCENES[String(options.scene)] : undefined;
      const num = (flag: string, fallback: number): number => (options[flag] !== undefined ? parseFloat(options[flag]) : fallback);

      const landscapeOptions: LandscapeOptions = {
        width,
        height,
        margin: marginPx,
        seed: options.seed ? parseInt(options.seed, 10) : undefined,
        horizonFrac: num('horizonFrac', scene?.horizonFrac ?? 0.46),
        horizonWobble: num('horizonWobble', scene?.horizonWobble ?? 6),
        horizonFreq: num('horizonFreq', scene?.horizonFreq ?? 2.2),
        hasWater: scene ? (scene.hasWater ?? true) && options.water : options.water,
        waterFrac: num('waterFrac', scene?.waterFrac ?? 0.6),
        skyHatchSpacing: num('skySpacing', 6),
        skyToneTop: num('skyToneTop', scene?.skyToneTop ?? 0.32),
        skyToneHorizon: num('skyToneHorizon', scene?.skyToneHorizon ?? 0.58),
        sun: scene ? (scene.sun ?? true) && options.sun : options.sun,
        sunX: options.sunX !== undefined ? parseFloat(options.sunX) : undefined,
        sunY: options.sunY !== undefined ? parseFloat(options.sunY) : undefined,
        sunRadius: num('sunRadius', 42),
        sunHalo: num('sunHalo', 0.7),
        moonRim: options.moonRim ?? false,
        sunRays: options.sunRays ?? scene?.sunRays ?? false,
        reflection: scene ? (scene.reflection ?? true) && options.reflection : options.reflection,
        reflectionWidth: num('reflectionWidth', 26),
        waterHatchSpacing: num('waterSpacing', 6),
        waterDash: num('waterDash', 36),
        waterGap: num('waterGap', 10),
        ridgeCount: Math.round(num('ridgeCount', scene?.ridgeCount ?? 3)),
        ridgeAmp: num('ridgeAmp', scene?.ridgeAmp ?? 34),
        ridgeFreq: num('ridgeFreq', scene?.ridgeFreq ?? 2.4),
        ridgeOctaves: Math.round(num('ridgeOctaves', 4)),
        ridgePersistence: num('ridgePersistence', scene?.ridgePersistence ?? 0.5),
        ridgeHatchSpacing: num('ridgeSpacing', 4.5),
        ridgeHatchAngle: num('ridgeAngle', scene?.ridgeHatchAngle ?? 80),
        slopeFollow: options.slopeFollow ?? scene?.slopeFollow ?? false,
        formFollow: scene ? (scene.formFollow ?? true) && options.formFollow : options.formFollow,
        ridgeSharpness: num('ridgeSharpness', scene?.ridgeSharpness ?? 0.3),
        atmosphere: num('atmosphere', scene?.atmosphere ?? 0.4),
        headlands: Math.round(num('headlands', scene?.headlands ?? 0)),
        foreground: num('foreground', scene?.foreground ?? 0),
        foregroundSide: (options.foregroundSide ?? scene?.foregroundSide ?? 'left') as LandscapeOptions['foregroundSide'],
        focus: num('focus', scene?.focus ?? 0.35),
        focusX: options.focusX !== undefined ? parseFloat(options.focusX) : undefined,
        toneContrast: num('toneContrast', scene?.toneContrast ?? 0.5),
        crossHatch: Math.round(num('crossHatch', scene?.crossHatch ?? 1)),
        hatchPatchiness: num('patchiness', 0.5),
        taper: num('taper', 0.5),
        clouds: num('clouds', scene?.clouds ?? 0),
        trees: Math.round(num('trees', scene?.trees ?? 0)),
        treeStyle: (options.treeStyle ?? scene?.treeStyle ?? 'mixed') as LandscapeOptions['treeStyle'],
        birds: Math.round(num('birds', scene?.birds ?? 0)),
        rocks: Math.round(num('rocks', scene?.rocks ?? 0)),
        rockMaxSize: num('rockMaxSize', 46),
        rockHatchSpacing: num('rockSpacing', 4),
        penWidth: paperStrokeWidth ?? parseFloat(options.strokeWidth),
        wobble: parseFloat(options.wobble),
        sketch: parseFloat(options.sketch),
        sketchStyle: options.sketchStyle as LandscapeOptions['sketchStyle'],
      };

      console.log('Generating landscape...');
      console.log(`  Size: ${width}x${height}, scene: ${options.scene ?? 'custom'}`);

      const result = generateLandscape(landscapeOptions);
      console.log(`  Generated ${result.lines.length} lines`);

      const palette = LANDSCAPE_PALETTES[scene?.palette ?? options.palette] ?? LANDSCAPE_PALETTES.ink;
      const svgOptions: SVGOptions = {
        strokeColor: palette.contour,
        strokeWidth: paperStrokeWidth ?? parseFloat(options.strokeWidth),
        includeBackground: options.background ?? false,
        backgroundColor: options.backgroundColor,
        optimizePaths: options.optimize,
        layerColors: palette,
        ...paperSvg,
      };

      const svg = toSVG(applySketchFromFlags(result, options, sketchScale(options)), svgOptions);
      const outputPath = resolve(process.cwd(), options.output);
      writeFileSync(outputPath, svg, 'utf-8');
      console.log(`\nSaved to: ${outputPath}`);
    });
}
