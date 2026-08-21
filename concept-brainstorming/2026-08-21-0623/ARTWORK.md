# Three Earths

## Artist statement

`terraces` is the newest generator in this repository — extracted a few
sessions ago from `lapidary`'s `strata` mode to grow on its own, with
dedicated fault knobs, piecewise-flat "terrace tread" boundaries
(`steppiness`), and a per-region multi-pen carve it inherited but that,
as far as this studio's records go, nobody had used for anything but a
single black pen. This is its first outing, and the thing that struck me
scrolling its option list wasn't the fault machinery at all — it was
`steppiness`. Turned up near 1, the bed boundaries stop wandering like
strata and commit to flat, slightly uneven shelves. That is not what a
rock face does. It's what a compacted lift of *rammed earth* does.

Pisé — earth rammed course by course into formwork, each lift tamped
solid before the next goes in — is one of the oldest wall-building
techniques on the planet, and it happens to leave exactly this signature
in section: flat bands, a faint seam where each day's formwork sat, and
a texture that changes slightly from lift to lift because the soil batch
did. Three real earth-building traditions gave the three plates here
their palette, not their geometry — the geometry is the same recipe
(same course count, same texture cycle, same seam width) run at three
seeds, because that's the actual claim of the piece: a wall built from
Moroccan ochre loam and a wall built from Rhône Valley marl are the
*same act*, repeated with different dirt. Aït Benhaddou's kasbah walls
run warm ochre-red because the local clay does; the outback rammed-earth
tradition in the Flinders Ranges runs hot iron-red for the same reason;
pisé's own European heartland, the Dauphiné hills above Lyon where
François Cointeraux wrote the 18th-century manuals that exported the
technique across Europe, runs cool grey because its marl does. Same
generator, same eight courses, three different soils.

I did not expect the middle "clay" course to do what it does. `mottle`
— the interleaved two-line-family weave lapidary borrows from
`overlapped-lines` — keeps its two-ink identity even under
`per-region` pen assignment; the code comment calls this deliberate
("the two-ink weave is the point of that texture"). In practice it means
the clay-rich course in every plate quietly draws in *both* of that
plate's neighbouring inks, woven together, instead of committing to one.
I read it, after the fact, as the most honest thing in the piece: a real
lift of rammed earth is never one clean batch, it's whatever soil was
left in the mixer plus whatever went in next. The generator invented a
transition zone I hadn't asked for and wouldn't have known how to ask
for. That's the render I kept.

What earns this a wall, for me, is the same thing "Downthrow" found in
this generator's ancestor: total representational confidence borrowed
from a genre — the specimen plate, the geological survey board — applied
to something that isn't rock at all. But where Downthrow stayed
single-pen and forensic, this one leans on the feature Downthrow didn't
touch: nine inks, one per material per site, doing real material
science instead of describing it.

## Materials

- **Paper:** Fabriano Ingres, "Avana" (warm sand-grey), 90 gsm, A3
  (420 × 297 mm), landscape. A light, smooth-enough drawing paper — no
  wash or wet media in this piece, so weight and tooth aren't load-bearing
  the way they would be under a wash.
- **Inks — nine earths plus one index black**, all fine technical pens
  (e.g. a refillable 0.3–0.5 mm Rotring Isograph loaded with bottled
  drawing ink, or the closest fixed-width fineliner in each colour —
  hex is the source of truth, product names are a starting point):

  | # | Plate | Course | Ink | Hex | Width |
  |---|-------|--------|-----|-----|-------|
  | 1 | I — Aït Benhaddou, Morocco | aggregate | Burnt Sienna | `#B15A2E` | 0.45 mm |
  | 2 | I — Aït Benhaddou, Morocco | clay | Vandyke Brown | `#7B3A1D` | 0.30 mm |
  | 3 | I — Aït Benhaddou, Morocco | sand | Yellow Ochre | `#C9964F` | 0.30 mm |
  | 4 | II — Flinders Ranges, Australia | aggregate | Indian Red | `#9C3B2E` | 0.45 mm |
  | 5 | II — Flinders Ranges, Australia | clay | Burnt Carmine | `#5E2A20` | 0.30 mm |
  | 6 | II — Flinders Ranges, Australia | sand | Dusty Rose Madder | `#B67862` | 0.30 mm |
  | 7 | III — Dauphiné, France | aggregate | Warm Grey (taupe) | `#8A8172` | 0.45 mm |
  | 8 | III — Dauphiné, France | clay | Payne's Grey | `#4B4A47` | 0.30 mm |
  | 9 | III — Dauphiné, France | sand | Chalk Grey | `#9A9284` | 0.30 mm |
  | 10 | index | title / captions / frames / scale bar | Warm Black | `#1C1A17` | 0.20 mm |

  Nine named earths, ten pens total. Any pigmented drawing ink close to
  these hexes works — Winsor & Newton and Daler-Rowney's drawing-ink
  ranges both carry Burnt Sienna, Vandyke Brown, Yellow Ochre, Indian
  Red and Payne's Grey under those exact names, which is what the table
  above is built from.
