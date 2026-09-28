# Arctic Circle

## Artist statement

Three plates, each a uniformly random domino tiling of the Aztec diamond,
drawn at increasing order — n = 24, 95, 240. Domino shuffling
(Elkies–Kuperberg–Larsen–Propp) samples the tiling *exactly*: no Markov
chain, no burn-in, no mixing time to argue about. And at every order the
same shape shows up anyway — a solid frozen mass at one pole, a sharp
curved edge, disorder inside it. That's the **arctic circle theorem**
(Jockusch–Propp–Shor, 1998): as n grows the frozen corners become perfect
brick and the boundary between order and chaos sharpens into a circle
inscribed in the diamond. Nothing in the sampling algorithm ever mentions
a circle. The three plates are the proof, run at increasing resolution,
left to speak for itself — the classic printmaker's move of showing the
same plate pulled at different states, except here the "state" is a
combinatorial limit, not wear on a copper plate.

The generator only inks one of the four domino classes, so the tiling's
own statistics carry the tone: solid welded rules where that class froze,
blank paper where the other three froze, broken dashes where the tiling
stayed liquid. Every stroke already tells you which regime it's in by its
own length, so I split the drawing along that seam — anything under three
domino-widths long is *chaos*, anything longer is *order* — a partition
read directly off the geometry, not painted on afterward. Order plots
once, in black, and stays one decisive edge. Chaos plots **twice**: once
in black with everything else, then again in a cold blue pre-shifted a
hair's width off the first pass, so the disordered two-thirds of each
plate reads as a doubled, faintly drifting field — ice just starting to
break up — while the frozen mass above it never moves.

Of a wide field of candidates — dense four-class weaves, every-domino
brick outlines, a 45°-rotated framing that puts the frozen corner in the
page corner like a breaking wave — this is the one I kept. The others
were decoration laid on top of the theorem. This one just lets the
theorem draw itself, three times, at three resolutions, and adds only the
smallest possible physical gesture (one ink, offset) to mark which part
of the drawing is certain and which isn't yet.

## Materials

- **Paper** — Fabriano Artistico Extra White, Hot Press, 300gsm, a single
  A3 sheet (420 × 297mm, landscape). Hot press for a smooth, tooth-free
  surface: at n = 240 the finest welded rules are well under a
  millimetre wide, and a cold-press tooth would skip the nib.
- **Ink 1 (order pass)** — Sakura Pigma Micron 03, **Black** (PN‑101),
  0.3mm archival pigment fineliner. Plots the title block, both
  captions, the rule, every "order" (frozen/welded) stroke, and every
  "chaos" (disordered) stroke once.
- **Ink 2 (ghost pass)** — Sakura Pigma Micron 03, **Blue**, 0.3mm.
  Re-plots only the "chaos" strokes, pre-shifted 0.15mm right / 0.08mm
  down in the file's own coordinates.

## Process

1. Tape the A3 sheet to the plotter bed, landscape.
2. Load the Black Micron. Plot `artwork-layer-1.svg`. This single pass is
   already a complete, valid drawing (the title, both rules of text, and
   every stroke of all three plates, entirely in black) — it's the
   "if you stopped here" state.
3. Let the black ink dry (~5 minutes is enough for a fineliner on hot
   press). **Do not move, unmount, or re-register the paper.**
4. Swap to the Blue Micron. Plot `artwork-layer-2.svg` directly on top of
   the same sheet, same mount. This file contains only the "chaos"
   strokes from all three plates, already shifted 0.15mm right / 0.08mm
   down in its own coordinate space — the registration drift is baked
   into the geometry, so no physical paper nudge is needed or wanted.
5. Let dry. No wash, no mask, no further hand step: the two-ink offset
   *is* the whole physical gesture, and adding more would blur the point
   (that restraint is doing the work everywhere else in the piece).
6. Optional: float-mount on a slightly larger black or dark-slate board,
   generous margin, no visible mat line — the paper's own white border
   is already the frame.

## Plot settings

- Paper: A3, landscape (420 × 297mm), single sheet.
- Pen width: 0.3mm, both passes.
- Vector render resolution used to generate the geometry: 4px/mm
  (affects only internal coordinate precision, not the physical plot).
- Registration offset (pass 2 vs pass 1): +0.15mm x, +0.08mm y, pre-baked
  into `artwork-layer-2.svg` — plot both files at the same paper mount.
