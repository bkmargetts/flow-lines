// Render the Machine Codex across every preset × seed into one HTML contact
// sheet — the eyeball-regression suite for contraption tuning, the
// counterpart to scripts/ribbons-gallery.mjs. There is no `codex` CLI
// command yet, so this imports the built core package directly.
//
//   pnpm --filter @flow-lines/core build   # build core first
//   node scripts/codex-gallery.mjs [outputDir]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const coreDist = join(root, 'packages', 'core', 'dist', 'index.js');
const outputDir = resolve(process.argv[2] ?? join(root, 'codex-gallery'));

if (!existsSync(coreDist)) {
  console.error('Core not built — run `pnpm --filter @flow-lines/core build` first');
  process.exit(1);
}
const { generateMachineCodex, toSVG } = await import(coreDist);

mkdirSync(outputDir, { recursive: true });

const W = 560;
const H = 700;
const SEEDS = [7, 42, 1337];

// Mirrors the web module's presets at gallery scale, plus the raw ends of the
// complexity axis.
const PRESETS = [
  ['codex', { style: 'codex', sketch: 0.3, wobble: 1.0 }],
  ['patent', { style: 'patent', sketch: 0, wobble: 0.15, annotations: 0.9, marginalia: 0.3 }],
  ['sketchbook', { style: 'codex', complexity: 0.4, marginalia: 0.9, sketch: 0.45 }],
  ['minimal', { complexity: 0.1, mechanisms: 0.2, annotations: 0.3, marginalia: 0 }],
  ['maximal', { complexity: 1, mechanisms: 1, annotations: 1, marginalia: 0.8 }],
];

const cells = [];
for (const [name, opts] of PRESETS) {
  for (const seed of SEEDS) {
    const label = `${name} · seed ${seed}`;
    const file = `${name}-s${seed}.svg`;
    const res = generateMachineCodex({ width: W, height: H, margin: 28, seed, ...opts });
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
  `<!doctype html><meta charset="utf-8"><title>Machine codex gallery</title>
<style>
  body { font: 14px system-ui; margin: 20px; background: #f4f1ea; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
  figure { margin: 0; }
  img { width: 320px; height: auto; background: white; border: 1px solid #ccc; }
  figcaption { text-align: center; color: #555; padding: 4px; }
</style>
<h1>Machine Codex — presets contact sheet</h1>
${rows}`
);
console.log(`\nwrote ${join(outputDir, 'index.html')}`);
