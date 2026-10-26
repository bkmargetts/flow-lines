// Reproduces artwork-layer-1.svg (city) and artwork-layer-2.svg (slime).
// Run from the repo root after `pnpm build`:  node concept-brainstorming/2026-10-26-0609/make.mjs
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const { generateCity, generatePhysarum, toSVGLayers } = await import('../../packages/core/dist/index.js');
const W = 297, H = 420, M = 18;
const city = generateCity({ width: W, height: H, margin: M, seed: 5, order: 0.9, style: 'brownstone',
  penWidth: 0.25, blockCols: 9, blockRows: 13, lotSize: 14, street: 6, buildingHeight: 10, windows: 0.3 });
const slime = generatePhysarum({ width: W, height: H, margin: M, seed: 27, preset: 'denseWeb',
  style: 'contour', steps: 500, gridCols: 240, contourLevels: 4 });
const tag = (r, layer) => r.lines.map((l) => ({ ...l, layer }));
const res = { width: W, height: H, lines: [...tag(city, 'city'), ...tag(slime, 'slime')] };
const svgs = toSVGLayers(res, { strokeWidth: 0.3, physicalWidth: '297mm', physicalHeight: '420mm',
  layerColors: { city: '#2b3a55', slime: '#b5532a' } });
for (const { layer, svg } of svgs) {
  writeFileSync(`${here}/artwork-layer-${layer === 'city' ? 1 : 2}.svg`, svg);
  console.log(layer);
}
