// Render the Lapidary generator across every curated look, arrangement, value
// rhythm and texture kind into one HTML contact sheet — the eyeball-regression
// suite, the counterpart to scripts/planet-gallery.mjs and
// scripts/botanical-gallery.mjs.
//
//   pnpm build                             # build the CLI first
//   node scripts/lapidary-gallery.mjs [outputDir]
//
// Drives the `flow-lines lapidary` CLI, so it doubles as a CLI smoke test.
// Option sets mirror the web app's presets
// (packages/web/src/projects/lapidary/presets.ts), the same convention the
// botanical and planet galleries use.
//
// The album is the judge: golden hashes only tell you the drawing changed,
// this tells you whether it got better. Judge a tuning change against the
// whole sheet, and against real pen-and-ink lapidary work — cut agate slices,
// etched geological plates — not against the previous render.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const cli = join(root, 'packages', 'cli', 'dist', 'cli.js');
const outputDir = resolve(process.argv[2] ?? join(root, 'lapidary-gallery'));

if (!existsSync(cli)) {
  console.error('CLI not built — run `pnpm build` first');
  process.exit(1);
}
mkdirSync(outputDir, { recursive: true });

// A5 at 3 px/mm through the paper path, so the mm-denominated seam and pitch
// land at their tuned physical size rather than at raw-pixel defaults.
const COMMON = ['--paper', 'a5', '--resolution', '3', '--margin-mm', '10', '--background'];
const SEED = ['--seed', '7'];

// Each render is [label, flag array]. Sections become rows in the contact sheet.
const SECTIONS = {
  // Every curated look, at one shared seed: the row that has to keep reading
  // as eleven distinct decisions rather than eleven shuffles of one deal.
  'Curated looks': {
    specimen: ['--preset', 'specimen', '--palette', 'specimen'],
    geode: ['--preset', 'geode', '--palette', 'graphite-rust-teal'],
    fortification: ['--preset', 'fortification', '--palette', 'specimen'],
    breccia: ['--preset', 'breccia', '--palette', 'graphite-rust-teal'],
    terraces: ['--preset', 'terraces', '--palette', 'specimen'],
    facet: ['--preset', 'facet', '--palette', 'specimen'],
    ammonite: ['--preset', 'ammonite', '--palette', 'specimen'],
    labyrinth: ['--preset', 'labyrinth', '--palette', 'graphite-rust-teal'],
    coil: ['--preset', 'coil', '--palette', 'graphite-rust-teal'],
    slab: ['--preset', 'slab', '--palette', 'graphite-rust-teal'],
    mono: ['--preset', 'mono', '--palette', 'mono'],
  },

  // The seeded deal in each arrangement — no texture list, so this row is
  // where a bad deal (two busy bands abutting, no dark anchor, no paper)
  // shows up first.
  Arrangements: {
    agate: ['--mode', 'agate', '--bands', '5', '--palette', 'specimen'],
    breccia: ['--mode', 'breccia', '--bands', '8', '--pen-assignment', 'per-region', '--palette', 'specimen'],
    strata: ['--mode', 'strata', '--bands', '6', '--angle', '0', '--palette', 'specimen'],
    spiral: ['--mode', 'spiral', '--bands', '6', '--palette', 'specimen'],
    'agate · no field': ['--mode', 'agate', '--bands', '5', '--no-field', '--palette', 'specimen'],
    'strata · faulted': ['--mode', 'strata', '--bands', '7', '--faults', '2', '--angle', '0', '--palette', 'specimen'],
    'spiral · blend': ['--mode', 'spiral', '--bands', '6', '--spiral-join', 'blend', '--palette', 'specimen'],
    'spiral · page': ['--mode', 'spiral', '--spiral-form', 'page', '--bands', '4', '--no-field', '--spiral-width', '0.9', '--palette', 'specimen'],
  },

  // One kind per sheet, filling every band, so each mark can be judged on its
  // own craft — taper, dash rhythm, end quality — instead of in a mixed deal.
  'Texture kinds': {
    lines: ['--textures', 'lines', '--bands', '4', '--palette', 'mono'],
    wavy: ['--textures', 'wavy', '--bands', '4', '--palette', 'mono'],
    contour: ['--textures', 'contour', '--bands', '4', '--palette', 'mono'],
    crystal: ['--textures', 'crystal', '--bands', '4', '--palette', 'mono'],
    hatch: ['--textures', 'hatch', '--bands', '4', '--palette', 'mono'],
    patchy: ['--textures', 'patchy', '--bands', '4', '--palette', 'mono'],
    cross: ['--textures', 'cross', '--bands', '4', '--palette', 'mono'],
    stipple: ['--textures', 'stipple', '--bands', '4', '--palette', 'mono'],
    mottle: ['--textures', 'mottle', '--bands', '4', '--pens', '2', '--palette', 'specimen'],
    grain: ['--textures', 'grain', '--bands', '4', '--palette', 'mono'],
  },

  // Tone: the composed value ladder against the knobs that shape it.
  'Value plan': {
    'plan off': ['--value-structure', '0', '--bands', '6', '--palette', 'mono'],
    'plan · auto': ['--bands', '6', '--palette', 'mono'],
    'rhythm dark-core': ['--value-rhythm', 'dark-core', '--bands', '6', '--palette', 'mono'],
    'rhythm dark-rim': ['--value-rhythm', 'dark-rim', '--bands', '6', '--palette', 'mono'],
    'rhythm alternating': ['--value-rhythm', 'alternating', '--bands', '6', '--palette', 'mono'],
    'rhythm ramp': ['--value-rhythm', 'ramp', '--bands', '6', '--palette', 'mono'],
    'rhythm flat': ['--value-rhythm', 'flat', '--bands', '6', '--palette', 'mono'],
    'no paper band': ['--no-paper-band', '--bands', '6', '--palette', 'mono'],
    'low contrast': ['--density-contrast', '0.15', '--bands', '6', '--palette', 'mono'],
    'high contrast': ['--density-contrast', '1', '--bands', '6', '--palette', 'mono'],
  },

  // Gradation across a band, and the finish knobs that carry the hand.
  Finish: {
    'gradient off': ['--gradation', '0', '--bands', '5', '--palette', 'mono'],
    'gradient full': ['--gradation', '1', '--bands', '5', '--palette', 'mono'],
    'keyline off': ['--outline-weight', '0', '--bands', '5', '--palette', 'mono'],
    'keyline drawn': ['--outlines', '--outline-weight', '0.6', '--bands', '5', '--palette', 'mono'],
    'misregistration off': ['--misregistration', '0', '--bands', '5', '--pens', '2', '--palette', 'specimen'],
    'misregistration wide': ['--misregistration', '1', '--bands', '5', '--pens', '2', '--palette', 'specimen'],
    'kintsugi veins': ['--mode', 'breccia', '--veins', '--bands', '8', '--palette', 'specimen'],
    'angle free': ['--angle-quantum', '0', '--bands', '6', '--palette', 'mono'],
  },

  // Same knobs, different seeds: the row that catches a plan which only works
  // for one deal. A generator is only as good as its worst seed.
  'Seed sweep': Object.fromEntries(
    [3, 11, 19, 23, 31, 47, 59, 71].map((s) => [
      `seed ${s}`,
      ['--bands', '6', '--palette', 'specimen', '--pens', '2'],
    ])
  ),
};

