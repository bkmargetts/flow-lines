#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decode as decodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';
import {
  generateConwayExposure,
  generateFlowLines,
  generateFlowLinesGrid,
  generatePlanet,
  generateVines,
  grayscaleFromRGBA,
  imageToPenInk,
  limitStrokeDensity,
  toSVG,
  toSVGLayers,
  pageMetrics,
  contentRect,
  getPaperSize,
  type ConwayExposureOptions,
  type DirectionMap,
  type FlowLinesOptions,
  type GrayscaleImage,
  type LabelImage,
  type Orientation,
  type PaperFit,
  type PenInkOptions,
  type SVGOptions,
  type VinesOptions,
  type VineComposition,
  type VineMode,
  type VineSeeding,
  type FillShape,
  type VineFill,
  type StemShade,
  type LeafType,
  type LeafStyle,
  type VineFlower,
  type LeafArrangement,
  type Phyllotaxis,
  type Inflorescence,
  type FruitType,
  type VineSupport,
  type StemTexture,
  type Point,
  type PlanetOptions,
  type PlanetType,
} from '@flow-lines/core';

/**
 * Decode a PNG or JPEG file (detected by magic bytes) into RGBA pixels
 */
function loadRGBA(path: string): { data: Uint8Array; width: number; height: number } {
  const buffer = readFileSync(path);

  // PNG signature
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e) {
    const png = PNG.sync.read(buffer);
    return { data: png.data, width: png.width, height: png.height };
  }

  // JPEG signature
  if (buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    const jpeg = decodeJpeg(buffer, { useTArray: true, maxMemoryUsageInMB: 1024 });
    return { data: jpeg.data, width: jpeg.width, height: jpeg.height };
  }

  throw new Error(`Unsupported image format: ${path} (only PNG and JPEG are supported)`);
}

/**
 * Load a normal/flow map: R and G channels encode the X and Y direction
 * components (128 = zero), as in a tangent-space normal map
 */
function loadDirectionMap(path: string): DirectionMap {
  const { data, width, height } = loadRGBA(path);
  const x = new Float32Array(width * height);
  const y = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    x[i] = (data[i * 4] / 255) * 2 - 1;
    y[i] = (data[i * 4 + 1] / 255) * 2 - 1;
  }

  return { width, height, x, y };
}

/**
 * Load a semantic label raster: the red channel carries the taxonomy id
 * directly (0 unknown, 1 sky, 2 water, 3 foliage, 4 ground, 5 building,
 * 6 person, 7 object), e.g. from scripts/segment-labels.mjs
 */
function loadLabelImage(path: string): LabelImage {
  const { data, width, height } = loadRGBA(path);
  const labels = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    labels[i] = data[i * 4];
  }
  return { width, height, data: labels };
}

/**
 * Decode a PNG or JPEG file (detected by magic bytes) into a grayscale image
 */
function loadImage(path: string): GrayscaleImage {
  const buffer = readFileSync(path);

  // PNG signature
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e) {
    const png = PNG.sync.read(buffer);
    return grayscaleFromRGBA(png.data, png.width, png.height);
  }

  // JPEG signature
  if (buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    const jpeg = decodeJpeg(buffer, { useTArray: true, maxMemoryUsageInMB: 1024 });
    return grayscaleFromRGBA(jpeg.data, jpeg.width, jpeg.height);
  }

  throw new Error(`Unsupported image format: ${path} (only PNG and JPEG are supported)`);
}

const program = new Command();

program
  .name('flow-lines')
  .description('Generate beautiful flow line art for pen plotters')
  .version('0.1.0');

program
  .command('generate')
  .description('Generate a flow lines SVG')
  .option('-w, --width <number>', 'Canvas width in pixels', '800')
  .option('-h, --height <number>', 'Canvas height in pixels', '800')
  .option('-l, --lines <number>', 'Number of flow lines', '100')
  .option('-s, --seed <number>', 'Random seed for reproducibility')
  .option('--step-length <number>', 'Step length for line tracing', '2')
  .option('--max-steps <number>', 'Maximum steps per line', '500')
  .option('-m, --margin <number>', 'Margin from canvas edges', '20')
  .option('--min-length <number>', 'Minimum line length in points', '10')
  .option('--noise-scale <number>', 'Scale of the noise field', '0.005')
  .option('--octaves <number>', 'Noise octaves for detail', '4')
  .option('--persistence <number>', 'Noise persistence', '0.5')
  .option('--lacunarity <number>', 'Noise lacunarity', '2')
  .option('--stroke-color <color>', 'SVG stroke color', '#000000')
  .option('--stroke-width <number>', 'SVG stroke width', '1')
  .option('--background', 'Include background rectangle')
  .option('--background-color <color>', 'Background color', '#ffffff')
  .option('-o, --output <file>', 'Output file path', 'flow-lines.svg')
  .action((options) => {
    const flowOptions: FlowLinesOptions = {
      width: parseInt(options.width, 10),
      height: parseInt(options.height, 10),
      lineCount: parseInt(options.lines, 10),
      seed: options.seed ? parseInt(options.seed, 10) : undefined,
      stepLength: parseFloat(options.stepLength),
      maxSteps: parseInt(options.maxSteps, 10),
      margin: parseInt(options.margin, 10),
      minLineLength: parseInt(options.minLength, 10),
      noiseScale: parseFloat(options.noiseScale),
      octaves: parseInt(options.octaves, 10),
      persistence: parseFloat(options.persistence),
      lacunarity: parseFloat(options.lacunarity),
    };

    const svgOptions: SVGOptions = {
      strokeColor: options.strokeColor,
      strokeWidth: parseFloat(options.strokeWidth),
      includeBackground: options.background ?? false,
      backgroundColor: options.backgroundColor,
    };

    console.log('Generating flow lines...');
    console.log(`  Size: ${flowOptions.width}x${flowOptions.height}`);
    console.log(`  Lines: ${flowOptions.lineCount}`);

    const result = generateFlowLines(flowOptions);

    console.log(`  Seed: ${result.seed}`);
    console.log(`  Generated ${result.lines.length} lines`);

    const svg = toSVG(result, svgOptions);
    const outputPath = resolve(process.cwd(), options.output);

    writeFileSync(outputPath, svg, 'utf-8');
    console.log(`\nSaved to: ${outputPath}`);
  });

