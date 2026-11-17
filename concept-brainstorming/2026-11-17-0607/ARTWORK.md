# Where We Agree

*Three inks, one A3 sheet, plotted. 2026-11-17.*

## Artist statement

Take an Aztec diamond, a stepped square tipped on its point, and tile it
with dominoes chosen *exactly uniformly at random* from the
astronomically many tilings it allows. Do it three times with three
different seeds and give each tiling its own ink. Only the two classes of
horizontal domino are drawn. Plot all three passes onto the same sheet.

Near the top and bottom tips, combinatorics leaves no freedom. Every
tiling is forced into the same brick courses there, so all three inks
land on exactly the same rules. Transparent yellow, red and blue printed
over each other make a dark neutral, so those caps print **black**,
the colour of all three agreeing. Inside a circle inscribed in the
diamond the tilings are free. Each seed makes its own choices and the
inks separate into scattered yellow, red, blue, green, orange and violet
dashes. Here and there two or three of them agree by chance and a short
black dash appears in the middle of the colour.

The circle itself is never drawn. It is the *arctic circle* of
Jockusch–Propp–Shor (1998), a theorem rather than a shape in the code.
Here it is the line where agreement stops and colour begins. The left
and right corners are frozen too, but in the vertical classes, which no
pen draws, so they stay as clean paper. That blank paper cuts the tall
lens shape out of the diamond.

**Why this one survived.** This was the first studio session to use the
`arctic` generator. Its single-pen presets (`dissolve`, `horizon`,
`brick`, `weave`, all four inks on one tiling) were all rendered first.
They show the theorem as a tone gradient, but they read as diagrams. The
idea that turned it into a picture was to overprint *several
independent samples*. Then the frozen region becomes visible as
consensus rather than density, and the ink chemistry does the arithmetic:
three colours on the same line make black. Other options were tried and
dropped:

- marking a single class (the registration drifts, because each seed's
  inked bounding box differs);
- orders 60, 72, 90, 128 and 140 (too coarse, or the colour turns to mud
  at A3);
- a small diamond floating in a lot of paper.

Up close the result reads like an ikat or a woven selvedge. From across a
room it is a dark seed with a bright, unsettled core.

## Materials

| Item | Spec |
|---|---|
| Paper | Hot-press cotton rag, 300 gsm, warm white (e.g. Fabriano Artistico Traditional White HP, or Arches HP natural white) ≈ `#f4eee1`, cut to **A3, 297 × 420 mm, portrait** |
| Pens | Three refillable 0.35 mm plotter pens: technical pen (Rotring Isograph 0.35) or a fountain-pen plotter adapter. One pen per ink, never shared. |
| Ink 1, yellow | Transparent dye ink, warm cadmium-yellow hue ≈ `#f2b705` (e.g. Diamine *Sunshine Yellow*) |
| Ink 2, red | Transparent dye ink, vermilion hue ≈ `#d23c1e` (e.g. Diamine *Poppy Red*) |
| Ink 3, blue | Transparent dye ink, deep ultramarine/Prussian hue ≈ `#1d4f91` (e.g. Diamine *Prussian Blue*) |
| Other | Low-tack drafting tape, a scrap sheet of the same paper for swatches, a 4-ply window mat with a 270 × 395 mm aperture (it hides the registration crosses) |

The inks **must be transparent dye inks**, not opaque pigment or
acrylic markers. The whole piece depends on the overprint turning the
caps black. Before the real run, plot a 3 × 3 swatch on scrap paper: each
ink alone, then each pair and all three over each other. Check that the
triple overprint reads as a near-black neutral. If it reads as brown, use
a stronger blue.

## Process

1. Tape the A3 sheet to the plotter bed, portrait, with tape at all four
   corners outside the registration crosses. **Leave it in place for all
   three passes.** Registration depends on the sheet not moving.
2. **Pass 1, yellow:** plot `artwork-layer-1-yellow.svg` with the yellow
   pen. (Seed 1.)
3. Let it dry for **20 minutes**. Dye ink on hot-press stays wet longer
   than you expect, and a wet line will smear under the next nib.
4. **Pass 2, red:** plot `artwork-layer-2-red.svg` with the red pen.
   (Seed 2.) Before committing, check the first registration cross: it
   should sit exactly on the yellow cross.
5. Let it dry for 20 minutes.
6. **Pass 3, blue:** plot `artwork-layer-3-blue.svg` with the blue pen.
   (Seed 3.) Blue goes last on purpose: dark over light hides any
   sub-millimetre misregistration, as in printmaking.
7. Let it dry overnight. Sign in pencil, lower right, under the mat line.
8. Float the sheet behind the window mat so the crosses are hidden. A
   slight colour fringe on the black caps, where the passes are a
   hair off register, is expected and welcome. It is the evidence that
   three separate drawings agree.

`artwork.svg` is the composite preview (all three layers, multiply
blend). It is a reference only. **Do not plot it.**

## Plot settings

- Sheet: A3 portrait, 297 × 420 mm. The SVGs are authored at that size
  (`width="297mm"`, 4 px/mm viewBox 1188 × 1680). Plot at 100 %, no
  fitting.
- Drawing: the diamond is 350 mm from apex to apex, centred on the
  sheet. The ink field is about 250 mm wide.
- Pen: 0.35 mm, all three layers. Row pitch is 1.75 mm, so there is
  about 1.4 mm of paper between rules.
- Per layer: about 2,400 strokes and about 18 m of line. Strokes are
  reordered (`orderPlot`) but deliberately **not** chained, so every
  domino run stays its own crisp stroke.