- **Mounting (optional):** float-mount on warm-white board, narrow
  black-anodised aluminium frame — the piece is a specimen board, so a
  clinical mount suits it better than a heavy period frame.

## Process

1. Build the repo (`pnpm install && pnpm build`) and run the
   reproduction script below to generate the ten `artwork-layer-*.svg`
   files — one A3 landscape sheet, three plates plus the index layer,
   already registered to the same coordinate space (they were composited
   from one in-memory layout, not aligned by eye).
2. Tape the A3 Fabriano Ingres "Avana" sheet to the plotter bed,
   landscape orientation, registered to the bed's home corner. It stays
   taped for the whole job — all ten layers plot on the same
   registration, no realignment between passes.
3. Load the ten pens in the order below and plot each corresponding
   layer file in sequence, swapping pens between passes:
   1. `artwork-layer-01-plate1-aggregate-terracotta.svg` — Burnt Sienna, 0.45 mm
   2. `artwork-layer-02-plate1-clay-rust.svg` — Vandyke Brown, 0.30 mm
   3. `artwork-layer-03-plate1-sand-ochre.svg` — Yellow Ochre, 0.30 mm
   4. `artwork-layer-04-plate2-aggregate-ironred.svg` — Indian Red, 0.45 mm
   5. `artwork-layer-05-plate2-clay-maroon.svg` — Burnt Carmine, 0.30 mm
   6. `artwork-layer-06-plate2-sand-dustyrose.svg` — Dusty Rose Madder, 0.30 mm
   7. `artwork-layer-07-plate3-aggregate-taupe.svg` — Warm Grey, 0.45 mm
   8. `artwork-layer-08-plate3-clay-paynesgrey.svg` — Payne's Grey, 0.30 mm
   9. `artwork-layer-09-plate3-sand-chalk.svg` — Chalk Grey, 0.30 mm
   10. `artwork-layer-10-index-black.svg` — Warm Black, 0.20 mm (**plot
       last** — the title, the three plate frames and the scale bar sit
       exactly on the plates' own boundaries, and plotting the frame
       after the earth courses lets its crisp rule lines sit cleanly on
       top of the ragged course edges, like a mount line drawn over a
       specimen rather than under it)
4. No wash, no hand-finishing step is required — the piece is complete
   off the plotter. Sign in soft pencil in the lower-right margin if
   desired; there's no printed signature block.
5. Float-mount and frame as described above.

## Plot settings

- Paper: A3, landscape, 420 × 297 mm
- Sheet margin: 18 mm outer border, 15 mm gutters between plates (baked
  into the layout, not a CLI `--margin-mm` pass — this is a hand-composited
  multi-panel sheet, see Reproduction)
- Pen widths: 0.45 mm (aggregate courses), 0.30 mm (clay and sand
  courses), 0.20 mm (index layer) — see the materials table
- Plates: three panels, 118 × 196 mm each, 8 courses per plate
- Effective density: 4 px/mm (1680 × 1188 viewBox)
- Estimated travel across all ten layers: ≈146 m pen-down, ≈100 m
  pen-up (≈246 m total), 26,496 strokes, already nearest-neighbour
  chained and ordered per layer by `optimizePlot` — a long job best
  split across a few sessions if your plotter needs supervision for pen
  swaps
- Ten pen layers, none shared — see the materials table for the full
  ink/width assignment per layer

## Reproduction

Deterministic from three integer seeds (`7`, `44`, `58` — one per
plate) plus the shared course recipe and fixed layout constants. There
is no CLI command for `terraces` yet (core-only, see Wishes) and none
for compositing panels onto one sheet at all, so this calls
`generateTerraces`, `toSVGLayers`, `optimizePlot` and the internal
`stroke-font` module directly. Build the repo, save this as `pise.mjs`
**in the repo root** (it imports `packages/core/dist` by
relative-from-root path), then run:

```sh
pnpm install && pnpm build
node pise.mjs concept-brainstorming/2026-08-21-0623
```