program
  .command('grid')
  .description('Generate flow lines from a grid of starting points')
  .option('-w, --width <number>', 'Canvas width in pixels', '800')
  .option('-h, --height <number>', 'Canvas height in pixels', '800')
  .option('-g, --grid-spacing <number>', 'Spacing between grid points', '20')
  .option('-s, --seed <number>', 'Random seed for reproducibility')
  .option('--step-length <number>', 'Step length for line tracing', '2')
  .option('--max-steps <number>', 'Maximum steps per line', '500')
  .option('-m, --margin <number>', 'Margin from canvas edges', '20')
  .option('--min-length <number>', 'Minimum line length in points', '10')
  .option('--noise-scale <number>', 'Scale of the noise field', '0.005')
  .option('--octaves <number>', 'Noise octaves for detail', '4')
  .option('--persistence <number>', 'Noise persistence', '0.5')
  .option('--lacunarity <number>', 'Noise lacunarity', '2')
  .option('--stroke-color <color>', 'SVG stroke color', '#000000')
  .option('--stroke-width <number>', 'SVG stroke width', '1')
  .option('--background', 'Include background rectangle')
  .option('--background-color <color>', 'Background color', '#ffffff')
  .option('-o, --output <file>', 'Output file path', 'flow-lines.svg')
  .action((options) => {
    const svgOptions: SVGOptions = {
      strokeColor: options.strokeColor,
      strokeWidth: parseFloat(options.strokeWidth),
      includeBackground: options.background ?? false,
      backgroundColor: options.backgroundColor,
    };

    console.log('Generating flow lines from grid...');
    console.log(`  Size: ${options.width}x${options.height}`);
    console.log(`  Grid spacing: ${options.gridSpacing}`);

    const result = generateFlowLinesGrid({
      width: parseInt(options.width, 10),
      height: parseInt(options.height, 10),
      gridSpacing: parseInt(options.gridSpacing, 10),
      seed: options.seed ? parseInt(options.seed, 10) : undefined,
      stepLength: parseFloat(options.stepLength),
      maxSteps: parseInt(options.maxSteps, 10),
      margin: parseInt(options.margin, 10),
      minLineLength: parseInt(options.minLength, 10),
      noiseScale: parseFloat(options.noiseScale),
      octaves: parseInt(options.octaves, 10),
      persistence: parseFloat(options.persistence),
      lacunarity: parseFloat(options.lacunarity),
    });

    console.log(`  Seed: ${result.seed}`);
    console.log(`  Generated ${result.lines.length} lines`);

    const svg = toSVG(result, svgOptions);
    const outputPath = resolve(process.cwd(), options.output);

    writeFileSync(outputPath, svg, 'utf-8');
    console.log(`\nSaved to: ${outputPath}`);
  });