- Stroke counts: pass 1 (`artwork-layer-1.svg`) ≈ 8,100 strokes (197
  title/caption/rule + 1,255 order + 6,648 chaos); pass 2
  (`artwork-layer-2.svg`) ≈ 6,648 strokes (the chaos set, repeated).
  Each plate's own strokes are reordered by `generateArctic`'s internal
  `orderPlot` (nearest-neighbour chaining without fusing separate
  dominoes into one path, which would round-cap the joins and soften the
  lattice) before this script's own panel placement.

## Reproduction

Requires `pnpm install && pnpm build` from the repo root first (builds
`packages/core/dist`, including the internal `stroke-font` module used
for the plate titling — not part of the public barrel export, but a real
build artifact safe to import directly from a scratch script).

Save as `compose.mjs` and run:

```
node compose.mjs concept-brainstorming/2026-09-28-0620 "24,95,240" 7 0.3 4 "#0d0d0d" "#1e5a94" 0.15 0.08
```

```js
// Three arctic-circle plates (increasing diamond order) on one A3
// landscape sheet, classified per-stroke into "order" (welded, long runs
// — the frozen corner) vs "chaos" (short, unwelded dashes — inside the
// arctic circle) by polyline length. Emits:
//   artwork-layer-1.svg — everything (order + chaos + titling), pass 1 ink
//   artwork-layer-2.svg — chaos strokes only, pre-shifted by a fixed
//                         registration offset, pass 2 ink
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const coreDist = 'packages/core/dist/index.js';
const strokeFontDist = 'packages/core/dist/stroke-font.js';

const { generateArctic, toSVG, pageMetrics, resolvePaperSize, orientedDimsMm } = await import(coreDist);
const { textToStrokes, textWidth } = await import(strokeFontDist);

const outDir = process.argv[2] ?? 'arctic-out';
const orders = (process.argv[3] ?? '25,95,230').split(',').map(Number);
const seed = Number(process.argv[4] ?? 7);
const penWidthMm = Number(process.argv[5] ?? 0.3);
const pxPerMm = Number(process.argv[6] ?? 4);
const orderInk = process.argv[7] ?? '#0d0d0d';
const ghostInk = process.argv[8] ?? '#3f6a96';
const offsetMmX = Number(process.argv[9] ?? 0.15);
const offsetMmY = Number(process.argv[10] ?? 0.08);

mkdirSync(outDir, { recursive: true });

function pathLen(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return d;
}

const size = resolvePaperSize('a3');
const { widthMm, heightMm } = orientedDimsMm(size, 'landscape');
const page = pageMetrics(size, 'landscape', pxPerMm);
const W = page.widthPx;
const H = page.heightPx;
const k = page.pxPerMm;

const panelMm = 115;
const gapMm = 20;
const sideMm = (widthMm - 3 * panelMm - 2 * gapMm) / 2;
const titleTopMm = 34;
const ruleMm = titleTopMm + 10;
const labelGapMm = 12;
const panelTopMm = ruleMm + 16 + (heightMm - (ruleMm + 16) - (panelMm + labelGapMm + 10) - 22) / 2;

const titleLines = [];
function addStrokes(target, strokes) {
  for (const pts of strokes) target.push({ points: pts });
}

const title = 'ARCTIC CIRCLE';
const titleSize = 8.5 * k;
addStrokes(titleLines, textToStrokes(title, (W - textWidth(title, titleSize)) / 2, 8 * k, titleSize));
const sub = 'THREE UNIFORM RANDOM DOMINO TILINGS OF THE AZTEC DIAMOND';
const subSize = 3.1 * k;
addStrokes(titleLines, textToStrokes(sub, (W - textWidth(sub, subSize)) / 2, 20 * k, subSize));
titleLines.push({
  points: [
    { x: sideMm * k, y: ruleMm * k },
    { x: (widthMm - sideMm) * k, y: ruleMm * k },
  ],
});

const orderLines = []; // frozen / welded — crisp single pass
const chaosLines = []; // disordered / unwelded — gets the ghost pass too

for (let i = 0; i < orders.length; i++) {
  const order = orders[i];
  const panelPx = Math.round(panelMm * k);
  const panelMarginPx = Math.round(6 * k);
  const res = generateArctic({
    width: panelPx,
    height: panelPx,
    margin: panelMarginPx,
    seed,
    preset: 'dissolve',
    order,
    upright: false,
  });
  const xOff = Math.round((sideMm + i * (panelMm + gapMm)) * k);
  const yOff = Math.round(panelTopMm * k);

  const lens = res.lines.map((l) => pathLen(l.points)).filter((d) => d > 0);
  const minLen = Math.min(...lens);
  const threshold = minLen * 3;

  for (let j = 0; j < res.lines.length; j++) {
    const pts = res.lines[j].points.map((p) => ({ x: p.x + xOff, y: p.y + yOff }));
    const bucket = lens[j] > threshold ? orderLines : chaosLines;
    bucket.push({ points: pts });
  }

  const roman = ['I', 'II', 'III'][i] ?? String(i + 1);
  const caption = `PLATE ${roman}  ·  N = ${order}  ·  ${res.lines.length.toLocaleString('en-US')} EDGES`;
  const capSize = 2.9 * k;
  const capW = textWidth(caption, capSize);
  const cx = xOff + panelPx / 2 - capW / 2;
  const cy = yOff + panelPx + labelGapMm * k;
  addStrokes(titleLines, textToStrokes(caption, cx, cy, capSize));
}

const dx = offsetMmX * k;
const dy = offsetMmY * k;
const chaosGhost = chaosLines.map((l) => ({ points: l.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }));

const paperSvg = { physicalWidth: `${widthMm}mm`, physicalHeight: `${heightMm}mm` };

// Pass 1 — everything, single black pen.
const layer1 = { lines: [...titleLines, ...orderLines, ...chaosLines], width: W, height: H, seed };
writeFileSync(
  resolve(outDir, 'artwork-layer-1.svg'),
  toSVG(layer1, { optimize: true, strokeWidth: penWidthMm * k, strokeColor: orderInk, ...paperSvg }),
  'utf-8'
);

// Pass 2 — chaos strokes only, pre-shifted, second ink.
const layer2 = { lines: chaosGhost, width: W, height: H, seed };
writeFileSync(
  resolve(outDir, 'artwork-layer-2.svg'),
  toSVG(layer2, { optimize: true, strokeWidth: penWidthMm * k, strokeColor: ghostInk, ...paperSvg }),
  'utf-8'
);

// Preview merge — both passes composited (not a plot file — for the raster preview only).
const preview = {
  lines: [
    ...titleLines.map((l) => ({ ...l, layer: 'a-black' })),
    ...orderLines.map((l) => ({ ...l, layer: 'a-black' })),
    ...chaosLines.map((l) => ({ ...l, layer: 'a-black' })),
    ...chaosGhost.map((l) => ({ ...l, layer: 'b-ghost' })),
  ],
  width: W,
  height: H,
  seed,
};
writeFileSync(
  resolve(outDir, '_preview-merge.svg'),
  toSVG(preview, {
    optimize: false,
    strokeWidth: penWidthMm * k,
    preserveLayerOrder: true,
    layerColors: { 'a-black': orderInk, 'b-ghost': ghostInk },
    includeBackground: true,
    backgroundColor: '#fbfaf6',
    ...paperSvg,
  }),
  'utf-8'
);
```

