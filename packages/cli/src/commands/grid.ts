import type { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateFlowLinesGrid, toSVG, type SVGOptions } from '@flow-lines/core';
import { addSketchOptions, applySketchFromFlags } from '../sketch.js';

export function registerGrid(program: Command) {
  addSketchOptions(program.command('grid'))
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
    .option('--no-optimize', 'Skip pen-travel ordering')
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
        optimize: options.optimize,
      });

      console.log(`  Seed: ${result.seed}`);
      console.log(`  Generated ${result.lines.length} lines`);

      const svg = toSVG(applySketchFromFlags(result, options), svgOptions);
      const outputPath = resolve(process.cwd(), options.output);

      writeFileSync(outputPath, svg, 'utf-8');
      console.log(`\nSaved to: ${outputPath}`);
    });
}
