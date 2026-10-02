// Reproduce: node concept-brainstorming/2026-10-02-0609/render.mjs  (after pnpm build)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const { generateArctic, toSVGLayers, toSVG } = await import(join(here, '../../packages/core/dist/index.js'));
const PX = 3, MM = 297; // 297 x 297 mm sheet at 3 px/mm
const r = generateArctic({ width: MM * PX, height: MM * PX, margin: 18 * PX, seed: 7, preset: 'weave', order: 64 });
const opt = { strokeWidth: 0.35 * PX, physicalWidth: `${MM}mm`, physicalHeight: `${MM}mm` };
const order = ['domino-n', 'domino-e', 'domino-s', 'domino-w'];
const layers = toSVGLayers(r, opt);
order.forEach((name, i) => {
  const l = layers.find((x) => x.layer === name);
  writeFileSync(join(here, `artwork-layer-${i + 1}.svg`), l.svg);
});
const cols = { 'domino-n': '#e8b84a', 'domino-e': '#4aa3c9', 'domino-s': '#d9503c', 'domino-w': '#9fd18b' };
writeFileSync(join(here, '.combined.svg'), toSVG(r, { ...opt, layerColors: cols, includeBackground: true, backgroundColor: '#14151c' }));