Then rasterize the preview (not a plot file, just the approximation):

```
node scripts/svg-to-png.mjs concept-brainstorming/2026-09-28-0620/_preview-merge.svg concept-brainstorming/2026-09-28-0620/preview.png --width 2200
```

(`_preview-merge.svg` is a working file — delete it after rasterizing;
only `artwork-layer-1.svg`, `artwork-layer-2.svg`, and `preview.png` are
committed.)

## Wishes

- `arctic` (the domino-tiling / arctic-circle-theorem generator) has no
  CLI command yet — everything above goes through a scratch script
  against `packages/core/dist` directly, same as `city`. A `flow-lines
  arctic` command would make this reproducible without reading source.
- No shared "plate grid" helper exists for laying out N independent
  generator calls as labelled panels on one sheet (title block, rule,
  per-panel captions, panel placement) — I hand-rolled it here and
  suspect most multi-panel brainstorming pieces reinvent the same
  handful of lines. Worth lifting into a small core/CLI utility if the
  pattern recurs.
- `arctic`'s output doesn't tag which regime (frozen vs liquid) a stroke
  belongs to, even though the generator computes exactly that
  distinction internally (`dominoClass` + which classes are "inked").
  I recovered it from polyline length as a proxy, which works but is a
  guess from outside; a `regime: 'frozen' | 'liquid'` tag on each
  `FlowLine` would make this kind of order/chaos split a first-class,
  exact operation instead of a length heuristic.
