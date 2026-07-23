# Sheet 14 — Meander Belt of an Unrecorded River

## Artist statement

In 1944 Harold Fisk published a set of survey plates mapping every course
the Mississippi is known to have taken across its meander belt — each
historical channel position inked in its own colour, oldest to most
recent, so a single sheet reads as a river's whole biography at once.
Those plates are now framed and sold as art in their own right, decades
after their engineering purpose expired. This piece steals that
convention wholesale and points it at a river that was never surveyed,
because it doesn't exist: five ink passes over one migrating channel,
each an earlier snapshot of the *same* simulated erosion history, laid
down oldest (sepia) to newest (black) exactly the way an atlas sheet
would show a hundred years of avulsion in one glance.

The `meander` generator (new to this repo, unused by any prior session
here) simulates one channel migrating by curvature-driven bank erosion —
bends grow, translate downstream, and the river forgets its own past
except for what a cartographer chooses to keep. Rather than take its
single-colour "atlas" output as finished, I ran the same seed's
simulation forward to five different ages (45, 120, 200, 270 and 320
migration steps) and kept only the channel-bank lines from each run,
tagged each age its own ink, and composited them by hand onto one sheet.
Nothing here is a generator default — every one of the five passes is
the same river, caught mid-sentence at a different point in its life.

I ran this composite across a dozen seeds before keeping this one. Most
produced either a tangled knot with no legible sequence, or a river that
never really turned — flat, uneventful, nothing for the eye to follow.
Seed 61 does something the others didn't: four huge, cleanly separated
loops with real editorial weight, room to breathe in the upper right and
lower left, and a present-day channel bold enough to read as the
document's spine even with four other colours competing for attention
underneath it. It is cut off hard at both margins — the belt visibly
continues past the sheet edge on both sides. I chose to keep that rather
than tune it away: a real Fisk plate is one sheet from a larger atlas,
and a river that runs off the edge of Sheet 14 is more convincing than
one that conveniently ends exactly at the paper's border.

Nothing about the river, its name, or its survey history is real. Saying
so plainly, in the plate's own caption, in the plate's own hand-plotted
typeface, is the point — the same move this studio made with an
unrecorded fern a few sessions ago, now aimed at a different genre of
found document.

## Materials

- **Paper**: Hahnemühle Ingres Antique, Cream, 100gsm, A3 (297×420mm),
  landscape. A warm, lightly toned, mould-made printmaking stock — close
  enough to the buff linen the real 1944 plates were printed on, smooth
  enough for fine technical pens.
- **Pen 1 — Sepia (oldest channel, ~45 migration steps)**: Sakura Pigma
  Micron 005 (0.20mm), Sepia. Approximate swatch `#6B3A1A`.
- **Pen 2 — Teal (~120 steps)**: Faber-Castell PITT Artist Pen S (0.3mm),
  Deep Cobalt Turquoise. Approximate swatch `#1F6F62`.
- **Pen 3 — Terracotta (~200 steps)**: Faber-Castell PITT Artist Pen S
  (0.3mm), Burnt Sienna. Approximate swatch `#B34A2E`.
- **Pen 4 — Indigo (~270 steps)**: Faber-Castell PITT Artist Pen S
  (0.3mm), Indigo. Approximate swatch `#3C4A8C`.
- **Pen 5 — Present channel + plate furniture (320 steps, boldest,
  black)**: Sakura Pigma Micron 03 (0.35mm), Black. Approximate swatch
  `#131110`. Carries the modern channel banks, its interior flow lines,
  the neatline border, title block and scale bar — all the document's
  "current" apparatus in one archival black.
- All five inks are pigment-based, lightfast, and dry to the touch in
  under a minute — no wash or wet media anywhere in this piece.

## Process

1. Mount the A3 sheet on the plotter bed and home the machine. Do not
   remove the sheet again until step 6 — all five layers share the exact
   same coordinate space, so registration only holds if the paper never
   moves between pen swaps.
2. Fit Pen 1 (Sepia, 0.20mm). Plot `artwork-layer-1-sepia.svg` — the
   channel's earliest recorded position, two thin parallel bank lines.
3. Swap to Pen 2 (Teal, 0.3mm), same paper. Plot
   `artwork-layer-2-teal.svg`.
4. Swap to Pen 3 (Terracotta, 0.3mm). Plot
   `artwork-layer-3-terracotta.svg`.
5. Swap to Pen 4 (Indigo, 0.3mm). Plot `artwork-layer-4-indigo.svg`.
6. Swap to Pen 5 (Black, 0.35mm). Plot `artwork-layer-5-present.svg`
   last, so the modern channel, its water-line texture, and the plate's
   cartographic furniture (neatline, title block, scale bar) sit boldest
   and print over anything the four colours already laid down where
   courses cross.
7. Let the final pass cure ~5 minutes before handling. Float-mount or
   frame under glass; no other finishing.

