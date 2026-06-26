// Render the Planet Generator across every type preset, engraved-plate option,
// composition layout and surface-relief mark into one HTML contact sheet — the
// eyeball-regression suite, the counterpart to scripts/vines-gallery.mjs.
//
//   pnpm build                          # build the CLI first
//   node scripts/planet-gallery.mjs [outputDir]
//
// Drives the `flow-lines planet` CLI, so it doubles as a CLI smoke test. Option
// sets are mirrored from the web app's presets
// (packages/web/.../planet-generator/presets.ts), the same convention the vine
// gallery uses for its species flag arrays.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const cli = join(root, 'packages', 'cli', 'dist', 'cli.js');
const outputDir = resolve(process.argv[2] ?? join(root, 'planet-gallery'));

if (!existsSync(cli)) {
  console.error('CLI not built — run `pnpm build` first');
  process.exit(1);
}
mkdirSync(outputDir, { recursive: true });

const COMMON = ['--seed', '7', '--width', '560', '--height', '560', '--hatch-spacing', '4.6', '--background'];

// Each render is [label, flag array]. Sections become rows in the contact sheet.
const SECTIONS = {
  'Type presets': {
    terrestrial: ['--type', 'terrestrial', '--sea-level', '0.11', '--ice-caps', '--atmosphere', '1', '--starfield', '--star-count', '110', '--palette', 'astronomical'],
    'gas giant': ['--type', 'gas-giant', '--bands', '--band-count', '11', '--storms', '1', '--storm-size', '1.2', '--limb-darkening', '0.5', '--cross-hatch-layers', '2', '--palette', 'saturn'],
    ringed: ['--type', 'ringed', '--bands', '--band-count', '10', '--storms', '1', '--storm-size', '1.2', '--limb-darkening', '0.45', '--cross-hatch-layers', '2', '--rings', '--ring-tilt', '22', '--ring-yaw', '14', '--ring-gap', '0.13', '--ring-count', '7', '--ring-density', '4', '--radius-frac', '0.5', '--palette', 'saturn'],
    moon: ['--type', 'moon', '--mare-level', '-0.04', '--craters', '--crater-count', '90', '--crater-detail', '--stipple', '0.6', '--light-elevation', '18', '--palette', 'lunar'],
    ice: ['--type', 'ice', '--ice-caps', '--cap-latitude', '40', '--contrast', '0.9', '--stipple', '0.2', '--atmosphere', '1', '--palette', 'cyanotype'],
    lava: ['--type', 'lava', '--contrast', '2', '--noise-scale', '2.1', '--stipple', '0.5', '--atmosphere', '2', '--lava-fissure-width', '0.14', '--lava-glow', '0.5', '--light-elevation', '24', '--palette', 'mars'],
    star: ['--type', 'star', '--limb-darkening', '0.7', '--atmosphere', '2', '--light-elevation', '90', '--ambient', '0.9', '--stipple', '0.6', '--cross-hatch-layers', '1', '--no-coastlines', '--palette', 'mars'],
    barren: ['--type', 'barren', '--mare-level', '-0.16', '--craters', '--crater-count', '50', '--crater-max-r', '0.1', '--crater-detail', '--stipple', '0.3', '--cross-hatch-layers', '4', '--palette', 'lunar'],
  },
  'Engraved plate': {
    graticule: ['--type', 'terrestrial', '--sea-level', '0.1', '--ice-caps', '--graticule', '--graticule-spacing', '20', '--palette', 'astronomical'],
    'frame + scale': ['--type', 'moon', '--mare-level', '-0.04', '--craters', '--crater-count', '70', '--stipple', '0.5', '--plate-frame', '--scale-bar', '--light-elevation', '18', '--palette', 'lunar'],
    'titled plate': ['--type', 'terrestrial', '--sea-level', '0.1', '--ice-caps', '--graticule', '--graticule-spacing', '20', '--plate-frame', '--scale-bar', '--title', 'TERRA NOVA', '--caption', 'PLATE IV', '--palette', 'astronomical'],
  },
  Composition: {
    phases: ['--layout', 'phases', '--layout-count', '7', '--type', 'moon', '--mare-level', '-0.04', '--craters', '--crater-count', '50', '--stipple', '0.4', '--plate-frame', '--title', 'PHASES', '--palette', 'lunar'],
    comparison: ['--layout', 'comparison', '--layout-count', '6', '--plate-frame', '--title', 'MAGNITUDES', '--palette', 'astronomical'],
    orbital: ['--layout', 'orbital', '--layout-count', '6', '--plate-frame', '--title', 'THE SYSTEM', '--starfield', '--star-count', '110', '--palette', 'astronomical'],
  },
  'Surface relief': {
    'crater detail': ['--type', 'moon', '--mare-level', '-0.04', '--craters', '--crater-count', '60', '--crater-detail', '--stipple', '0.4', '--light-elevation', '16', '--palette', 'lunar'],
    terminator: ['--type', 'barren', '--craters', '--crater-count', '40', '--terminator-emphasis', '0.8', '--light-elevation', '18', '--stipple', '0.3', '--palette', 'lunar'],
    mountains: ['--type', 'terrestrial', '--sea-level', '0.1', '--ice-caps', '--mountains', '--contrast', '1.6', '--palette', 'astronomical'],
    clouds: ['--type', 'terrestrial', '--sea-level', '0.05', '--ice-caps', '--clouds', '--palette', 'astronomical'],
  },
};

const sections = [];
for (const [title, items] of Object.entries(SECTIONS)) {
  const renders = [];
  for (const [label, flags] of Object.entries(items)) {
    const file = `${title}-${label}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.svg';
    process.stdout.write(`${title} × ${label}… `);
    execFileSync(process.execPath, [cli, 'planet', '-o', join(outputDir, file), ...COMMON, ...flags], {
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    console.log('done');
    renders.push({ label, file });
  }
  sections.push({ title, renders });
}

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Planet Generator gallery</title>
<style>
  body { font-family: system-ui, sans-serif; background: #f4f1ea; margin: 24px; }
  h2 { margin: 32px 0 8px; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
  figure { margin: 0; background: white; padding: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
  figure img { width: 220px; display: block; }
  figcaption { font-size: 12px; color: #555; padding-top: 6px; text-align: center; }
</style></head><body>
<h1>Planet Generator gallery</h1>
<p>Seed 7. Type presets, engraved-plate options, composition layouts and surface relief.</p>
${sections
  .map(
    (s) => `<h2>${s.title}</h2>\n<div class="row">${s.renders
      .map((r) => `<figure><img src="${r.file}" loading="lazy"><figcaption>${r.label}</figcaption></figure>`)
      .join('')}</div>`
  )
  .join('\n')}
</body></html>`;

writeFileSync(join(outputDir, 'index.html'), html);
console.log(`\nGallery written to ${join(outputDir, 'index.html')}`);
