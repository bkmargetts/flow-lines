// Render the Ribbon Weave across every preset × order × seed into one HTML
// contact sheet — the eyeball-regression suite for weave tuning, the
// counterpart to scripts/city-gallery.mjs. There is no `ribbons` CLI
// command, so this imports the built core package directly.
//
//   pnpm --filter @flow-lines/core build   # build core first
//   node scripts/ribbons-gallery.mjs [outputDir]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const coreDist = join(root, 'packages', 'core', 'dist', 'index.js');
const outputDir = resolve(process.argv[2] ?? join(root, 'ribbons-gallery'));

if (!existsSync(coreDist)) {
  console.error('Core not built — run `pnpm --filter @flow-lines/core build` first');
  process.exit(1);
}
const { generateRibbonWeave, toSVG } = await import(coreDist);

mkdirSync(outputDir, { recursive: true });

const W = 560;
const H = 640;
const SEEDS = [7, 42];

// Mirrors the web module's presets (packages/web/src/projects/ribbon-weave/
// presets.ts) at gallery scale, plus the raw ends of the order axis.
const PRESETS = [
  ['plait', { order: 1, breaks: 0, wobble: 0.4 }],
  ['knot-garden', { order: 0.78, breaks: 0.4, shading: 0.6 }],
  ['mid', { order: 0.5 }],
  ['ink-ribbons', { order: 0.35, breaks: 0.3, cell: 62, bandWidth: 18, shading: 0.85, shadowHatch: 1, twists: 0.35, sketch: 0.3 }],
  ['op-art', { order: 0.6, breaks: 0.1, edge: 'bleed', cell: 56, bandWidth: 20, rungs: 0.95, rungCurve: 0.75, shading: 0.15 }],
  ['tangle', { order: 0.1, breaks: 0.15, edge: 'bleed', cell: 50, twists: 0.15, sketch: 0.2 }],
  ['silk', { style: 'silk', order: 0.55, breaks: 0.35, cell: 56, bandWidth: 17, shading: 0.65, twists: 0.3, sketch: 0.15 }],
  ['silk-loose', { style: 'silk', order: 0.3, breaks: 0.3, cell: 64, bandWidth: 20, shading: 0.7, twists: 0.4, sketch: 0.15 }],
];

const cells = [];
for (const [name, opts] of PRESETS) {
  for (const seed of SEEDS) {
    const label = `${name} · seed ${seed}`;
    const file = `${name}-s${seed}.svg`;
    const res = generateRibbonWeave({ width: W, height: H, margin: 24, seed, ...opts });
    writeFileSync(join(outputDir, file), toSVG(res, { optimize: true }));
    cells.push({ name, label, file });
    console.log(`rendered ${file} (${res.lines.length} lines)`);
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
  `<!doctype html><meta charset="utf-8"><title>Ribbon weave gallery</title>
<style>
  body { font: 14px system-ui; margin: 20px; background: #f4f1ea; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
  figure { margin: 0; }
  img { width: 320px; height: auto; background: white; border: 1px solid #ccc; }
  figcaption { text-align: center; color: #555; padding: 4px; }
</style>
<h1>Ribbon Weave — presets contact sheet</h1>
${rows}`
);
console.log(`\nwrote ${join(outputDir, 'index.html')}`);
