// Render every vine species across every composition and build an HTML contact
// sheet — the eyeball-regression suite for the Vine Generator, the counterpart
// to scripts/gallery.mjs for the image pipeline.
//
//   node scripts/vines-gallery.mjs [outputDir]
//
// Requires the CLI to be built (`pnpm build`). Species are mirrored from the web
// app's presets (packages/web/.../vine-generator/presets.ts) as flag arrays —
// the same convention scripts/gallery.mjs uses for the image style presets.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const cli = join(root, 'packages', 'cli', 'dist', 'cli.js');
const outputDir = resolve(process.argv[2] ?? join(root, 'vines-gallery'));

// Species character (mirrors presets.ts: leaf/flower/density/palette).
const SPECIES = {
  'wild-rose': ['--leaf-type', 'serrate', '--leaf-arrangement', 'pinnate', '--leaflet-count', '5', '--thorns', '--thorn-prob', '0.18', '--flower-type', 'rose', '--flower-prob', '0.4', '--density', '0.55', '--stem-width', '8', '--palette', 'rose'],
  ivy: ['--leaf-type', 'lobed', '--no-flowers', '--tendril-prob', '0.06', '--density', '0.7', '--stem-width', '6', '--palette', 'botanical'],
  fern: ['--leaf-type', 'lance', '--leaf-style', 'veined', '--leaf-arrangement', 'bipinnate', '--leaflet-count', '9', '--no-flowers', '--no-tendrils', '--density', '0.5', '--leaf-size', '16', '--leaf-spacing', '18', '--stem-width', '5', '--palette', 'botanical'],
  wisteria: ['--leaf-type', 'ovate', '--leaf-arrangement', 'pinnate', '--leaflet-count', '9', '--inflorescence', 'raceme', '--floret-count', '12', '--flower-type', 'bell', '--flower-prob', '0.7', '--density', '0.45', '--gravitropism', '0.2', '--stem-width', '7', '--palette', 'botanical'],
  eucalyptus: ['--leaf-type', 'cordate', '--phyllotaxis', 'opposite', '--no-flowers', '--no-tendrils', '--density', '0.5', '--leaf-size', '22', '--stem-width', '6', '--palette', 'botanical'],
  grapevine: ['--leaf-type', 'lobed', '--fruit-type', 'grape', '--fruit-prob', '0.4', '--no-flowers', '--tendril-prob', '0.28', '--density', '0.55', '--stem-width', '8', '--palette', 'autumn'],
};

// Page compositions — exercises wreath closure, vessel/ground, and notan.
const COMPOSITIONS = {
  specimen: ['--composition', 'specimen'],
  'specimen+jar': ['--composition', 'specimen', '--vessel', 'jar', '--ground-line'],
  wreath: ['--composition', 'wreath', '--seed-count', '8'],
  'bouquet+vase': ['--composition', 'bouquet', '--vessel', 'vase', '--ground-line', '--seed-count', '6'],
  trellis: ['--composition', 'trellis', '--support', 'lattice', '--seed-count', '4'],
  border: ['--composition', 'border'],
  'fill-heart': ['--composition', 'fill', '--fill-shape', 'heart', '--mode', 'colonization'],
  'free+notan': ['--composition', 'free', '--seeding', 'scatter', '--seed-count', '10', '--negative-space', '0.6'],
};

if (!existsSync(cli)) {
  console.error('CLI not built — run `pnpm build` first');
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });
const cells = [];

for (const [species, speciesFlags] of Object.entries(SPECIES)) {
  const row = { species, renders: [] };
  for (const [comp, compFlags] of Object.entries(COMPOSITIONS)) {
    const out = `${species}-${comp}.svg`;
    const args = [
      cli, 'vines',
      '-o', join(outputDir, out),
      '--seed', '42',
      '--width', '700',
      '--height', '900',
      '--background',
      // Composition flags come after species so they win on conflict.
      ...speciesFlags,
      ...compFlags,
    ];
    process.stdout.write(`${species} × ${comp}… `);
    execFileSync(process.execPath, args, { stdio: ['ignore', 'ignore', 'inherit'] });
    console.log('done');
    row.renders.push({ comp, file: out });
  }
  cells.push(row);
}

// Vessel showcase: one species (wild rose) bouquet across every vessel style,
// grounded with a cast shadow — the regression view for the vessel rework.
const VESSELS = ['vase', 'urn', 'amphora', 'bud-vase', 'pot', 'jar', 'mason-jar', 'bowl'];
const vesselRow = { species: 'vessels (wild rose bouquet)', renders: [] };
for (const v of VESSELS) {
  const out = `vessel-${v}.svg`;
  const args = [
    cli, 'vines',
    '-o', join(outputDir, out),
    '--seed', '42', '--width', '700', '--height', '900', '--background',
    '--composition', 'bouquet', '--vessel', v, '--ground-line', '--cast-shadow', '0.4',
    ...SPECIES['wild-rose'],
  ];
  process.stdout.write(`vessel ${v}… `);
  execFileSync(process.execPath, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log('done');
  vesselRow.renders.push({ comp: v, file: out });
}
cells.push(vesselRow);

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Vine Generator gallery</title>
<style>
  body { font-family: system-ui, sans-serif; background: #f4f1ea; margin: 24px; }
  h2 { margin: 32px 0 8px; text-transform: capitalize; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
  figure { margin: 0; background: white; padding: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
  figure img { width: 240px; display: block; }
  figcaption { font-size: 12px; color: #555; padding-top: 6px; text-align: center; }
</style></head><body>
<h1>Vine Generator gallery</h1>
<p>Seed 42, 700×900. Species (rows) × compositions (columns).</p>
${cells
  .map(
    (row) => `<h2>${row.species}</h2>\n<div class="row">${row.renders
      .map(
        (r) =>
          `<figure><img src="${r.file}" loading="lazy"><figcaption>${r.comp}</figcaption></figure>`
      )
      .join('')}</div>`
  )
  .join('\n')}
</body></html>`;

writeFileSync(join(outputDir, 'index.html'), html);
console.log(`\nGallery written to ${join(outputDir, 'index.html')}`);
