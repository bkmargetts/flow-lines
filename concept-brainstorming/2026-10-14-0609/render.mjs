// Reproduces every SVG in this folder:  node concept-brainstorming/2026-10-14-0609/render.mjs
import { generateArctic, toSVG } from '../../packages/core/dist/index.js';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const out = dirname(fileURLToPath(import.meta.url));
const r = generateArctic({ width: 297, height: 420, margin: 15, seed: 3, marks: 'all', upright: true, order: 90 });
const pens = { 'domino-n': 1, 'domino-e': 2, 'domino-s': 3, 'domino-w': 4 };
writeFileSync(join(out, 'artwork.svg'), toSVG(r, { strokeWidth: 0.4 }));
for (const [layer, n] of Object.entries(pens)) {
  writeFileSync(join(out, `artwork-layer-${n}.svg`),
    toSVG({ ...r, lines: r.lines.filter((l) => l.layer === layer) }, { strokeWidth: 0.4 }));
}
if (process.argv[2]) {
  const cols = { 'domino-n': '#f2efe6', 'domino-e': '#46c2b0', 'domino-s': '#f08a7e', 'domino-w': '#e8b94a' };
  writeFileSync(process.argv[2], toSVG(r, { strokeWidth: 0.4, layerColors: cols }));
}