// The seed sweep overrides the shared seed; everything else inherits it.
const seedFor = (title, label) =>
  title === 'Seed sweep' ? ['--seed', label.replace('seed ', '')] : SEED;

const sections = [];
let failures = 0;
for (const [title, items] of Object.entries(SECTIONS)) {
  const renders = [];
  for (const [label, flags] of Object.entries(items)) {
    const file = `${title}-${label}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.svg';
    process.stdout.write(`${title} × ${label}… `);
    try {
      execFileSync(
        process.execPath,
        [cli, 'lapidary', '-o', join(outputDir, file), ...COMMON, ...seedFor(title, label), ...flags],
        { stdio: ['ignore', 'ignore', 'inherit'] }
      );
      console.log('done');
      renders.push({ label, file });
    } catch {
      // A flag that does not exist yet (the gallery is written ahead of the
      // knobs) must not abort the whole sheet — the cell is reported missing.
      console.log('FAILED');
      failures++;
      renders.push({ label, file: null });
    }
  }
  sections.push({ title, renders });
}

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Lapidary gallery</title>
<style>
  body { font-family: system-ui, sans-serif; background: #f4f1ea; margin: 24px; }
  h2 { margin: 32px 0 8px; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
  figure { margin: 0; background: white; padding: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
  figure img { width: 240px; display: block; }
  .missing { width: 240px; height: 340px; display: grid; place-items: center; color: #b00; font-size: 12px; background: #fbeaea; }
  figcaption { font-size: 12px; color: #555; padding-top: 6px; text-align: center; }
</style></head><body>
<h1>Lapidary gallery</h1>
<p>A5 at 3&nbsp;px/mm, seed 7 unless the caption says otherwise. Curated looks,
arrangements, every texture kind on its own, the value plan, the finish knobs,
and a seed sweep.</p>
${sections
  .map(
    (s) => `<h2>${s.title}</h2>\n<div class="row">${s.renders
      .map(
        (r) =>
          `<figure>${
            r.file
              ? `<img src="${r.file}" loading="lazy">`
              : '<div class="missing">render failed</div>'
          }<figcaption>${r.label}</figcaption></figure>`
      )
      .join('')}</div>`
  )
  .join('\n')}
</body></html>`;

writeFileSync(join(outputDir, 'index.html'), html);
console.log(`\nGallery written to ${join(outputDir, 'index.html')}`);
if (failures > 0) console.log(`${failures} render(s) failed — see the red cells.`);
