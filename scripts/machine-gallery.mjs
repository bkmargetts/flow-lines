// Render the Machine across every preset × seed into one HTML contact
// sheet — the eyeball-regression suite for contraption tuning, the
// counterpart to scripts/ribbons-gallery.mjs. Imports the built core
// package directly.
//
//   pnpm --filter @flow-lines/core build   # build core first
//   node scripts/machine-gallery.mjs [outputDir]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const coreDist = join(root, 'packages', 'core', 'dist', 'index.js');
const outputDir = resolve(process.argv[2] ?? join(root, 'machine-gallery'));

if (!existsSync(coreDist)) {
  console.error('Core not built — run `pnpm --filter @flow-lines/core build` first');
  process.exit(1);
}
const { generateMachine, toSVG } = await import(coreDist);

mkdirSync(outputDir, { recursive: true });

const W = 560;
const H = 700;
const SEEDS = [7, 42, 1337];

// Mirrors the web module's presets at gallery scale, plus the raw poles of
// the complexity × connectivity plane.
const PRESETS = [
  ['mega', { complexity: 1, connectivity: 1 }],
  ['wall', { complexity: 1, connectivity: 0, shading: 0.7 }],
  ['half-linked', { complexity: 0.8, connectivity: 0.5 }],
  ['sparse', { complexity: 0.3, connectivity: 0.8 }],
  ['ruled', { complexity: 0.85, connectivity: 0.9, sketch: 0, wobble: 0.1 }],
];

const cells = [];
for (const [name, opts] of PRESETS) {
  for (const seed of SEEDS) {
    const label = `${name} · seed ${seed}`;
    const file = `${name}-s${seed}.svg`;
    const t0 = Date.now();
    const res = generateMachine({ width: W, height: H, margin: 28, seed, ...opts });
    writeFileSync(join(outputDir, file), toSVG(res, { optimize: true }));
    cells.push({ name, label, file });
    console.log(`rendered ${file} (${res.lines.length} lines, ${Date.now() - t0}ms)`);
  }
}

const rows = PRESETS.map(([name]) => {
  const imgs = cells
    .filter((c) => c.name === name)
    .map((c) => `<figure><img src="${c.file}" loading="lazy"><figcaption>${c.label}</figcaption></figure>`)
    .join('\n');
  return `<h2>${name}</h2><div class="row">${imgs}</div>`;
}).join('\n');

writeFileSync(
  join(outputDir, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Machine gallery</title>
<style>
  body { font: 14px system-ui; margin: 20px; background: #f4f1ea; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
  figure { margin: 0; }
  img { width: 320px; height: auto; background: white; border: 1px solid #ccc; }
  figcaption { text-align: center; color: #555; padding: 4px; }
</style>
<h1>Machine — presets contact sheet</h1>
${rows}`
);
console.log(`\nwrote ${join(outputDir, 'index.html')}`);