program
  .command('image')
  .description('Render an image as pen-and-ink style hatching for plotting')
  .requiredOption('-i, --input <file>', 'Input image (PNG or JPEG)')
  .option('-w, --width <number>', 'Output width in pixels', '800')
  .option('-h, --height <number>', 'Output height in pixels (default: match image aspect)')
  .option(
    '--paper <size>',
    'Plot to a physical sheet (a6,a5,a4,a3,letter,legal,tabloid); overrides --width/--height and exports the SVG in mm'
  )
  .option('--orientation <o>', 'Paper orientation: portrait or landscape', 'portrait')
  .option('--fit <mode>', 'How the photo sits on the sheet: fit (letterbox) or fill (crop)', 'fit')
  .option('--margin-mm <number>', 'Clear paper border in mm (with --paper)', '10')
  .option('--pen-width-mm <number>', 'Plotted pen width in mm (with --paper)', '0.3')
  .option('--resolution <number>', 'Render density in px per mm (with --paper)', '3')
  .option('-s, --seed <number>', 'Random seed for reproducibility')
  .option('-m, --margin <number>', 'Margin from canvas edges', '20')
  .option('--layers <number>', 'Hatching layers; shadows get cross-hatched (1-5)', '3')
  .option('--min-spacing <number>', 'Stroke spacing in darkest areas (px)', '2.5')
  .option('--max-spacing <number>', 'Stroke spacing in lightest hatched areas (px)', '14')
  .option('--white-cutoff <number>', 'Darkness below which paper stays blank (0-1)', '0.08')
  .option('--tone-gamma <number>', 'Tone response curve; >1 favors shadows', '1')
  .option(
    '--value-bands <number>',
    'Posterize tone into k value bands (artist value plan); 0 = off',
    '0'
  )
  .option(
    '--massing <number>',
    'Composition-aware value massing: redistribute tone by role (0-1, needs value bands)',
    '0'
  )
  .option(
    '--hatch-patchiness <number>',
    'Build cross-hatch layers in patches with gaps (0-1)',
    '0.35'
  )
  .option('--hatch-angle <number>', 'Fallback hatch angle in degrees', '-45')
  .option('--no-follow-tone', 'Hatch at fixed angles instead of following contours')
  .option('--field-smoothing <number>', 'Direction field smoothing', '4')
  .option('--no-contrast', 'Skip automatic contrast stretching')
  .option('--no-outlines', 'Skip the edge outline pass')
  .option('--outline-threshold <number>', 'Edge strength needed for outlines (0-1)', '0.35')
  .option(
    '--contour-halo <number>',
    'Reserved white sliver around long contours, px (0 = off)',
    '2.2'
  )
  .option('--wobble <number>', 'Hand-drawn wobble amplitude in px (0 = ruler-straight)', '0.8')
  .option('--texture <number>', 'Render fur/foliage as short tick strokes (0-1)', '0.6')
  .option('--texture-style <style>', 'Mark style for textured regions: ticks|stipple|scribble', 'ticks')
  .option('--sky-stipple', 'Stipple smooth light regions (open skies) instead of hatching (auto with --label-image)')
  .option('--no-sky-stipple', 'Never stipple the sky, even when labels report one')
  .option('--calm-water', 'Render smooth water regions as long broken horizontal strokes (auto with --label-image)')
  .option('--no-calm-water', 'Never use the calm-water treatment, even when labels report water')
  .option('--no-rich-blacks', 'Keep deep shadows at regular hatch density instead of saturating')
  .option(
    '--counterchange <number>',
    'Darken tone where a dark mass borders a lighter one (0-1)',
    '0.5'
  )
  .option('--cross-contour', 'Hatch across forms (etching style) instead of along them')
  .option('--facet-hatch', 'Hatch toned masses as straight-stroke facets with per-patch angles')
  .option('--max-stroke <number>', 'Cap hatch stroke length in px (0 = unlimited)', '0')
  .option('--outline-passes <number>', 'Single-pen passes used to build bold outlines (1-4)', '2')
  .option('--no-optimize', 'Skip stroke chaining and pen-travel ordering')
  .option(
    '--density-max-passes <number>',
    'Pen-plotting density protection: trim runs where lines coalesce and re-ink the same path once a patch has taken this many passes; crossings kept (omit = off, 1 = ink each path once)'
  )
  .option(
    '--density-min-overlap <px>',
    'Min length (px) a shared run must reach before it is trimmed by --density-max-passes; lower trims short converging runs near singularities (default 8× pen width)'
  )
  .option('--auto-style', 'Per-region mark-making: cross-contour marks wrap curved forms (needs --depth-image)')
  .option('--detail <number>', 'Emphasize detailed regions; flat areas fade (0-1)', '0.3')
  .option(
    '--focus <x,y>',
    'Focal point in output coordinates; detail falls off around it (repeatable for multiple subjects)',
    (value: string, previous: string[]) => previous.concat([value]),
    [] as string[]
  )
  .option('--focus-radius <number>', 'Radius of full detail around the focal point (px; default 25% of output)')
  .option('--focus-strength <number>', 'How strongly detail fades outside the focus (0-1)', '0.85')
  .option('--mask <file>', 'Subject mask image (bright = subject), e.g. from an ML segmenter')
  .option('--mask-strength <number>', 'How strongly the mask suppresses the background (0-1)', '1')
  .option('--depth-image <file>', 'Depth map image (bright = near), e.g. from Depth Anything')
  .option(
    '--normal-image <file>',
    'Normal/flow map: R/G channels = X/Y stroke direction (128 = neutral), e.g. from DSINE'
  )
  .option(
    '--label-image <file>',
    'Semantic label raster: red channel = taxonomy id (0 unknown, 1 sky, 2 water, 3 foliage, 4 ground, 5 building, 6 person, 7 object), e.g. from scripts/segment-labels.mjs'
  )
  .option('--form-strength <number>', 'How strongly depth steers stroke orientation (0-1)', '0.8')
  .option('--depth-isolation <number>', 'Fade far regions toward paper based on depth (0-1)', '0.5')
  .option('--working-size <number>', 'Internal analysis resolution', '720')
  .option('--stroke-color <color>', 'SVG stroke color', '#000000')
  .option('--stroke-width <number>', 'SVG stroke width', '1')
  .option('--background', 'Include background rectangle')
  .option('--background-color <color>', 'Background color', '#ffffff')
  .option('-o, --output <file>', 'Output file path', 'pen-ink.svg')
  .action((options) => {
    const inputPath = resolve(process.cwd(), options.input);

    console.log(`Loading image: ${inputPath}`);
    const image = loadImage(inputPath);
    console.log(`  Image size: ${image.width}x${image.height}`);

    // A physical sheet (--paper) frames the drawing onto a page sized in mm:
    // the drawing fills its content rect, the SVG exports at true millimetre
    // dimensions, and stroke spacing scales so density tracks the sheet size.
    // Without --paper the original pixel behaviour is unchanged.
    let outputWidth: number;
    let outputHeight: number;
    let paperFraming: Pick<PenInkOptions, 'scale' | 'page'> = {};
    let paperSvg: Pick<SVGOptions, 'physicalWidth' | 'physicalHeight'> = {};
    let paperStrokeWidth: number | undefined;

    if (options.paper) {
      const page = pageMetrics(
        getPaperSize(String(options.paper).toLowerCase()),
        options.orientation as Orientation,
        parseFloat(options.resolution)
      );
      const marginPx = parseFloat(options.marginMm) * page.pxPerMm;
      const rect = contentRect(
        page.widthPx,
        page.heightPx,
        marginPx,
        image.width / image.height,
        options.fit as PaperFit
      );
      outputWidth = Math.max(1, Math.round(rect.width));
      outputHeight = Math.max(1, Math.round(rect.height));
      paperFraming = {
        scale: page.scale,
        page: { width: page.widthPx, height: page.heightPx, offsetX: rect.x, offsetY: rect.y },
      };
      paperSvg = { physicalWidth: `${page.widthMm}mm`, physicalHeight: `${page.heightMm}mm` };
      paperStrokeWidth = parseFloat(options.penWidthMm) * page.pxPerMm;
    } else {
      outputWidth = parseInt(options.width, 10);
      outputHeight = options.height
        ? parseInt(options.height, 10)
        : Math.max(1, Math.round((outputWidth * image.height) / image.width));
    }

    const focus: PenInkOptions['focus'] = (options.focus as string[]).map((spec) => {
      const [fx, fy] = spec.split(',').map((v: string) => parseFloat(v));
      if (!Number.isFinite(fx) || !Number.isFinite(fy)) {
        throw new Error(`Invalid --focus "${spec}", expected "x,y"`);
      }
      return {
        x: fx,
        y: fy,
        radius: options.focusRadius
          ? parseFloat(options.focusRadius)
          : Math.min(outputWidth, outputHeight) * 0.25,
        strength: parseFloat(options.focusStrength),
      };
    });

    const penInkOptions: PenInkOptions = {
      width: outputWidth,
      height: options.paper ? outputHeight : options.height ? parseInt(options.height, 10) : undefined,
      ...paperFraming,
      detailEmphasis: parseFloat(options.detail),
      focus,
      subjectMask: options.mask ? loadImage(resolve(process.cwd(), options.mask)) : undefined,
      maskStrength: parseFloat(options.maskStrength),
      depthMap: options.depthImage
        ? loadImage(resolve(process.cwd(), options.depthImage))
        : undefined,
      formStrength: parseFloat(options.formStrength),
      flowMap: options.normalImage
        ? loadDirectionMap(resolve(process.cwd(), options.normalImage))
        : undefined,
      labelMap: options.labelImage
        ? loadLabelImage(resolve(process.cwd(), options.labelImage))
        : undefined,
      depthIsolation: parseFloat(options.depthIsolation),
      outlinePasses: parseInt(options.outlinePasses, 10),
      optimize: options.optimize,
      autoStyle: options.autoStyle ?? false,
      seed: options.seed ? parseInt(options.seed, 10) : undefined,
      // With a sheet the page border is the margin; the photo fills its content rect
      margin: options.paper ? 0 : parseInt(options.margin, 10),
      layers: parseInt(options.layers, 10),
      minSpacing: parseFloat(options.minSpacing),
      maxSpacing: parseFloat(options.maxSpacing),
      whiteCutoff: parseFloat(options.whiteCutoff),
      toneGamma: parseFloat(options.toneGamma),
      valueBands: parseInt(options.valueBands, 10),
      massing: parseFloat(options.massing),
      hatchPatchiness: parseFloat(options.hatchPatchiness),
      hatchAngle: parseFloat(options.hatchAngle),
      followTone: options.followTone,
      fieldSmoothing: parseFloat(options.fieldSmoothing),
      normalizeContrast: options.contrast,
      drawOutlines: options.outlines,
      outlineThreshold: parseFloat(options.outlineThreshold),
      contourHalo: parseFloat(options.contourHalo),
      wobble: parseFloat(options.wobble),
      textureStrokes: parseFloat(options.texture),
      textureStyle: options.textureStyle as 'ticks' | 'stipple' | 'scribble',
      // Left undefined (neither --x nor --no-x), these auto-enable when
      // the label map reports the material
      skyStipple: options.skyStipple,
      calmWater: options.calmWater,
      richBlacks: options.richBlacks,
      counterchange: parseFloat(options.counterchange),
      crossContour: options.crossContour ?? false,
      facetHatch: options.facetHatch ?? false,
      maxStrokeLength: parseFloat(options.maxStroke),
      workingSize: parseInt(options.workingSize, 10),
    };

    const svgOptions: SVGOptions = {
      strokeColor: options.strokeColor,
      strokeWidth: paperStrokeWidth ?? parseFloat(options.strokeWidth),
      includeBackground: options.background ?? false,
      backgroundColor: options.backgroundColor,
      ...paperSvg,
    };

    console.log('Rendering pen-and-ink strokes...');
    let result = imageToPenInk(image, penInkOptions);

    console.log(`  Output size: ${result.width}x${result.height}`);
    console.log(`  Seed: ${result.seed}`);
    console.log(`  Generated ${result.lines.length} strokes`);

    if (options.densityMaxPasses !== undefined) {
      const maxPasses = parseInt(options.densityMaxPasses, 10);
      const cellPx = svgOptions.strokeWidth ?? 1;
      const minOverlapPx =
        options.densityMinOverlap !== undefined
          ? parseFloat(options.densityMinOverlap)
          : undefined;
      // Bold outlines are deliberate multi-pass emphasis, not pile-up — exempt.
      const protect = limitStrokeDensity(result, {
        maxPasses,
        cellPx,
        minOverlapPx,
        skipLayers: ['bold'],
      });
      result = protect.result;
      console.log(
        `  Density protection (max ${maxPasses} passes): trimmed ${protect.removed.length} coalesced runs`
      );
    }

    const svg = toSVG(result, svgOptions);
    const outputPath = resolve(process.cwd(), options.output);

    writeFileSync(outputPath, svg, 'utf-8');
    console.log(`\nSaved to: ${outputPath}`);
  });

