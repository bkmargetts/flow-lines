# Desire Lines

## Statement
A small isometric city, drawn in the rigid black pen of the planner, sits on a sheet of warm paper while a slime mould's transit network — contoured in vermilion — has grown *around* it. The veins arrive at the city, bend, and refuse to enter: they are the routes people would take if no one had built anything. Physarum is famous for rediscovering the Tokyo rail map; here it draws the map of the city that was never allowed. The red lines are occluded by the buildings (a mask built from the city's own strokes), so the two systems read as one flat print, plan versus appetite. It survived the cull over a dense-path version that smothered the city in red: restraint made the idea legible.

## Materials
- Paper: cream/ivory smooth cotton, ~160–200 gsm, A3 (297×420 mm), portrait. Hex approx #F2ECDC.
- Pen 1 (city): 0.4 mm black fineliner/pigment liner, e.g. Sakura Pigma Micron 04 — #111111.
- Pen 2 (slime): 0.4 mm vermilion/red gel or fineliner (e.g. Pilot G-Tec-C4 red, or Staedtler pigment liner red) — #C1272D.

## Process
1. Tape paper to the bed; set pen origin at the top-left of the sheet.
2. Plot `artwork-slime.svg` with the red pen (the vein contours; they are already trimmed around the city).
3. Let ink dry 5 min. Swap to the black pen without moving the paper.
4. Plot `artwork-city.svg` in black. Optional: mark a tiny registration dot with a pencil at paper corner before step 2 and re-check before step 4.
5. Optional hand step: a faint tea wash (cold black tea) over the paper, only outside the city footprint, before plotting, for a lived-in map tone.

## Plot settings
A3 portrait, 15 mm margin, both layers 0.4 mm pen, 3 px/mm render, no hold-off required (occlusion is baked in).

## Reproduction
Save the script below as `desire.mjs` at the repo root after `pnpm install && pnpm build`, run `node desire.mjs out 42 7`; output `artwork-city.svg` and `artwork-slime.svg` are byte-identical to this folder. Preview: merge the two SVGs (slime #c1272d under city #111, background #f2ecdc) and rasterize with `scripts/svg-to-png.mjs --width 1000`.

```js
import { writeFileSync, mkdirSync } from 'node:fs';
const core = await import('./packages/core/dist/index.js');
const { generateCity, generatePhysarum, toSVGLayers, resolvePaperSize, pageMetrics } = core;
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const cseed = +process.argv[3] || 42, pseed = +process.argv[4] || 7;
const pm = pageMetrics(resolvePaperSize('a3'), 'portrait', 3);
const W = pm.widthPx, H = pm.heightPx, m = 15 * pm.pxPerMm, pw = 0.4 * pm.pxPerMm;
const city = generateCity({ width: W, height: H, margin: m, seed: cseed, order: 0.9, style: 'mixed', penWidth: pw });
const ph = generatePhysarum({ width: W, height: H, margin: m, seed: pseed, preset: 'network', style: 'contour', contourLevels: 6, startLayout: 'scatter' });
// occupancy mask of the city, closed by flood fill, so the city occludes the vein
const G = 6, gw = Math.ceil(W / G), gh = Math.ceil(H / G), R = 2;
const occ = new Uint8Array(gw * gh);
for (const l of city.lines) {
  const p = l.points; for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[i + 1] ?? p[i]; const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / G));
    for (let k = 0; k <= n; k++) { const x = (a.x + (b.x - a.x) * k / n) / G | 0, y = (a.y + (b.y - a.y) * k / n) / G | 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < gw && yy < gh) occ[yy * gw + xx] = 1; } } } }
const out2 = new Uint8Array(gw * gh); const st = [0]; out2[0] = 1;
while (st.length) { const c = st.pop(), x = c % gw, y = c / gw | 0;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue; const j = yy * gw + xx; if (!out2[j] && !occ[j]) { out2[j] = 1; st.push(j); } } }
const inside = (p) => !out2[(p.y / G | 0) * gw + (p.x / G | 0)];
const slime = [];
for (const l of ph.lines) { let cur = [];
  const p = l.points;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[i + 1];
    const seg = b ? Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2)) : 1;
    for (let k = 0; k < seg; k++) { const q = b ? { x: a.x + (b.x - a.x) * k / seg, y: a.y + (b.y - a.y) * k / seg } : a;
      if (inside(q)) { if (cur.length > 1) slime.push({ ...l, points: cur }); cur = []; } else cur.push(q); } }
  if (cur.length > 1) slime.push({ ...l, points: cur }); }
const lines = [...city.lines.map((l) => ({ ...l, layer: 'city' })), ...slime.map((l) => ({ ...l, layer: 'slime' }))];
const res = { ...city, lines: core.optimizePlot ? lines : lines };
const o = { physicalWidth: `${pm.widthMm}mm`, physicalHeight: `${pm.heightMm}mm`, strokeWidth: pw };
for (const { layer, svg } of toSVGLayers(res, o)) writeFileSync(`${out}/artwork-${layer}.svg`, svg);
console.log(city.lines.length, slime.length);
```

## Wishes
- A first-class compose step to occlude one generator's lines by another's silhouette (done here by hand with a raster mask).
- A `city` CLI command.