```js
// pise.mjs — "Three Earths": a rammed-earth (pisé) course-sample
// compendium. Three A3-landscape panels, each an independent
// generateTerraces() cross-section (own seed, own 3-ink per-region pen
// assignment), composited by hand onto one sheet with a title, plate
// captions and a scale bar built from core's stroke-font.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const coreDist = join(process.cwd(), 'packages', 'core', 'dist', 'index.js');
const outDir = process.argv[2] ?? '.';
mkdirSync(outDir, { recursive: true });

const { generateTerraces, toSVG, toSVGLayers, optimizePlot } = await import(coreDist);
const { textToStrokes, textWidth } = await import(
  join(process.cwd(), 'packages', 'core', 'dist', 'stroke-font.js')
);

const PXPMM = 4;
const mm = (v) => v * PXPMM;

const SHEET_W_MM = 420;
const SHEET_H_MM = 297;
const OUTER_MM = 18;
const GUTTER_MM = 15;
const PANEL_W_MM = 118;
const PANEL_TOP_MM = 34;
const PANEL_H_MM = 196;
const CAPTION_GAP_MM = 6;

const panelX = [
  OUTER_MM,
  OUTER_MM + PANEL_W_MM + GUTTER_MM,
  OUTER_MM + 2 * (PANEL_W_MM + GUTTER_MM),
];

// Shared course recipe: coarse aggregate / dense clay / sand, cycled so
// pen 0/1/2 always carries the same material across all three plates.
const baseOpts = {
  bands: 8,
  irregularity: 0.24,
  steppiness: 0.85,
  faults: 0,
  baseAngleDeg: 0,
  angleDriftDeg: 5,
  waviness: 0.5,
  patchiness: 0.7,
  densityContrast: 0.35,
  toneStrength: 0.25,
  jitterDeg: 0.9,
  textures: [
    { kind: 'grain', spacingScale: 1.1, waviness: 0.55 },
    { kind: 'mottle', spacingScale: 0.9, patchiness: 0.85 },
    { kind: 'stipple', spacingScale: 1.1 },
  ],
  pens: 3,
  penAssignment: 'per-region',
};

const PANELS = [
  { id: 'p1', roman: 'I', place: 'AIT BENHADDOU, MOROCCO', note: 'OCHRE LOAM, RIVER GRAVEL', seed: 7 },
  { id: 'p2', roman: 'II', place: 'FLINDERS RANGES, AUSTRALIA', note: 'IRON-RED CLAY, QUARTZ GRIT', seed: 44 },
  { id: 'p3', roman: 'III', place: 'DAUPHINE, FRANCE', note: 'GREY MARL, CHALK FINES', seed: 58 },
];

const allLines = [];
function addPoly(points, layer) {
  if (points.length < 2) return;
  allLines.push({ points, layer });
}
function addText(text, x, y, sizeMm, layer, center = false) {
  const sizePx = mm(sizeMm);
  let ox = mm(x);
  if (center) ox -= textWidth(text, sizePx) / 2;
  for (const s of textToStrokes(text, ox, mm(y), sizePx)) addPoly(s, layer);
}
function addRect(x, y, w, h, layer) {
  addPoly(
    [
      { x: mm(x), y: mm(y) },
      { x: mm(x + w), y: mm(y) },
      { x: mm(x + w), y: mm(y + h) },
      { x: mm(x), y: mm(y + h) },
      { x: mm(x), y: mm(y) },
    ],
    layer
  );
}

addText('THREE EARTHS', SHEET_W_MM / 2, 8, 9, 'index', true);
addText('RAMMED-EARTH COURSE STUDIES, PLATES I-III, SCALE 1:5', SHEET_W_MM / 2, 21, 3, 'index', true);
addPoly(
  [
    { x: mm(OUTER_MM), y: mm(27) },
    { x: mm(SHEET_W_MM - OUTER_MM), y: mm(27) },
  ],
  'index'
);

for (const panel of PANELS) {
  const idx = PANELS.indexOf(panel);
  const x = panelX[idx];
  const wPx = Math.round(mm(PANEL_W_MM));
  const hPx = Math.round(mm(PANEL_H_MM));
  const res = generateTerraces({ width: wPx, height: hPx, margin: 0, seed: panel.seed, ...baseOpts });
  const ox = mm(x);
  const oy = mm(PANEL_TOP_MM);
  for (const line of res.lines) {
    const pts = line.points.map((p) => ({ x: p.x + ox, y: p.y + oy }));
    addPoly(pts, `${panel.id}-${line.layer ?? 'ink-0'}`);
  }
  addRect(x, PANEL_TOP_MM, PANEL_W_MM, PANEL_H_MM, 'index');
  const capY0 = PANEL_TOP_MM + PANEL_H_MM + CAPTION_GAP_MM;
  addText(`PLATE ${panel.roman}`, x, capY0, 3.4, 'index');
  addText(panel.place, x, capY0 + 6.5, 4.2, 'index');
  addText(panel.note, x, capY0 + 13.5, 2.8, 'index');
  addText(`SEED ${panel.seed} - 8 COURSES`, x, capY0 + 19, 2.8, 'index');
}

const scaleY = 288;
const scaleW = 20; // mm on paper = 100mm real at 1:5
const scaleX0 = SHEET_W_MM / 2 - scaleW / 2;
addPoly(
  [
    { x: mm(scaleX0), y: mm(scaleY) },
    { x: mm(scaleX0 + scaleW), y: mm(scaleY) },
  ],
  'index'
);
for (const tx of [scaleX0, scaleX0 + scaleW / 2, scaleX0 + scaleW]) {
  addPoly(
    [
      { x: mm(tx), y: mm(scaleY - 1.2) },
      { x: mm(tx), y: mm(scaleY + 1.2) },
    ],
    'index'
  );
}
addText('0', scaleX0, scaleY - 4, 2.4, 'index', true);
addText('100 MM', scaleX0 + scaleW, scaleY - 4, 2.4, 'index', true);
addText('SCALE 1 : 5', SHEET_W_MM / 2, scaleY + 5, 2.6, 'index', true);

let result = { lines: allLines, width: Math.round(mm(SHEET_W_MM)), height: Math.round(mm(SHEET_H_MM)), seed: 1 };
result = optimizePlot(result, { mergeTolerance: 0.6 });

const layers = toSVGLayers(result, {
  width: result.width,
  height: result.height,
  physicalWidth: `${SHEET_W_MM}mm`,
  physicalHeight: `${SHEET_H_MM}mm`,
});

const NAMES = {
  'p1-ink-0': '01-plate1-aggregate-terracotta',
  'p1-ink-1': '02-plate1-clay-rust',
  'p1-ink-2': '03-plate1-sand-ochre',
  'p2-ink-0': '04-plate2-aggregate-ironred',
  'p2-ink-1': '05-plate2-clay-maroon',
  'p2-ink-2': '06-plate2-sand-dustyrose',
  'p3-ink-0': '07-plate3-aggregate-taupe',
  'p3-ink-1': '08-plate3-clay-paynesgrey',
  'p3-ink-2': '09-plate3-sand-chalk',
  index: '10-index-black',
};
for (const layer of layers) {
  const name = NAMES[layer.layer] ?? layer.layer;
  writeFileSync(join(outDir, `artwork-layer-${name}.svg`), layer.svg);
}

// --- Combined colour preview (not a deliverable file; feeds svg-to-png).
// The ten layers above are what actually gets plotted — this is a second,
// colour-tagged export of the same `result` for rendering convenience only.
const COLORS = {
  'p1-ink-0': '#B15A2E', 'p1-ink-1': '#7B3A1D', 'p1-ink-2': '#C9964F',
  'p2-ink-0': '#9C3B2E', 'p2-ink-1': '#5E2A20', 'p2-ink-2': '#B67862',
  'p3-ink-0': '#8A8172', 'p3-ink-1': '#4B4A47', 'p3-ink-2': '#9A9284',
  index: '#1c1a17',
};
const previewSvg = toSVG(result, {
  physicalWidth: `${SHEET_W_MM}mm`,
  physicalHeight: `${SHEET_H_MM}mm`,
  layerColors: COLORS,
  strokeWidth: 1.1,
  includeBackground: true,
  backgroundColor: '#e3d9c3',
});
writeFileSync(join(outDir, 'preview-source.svg'), previewSvg);
```