program
  .command('conway')
  .description(
    "Render a 'long exposure' of Conway's Game of Life from an R-pentomino: " +
      'the final config sits solid and crisp while its history fades into comet trails'
  )
  .option('-w, --width <number>', 'Canvas width in pixels (ignored with --paper)', '800')
  .option('-h, --height <number>', 'Canvas height in pixels (ignored with --paper)', '800')
  .option(
    '--paper <size>',
    'Plot to a physical sheet (a6,a5,a4,a3,letter,legal,tabloid); overrides --width/--height and exports the SVG in mm'
  )
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
    let width: number;
    let height: number;
    let marginPx: number;
    let paperSvg: Pick<SVGOptions, 'physicalWidth' | 'physicalHeight'> = {};
    let paperStrokeWidth: number | undefined;

    if (options.paper) {
      const page = pageMetrics(
        getPaperSize(String(options.paper).toLowerCase()),
        options.orientation as Orientation,
        parseFloat(options.resolution)
      );
      width = page.widthPx;
      height = page.heightPx;
      marginPx = parseFloat(options.marginMm) * page.pxPerMm;
      paperSvg = { physicalWidth: `${page.widthMm}mm`, physicalHeight: `${page.heightMm}mm` };
      paperStrokeWidth = parseFloat(options.penWidthMm) * page.pxPerMm;
    } else {
      width = parseInt(options.width, 10);
      height = parseInt(options.height, 10);
      marginPx = parseInt(options.margin, 10);
    }

    const conwayOptions: ConwayExposureOptions = {
      width,
      height,
      margin: marginPx,
      seed: options.seed ? parseInt(options.seed, 10) : undefined,
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

    const result = generateConwayExposure(conwayOptions);

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

// A few curated multi-pen palettes, duplicated here rather than imported from
// the web app (the CLI must not depend on packages/web — the same convention
// scripts/gallery.mjs follows by mirroring the web style presets as flags).
const VINE_PALETTES: Record<string, Record<string, string>> = {
  ink: { stem: '#2a2a26', tendril: '#2a2a26', leaf: '#2a2a26', vein: '#2a2a26', flower: '#2a2a26', shadow: '#2a2a26' },
  botanical: { stem: '#5b4636', tendril: '#5b4636', leaf: '#3f6b3a', vein: '#34602f', flower: '#9c2b52', shadow: '#8a7a60' },
  rose: { stem: '#4a5d3a', tendril: '#4a5d3a', leaf: '#3f6b3a', vein: '#34602f', flower: '#c0306a', shadow: '#9aa07e' },
  autumn: { stem: '#6e4326', tendril: '#6e4326', leaf: '#a8662a', vein: '#7d4a1f', flower: '#b23b2e', shadow: '#9b7b53' },
};

/**
 * Flatten the `d` attributes of every <path> (and <polyline>) in an SVG file
 * into polylines, then fit them into the page's margin box. Supports the common
 * absolute/relative commands (M L H V C S Q T Z); curves are subdivided. This
 * lets `flow-lines vines --composition guide --guide-svg shape.svg` grow vines
 * along any traced outline or letterform.
 */
function loadGuidePathsFromSvg(file: string, width: number, height: number, margin: number): Point[][] {
  const text = readFileSync(file, 'utf8');
  const polys: Point[][] = [];

  const flattenCubic = (p0: Point, p1: Point, p2: Point, p3: Point, out: Point[]) => {
    const N = 16;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const u = 1 - t;
      out.push({
        x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      });
    }
  };
  const flattenQuad = (p0: Point, p1: Point, p2: Point, out: Point[]) => {
    const N = 12;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const u = 1 - t;
      out.push({ x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y });
    }
  };

  for (const m of text.matchAll(/<path[^>]*\sd="([^"]+)"/g)) {
    const d = m[1];
    const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
    let i = 0;
    const num = () => parseFloat(tokens[i++]);
    let cur: Point = { x: 0, y: 0 };
    let start: Point = { x: 0, y: 0 };
    let prevCtrl: Point | null = null;
    let cmd = '';
    let poly: Point[] = [];
    const flush = () => { if (poly.length >= 2) polys.push(poly); poly = []; };
    while (i < tokens.length) {
      const t = tokens[i];
      if (/[a-zA-Z]/.test(t)) { cmd = t; i++; }
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      if (C === 'M') {
        const x = num(); const y = num();
        cur = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        flush();
        poly = [{ ...cur }];
        start = { ...cur };
        cmd = rel ? 'l' : 'L';
        prevCtrl = null;
      } else if (C === 'L') {
        const x = num(); const y = num();
        cur = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        poly.push({ ...cur });
        prevCtrl = null;
      } else if (C === 'H') {
        const x = num();
        cur = { x: rel ? cur.x + x : x, y: cur.y };
        poly.push({ ...cur });
        prevCtrl = null;
      } else if (C === 'V') {
        const y = num();
        cur = { x: cur.x, y: rel ? cur.y + y : y };
        poly.push({ ...cur });
        prevCtrl = null;
      } else if (C === 'C' || C === 'S') {
        let c1: Point;
        if (C === 'S') {
          c1 = prevCtrl ? { x: 2 * cur.x - prevCtrl.x, y: 2 * cur.y - prevCtrl.y } : { ...cur };
        } else {
          const x1 = num(); const y1 = num();
          c1 = rel ? { x: cur.x + x1, y: cur.y + y1 } : { x: x1, y: y1 };
        }
        const x2 = num(); const y2 = num(); const x = num(); const y = num();
        const c2 = rel ? { x: cur.x + x2, y: cur.y + y2 } : { x: x2, y: y2 };
        const end = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        flattenCubic(cur, c1, c2, end, poly);
        prevCtrl = c2;
        cur = end;
      } else if (C === 'Q' || C === 'T') {
        let c1: Point;
        if (C === 'T') {
          c1 = prevCtrl ? { x: 2 * cur.x - prevCtrl.x, y: 2 * cur.y - prevCtrl.y } : { ...cur };
        } else {
          const x1 = num(); const y1 = num();
          c1 = rel ? { x: cur.x + x1, y: cur.y + y1 } : { x: x1, y: y1 };
        }
        const x = num(); const y = num();
        const end = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        flattenQuad(cur, c1, end, poly);
        prevCtrl = c1;
        cur = end;
      } else if (C === 'Z') {
        poly.push({ ...start });
        flush();
        cur = { ...start };
        prevCtrl = null;
      } else {
        i++; // unknown token, skip
      }
    }
    flush();
  }

  for (const m of text.matchAll(/<(?:polyline|polygon)[^>]*\spoints="([^"]+)"/g)) {
    const nums = (m[1].match(/-?\d*\.?\d+/g) ?? []).map(Number);
    const poly: Point[] = [];
    for (let k = 0; k + 1 < nums.length; k += 2) poly.push({ x: nums[k], y: nums[k + 1] });
    if (poly.length >= 2) polys.push(poly);
  }

  if (polys.length === 0) return [];
  // Fit every path together into the margin box, preserving aspect ratio.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of polys) for (const p of poly) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const bw = Math.max(1e-6, maxX - minX);
  const bh = Math.max(1e-6, maxY - minY);
  const availW = width - 2 * margin;
  const availH = height - 2 * margin;
  const scale = Math.min(availW / bw, availH / bh);
  const offX = margin + (availW - bw * scale) / 2;
  const offY = margin + (availH - bh * scale) / 2;
  return polys.map((poly) => poly.map((p) => ({ x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale })));
}

