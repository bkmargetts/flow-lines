import type { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  generatePlanet,
  toSVG,
  type PlanetOptions,
  type PlanetType,
  type SVGOptions,
} from '@flow-lines/core';
import { PLANET_PALETTES } from '../palettes.js';
import { resolvePageFrame } from '../page.js';

export function registerPlanet(program: Command) {
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
    .option('--persistence <number>', 'Surface noise persistence (0.3-0.8)', '0.5')
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
    .option('--oblateness <number>', 'Equatorial bulge: vertical squash of gas bodies (0-0.15)', '0')
    // ice
    .option('--ice-caps', 'Draw polar ice caps')
    .option('--cap-latitude <number>', 'Latitude where caps begin (deg)', '68')
    .option('--cap-raggedness <number>', 'Noisy cap edge (0-1)', '0.5')
    // marks
    .option('--hatch-spacing <number>', 'Form-hatch spacing in px', '6')
    .option('--cross-hatch-layers <number>', 'Cross-hatch layers (1-5)', '3')
    .option('--light-weight <number>', 'Shading weight of lit-ness in tone (0-1)', '0.85')
    .option('--albedo-weight <number>', 'Shading weight of surface albedo in tone (0-1)', '0.7')
    .option('--stipple <number>', 'Shadow/texture stipple (0-1)', '0')
    .option('--atmosphere <number>', 'Glow rings (corona for stars)', '0')
    .option('--atmosphere-style <s>', 'Atmosphere marks: rings | haze', 'rings')
    // phenomena
    .option('--eclipse', 'Companion moon casts its shadow on the planet (needs --moon)')
    .option('--aurora', 'Dashed auroral ovals + curtain rays around the poles')
    .option('--aurora-latitude <number>', 'Latitude of the auroral oval (deg)', '70')
    .option('--aurora-intensity <number>', 'Aurora dash density / ray count (0-1)', '0.6')
    // relief
    .option('--terminator-emphasis <number>', 'Extra hatch hugging the terminator (0-1)', '0')
    .option('--mountains', 'Chevron hachures on high terrestrial land')
    .option('--clouds', 'Trace soft cloud shapes (terrestrial)')
    .option('--rivers <number>', 'Drainage lines from high ground to the sea (terrestrial)', '0')
    .option('--rilles <number>', 'Sinuous double-line channels (moon / barren)', '0')
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
    .option('--sketch <number>', 'Hand-drawn sketch overdraw intensity (0-1)', '0')
    .option('--sketch-style <s>', 'Sketch character: loose | fine | gestural | scratchy', 'loose')
    .option('--background', 'Include background rectangle')
    .option('--background-color <color>', 'Background color', '#ffffff')
    .option('--no-optimize', 'Skip stroke chaining and pen-travel ordering')
    .option('-o, --output <file>', 'Output file path', 'planet.svg')
    .action((options) => {
      const { width, height, marginPx, paperSvg, paperStrokeWidth } = resolvePageFrame(options);

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
        persistence: parseFloat(options.persistence),
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
        oblateness: parseFloat(options.oblateness),
        iceCaps: options.iceCaps ?? false,
        capLatitude: parseFloat(options.capLatitude),
        capRaggedness: parseFloat(options.capRaggedness),
        hatchSpacing: paperStrokeWidth ? (parseFloat(options.hatchSpacing) * paperStrokeWidth) / parseFloat(options.penWidthMm) : parseFloat(options.hatchSpacing),
        crossHatchLayers: parseInt(options.crossHatchLayers, 10),
        lightWeight: parseFloat(options.lightWeight),
        albedoWeight: parseFloat(options.albedoWeight),
        stipple: parseFloat(options.stipple),
        atmosphere: parseInt(options.atmosphere, 10),
        atmosphereStyle: options.atmosphereStyle as PlanetOptions['atmosphereStyle'],
        eclipse: options.eclipse ?? false,
        aurora: options.aurora ?? false,
        auroraLatitude: parseFloat(options.auroraLatitude),
        auroraIntensity: parseFloat(options.auroraIntensity),
        terminatorEmphasis: parseFloat(options.terminatorEmphasis),
        mountains: options.mountains ?? false,
        clouds: options.clouds ?? false,
        rivers: parseInt(options.rivers, 10),
        rilles: parseInt(options.rilles, 10),
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
        sketch: parseFloat(options.sketch),
        sketchStyle: options.sketchStyle as PlanetOptions['sketchStyle'],
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
}
