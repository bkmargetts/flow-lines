import type { Command } from 'commander';
import { generateTangles, type TanglesOptions, type SVGOptions } from '@flow-lines/core';
import { addTileOptions, resolvePageFrame, writePlotOutput, PAPER_SPEC_HELP } from '../page.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';

export function registerTangles(program: Command) {
  addTileOptions(addSketchOptions(program.command('tangles')))
    .description(
      'Render a tangle of corrugated vent hoses or shoelaces worming across ' +
        'the page, weaving over and under with reserved-paper crossings'
    )
    .option('-w, --width <number>', 'Canvas width in pixels (ignored with --paper)', '800')
    .option('-h, --height <number>', 'Canvas height in pixels (ignored with --paper)', '1000')
    .option('--paper <size>', PAPER_SPEC_HELP)
    .option('--orientation <o>', 'Paper orientation: portrait or landscape', 'portrait')
    .option('--margin-mm <number>', 'Clear paper border in mm (with --paper)', '10')
    .option('--pen-width-mm <number>', 'Plotted pen width in mm (with --paper)', '0.3')
    .option('--resolution <number>', 'Render density in px per mm (with --paper)', '3')
    .option('-m, --margin <number>', 'Margin from canvas edges in px (without --paper)', '28')
    .option('-s, --seed <number>', 'Seed: strand layout, weave bias and wobble')
    .option('--material <m>', 'Strand material: hose (corrugated duct) or lace (flat shoelace)', 'hose')
    .option('--count <number>', 'Number of strands', '7')
    .option('--radius-min-mm <number>', 'Thinnest strand radius in mm (px at 3px/mm without --paper)', '3')
    .option('--radius-max-mm <number>', 'Fattest strand radius in mm (px at 3px/mm without --paper)', '8')
    .option('--wander <number>', 'Curvature energy 0-1: drifts at 0, coils at 1', '0.55')
    .option('--cuff-chance <number>', 'Chance 0-1 a strand ends on-page (hose cuff / lace aglet)', '0.25')
    .option('--clearance-mm <number>', 'Extra paper between parallel strands in mm', '1.5')
    .option('--ring-density <number>', 'Corrugation ring pitch 0-1 (pitch scales with radius)', '0.6')
    .option('--ring-curve <number>', 'Ring ellipse bulge 0-1 — the wrap-the-cylinder cue', '0.6')
    .option('--twists <number>', 'Lace twist-flip frequency 0-1 (material lace)', '0.5')
    .option('--shading <number>', 'Shadow-side longitudinal hatch strength 0-1', '0.45')
    .option('--light-angle <degrees>', 'Light direction in degrees', '315')
    .option('--shadow-hatch <number>', 'Contact-shadow strength at under-crossings 0-1', '0.6')
    .option('--weave-bias <number>', 'Fraction 0-1 of crossings where the fatter duct just lies on top', '0.35')
    .option('--gap-mm <number>', 'Reserved paper at crossings in mm', '0.45')
    .option('--wobble <number>', 'Hand-drawn wobble amplitude in px', '0.8')
    .option('--stroke-color <color>', 'SVG stroke color', '#000000')
    .option('--stroke-width <number>', 'SVG stroke width (without --paper)', '1.35')
    .option('--background', 'Include background rectangle')
    .option('--background-color <color>', 'Background color', '#ffffff')
    .option('--no-optimize', 'Skip pen-travel ordering')
    .option('-o, --output <file>', 'Output file path', 'tangles.svg')
    .action((options) => {
      const frame = resolvePageFrame(options);
      const { width, height, marginPx, paperSvg, paperStrokeWidth } = frame;

      // mm flags convert at the sheet's density; pixel-frame renders (no
      // --paper) use the base 3 px/mm so the same flags read sensibly.
      const mm = frame.page ? frame.page.pxPerMm : 3;
      // More strands on big sheets at the same physical diameter — but by
      // the SQUARE ROOT of the area growth: strand length already scales
      // with the sheet diagonal, so area-linear counts over-fill the page
      // and drown the weave in collisions. ×1 at A4 and below.
      const sheetFactor = frame.page
        ? Math.sqrt(Math.max(1, (frame.page.widthMm * frame.page.heightMm) / (210 * 297)))
        : 1;

      const hoseOptions: TanglesOptions = {
        width,
        height,
        margin: marginPx,
        seed: options.seed ? parseInt(options.seed, 10) : undefined,
        material: options.material === 'lace' ? 'lace' : 'hose',
        count: Math.max(1, Math.round(parseInt(options.count, 10) * sheetFactor)),
        radiusMin: parseFloat(options.radiusMinMm) * mm,
        radiusMax: parseFloat(options.radiusMaxMm) * mm,
        wander: parseFloat(options.wander),
        cuffChance: parseFloat(options.cuffChance),
        clearance: parseFloat(options.clearanceMm) * mm,
        ringDensity: parseFloat(options.ringDensity),
        ringCurve: parseFloat(options.ringCurve),
        twists: parseFloat(options.twists),
        shading: parseFloat(options.shading),
        lightAngle: (parseFloat(options.lightAngle) * Math.PI) / 180,
        shadowHatch: parseFloat(options.shadowHatch),
        weaveBias: parseFloat(options.weaveBias),
        gap: parseFloat(options.gapMm) * mm,
        penWidth: paperStrokeWidth ?? parseFloat(options.strokeWidth),
        wobble: parseFloat(options.wobble),
        optimize: options.optimize,
      };

      console.log('Rendering tangles...');
      console.log(`  Size: ${width}x${height}`);
      console.log(`  Strands: ${hoseOptions.count} (${hoseOptions.material})`);

      const result = applySketchFromFlags(
        generateTangles(hoseOptions),
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