program
  .command('vines')
  .description('Grow procedural, plottable botanical-illustration vines')
  .option('-w, --width <number>', 'Canvas width in pixels (ignored with --paper)', '800')
  .option('-h, --height <number>', 'Canvas height in pixels (ignored with --paper)', '1000')
  .option(
    '--paper <size>',
    'Plot to a physical sheet (a6,a5,a4,a3,letter,legal,tabloid); overrides --width/--height and exports the SVG in mm'
  )
  .option('--orientation <o>', 'Paper orientation: portrait or landscape', 'portrait')
  .option('--margin-mm <number>', 'Clear paper border in mm (with --paper)', '12')
  .option('--pen-width-mm <number>', 'Plotted pen width in mm (with --paper)', '0.3')
  .option('--resolution <number>', 'Render density in px per mm (with --paper)', '3')
  .option('-m, --margin <number>', 'Margin from canvas edges in px (without --paper)', '24')
  .option('-s, --seed <number>', 'Random seed for reproducibility')
  // composition & seeding
  .option('--composition <c>', 'specimen | free | wreath | border | bouquet | trellis | fill | guide', 'specimen')
  .option('--guide-svg <file>', 'SVG file whose path outlines the vines grow along (with --composition guide)')
  .option('--support <s>', 'Trellis support the climbers wrap: none | lattice | arch | obelisk', 'none')
  .option('--fill-shape <s>', 'circle | oval | heart | diamond | painted (with --composition fill)', 'heart')
  .option('--mode <m>', 'Growth model: growth | colonization', 'growth')
  .option('--seeding <s>', 'Root placement: scatter | edges | point | painted', 'scatter')
  .option('--seed-count <number>', 'Number of roots', '6')
  // page composition
  .option('--vessel <v>', 'A drawn container the stems rise from: none | vase | urn | amphora | bud-vase | pot | jar | mason-jar | bowl', 'none')
  .option('--ground-line', 'Draw a hand-drawn ground line under the arrangement')
  .option('--negative-space <number>', 'Deliberate notan: hold one region clear, swell the mass (0-1)', '0')
  .option('--tonal-massing <number>', 'Light-driven value massing: foliage gathers/hatches on the shadow side, opens the lit side (0-1)', '0')
  .option('--value-bands <number>', 'Posterize the tonal massing into N value masses (>=2; 0 = smooth)', '0')
  // growth model
  .option('--curl <number>', 'Meandering of the curl field (0-1.5)', '0.5')
  .option('--gravitropism <number>', 'Upward growth bias (0-1)', '0.4')
  .option('--branch-prob <number>', 'Side-branch probability per step (0-0.2)', '0.05')
  .option('--max-depth <number>', 'Branching recursion depth', '5')
  .option('--max-length <number>', 'Max vine length in px', '320')
  .option('--step-length <number>', 'Growth step length in px', '6')
  // colonization
  .option('--attractor-count <number>', 'Space-colonization attractor points', '600')
  .option('--attractor-radius <number>', 'Attractor reach in px', '90')
  .option('--kill-radius <number>', 'Attractor consume distance in px', '16')
  // vine body & shading
  .option('--stem-width <number>', 'Base stem width in px', '8')
  .option('--taper <number>', 'Tapering toward the tip (0-1)', '0.85')
  .option('--vine-fill <f>', 'Stem rendering: shaded | solid | outline | highlight', 'shaded')
  .option('--light-angle <number>', 'Light source direction in degrees (0 = +x)', '-130')
  .option('--shade-density <number>', 'Shadow hatching intensity (0-1)', '0.55')
  .option('--stem-shade <s>', 'Thick-stem tube shading: none | along | cross', 'along')
  .option('--stem-texture <t>', 'Woody-stem surface texture: none | bark', 'none')
  .option('--no-occlude', 'Skip hidden-line removal (flat overlap)')
  .option('--cast-shadow <number>', 'Contact-shadow strength (0-1)', '0.35')
  .option('--sketch <number>', 'Hand-drawn overdraw intensity (0-1)', '0')
  .option('--sketch-style <s>', 'Overdraw character: loose | fine | gestural | scratchy', 'loose')
  .option('--wobble <number>', 'Centerline wobble amplitude in px', '0.6')
  // decorations
  .option('--density <number>', 'Overall foliage density (0-1)', '0.45')
  .option('--no-leaves', 'Omit leaves')
  .option('--leaf-style <s>', 'shaded | veined | outline | solid', 'shaded')
  .option('--leaf-type <t>', 'ovate | lance | cordate | lobed | serrate | mixed', 'ovate')
  .option('--no-veins', 'Omit leaf veins')
  .option('--leaf-size <number>', 'Leaf length in px', '26')
  .option('--leaf-spacing <number>', 'Arc-length leaf spacing in px', '30')
  .option('--leaf-arrangement <a>', 'simple | pinnate | bipinnate | palmate | trifoliate', 'simple')
  .option('--leaflet-count <number>', 'Leaflets per compound leaf', '5')
  .option('--phyllotaxis <p>', 'alternate | opposite | whorled | spiral', 'alternate')
  .option('--whorl-count <number>', 'Leaves per node (whorled phyllotaxis)', '3')
  .option('--no-tendrils', 'Omit tendrils')
  .option('--tendril-prob <number>', 'Tendril probability per site (0-1)', '0.12')
  .option('--no-flowers', 'Omit flowers')
  .option('--flower-type <t>', 'rose | daisy | bell | bud | mixed', 'rose')
  .option('--flower-prob <number>', 'Flower probability at stem tips (0-1)', '0.2')
  .option('--flower-size <number>', 'Bloom size in px', '18')
  .option('--inflorescence <i>', 'none | raceme | umbel | spike | corymb', 'none')
  .option('--floret-count <number>', 'Florets per inflorescence', '8')
  .option('--thorns', 'Bear thorns along the stems')
  .option('--thorn-prob <number>', 'Thorn density along stems (0-1)', '0.15')
  .option('--fruit-type <f>', 'none | berry | grape | rosehip | pod | catkin', 'none')
  .option('--fruit-prob <number>', 'Fruit-cluster probability per site (0-1)', '0.2')
  .option('--dewdrops', 'Scatter dewdrop highlights on the foliage')
  .option('--dewdrop-prob <number>', 'Dewdrop probability per site (0-1)', '0.15')
  // ink
  .option('--palette <p>', 'Multi-pen palette: ink | botanical | rose | autumn', 'ink')
  .option('--stroke-width <number>', 'SVG stroke width (without --paper)', '1')
  .option('--background', 'Include background rectangle')
  .option('--background-color <color>', 'Background color', '#ffffff')
  .option('--no-optimize', 'Skip stroke chaining and pen-travel ordering')
  .option('-o, --output <file>', 'Output file path', 'vines.svg')
  .action((options) => {
    let width: number;
    let height: number;
    let marginPx: number;
    let paperSvg: Pick<SVGOptions, 'physicalWidth' | 'physicalHeight'> = {};
    let paperStrokeWidth: number | undefined;

    if (options.paper) {
      const page = pageMetrics(
        getPaperSize(String(options.paper).toLowerCase()),
        options.orientation as Orientation,
        parseFloat(options.resolution)
      );
      width = page.widthPx;
      height = page.heightPx;
      marginPx = parseFloat(options.marginMm) * page.pxPerMm;
      paperSvg = { physicalWidth: `${page.widthMm}mm`, physicalHeight: `${page.heightMm}mm` };
      paperStrokeWidth = parseFloat(options.penWidthMm) * page.pxPerMm;
    } else {
      width = parseInt(options.width, 10);
      height = parseInt(options.height, 10);
      marginPx = parseInt(options.margin, 10);
    }

    const vineOptions: VinesOptions = {
      width,
      height,
      margin: marginPx,
      seed: options.seed ? parseInt(options.seed, 10) : undefined,
      composition: options.composition as VineComposition,
      fillShape: options.fillShape as FillShape,
      support: options.support as VineSupport,
      guidePaths: options.guideSvg ? loadGuidePathsFromSvg(options.guideSvg, width, height, marginPx) : undefined,
      mode: options.mode as VineMode,
      seeding: options.seeding as VineSeeding,
      seedCount: parseInt(options.seedCount, 10),
      vessel: options.vessel as VinesOptions['vessel'],
      groundLine: options.groundLine ?? false,
      negativeSpace: parseFloat(options.negativeSpace),
      tonalMassing: parseFloat(options.tonalMassing),
      valueBands: parseInt(options.valueBands, 10),
      curl: parseFloat(options.curl),
      gravitropism: parseFloat(options.gravitropism),
      branchProb: parseFloat(options.branchProb),
      maxDepth: parseInt(options.maxDepth, 10),
      maxLength: parseFloat(options.maxLength),
      stepLength: parseFloat(options.stepLength),
      attractorCount: parseInt(options.attractorCount, 10),
      attractorRadius: parseFloat(options.attractorRadius),
      killRadius: parseFloat(options.killRadius),
      stemWidth: parseFloat(options.stemWidth),
      taper: parseFloat(options.taper),
      vineFill: options.vineFill as VineFill,
      lightAngle: parseFloat(options.lightAngle),
      shadeDensity: parseFloat(options.shadeDensity),
      stemShade: options.stemShade as StemShade,
      stemTexture: options.stemTexture as StemTexture,
      occlude: options.occlude,
      castShadow: parseFloat(options.castShadow),
      sketch: parseFloat(options.sketch),
      sketchStyle: options.sketchStyle,
      wobble: parseFloat(options.wobble),
      density: parseFloat(options.density),
      leaves: options.leaves,
      leafStyle: options.leafStyle as LeafStyle,
      leafType: options.leafType as LeafType,
      veins: options.veins,
      leafSize: parseFloat(options.leafSize),
      leafSpacing: parseFloat(options.leafSpacing),
      leafArrangement: options.leafArrangement as LeafArrangement,
      leafletCount: parseInt(options.leafletCount, 10),
      phyllotaxis: options.phyllotaxis as Phyllotaxis,
      whorlCount: parseInt(options.whorlCount, 10),
      tendrils: options.tendrils,
      tendrilProb: parseFloat(options.tendrilProb),
      flowers: options.flowers,
      flowerType: options.flowerType as VineFlower,
      flowerProb: parseFloat(options.flowerProb),
      flowerSize: parseFloat(options.flowerSize),
      inflorescence: options.inflorescence as Inflorescence,
      floretCount: parseInt(options.floretCount, 10),
      thorns: options.thorns ?? false,
      thornProb: parseFloat(options.thornProb),
      fruitType: options.fruitType as FruitType,
      fruitProb: parseFloat(options.fruitProb),
      dewdrops: options.dewdrops ?? false,
      dewdropProb: parseFloat(options.dewdropProb),
      penWidth: paperStrokeWidth ?? parseFloat(options.strokeWidth),
    };

    console.log('Growing vines...');
    console.log(`  Size: ${width}x${height}, composition: ${vineOptions.composition}, mode: ${vineOptions.mode}`);

    const result = generateVines(vineOptions);

    console.log(`  Seed: ${result.seed}`);
    console.log(`  Generated ${result.lines.length} lines`);

    const palette = VINE_PALETTES[options.palette] ?? VINE_PALETTES.ink;
    const svgOptions: SVGOptions = {
      strokeColor: palette.stem,
      strokeWidth: paperStrokeWidth ?? parseFloat(options.strokeWidth),
      includeBackground: options.background ?? false,
      backgroundColor: options.backgroundColor,
      optimizePaths: options.optimize,
      layerColors: palette,
      ...paperSvg,
    };

    const svg = toSVG(result, svgOptions);
    const outputPath = resolve(process.cwd(), options.output);
    writeFileSync(outputPath, svg, 'utf-8');
    console.log(`\nSaved to: ${outputPath}`);
  });

