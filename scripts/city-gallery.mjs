// Render the City Generator across every building style × order × seed into
// one HTML contact sheet — the eyeball-regression suite for style tuning,
// the counterpart to scripts/planet-gallery.mjs. There is no `city` CLI
// command, so this imports the built core package directly.
//
//   pnpm --filter @flow-lines/core build   # build core first
//   node scripts/city-gallery.mjs [outputDir]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const coreDist = join(root, 'packages', 'core', 'dist', 'index.js');
const outputDir = resolve(process.argv[2] ?? join(root, 'city-gallery'));

if (!existsSync(coreDist)) {
  console.error('Core not built — run `pnpm --filter @flow-lines/core build` first');
  process.exit(1);
}
const { generateCity, toSVG, CITY_STYLES } = await import(coreDist);

mkdirSync(outputDir, { recursive: true });

const W = 560;
const H = 640;
const SEEDS = [7, 42];
const ORDERS = [0.2, 0.8];

const cells = [];
for (const style of CITY_STYLES) {
  for (const seed of SEEDS) {
    for (const order of ORDERS) {
      const label = `${style} · seed ${seed} · order ${order}`;
      const file = `${style}-s${seed}-o${String(order).replace('.', '')}.svg`;
      const res = generateCity({ width: W, height: H, margin: 24, seed, order, style });
      writeFileSync(join(outputDir, file), toSVG(res, { optimize: true }));
      cells.push({ style, label, file });
      console.log(`rendered ${file} (${res.lines.length} lines)`);
    }
  }
}

const rows = CITY_STYLES.map((style) => {
  const imgs = cells
    .filter((c) => c.style === style)
    .map((c) => `<figure><img src="${c.file}" loading="lazy"><figcaption>${c.label}</figcaption></figure>`)
    .join('\n');
  return `<h2>${style}</h2><div class="row">${imgs}</div>`;
}).join('\n');

writeFileSync(
  join(outputDir, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>City gallery</title>
<style>
  body { font: 14px system-ui; margin: 20px; background: #f4f1ea; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
  figure { margin: 0; }
  img { width: 320px; height: auto; background: white; border: 1px solid #ccc; }
  figcaption { text-align: center; color: #555; padding: 4px; }
</style>
<h1>City Generator — building styles contact sheet</h1>
${rows}`
);
console.log(`\nwrote ${join(outputDir, 'index.html')}`);