## Plot settings

- Paper: A3, landscape (420×297mm), 18mm clear margin on all sides.
- Render density: 3px/mm (repo default).
- Pen widths: 0.20mm (Sepia), 0.3mm (Teal / Terracotta / Indigo), 0.35mm
  (Black — present channel + furniture).
- Seed: 61 (channel geometry, bank noise, hand-drawn wobble all derive
  from this single seed across all five passes).
- Path counts: Sepia 2, Teal 3, Terracotta 3, Indigo 5, Black 241
  (banks + flow-line texture + neatline + title/caption glyphs + scale
  bar) — every layer short enough that pen travel is not a practical
  concern on this sheet size.

## Reproduction

There is no CLI flag for "plot five ages of the same river as five
inks" — this piece calls the core `generateMeander` function directly,
five times at the same seed and increasing `iterations`, keeping only
each run's `channel`-tagged lines, then hand-builds the plate's neatline,
title block and scale bar with the repo's internal single-stroke font
(`stroke-font.ts`, not exported from the package barrel — used elsewhere
only by the `planet` generator's plate furniture). No source file was
changed; this is a scratch composition script over the public
`@flow-lines/core` API (plus one internal module import), run against a
built `pnpm install && pnpm build` checkout.

```js
import fs from 'node:fs';
import path from 'node:path';
import {
  generateMeander,
  toSVG,
  toSVGLayers,
  PAPER_SIZES,
  pageMetrics,
} from '@flow-lines/core'; // packages/core/dist/index.js
import { textToStrokes, textWidth } from '../../packages/core/dist/stroke-font.js';

const OUT = process.argv[2] || './chronology';

// ---- Physical page: A3 landscape ----
const a3 = PAPER_SIZES.find((p) => p.id === 'a3');
const PX_PER_MM = 3;
const MARGIN_MM = 18;
const pm = pageMetrics(a3, 'landscape', PX_PER_MM);
const { widthPx: W, heightPx: H } = pm;
const marginPx = MARGIN_MM * PX_PER_MM;

const SEED = 61;
const SHARED = {
  width: W,
  height: H,
  margin: marginPx,
  seed: SEED,
  preset: 'atlas',
  flowAngleDeg: 8,
  valleyWidth: 0.56,
  migration: 0.6,
  bendScale: 0.09,
  jitter: 0.35,
  refMinDim: 297 * PX_PER_MM,
};

// ---- Historical epochs: thin twin-bank channel snapshots, same seed & valley ----
const EPOCHS = [
  { iterations: 45, layer: 'epoch1', color: '#6B3A1A', name: 'Sepia' }, // oldest
  { iterations: 120, layer: 'epoch2', color: '#1F6F62', name: 'Teal' },
  { iterations: 200, layer: 'epoch3', color: '#B34A2E', name: 'Terracotta' },
  { iterations: 270, layer: 'epoch4', color: '#3C4A8C', name: 'Indigo' },
];

let allLines = [];
const layerColors = {};
const layerWidths = {};

for (const ep of EPOCHS) {
  const result = generateMeander({
    ...SHARED,
    iterations: ep.iterations,
    boldPasses: 1,
    flowLines: 0,
    oxbows: false,
    traces: 0,
  });
  const channelLines = result.lines
    .filter((l) => l.layer === 'channel')
    .map((l) => ({ ...l, layer: ep.layer }));
  allLines.push(...channelLines);
  layerColors[ep.layer] = ep.color;
  layerWidths[ep.layer] = PX_PER_MM * 0.25; // ~0.25mm fine pens for history
}

// ---- Present day: full atlas richness (bold banks, flow lines) ----
const present = generateMeander({
  ...SHARED,
  iterations: 320,
  boldPasses: 3,
  flowLines: 2,
  oxbows: false,
  traces: 0,
});
const presentLines = present.lines
  .filter((l) => l.layer === 'channel' || l.layer === 'oxbow')
  .map((l) => ({ ...l, layer: 'present' }));
allLines.push(...presentLines);
layerColors['present'] = '#131110';
layerWidths['present'] = PX_PER_MM * 0.35;

// ---- Plate furniture: neatline, title block, scale bar (all in 'present' black) ----
const furnitureLines = [];

const nlOuter = { x0: marginPx * 0.55, y0: marginPx * 0.55, x1: W - marginPx * 0.55, y1: H - marginPx * 0.55 };
const nlInner = { x0: marginPx * 0.7, y0: marginPx * 0.7, x1: W - marginPx * 0.7, y1: H - marginPx * 0.7 };
for (const nl of [nlOuter, nlInner]) {
  furnitureLines.push({
    points: [
      { x: nl.x0, y: nl.y0 }, { x: nl.x1, y: nl.y0 },
      { x: nl.x1, y: nl.y1 }, { x: nl.x0, y: nl.y1 }, { x: nl.x0, y: nl.y0 },
    ],
    layer: 'present',
  });
}

const titleX = marginPx * 1.3;
let titleY = H - marginPx * 1.55;
const addText = (text, size, y) => {
  for (const stroke of textToStrokes(text, titleX, y, size)) {
    furnitureLines.push({ points: stroke, layer: 'present' });
  }
};
addText('SHEET 14', 15, titleY);
addText('MEANDER BELT OF AN UNRECORDED RIVER', 10, titleY + 21);
addText(
  `SUCCESSIVE CHANNEL POSITIONS, OLDEST (SEPIA) TO PRESENT (BLACK) - SEED ${SEED} - FLOW LINES STUDIO`,
  6,
  titleY + 36
);

const sbSegMm = 10;
const sbSegs = 4;
const sbTotalPx = sbSegMm * sbSegs * PX_PER_MM;
const sbX1 = W - marginPx * 1.3;
const sbX0 = sbX1 - sbTotalPx;
const sbY = H - marginPx * 1.55;
const tick = 3.5 * PX_PER_MM;
furnitureLines.push({ points: [{ x: sbX0, y: sbY }, { x: sbX1, y: sbY }], layer: 'present' });
for (let i = 0; i <= sbSegs; i++) {
  const x = sbX0 + i * sbSegMm * PX_PER_MM;
  furnitureLines.push({ points: [{ x, y: sbY - tick }, { x, y: sbY + tick * 0.4 }], layer: 'present' });
}
for (let i = 0; i < sbSegs; i += 2) {
  const xa = sbX0 + i * sbSegMm * PX_PER_MM;
  const xb = xa + sbSegMm * PX_PER_MM;
  const hatchN = 6;
  for (let j = 1; j < hatchN; j++) {
    const x = xa + ((xb - xa) * j) / hatchN;
    furnitureLines.push({ points: [{ x, y: sbY - tick * 0.9 }, { x, y: sbY }], layer: 'present' });
  }
}
const addFurnitureText = (text, size, x, y) => {
  for (const stroke of textToStrokes(text, x, y, size)) {
    furnitureLines.push({ points: stroke, layer: 'present' });
  }
};
addFurnitureText('0', 5, sbX0, sbY + 5);
const kmLabel = `${sbSegMm * sbSegs} KM`;
addFurnitureText(kmLabel, 5, sbX1 - textWidth(kmLabel, 5), sbY + 5);

allLines.push(...furnitureLines);

const result = { lines: allLines, width: W, height: H, seed: SEED };

const layered = toSVGLayers(result, {
  layerColors,
  layerWidths,
  physicalWidth: `${pm.widthMm}mm`,
  physicalHeight: `${pm.heightMm}mm`,
  optimizePaths: true,
});
for (const { layer, svg } of layered) {
  fs.writeFileSync(`${OUT}.${layer}.svg`, svg);
}

// preview.png: rasterize the combined multi-colour SVG.
fs.writeFileSync(
  `${OUT}.svg`,
  toSVG(result, {
    layerColors,
    layerWidths,
    includeBackground: true,
    backgroundColor: '#f7f0dd',
    physicalWidth: `${pm.widthMm}mm`,
    physicalHeight: `${pm.heightMm}mm`,
    optimizePaths: true,
  })
);
// then: node scripts/svg-to-png.mjs OUT.svg preview.png --width 2200
```

Run with `node <script>.mjs ./out-prefix` against a built checkout
(`pnpm install && pnpm build`), then rename `out-prefix.epoch1.svg` →
`artwork-layer-1-sepia.svg`, `out-prefix.epoch2.svg` →
`artwork-layer-2-teal.svg`, `out-prefix.epoch3.svg` →
`artwork-layer-3-terracotta.svg`, `out-prefix.epoch4.svg` →
`artwork-layer-4-indigo.svg`, `out-prefix.present.svg` →
`artwork-layer-5-present.svg`, and rasterize `out-prefix.svg` (the
combined multi-colour document, not shipped in this folder) for the
preview.

## Wishes

- No CLI flag renders "this generator's state at several ages, each its
  own ink" — I had to call `generateMeander` five times by hand and
  filter each result down to one `FlowLine.layer` tag. A generic
  `--snapshot-ages 45,120,200,270` (any generator with a time-evolving
  sim: meander, conway, fracture) that emitted one extra split-layer per
  age would turn this from a scratch script into a one-line CLI call.
- Plate furniture (neatline, title block, scale bar) exists today only
  inside the `planet` generator (`furniture.ts`) and isn't reusable
  elsewhere — I ended up hand-placing text and tick marks with the
  unexported `stroke-font` module instead. A shared `plateFurniture()`
  helper (neatline + title block + scale bar, parametrized by page
  metrics) would serve this piece, any future landscape/meander plate,
  and probably a few pieces already in this folder.
