// node concept-brainstorming/2026-10-13-0609/render.mjs <outDir>
import { writeFileSync } from 'node:fs';
const { generatePhysarum, toSVG } = await import('../../packages/core/dist/index.js');
const out = process.argv[2] ?? '.';
const base = { width: 842, height: 1191, margin: 40, seed: 42, preset: 'denseWeb', gridCols: 320 };
const opt = { optimize: true, physicalWidth: 297, physicalHeight: 420 };
// Layer 1: contour lines (the channels' banks). Layer 2: hatch (the flowing water), nudged ~1 mm.
writeFileSync(`${out}/artwork-layer-1.svg`, toSVG(generatePhysarum({ ...base, style: 'contour' }), opt));
const h = generatePhysarum({ ...base, style: 'hatch' });
const DX = 3, DY = 2; // px at 72/in ≈ 1.06 mm / 0.7 mm deliberate misregistration
const shifted = { ...h, lines: h.lines.map((l) => Array.isArray(l) ? l.map((p) => ({ ...p, x: p.x + DX, y: p.y + DY })) : { ...l, points: l.points.map((p) => ({ ...p, x: p.x + DX, y: p.y + DY })) }) };
writeFileSync(`${out}/artwork-layer-2.svg`, toSVG(shifted, opt));
