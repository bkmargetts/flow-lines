// node concept-brainstorming/2026-10-30-0614/render.mjs   (run from repo root, after pnpm build)
import { writeFileSync } from 'node:fs';
import { generateArctic, toSVGLayers } from '../../packages/core/dist/index.js';
const MM = 96 / 25.4; // px per mm
const W = 297, H = 420;
const res = generateArctic({
  width: W * MM, height: H * MM, margin: 15 * MM,
  seed: 21, preset: 'horizon', order: 150, upright: false,
});
const out = toSVGLayers(res, { strokeWidth: 1, physicalWidth: W, physicalHeight: H });
const names = { 'domino-n': 'artwork-layer-1-blue.svg', 'domino-s': 'artwork-layer-2-copper.svg' };
for (const { layer, svg } of out) writeFileSync(new URL(names[layer], import.meta.url), svg);
console.log(out.map((o) => o.layer));
