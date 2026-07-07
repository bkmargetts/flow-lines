// Refactor safety net for the CLI surface: render a fixed command × preset ×
// seed matrix through the *built* CLI (packages/cli/dist/cli.js) and record a
// sha256 per SVG. Unlike the vitest golden suites (which call core/web
// functions directly), this exercises the real binary — flag parsing, the
// flag→options mapping, image loading, and SVG writing — exactly where a CLI
// refactor could silently drift.
//
//   node scripts/hash-baseline.mjs write   [manifest.json]   # record baseline
//   node scripts/hash-baseline.mjs compare [manifest.json]   # diff against it
//
// The manifest is a working artifact (keep it out of the repo — e.g. in the
// session scratchpad). Renders use small widths: the point is bit-stability
// across code motion, not print quality. Run `pnpm build` first.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const cli = join(root, 'packages', 'cli', 'dist', 'cli.js');
const images = join(root, 'test-images');

const mode = process.argv[2];
const manifestPath = resolve(
  process.argv[3] ?? join(root, 'cli-hash-baseline.json')
);
if (mode !== 'write' && mode !== 'compare') {
  console.error('usage: node scripts/hash-baseline.mjs <write|compare> [manifest.json]');
  process.exit(2);
}
if (!existsSync(cli)) {
  console.error('CLI not built — run `pnpm build` first');
  process.exit(1);
}

const SEED = ['--seed', '42'];
const SIZE = ['--width', '420', '--height', '560'];

// Image presets mirror scripts/gallery.mjs (which mirrors the web app).
const IMAGE_PRESETS = {
  classic: ['--layers', '3', '--tone-gamma', '1.3', '--texture', '0.6', '--wobble', '0.8', '--value-bands', '4', '--massing', '0.5'],
  portrait: ['--layers', '3', '--tone-gamma', '1.7', '--texture', '0.4', '--wobble', '0.9', '--working-size', '800'],
  pet: ['--layers', '2', '--max-spacing', '12', '--tone-gamma', '1.45', '--texture', '1', '--wobble', '1', '--working-size', '800', '--value-bands', '4', '--massing', '0.4'],
  landscape: ['--layers', '5', '--min-spacing', '1.8', '--max-spacing', '16', '--tone-gamma', '1', '--texture', '0.7', '--wobble', '0.9', '--working-size', '800', '--white-cutoff', '0.14', '--hatch-angle', '0', '--sky-stipple', '--calm-water', '--max-stroke', '70', '--field-smoothing', '5', '--value-bands', '4', '--hatch-patchiness', '0.7', '--facet-hatch', '--massing', '0.4'],
  sketch: ['--layers', '1', '--min-spacing', '3.2', '--max-spacing', '24', '--tone-gamma', '1.35', '--texture', '0.8', '--texture-style', 'scribble', '--wobble', '2.2', '--value-bands', '3', '--hatch-patchiness', '0.6', '--detail', '0.4', '--white-cutoff', '0.1', '--hatch-angle', '-30', '--field-smoothing', '3', '--massing', '0.5'],
  etching: ['--layers', '2', '--min-spacing', '2.8', '--white-cutoff', '0.15', '--tone-gamma', '1.8', '--texture', '0.15', '--wobble', '0.4', '--working-size', '800', '--cross-contour', '--max-stroke', '48', '--field-smoothing', '8', '--value-bands', '5', '--hatch-patchiness', '0.5', '--facet-hatch', '--massing', '0.5'],
  // Artist styles live in core (PEN_INK_STYLES) — one flag, no mirroring
  comic: ['--style', 'comic'],
  dore: ['--style', 'dore'],
};

