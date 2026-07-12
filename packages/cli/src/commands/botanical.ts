import type { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  generateBotanical,
  toSVG,
  type SVGOptions,
  type BotanicalOptions,
  type BotanicalComposition,
  type BotanicalMode,
  type BotanicalSeeding,
  type FillShape,
  type BotanicalFill,
  type StemShade,
  type LeafType,
  type LeafStyle,
  type BotanicalFlower,
  type LeafArrangement,
  type Phyllotaxis,
  type Inflorescence,
  type FruitType,
  type BotanicalSupport,
  type StemTexture,
} from '@flow-lines/core';
import { BOTANICAL_PALETTES } from '../palettes.js';
import { loadGuidePathsFromSvg } from '../guide-paths.js';
import { resolvePageFrame } from '../page.js';
import { addSketchOptions, applySketchFromFlags, sketchScale } from '../sketch.js';

export function registerBotanical(program: Command) {
  addSketchOptions(program.command('botanical'))
    .description('Grow procedural, plottable botanical illustrations')
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
    .option('--guide-svg <file>', 'SVG file whose path outlines the stems grow along (with --composition guide)')
    .option('--support <s>', 'Trellis support the climbers wrap: none | lattice | arch | obelisk', 'none')
    .option('--fill-shape <s>', 'circle | oval | heart | diamond | painted (with --composition fill)', 'heart')
    .option('--no-fill-outline', 'Skip the broken outline around the fill region')
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
    .option('--max-length <number>', 'Max stem length in px (default: scales with the page)')
    .option('--step-length <number>', 'Growth step length in px', '6')
    // colonization
    .option('--attractor-count <number>', 'Space-colonization attractor points', '600')
    .option('--attractor-radius <number>', 'Attractor reach in px', '90')
    .option('--kill-radius <number>', 'Attractor consume distance in px', '16')
    // stem body & shading
    .option('--stem-width <number>', 'Base stem width in px (default: scales with the page)')
    .option('--taper <number>', 'Tapering toward the tip (0-1)', '0.85')
    .option('--stem-fill <f>', 'Stem rendering: shaded | solid | outline | highlight', 'shaded')
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
    .option('--leaf-size <number>', 'Leaf length in px (default: scales with the page)')
    .option('--leaf-spacing <number>', 'Arc-length leaf spacing in px (default: scales with leaf size)')
    .option('--leaf-arrangement <a>', 'simple | pinnate | bipinnate | palmate | trifoliate', 'simple')
    .option('--leaflet-count <number>', 'Leaflets per compound leaf', '5')
    .option('--phyllotaxis <p>', 'alternate | opposite | whorled | spiral', 'alternate')
    .option('--whorl-count <number>', 'Leaves per node (whorled phyllotaxis)', '3')
    .option('--no-tendrils', 'Omit tendrils')
    .option('--tendril-prob <number>', 'Tendril probability per site (0-1)', '0.12')
    .option('--no-flowers', 'Omit flowers')
    .option('--flower-type <t>', 'rose | daisy | bell | bud | mixed', 'rose')
    .option('--flower-prob <number>', 'Flower probability at stem tips (0-1)', '0.2')
    .option('--flower-size <number>', 'Bloom size in px (default: scales with the page)')
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
    .option('-o, --output <file>', 'Output file path', 'botanical.svg')
    .action((options) => {
      const { width, height, marginPx, paperSvg, paperStrokeWidth } = resolvePageFrame(options);

      const botanicalOptions: BotanicalOptions = {
        width,
        height,
        margin: marginPx,
        seed: options.seed ? parseInt(options.seed, 10) : undefined,
        composition: options.composition as BotanicalComposition,
        fillShape: options.fillShape as FillShape,
        fillOutline: options.fillOutline,
        support: options.support as BotanicalSupport,
        guidePaths: options.guideSvg ? loadGuidePathsFromSvg(options.guideSvg, width, height, marginPx) : undefined,
        mode: options.mode as BotanicalMode,
        seeding: options.seeding as BotanicalSeeding,
        seedCount: parseInt(options.seedCount, 10),
        vessel: options.vessel as BotanicalOptions['vessel'],
        groundLine: options.groundLine ?? false,
        negativeSpace: parseFloat(options.negativeSpace),
        tonalMassing: parseFloat(options.tonalMassing),
        valueBands: parseInt(options.valueBands, 10),
        curl: parseFloat(options.curl),
        gravitropism: parseFloat(options.gravitropism),
        branchProb: parseFloat(options.branchProb),
        maxDepth: parseInt(options.maxDepth, 10),
        maxLength: options.maxLength !== undefined ? parseFloat(options.maxLength) : undefined,
        stepLength: parseFloat(options.stepLength),
        attractorCount: parseInt(options.attractorCount, 10),
        attractorRadius: parseFloat(options.attractorRadius),
        killRadius: parseFloat(options.killRadius),
        stemWidth: options.stemWidth !== undefined ? parseFloat(options.stemWidth) : undefined,
        taper: parseFloat(options.taper),
        stemFill: options.stemFill as BotanicalFill,
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
        leafSize: options.leafSize !== undefined ? parseFloat(options.leafSize) : undefined,
        leafSpacing: options.leafSpacing !== undefined ? parseFloat(options.leafSpacing) : undefined,
        leafArrangement: options.leafArrangement as LeafArrangement,
        leafletCount: parseInt(options.leafletCount, 10),
        phyllotaxis: options.phyllotaxis as Phyllotaxis,
        whorlCount: parseInt(options.whorlCount, 10),
        tendrils: options.tendrils,
        tendrilProb: parseFloat(options.tendrilProb),
        flowers: options.flowers,
        flowerType: options.flowerType as BotanicalFlower,
        flowerProb: parseFloat(options.flowerProb),
        flowerSize: options.flowerSize !== undefined ? parseFloat(options.flowerSize) : undefined,
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

      console.log('Growing botanicals...');
      console.log(`  Size: ${width}x${height}, composition: ${botanicalOptions.composition}, mode: ${botanicalOptions.mode}`);

      const result = generateBotanical(botanicalOptions);

      console.log(`  Seed: ${result.seed}`);
      console.log(`  Generated ${result.lines.length} lines`);

      const palette = BOTANICAL_PALETTES[options.palette] ?? BOTANICAL_PALETTES.ink;
      const svgOptions: SVGOptions = {
        strokeColor: palette.stem,
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