```sh
node scripts/svg-to-png.mjs concept-brainstorming/2026-08-21-0623/preview-source.svg \
  concept-brainstorming/2026-08-21-0623/preview.png --width 1800 --background '#e3d9c3'
```

## Wishes

- `terraces` has no CLI command yet (core-only, like several recent
  additions) — everything here goes straight at
  `packages/core/dist/index.js`. It's a strong enough generator on its
  own terms that it probably deserves one; `lapidary`'s CLI surface
  (`--textures`, `--mode`, `--pens`) would mostly transfer.
- Multi-panel, multi-seed compositing onto one physical sheet (this
  piece, "LATENT", "Downthrow" before it) is a recurring studio need
  with no shared helper — every session re-derives panel-offset and
  caption-layout math by hand. A small "plate sheet" utility
  (N panel rects + captions + shared scale bar, given panel results
  already generated) would save real time.
- `SVGOptions.physicalWidth`/`physicalHeight` are typed `string`
  (`"420mm"`) but nothing in the JS build enforces that at the call
  site — passing a bare number silently produces an SVG whose `width`/
  `height` attributes are unitless (i.e. plotted as px, not mm). Worth
  a runtime guard or at least a JSDoc example, since a silently wrong
  physical size is exactly the kind of bug a plotter run only catches
  after the fact.
