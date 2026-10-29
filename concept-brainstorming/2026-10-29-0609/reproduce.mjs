// node concept-brainstorming/2026-10-29-0609/reproduce.mjs  (after pnpm build)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const { generateArctic, toSVGLayers } = await import(
  join(dirname(fileURLToPath(import.meta.url)), '../../packages/core/dist/index.js'));
const PX = 96 / 25.4;
const r = generateArctic({ width: 297 * PX, height: 420 * PX, margin: 25 * PX, seed: 7,
  preset: 'horizon', upright: true, order: 150 });
const out = dirname(fileURLToPath(import.meta.url));
for (const { layer, svg } of toSVGLayers(r, { strokeWidth: 0.3 * PX, physicalWidth: '297mm', physicalHeight: '420mm' })) {
  writeFileSync(join(out, `artwork-${layer}.svg`), svg);
  console.log(layer);
}
