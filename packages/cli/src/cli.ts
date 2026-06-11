#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decode as decodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';
import {
  generateFlowLines,
  generateFlowLinesGrid,
  grayscaleFromRGBA,
  imageToPenInk,
  toSVG,
  type DirectionMap,
  type FlowLinesOptions,
  type GrayscaleImage,
  type PenInkOptions,
  type SVGOptions,
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
  .option('-s, --seed <number>', 'Random seed for reproducibility')
  .option('-m, --margin <number>', 'Margin from canvas edges', '20')
  .option('--layers <number>', 'Hatching layers; shadows get cross-hatched (1-4)', '3')
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
  .option('--sky-stipple', 'Stipple smooth light regions (open skies) instead of hatching')
  .option('--no-rich-blacks', 'Keep deep shadows at regular hatch density instead of saturating')
  .option('--cross-contour', 'Hatch across forms (etching style) instead of along them')
  .option('--facet-hatch', 'Hatch toned masses as straight-stroke facets with per-patch angles')
  .option('--max-stroke <number>', 'Cap hatch stroke length in px (0 = unlimited)', '0')
  .option('--outline-passes <number>', 'Single-pen passes used to build bold outlines (1-4)', '2')
  .option('--no-optimize', 'Skip stroke chaining and pen-travel ordering')
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
  .option('--form-strength <number>', 'How strongly depth steers stroke orientation (0-1)', '0.8')
  .option('--depth-isolation <number>', 'Fade far regions toward paper based on depth (0-1)', '0.5')
  .option('--working-size <number>', 'Internal analysis resolution', '600')
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

    const outputWidth = parseInt(options.width, 10);
    const outputHeight = options.height
      ? parseInt(options.height, 10)
      : Math.max(1, Math.round((outputWidth * image.height) / image.width));

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
      height: options.height ? parseInt(options.height, 10) : undefined,
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
      depthIsolation: parseFloat(options.depthIsolation),
      outlinePasses: parseInt(options.outlinePasses, 10),
      optimize: options.optimize,
      autoStyle: options.autoStyle ?? false,
      seed: options.seed ? parseInt(options.seed, 10) : undefined,
      margin: parseInt(options.margin, 10),
      layers: parseInt(options.layers, 10),
      minSpacing: parseFloat(options.minSpacing),
      maxSpacing: parseFloat(options.maxSpacing),
      whiteCutoff: parseFloat(options.whiteCutoff),
      toneGamma: parseFloat(options.toneGamma),
      valueBands: parseInt(options.valueBands, 10),
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
      skyStipple: options.skyStipple ?? false,
      richBlacks: options.richBlacks,
      crossContour: options.crossContour ?? false,
      facetHatch: options.facetHatch ?? false,
      maxStrokeLength: parseFloat(options.maxStroke),
      workingSize: parseInt(options.workingSize, 10),
    };

    const svgOptions: SVGOptions = {
      strokeColor: options.strokeColor,
      strokeWidth: parseFloat(options.strokeWidth),
      includeBackground: options.background ?? false,
      backgroundColor: options.backgroundColor,
    };

    console.log('Rendering pen-and-ink strokes...');
    const result = imageToPenInk(image, penInkOptions);

    console.log(`  Output size: ${result.width}x${result.height}`);
    console.log(`  Seed: ${result.seed}`);
    console.log(`  Generated ${result.lines.length} strokes`);

    const svg = toSVG(result, svgOptions);
    const outputPath = resolve(process.cwd(), options.output);

    writeFileSync(outputPath, svg, 'utf-8');
    console.log(`\nSaved to: ${outputPath}`);
  });

program.parse();
