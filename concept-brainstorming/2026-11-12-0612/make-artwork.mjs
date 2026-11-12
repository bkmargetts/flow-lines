// Precipitate — reproduces artwork.svg byte-for-byte.
// From the repo root, after `pnpm install && pnpm build`:
//   node concept-brainstorming/<this-folder>/make-artwork.mjs <this-folder>
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { generateArctic, toSVG } = await import(new URL('../../packages/core/dist/index.js', import.meta.url));

const outDir = process.argv[2] ?? '.';
const SEED = 58;                      // drop i uses SEED + i
const ORDERS = [6, 12, 24, 48, 96];   // Aztec diamond order, doubling top → bottom
const PEN = 0.2;                      // mm — the one pen for the whole sheet
const WEIGHT = 0.4;                   // bar weight as a fraction of the domino unit
const PX = 4;                         // px per mm
const Wmm = 297, Hmm = 420;           // A3 portrait
const W = Wmm * PX, H = Hmm * PX;
const MARGIN = 30 * PX, GAP = 6 * PX;
const cell = (H - 2 * MARGIN - (ORDERS.length - 1) * GAP) / ORDERS.length;

const drops = ORDERS.map((n, i) => {
  const r = generateArctic({ width: cell, height: cell, margin: 0, seed: SEED + i, preset: 'dissolve', order: n });
  // Weight scales with the domino, so every drop carries the same relative ink:
  // one fixed pen, with coarse bars built from stacked offset passes.
  const unitMm = cell / PX / (2 * n);
  const weight = Math.max(PEN, unitMm * WEIGHT);
  const passes = Math.max(1, Math.ceil((weight - PEN) / (PEN * 0.75)) + 1);
  const step = passes > 1 ? (weight - PEN) / (passes - 1) : 0;
  const dx = (W - cell) / 2, dy = MARGIN + i * (cell + GAP);
  const lines = [];
  for (const l of r.lines) for (let p = 0; p < passes; p++) {
    const oy = (p - (passes - 1) / 2) * step * PX;
    lines.push({ points: l.points.map((q) => ({ x: q.x + dx, y: q.y + dy + oy })), layer: `drop-${i + 1}` });
  }
  return lines;
});
// Plot order: finest drop first (fresh nib), coarsest last.
const lines = drops.reverse().flat();
const res = { lines, width: W, height: H, seed: SEED };
writeFileSync(join(outDir, 'artwork.svg'), toSVG(res, { physicalWidth: Wmm, physicalHeight: Hmm, strokeWidth: PEN * PX, preserveLayerOrder: true }));
let len = 0;
for (const l of lines) for (let j = 1; j < l.points.length; j++) len += Math.hypot(l.points[j].x - l.points[j - 1].x, l.points[j].y - l.points[j - 1].y);
console.log(`${lines.length} strokes, ${(len / PX / 1000).toFixed(1)} m of line`);