// Vine species mirror scripts/vines-gallery.mjs (a representative subset).
const VINE_SPECIES = {
  'wild-rose': ['--leaf-type', 'serrate', '--leaf-arrangement', 'pinnate', '--leaflet-count', '5', '--thorns', '--thorn-prob', '0.18', '--flower-type', 'rose', '--flower-prob', '0.4', '--density', '0.55', '--stem-width', '8', '--palette', 'rose'],
  fern: ['--leaf-type', 'lance', '--leaf-style', 'veined', '--leaf-arrangement', 'bipinnate', '--leaflet-count', '9', '--no-flowers', '--no-tendrils', '--density', '0.5', '--leaf-size', '16', '--leaf-spacing', '18', '--stem-width', '5', '--palette', 'botanical'],
  grapevine: ['--leaf-type', 'lobed', '--fruit-type', 'grape', '--fruit-prob', '0.4', '--no-flowers', '--tendril-prob', '0.28', '--density', '0.55', '--stem-width', '8', '--palette', 'autumn'],
  oak: ['--leaf-type', 'lobed', '--phyllotaxis', 'spiral', '--fruit-type', 'catkin', '--fruit-prob', '0.25', '--no-flowers', '--density', '0.55', '--leaf-size', '16', '--stem-width', '12', '--stem-texture', 'bark', '--palette', 'botanical'],
};
const VINE_COMPOSITIONS = {
  specimen: ['--composition', 'specimen'],
  'specimen+jar': ['--composition', 'specimen', '--vessel', 'jar', '--ground-line'],
  wreath: ['--composition', 'wreath', '--seed-count', '8'],
  'bouquet+vase': ['--composition', 'bouquet', '--vessel', 'vase', '--ground-line', '--seed-count', '6'],
  trellis: ['--composition', 'trellis', '--support', 'lattice', '--seed-count', '4'],
  'fill-heart': ['--composition', 'fill', '--fill-shape', 'heart', '--mode', 'colonization'],
  'free+notan': ['--composition', 'free', '--seeding', 'scatter', '--seed-count', '10', '--negative-space', '0.6'],
};

// Planet presets mirror scripts/planet-gallery.mjs (a representative subset,
// covering every body type plus plate/layout/sketch features).
const PLANET_PRESETS = {
  terrestrial: ['--type', 'terrestrial', '--sea-level', '0.11', '--ice-caps', '--atmosphere', '1', '--starfield', '--star-count', '110', '--palette', 'astronomical'],
  'gas-giant': ['--type', 'gas-giant', '--bands', '--band-count', '11', '--storms', '1', '--storm-size', '1.2', '--limb-darkening', '0.5', '--cross-hatch-layers', '2', '--palette', 'saturn'],
  ringed: ['--type', 'ringed', '--bands', '--band-count', '10', '--storms', '1', '--storm-size', '1.2', '--limb-darkening', '0.45', '--cross-hatch-layers', '2', '--rings', '--ring-tilt', '22', '--ring-yaw', '14', '--ring-gap', '0.13', '--ring-count', '7', '--ring-density', '4', '--radius-frac', '0.5', '--palette', 'saturn'],
  moon: ['--type', 'moon', '--mare-level', '-0.04', '--craters', '--crater-count', '90', '--crater-detail', '--stipple', '0.6', '--light-elevation', '18', '--palette', 'lunar'],
  ice: ['--type', 'ice', '--ice-caps', '--cap-latitude', '40', '--contrast', '0.9', '--stipple', '0.2', '--atmosphere', '1', '--palette', 'cyanotype'],
  lava: ['--type', 'lava', '--contrast', '2', '--noise-scale', '2.1', '--stipple', '0.5', '--atmosphere', '2', '--lava-fissure-width', '0.14', '--lava-glow', '0.5', '--light-elevation', '24', '--palette', 'mars'],
  star: ['--type', 'star', '--limb-darkening', '0.7', '--atmosphere', '2', '--light-elevation', '90', '--ambient', '0.9', '--stipple', '0.6', '--cross-hatch-layers', '1', '--no-coastlines', '--palette', 'mars'],
  barren: ['--type', 'barren', '--mare-level', '-0.16', '--craters', '--crater-count', '50', '--crater-max-r', '0.1', '--crater-detail', '--stipple', '0.3', '--cross-hatch-layers', '4', '--palette', 'lunar'],
  'titled-plate': ['--type', 'terrestrial', '--sea-level', '0.1', '--ice-caps', '--graticule', '--graticule-spacing', '20', '--plate-frame', '--scale-bar', '--title', 'TERRA NOVA', '--caption', 'PLATE IV', '--palette', 'astronomical'],
  phases: ['--layout', 'phases', '--layout-count', '7', '--type', 'moon', '--mare-level', '-0.04', '--craters', '--crater-count', '50', '--stipple', '0.4', '--plate-frame', '--title', 'PHASES', '--palette', 'lunar'],
  orbital: ['--layout', 'orbital', '--layout-count', '6', '--plate-frame', '--title', 'THE SYSTEM', '--starfield', '--star-count', '110', '--palette', 'astronomical'],
  sketch: ['--type', 'terrestrial', '--sea-level', '0.1', '--ice-caps', '--sketch', '0.5', '--sketch-style', 'loose', '--palette', 'astronomical'],
};