// Multi-pen ink palettes for the planet command (subset of the web app's).
const PLANET_PALETTES: Record<string, Record<string, string>> = {
  ink: { limb: '#2a2a26', hatch: '#2a2a26', feature: '#2a2a26', stipple: '#2a2a26', ring: '#2a2a26', star: '#2a2a26', atmosphere: '#2a2a26', graticule: '#2a2a26', annotation: '#2a2a26', label: '#2a2a26', orbit: '#2a2a26', relief: '#2a2a26', cloud: '#2a2a26' },
  astronomical: { limb: '#3a2f25', hatch: '#3b3a36', feature: '#4a3320', stipple: '#3b3a36', ring: '#5b4636', star: '#2b3a55', atmosphere: '#566b86', graticule: '#6b5e7a', annotation: '#4a3320', label: '#3a2f25', orbit: '#6b5e7a', relief: '#4a3320', cloud: '#6b5e7a' },
  saturn: { limb: '#4a3a23', hatch: '#5a4a32', feature: '#6e5326', stipple: '#5a4a32', ring: '#8a6a36', star: '#6b5a44', atmosphere: '#b89a5a', graticule: '#8a7a52', annotation: '#6e5326', label: '#4a3a23', orbit: '#8a7a52', relief: '#6e5326', cloud: '#8a7a52' },
  lunar: { limb: '#2c2c2c', hatch: '#3c3c3c', feature: '#222222', stipple: '#3c3c3c', ring: '#3c3c3c', star: '#4a4a4a', atmosphere: '#6a6a6a', graticule: '#5a5a5a', annotation: '#222222', label: '#2c2c2c', orbit: '#5a5a5a', relief: '#222222', cloud: '#5a5a5a' },
  mars: { limb: '#6e2f1f', hatch: '#8a3b2e', feature: '#5a2418', stipple: '#8a3b2e', ring: '#8a3b2e', star: '#7a5a4a', atmosphere: '#b5715a', graticule: '#a86a55', annotation: '#5a2418', label: '#6e2f1f', orbit: '#a86a55', relief: '#5a2418', cloud: '#a86a55' },
  cyanotype: { limb: '#13385e', hatch: '#1f4d78', feature: '#0e2a47', stipple: '#1f4d78', ring: '#1f4d78', star: '#3a6fa0', atmosphere: '#5a8fc0', graticule: '#3a6fa0', annotation: '#0e2a47', label: '#13385e', orbit: '#3a6fa0', relief: '#0e2a47', cloud: '#3a6fa0' },
};

