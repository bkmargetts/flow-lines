import type { Command } from 'commander';
import { resolve } from 'node:path';
import {
  imageToPenInk,
  limitStrokeDensity,
  pageMetrics,
  contentRect,
  resolvePaperSize,
  PEN_INK_STYLES,
  type Orientation,
  type PageMetrics,
  type PaperFit,
  type PenInkOptions,
  type SVGOptions,
} from '@flow-lines/core';
import { loadImage, loadDirectionMap, loadLabelImage } from '../io.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';
import { addTileOptions, writePlotOutput, PAPER_SPEC_HELP, type PageFrame } from '../page.js';

export function registerImage(program: Command) {
  addTileOptions(addSketchOptions(program.command('image')))
    .description('Render an image as pen-and-ink style hatching for plotting')
    .requiredOption('-i, --input <file>', 'Input image (PNG or JPEG)')
    .option(
      '--style <id>',
      `Artist style — a whole coherent ink philosophy (${Object.keys(PEN_INK_STYLES).join(', ')}); explicitly passed flags still override the style`
    )
    .option('-w, --width <number>', 'Output width in pixels', '800')
    .option('-h, --height <number>', 'Output height in pixels (default: match image aspect)')
    .option('--paper <size>', PAPER_SPEC_HELP)
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
      '--solid-blacks',
      'Ink the darkest value band as committed solid fill instead of cross-hatch (needs --value-bands >= 2)'
    )
    .option(
      '--fill-spacing <px>',
      'Distance between solid-fill passes in px; slightly under your pen width (default 0.9)'
    )
    .option(
      '--counterchange <number>',
      'Darken tone where a dark mass borders a lighter one (0-1)',
      '0.5'
    )
    .option('--cross-contour', 'Hatch across forms (etching style) instead of along them')
    .option(
      '--line-swell <number>',
      'Swelling line weight: hatch lines thicken through shadow and thin in the light (0-1)',
      '0'
    )
    .option('--facet-hatch', 'Hatch toned masses as straight-stroke facets with per-patch angles')
    .option('--max-stroke <number>', 'Cap hatch stroke length in px (0 = unlimited)', '0')
    .option(
      '--scribble-tone <number>',
      'Continuous ballpoint scribble as the tone engine; replaces hatching (0-1)',
      '0'
    )
    .option(
      '--stroke-budget <number>',
      'Stroke economy: cap total drawn length at this multiple of the canvas diagonal; best strokes survive (0 = off)',
      '0'
    )
    .option(
      '--stroke-weight <number>',
      'Pen passes per surviving long stroke with --stroke-budget: >1 builds fat brush strokes',
      '1'
    )
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
    .action((options, cmd) => {
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
      let pageMetricsForTiling: PageMetrics | undefined;

      if (options.paper) {
        const page = pageMetrics(
          resolvePaperSize(String(options.paper)),
          options.orientation as Orientation,
          parseFloat(options.resolution)
        );
        pageMetricsForTiling = page;
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
        solidBlacks: options.solidBlacks ?? false,
        // With a physical sheet the fill pitch follows the actual pen:
        // slightly tighter than the pen width so passes overlap into solid
        fillSpacing:
          options.fillSpacing !== undefined
            ? parseFloat(options.fillSpacing)
            : paperStrokeWidth !== undefined
              ? paperStrokeWidth * 0.95
              : undefined,
        counterchange: parseFloat(options.counterchange),
        crossContour: options.crossContour ?? false,
        lineSwell: parseFloat(options.lineSwell),
        scribbleTone: parseFloat(options.scribbleTone),
        strokeBudget: parseFloat(options.strokeBudget),
        strokeWeight: parseFloat(options.strokeWeight),
        facetHatch: options.facetHatch ?? false,
        maxStrokeLength: parseFloat(options.maxStroke),
        workingSize: parseInt(options.workingSize, 10),
      };

      // Artist style: the style's option bundle wins over every flag the
      // user did NOT pass explicitly (commander fills defaults for all of
      // them, so option-value sources — not values — decide precedence).
      // Without --style, nothing here runs and output is byte-identical.
      if (options.style) {
        const style = PEN_INK_STYLES[String(options.style).toLowerCase()];
        if (!style) {
          console.error(
            `Unknown --style "${options.style}" (available: ${Object.keys(PEN_INK_STYLES).join(', ')})`
          );
          process.exit(2);
        }
        // Which commander option feeds each style-settable PenInkOptions field
        const OPTION_FLAG: Partial<Record<keyof PenInkOptions, string>> = {
          layers: 'layers',
          minSpacing: 'minSpacing',
          maxSpacing: 'maxSpacing',
          whiteCutoff: 'whiteCutoff',
          toneGamma: 'toneGamma',
          valueBands: 'valueBands',
          massing: 'massing',
          hatchPatchiness: 'hatchPatchiness',
          hatchAngle: 'hatchAngle',
          followTone: 'followTone',
          fieldSmoothing: 'fieldSmoothing',
          normalizeContrast: 'contrast',
          drawOutlines: 'outlines',
          outlineThreshold: 'outlineThreshold',
          contourHalo: 'contourHalo',
          wobble: 'wobble',
          textureStrokes: 'texture',
          textureStyle: 'textureStyle',
          skyStipple: 'skyStipple',
          calmWater: 'calmWater',
          richBlacks: 'richBlacks',
          solidBlacks: 'solidBlacks',
          fillSpacing: 'fillSpacing',
          counterchange: 'counterchange',
          crossContour: 'crossContour',
          lineSwell: 'lineSwell',
          scribbleTone: 'scribbleTone',
          strokeBudget: 'strokeBudget',
          strokeWeight: 'strokeWeight',
          facetHatch: 'facetHatch',
          maxStrokeLength: 'maxStroke',
          outlinePasses: 'outlinePasses',
          autoStyle: 'autoStyle',
          detailEmphasis: 'detail',
          workingSize: 'workingSize',
        };
        for (const [key, value] of Object.entries(style.options)) {
          const flag = OPTION_FLAG[key as keyof PenInkOptions];
          if (!flag || cmd.getOptionValueSource(flag) !== 'cli') {
            (penInkOptions as Record<string, unknown>)[key] = value;
          }
        }
        console.log(`Style: ${style.label} — ${style.description}`);
      }

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
        // Bold outlines are deliberate multi-pass emphasis, and solid fill
        // is deliberate coverage at pen width — neither is pile-up. Exempt.
        const protect = limitStrokeDensity(result, {
          maxPasses,
          cellPx,
          minOverlapPx,
          skipLayers: ['bold', 'fill'],
        });
        result = protect.result;
        console.log(
          `  Density protection (max ${maxPasses} passes): trimmed ${protect.removed.length} coalesced runs`
        );
      }

      const frame: PageFrame = {
        width: result.width,
        height: result.height,
        marginPx: 0,
        paperSvg,
        paperStrokeWidth,
        page: pageMetricsForTiling,
        marginMm: options.paper ? parseFloat(options.marginMm) : undefined,
      };
      writePlotOutput(
        applySketchFromFlags(result, options, sketchScale(options)),
        frame,
        options,
        svgOptions
      );
    });
}