const CONWAY_STYLES = ['marks', 'contour', 'streaks', 'slipstream', 'embers'];
const LANDSCAPE_SCENES = ['coastal-sunset', 'misty-ranges', 'rolling-hills', 'desert-dunes', 'alpine-lake'];

/** name → argv (without -o). */
const CASES = {};

CASES['generate/default'] = ['generate', ...SIZE, ...SEED, '--lines', '60'];
CASES['generate/noise-flags'] = [
  'generate', ...SIZE, ...SEED, '--lines', '60',
  '--noise-scale', '0.004', '--octaves', '3', '--persistence', '0.6', '--min-length', '12',
];
CASES['grid/default'] = ['grid', ...SIZE, ...SEED, '--grid-spacing', '18'];

// The image command: test-tube.png carries depth + labels sidecars, so the
// external-raster paths get exercised; boats.jpg covers JPEG + labels-only.
for (const [preset, flags] of Object.entries(IMAGE_PRESETS)) {
  CASES[`image/${preset}/test-tube`] = [
    'image', '-i', join(images, 'test-tube.png'), ...SEED, '--width', '420', ...flags,
    '--depth-image', join(images, 'test-tube.depth.png'), '--auto-style',
    '--label-image', join(images, 'test-tube.labels.png'),
  ];
}
CASES['image/classic/boats'] = [
  'image', '-i', join(images, 'boats.jpg'), ...SEED, '--width', '420',
  ...IMAGE_PRESETS.classic, '--label-image', join(images, 'boats.labels.png'),
];

for (const style of CONWAY_STYLES) {
  CASES[`conway/${style}`] = ['conway', ...SIZE, ...SEED, '--style', style];
}
for (const [species, flags] of Object.entries(VINE_SPECIES)) {
  CASES[`vines/${species}`] = ['vines', ...SIZE, ...SEED, ...flags];
}
for (const [comp, flags] of Object.entries(VINE_COMPOSITIONS)) {
  CASES[`vines/wild-rose/${comp}`] = ['vines', ...SIZE, ...SEED, ...VINE_SPECIES['wild-rose'], ...flags];
}
for (const [preset, flags] of Object.entries(PLANET_PRESETS)) {
  CASES[`planet/${preset}`] = ['planet', '--width', '420', '--height', '420', ...SEED, ...flags];
}
for (const scene of LANDSCAPE_SCENES) {
  CASES[`landscape/${scene}`] = ['landscape', ...SIZE, ...SEED, '--scene', scene];
}
// Paper-size page path (the block repeated across commands) + hand-drawn wobble.
CASES['vines/paper-a5'] = ['vines', ...SEED, '--paper', 'a5', ...VINE_SPECIES.fern];
CASES['landscape/paper-a5'] = ['landscape', ...SEED, '--paper', 'a5', '--scene', 'rolling-hills'];
CASES['planet/paper-a5'] = ['planet', ...SEED, '--paper', 'a5', '--type', 'moon', '--craters'];
CASES['conway/paper-a5'] = ['conway', ...SEED, '--paper', 'a5'];

const tmp = mkdtempSync(join(tmpdir(), 'flow-lines-baseline-'));
const hashes = {};
let i = 0;
for (const [name, args] of Object.entries(CASES)) {
  const out = join(tmp, `case-${i++}.svg`);
  process.stdout.write(`${name}… `);
  execFileSync(process.execPath, [cli, ...args, '-o', out], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  hashes[name] = createHash('sha256').update(readFileSync(out)).digest('hex');
  console.log('done');
}
rmSync(tmp, { recursive: true, force: true });

if (mode === 'write') {
  writeFileSync(manifestPath, JSON.stringify(hashes, null, 2) + '\n');
  console.log(`\nBaseline (${Object.keys(hashes).length} cases) written to ${manifestPath}`);
} else {
  const baseline = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const names = new Set([...Object.keys(baseline), ...Object.keys(hashes)]);
  let bad = 0;
  for (const name of [...names].sort()) {
    if (!(name in baseline)) { console.log(`NEW      ${name}`); bad++; }
    else if (!(name in hashes)) { console.log(`MISSING  ${name}`); bad++; }
    else if (baseline[name] !== hashes[name]) { console.log(`CHANGED  ${name}`); bad++; }
  }
  if (bad) {
    console.log(`\n${bad} case(s) drifted from ${manifestPath}`);
    process.exit(1);
  }
  console.log(`\nAll ${Object.keys(hashes).length} cases match ${manifestPath}`);
}
