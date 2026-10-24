// Graben — regenerates artwork-layer-1..4.svg (run from repo root after `pnpm build`):
//   node concept-brainstorming/<this-folder>/make.mjs <outdir>
import { generateTerraces, TERRACES_PRESETS, toSVGLayers } from '../../packages/core/dist/index.js';
import fs from 'fs';
const outdir = process.argv[2] ?? '.';
const r = generateTerraces({
  width: 1260, height: 891, margin: 36, seed: 11,          // A3 landscape @ 3 px/mm, 12 mm margin
  ...TERRACES_PRESETS.rift,
  bands: 9, spacingPx: 4.5, pens: 4, penAssignment: 'interleave',
  sheetTone: 'light', sheetToneStrength: 0.5, toneStrength: 0.6,
  continuous: 'mixed', outlines: true,
});
const opt = { strokeWidth: 0.3 * 3, physicalWidth: '420mm', physicalHeight: '297mm' };
const n = { 'ink-0': 1, 'ink-1': 2, 'ink-2': 3, 'ink-3': 4 };
for (const { layer, svg } of toSVGLayers(r, opt)) fs.writeFileSync(`${outdir}/artwork-layer-${n[layer]}.svg`, svg);