program
  .command('planet')
  .description('Generate procedural, plottable pen-and-ink planets')
  .option('-w, --width <number>', 'Canvas width in pixels (ignored with --paper)', '800')
  .option('-h, --height <number>', 'Canvas height in pixels (ignored with --paper)', '800')
  .option('--paper <size>', 'Plot to a physical sheet (a6,a5,a4,a3,letter,legal,tabloid); exports the SVG in mm')
  .option('--orientation <o>', 'Paper orientation: portrait or landscape', 'portrait')
  .option('--margin-mm <number>', 'Clear paper border in mm (with --paper)', '12')
  .option('--pen-width-mm <number>', 'Plotted pen width in mm (with --paper)', '0.3')
  .option('--resolution <number>', 'Render density in px per mm (with --paper)', '3')
  .option('-m, --margin <number>', 'Margin from canvas edges in px (without --paper)', '24')
  .option('-s, --seed <number>', 'Random seed for reproducibility')
  .option('--type <t>', 'terrestrial | gas-giant | ringed | moon | ice | lava | star | barren', 'terrestrial')
  .option('--radius-frac <number>', 'Disk radius as a fraction of the usable half-frame', '0.7')
  // light
  .option('--light-angle <number>', 'Light azimuth in degrees', '-35')
  .option('--light-elevation <number>', 'Light elevation: 0 grazing (crescent) .. 90 full face', '32')
  .option('--ambient <number>', 'Shadow-side fill light (0-1)', '0.12')
  .option('--limb-darkening <number>', 'Darkening toward the disk edge (0-1)', '0')
  // surface
  .option('--noise-scale <number>', 'Surface noise frequency', '1.7')
  .option('--octaves <number>', 'Surface noise octaves', '5')
  .option('--contrast <number>', 'Sharpen coastlines / cracks', '1.4')
  .option('--sea-level <number>', 'Terrestrial land/sea threshold (-1..1)', '0')
  .option('--mare-level <number>', 'Lunar dark-plain threshold (-1..1)', '-0.12')
  .option('--no-coastlines', 'Skip traced feature outlines')
  .option('--lava-fissure-width <number>', 'Width of glowing lava cracks (0-1)', '0.12')
  .option('--lava-glow <number>', 'Ember-stipple density on lava fissures (0-1)', '0.4')
  // gas
  .option('--bands', 'Banded zones (gas giants)')
  .option('--band-count <number>', 'Number of banded zones', '9')
  .option('--band-turbulence <number>', 'Band wobble (0-1.2)', '0.5')
  .option('--storms <number>', 'Oval storm spots', '0')
  .option('--storm-size <number>', 'Storm oval scale', '1')
  // ice
  .option('--ice-caps', 'Draw polar ice caps')
  .option('--cap-latitude <number>', 'Latitude where caps begin (deg)', '68')
  // marks
  .option('--hatch-spacing <number>', 'Form-hatch spacing in px', '6')
  .option('--cross-hatch-layers <number>', 'Cross-hatch layers (1-5)', '3')
  .option('--stipple <number>', 'Shadow/texture stipple (0-1)', '0')
  .option('--atmosphere <number>', 'Glow rings (corona for stars)', '0')
  // relief
  .option('--terminator-emphasis <number>', 'Extra hatch hugging the terminator (0-1)', '0')
  .option('--mountains', 'Chevron hachures on high terrestrial land')
  .option('--clouds', 'Trace soft cloud shapes (terrestrial)')
  .option('--crater-detail', 'Central peaks + ejecta rays on big craters')
  // rings
  .option('--rings', 'Draw a tilted ring system')
  .option('--ring-inner <number>', 'Inner ring radius in disk radii', '1.35')
  .option('--ring-outer <number>', 'Outer ring radius in disk radii', '2.2')
  .option('--ring-tilt <number>', 'Ring tilt in degrees', '22')
  .option('--ring-yaw <number>', 'Ring yaw in degrees', '12')
  .option('--ring-gap <number>', 'Cassini gap fraction (0-1)', '0.14')
  .option('--ring-count <number>', 'Concentric ring bands', '6')
  .option('--ring-density <number>', 'Strokes per ring band', '3')
  .option('--no-ring-shadow', 'Do not cut the planet shadow into the rings')
  // craters
  .option('--craters', 'Scatter craters')
  .option('--crater-count <number>', 'Number of craters', '80')
  .option('--crater-min-r <number>', 'Min crater radius (fraction of disk)', '0.02')
  .option('--crater-max-r <number>', 'Max crater radius (fraction of disk)', '0.14')
  // engraved plate
  .option('--graticule', 'Draw lat/long lines on the globe')
  .option('--graticule-spacing <number>', 'Degrees between graticule lines', '30')
  .option('--plate-frame', 'Graduated neatline just inside the margin')
  .option('--scale-bar', 'Divided scale bar along the bottom')
  .option('--title <text>', 'Engraved plate title')
  .option('--caption <text>', 'Engraved plate caption')
  // composition
  .option('--layout <l>', 'single | phases | comparison | orbital', 'single')
  .option('--layout-count <number>', 'Bodies in a multi-body plate', '5')
  // scene
  .option('--starfield', 'Scatter a background starfield')
  .option('--star-count <number>', 'Number of stars', '120')
  .option('--moon', 'Draw a companion moon')
  .option('--moon-dist <number>', 'Moon distance in disk radii', '1.9')
  .option('--moon-angle <number>', 'Moon angle in degrees', '-35')
  .option('--moon-radius-frac <number>', 'Moon radius as fraction of the planet', '0.28')
  // ink
  .option('--palette <p>', 'Multi-pen palette: ink | astronomical | saturn | lunar | mars | cyanotype', 'ink')
  .option('--stroke-width <number>', 'SVG stroke width (without --paper)', '1')
  .option('--wobble <number>', 'Hand-drawn wobble amplitude in px', '0.6')
  .option('--background', 'Include background rectangle')
  .option('--background-color <color>', 'Background color', '#ffffff')
  .option('--no-optimize', 'Skip stroke chaining and pen-travel ordering')
  .option('-o, --output <file>', 'Output file path', 'planet.svg')
  .action((options) => {
    let width: number;
    let height: number;
    let marginPx: number;
    let paperSvg: Pick<SVGOptions, 'physicalWidth' | 'physicalHeight'> = {};
    let paperStrokeWidth: number | undefined;

    if (options.paper) {
      const page = pageMetrics(
        getPaperSize(String(options.paper).toLowerCase()),
        options.orientation as Orientation,
        parseFloat(options.resolution)
      );
      width = page.widthPx;
      height = page.heightPx;
      marginPx = parseFloat(options.marginMm) * page.pxPerMm;
      paperSvg = { physicalWidth: `${page.widthMm}mm`, physicalHeight: `${page.heightMm}mm` };
      paperStrokeWidth = parseFloat(options.penWidthMm) * page.pxPerMm;
    } else {
      width = parseInt(options.width, 10);
      height = parseInt(options.height, 10);
      marginPx = parseInt(options.margin, 10);
    }

    const planetOptions: PlanetOptions = {
      width,
      height,
      margin: marginPx,
      seed: options.seed ? parseInt(options.seed, 10) : undefined,
      radiusFrac: parseFloat(options.radiusFrac),
      planetType: options.type as PlanetType,
      lightAngle: parseFloat(options.lightAngle),
      lightElevation: parseFloat(options.lightElevation),
      ambient: parseFloat(options.ambient),
      limbDarkening: parseFloat(options.limbDarkening),
      noiseScale: parseFloat(options.noiseScale),
      octaves: parseInt(options.octaves, 10),
      contrast: parseFloat(options.contrast),
      seaLevel: parseFloat(options.seaLevel),
      mareLevel: parseFloat(options.mareLevel),
      coastlines: options.coastlines,
      lavaFissureWidth: parseFloat(options.lavaFissureWidth),
      lavaGlow: parseFloat(options.lavaGlow),
      bands: options.bands ?? false,
      bandCount: parseInt(options.bandCount, 10),
      bandTurbulence: parseFloat(options.bandTurbulence),
      storms: parseInt(options.storms, 10),
      stormSize: parseFloat(options.stormSize),
      iceCaps: options.iceCaps ?? false,
      capLatitude: parseFloat(options.capLatitude),
      hatchSpacing: paperStrokeWidth ? (parseFloat(options.hatchSpacing) * paperStrokeWidth) / parseFloat(options.penWidthMm) : parseFloat(options.hatchSpacing),
      crossHatchLayers: parseInt(options.crossHatchLayers, 10),
      stipple: parseFloat(options.stipple),
      atmosphere: parseInt(options.atmosphere, 10),
      terminatorEmphasis: parseFloat(options.terminatorEmphasis),
      mountains: options.mountains ?? false,
      clouds: options.clouds ?? false,
      rings: options.rings ?? false,
      ringInner: parseFloat(options.ringInner),
      ringOuter: parseFloat(options.ringOuter),
      ringTilt: parseFloat(options.ringTilt),
      ringYaw: parseFloat(options.ringYaw),
      ringGap: parseFloat(options.ringGap),
      ringCount: parseInt(options.ringCount, 10),
      ringDensity: parseInt(options.ringDensity, 10),
      ringShadow: options.ringShadow,
      craters: options.craters ?? false,
      craterCount: parseInt(options.craterCount, 10),
      craterMinR: parseFloat(options.craterMinR),
      craterMaxR: parseFloat(options.craterMaxR),
      craterDetail: options.craterDetail ?? false,
      graticule: options.graticule ?? false,
      graticuleSpacingDeg: parseFloat(options.graticuleSpacing),
      plateFrame: options.plateFrame ?? false,
      scaleBar: options.scaleBar ?? false,
      title: options.title,
      caption: options.caption,
      layout: options.layout as PlanetOptions['layout'],
      layoutCount: parseInt(options.layoutCount, 10),
      starfield: options.starfield ?? false,
      starCount: parseInt(options.starCount, 10),
      moon: options.moon ?? false,
      moonDist: parseFloat(options.moonDist),
      moonAngle: parseFloat(options.moonAngle),
      moonRadiusFrac: parseFloat(options.moonRadiusFrac),
      penWidth: paperStrokeWidth ?? parseFloat(options.strokeWidth),
      wobble: parseFloat(options.wobble),
    };

    console.log('Generating planet...');
    console.log(`  Size: ${width}x${height}, type: ${planetOptions.planetType}`);

    const result = generatePlanet(planetOptions);
    console.log(`  Generated ${result.lines.length} lines`);

    const palette = PLANET_PALETTES[options.palette] ?? PLANET_PALETTES.ink;
    const svgOptions: SVGOptions = {
      strokeColor: palette.limb,
      strokeWidth: paperStrokeWidth ?? parseFloat(options.strokeWidth),
      includeBackground: options.background ?? false,
      backgroundColor: options.backgroundColor,
      optimizePaths: options.optimize,
      layerColors: palette,
      ...paperSvg,
    };

    const svg = toSVG({ ...result, seed: planetOptions.seed ?? 0 }, svgOptions);
    const outputPath = resolve(process.cwd(), options.output);
    writeFileSync(outputPath, svg, 'utf-8');
    console.log(`\nSaved to: ${outputPath}`);
  });

program.parse();