- Expect about 40–60 minutes per pass at typical AxiDraw speeds,
  dominated by pen lifts.

## Reproduction

All four SVGs come from one scratch script that drives the core
`generateArctic` generator. It uses the generator's configuration only:
order 100, `marks: 'horizontals'`, wobble 0.3, seeds **1, 2, 3**. It
re-fits each tiling's position so that the seed-invariant frozen apexes
register exactly across the three layers. (The generator fits the
*inked* bounding box, which drifts with each seed's liquid region.) The
output is deterministic and byte-identical across runs (verified).

```sh
pnpm install && pnpm build
# save the script below as where-we-agree.mjs, then from the repo root:
node where-we-agree.mjs concept-brainstorming/2026-11-17-0607
node scripts/svg-to-png.mjs concept-brainstorming/2026-11-17-0607/artwork.svg \
  concept-brainstorming/2026-11-17-0607/preview.png --width 2000 --background '#f4eee1'
```

```js
// Where We Agree — three exact random domino tilings of the same Aztec diamond,
// one per ink, normalised onto a shared registration and overprinted.
// Run from the repo root after `pnpm install && pnpm build`:
//   node where-we-agree.mjs <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const { generateArctic, toSVG } = await import(resolve('packages/core/dist/index.js'));

const OUT = process.argv[2] ?? '.';
mkdirSync(OUT, { recursive: true });

const PX_PER_MM = 4;
const W = 297 * PX_PER_MM, H = 420 * PX_PER_MM; // A3 portrait
const ORDER = 100;            // AD(100): 10,100 dominoes per tiling
const SPAN = 350 * PX_PER_MM; // diamond apex-to-apex height on the sheet
const PEN = 0.35 * PX_PER_MM; // 0.35 mm nib
const INKS = [
  { seed: 1, name: 'yellow', hex: '#f2b705' },
  { seed: 2, name: 'red', hex: '#d23c1e' },
  { seed: 3, name: 'blue', hex: '#1d4f91' },
];

// Registration crosses 12 mm in from each corner, drawn in every layer.
const reg = [];
for (const [cx, cy] of [[12, 12], [285, 12], [12, 408], [285, 408]]) {
  const x = cx * PX_PER_MM, y = cy * PX_PER_MM, r = 3 * PX_PER_MM;
  reg.push([{ x: x - r, y }, { x: x + r, y }], [{ x, y: y - r }, { x, y: y + r }]);
}

const mean = (pts, k) => pts.reduce((a, p) => a + p[k], 0) / pts.length;
const all = [];
for (const [i, ink] of INKS.entries()) {
  const r = generateArctic({
    width: W, height: H, margin: 110, seed: ink.seed,
    order: ORDER, marks: 'horizontals', upright: false, wobble: 0.3,
  });
  // generateArctic fits the INKED bounding box, which varies with the seed's
  // liquid region. The frozen apexes don't: re-fit every tiling so its top and
  // bottom apex land on the same page points — the shared registration.
  let y0 = Infinity, y1 = -Infinity, top = null, bot = null;
  for (const l of r.lines) {
    const my = mean(l.points, 'y');
    if (!top || my < top.my) top = { my, l };
    if (!bot || my > bot.my) bot = { my, l };
    for (const p of l.points) { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  }
  const k = SPAN / (y1 - y0);
  const cx = (mean(top.l.points, 'x') + mean(bot.l.points, 'x')) / 2, cy = (y0 + y1) / 2;
  const layer = `ink-${i + 1}-${ink.name}`;
  const lines = r.lines.map((l) => ({
    layer,
    points: l.points.map((p) => ({ x: W / 2 + (p.x - cx) * k, y: H / 2 + (p.y - cy) * k })),
  }));
  for (const pts of reg) lines.push({ layer, points: pts });
  all.push(...lines);
  const svg = toSVG({ lines, width: W, height: H, seed: ink.seed }, {
    strokeColor: ink.hex, strokeWidth: PEN, physicalWidth: '297mm', physicalHeight: '420mm',
  });
  writeFileSync(join(OUT, `artwork-layer-${i + 1}-${ink.name}.svg`), svg);
  const len = lines.reduce((a, l) => a + l.points.slice(1).reduce((s, p, j) => s + Math.hypot(p.x - l.points[j].x, p.y - l.points[j].y), 0), 0);
  console.log(`${layer}: seed ${ink.seed}, ${lines.length} strokes, ${(len / PX_PER_MM / 1000).toFixed(1)} m of line`);
}

const layerColors = {}, layerBlend = {};
INKS.forEach((ink, i) => { layerColors[`ink-${i + 1}-${ink.name}`] = ink.hex; layerBlend[`ink-${i + 1}-${ink.name}`] = 'multiply'; });
writeFileSync(join(OUT, 'artwork.svg'), toSVG({ lines: all, width: W, height: H, seed: 1 }, {
  strokeWidth: PEN, physicalWidth: '297mm', physicalHeight: '420mm',
  layerColors, layerBlend, preserveLayerOrder: true,
}));
```

## Wishes

- **A registration mode in `arctic`** that fits the *diamond* (the lattice
  bounding box) rather than the inked marks, so multi-seed overprints
  register without the re-fit step. `--seeds 1,2,3 --split-layers` on a
  CLI `arctic` command would make this piece a one-liner.
- **An `arctic` CLI command.** It is currently core and web only.
- **A "consensus" compositor:** given N samples of any stochastic generator,
  tag strokes that coincide across samples, so a drawing could treat
  agreed lines differently (a heavier pass, a separate pen).
