// Desire Lines — regenerates artwork-layer-{1,2,3}.svg (run: node concept-brainstorming/2026-10-15-0609/render.mjs concept-brainstorming/2026-10-15-0609 after `pnpm build`)
import { writeFileSync } from 'node:fs';
const { generatePhysarum, toSVGLayers, PAPER_SIZES } = await import('../../packages/core/dist/index.js');
const outDir = process.argv[2] ?? '.';
const W = 297 * 3, H = 420 * 3; // A3 portrait at 3 px/mm
const r = generatePhysarum({
  width: W, height: H, margin: 45, seed: 15,
  preset: 'network', style: 'paths', startLayout: 'scatter',
  pathFraction: 0.025, gridCols: 260, steps: 600,
});
const order = { rim: 1, mid: 2, core: 3 };
for (const { layer, svg } of toSVGLayers(r, { physicalWidth: 297, physicalHeight: 420, strokeWidth: 1 })) {
  writeFileSync(`${outDir}/artwork-layer-${order[layer]}.svg`, svg);
  console.log(layer, '->', order[layer]);
}
