# Three Witnesses

## Artist statement

Three witnesses were asked the same question, independently. Each one
answered by tiling the same diamond with dominoes, choosing uniformly at
random among the 2^4095 ways it can be done. The drawing doesn't show any
one answer. It shows all three, laid on top of one another in three inks.

Where the witnesses agree, their three inks land on the same line and
overprint into a dark, bruised near-black: gamboge under madder under
Prussian blue. Where they disagree, each mark is left alone in its
witness's own colour. Where only two agree, you get the secondaries: a
moss green, an oxblood, a violet. So the colour of every mark tells you
how many witnesses agree on it. Black means all three, a mixed colour
means two, and a primary means one.

The shape is not designed. It is the *arctic circle theorem*
(Jockusch–Propp–Shor): a uniformly random domino tiling of a large Aztec
diamond freezes into rigid brick courses in its four corners and stays
disordered inside the inscribed circle. Nothing random happens in the
frozen corners, so every possible sample, and every witness, says
exactly the same thing there. Inside the circle anything can happen,
and that is where the colour is. Only the two horizontal domino
classes are inked, so the north and south corners become ruled black
poles and the east and west corners stay clean paper. What's left is a
mandorla: a vesica of certainty around a body of chance.

Why it survived the cull: the session started with the repo's
`arctic` generator, which no studio run had touched. A single sample
(the `dissolve` and `horizon` presets) is a handsome diagram. Four
classes in four colours turned to woven mush, and four classes with
three samples went to an even brown. Then it became clear that
overlaying *independent samples* lets the theorem make the drawing
itself. Certainty comes out black and uncertainty comes out as colour,
and that needs no shading logic at all. The other thing that won me
over was the hand: each witness carries its own wobble, so even where
they agree, the black rules come out as three slightly different hands
drawing the same line. A frayed hem of yellow, red and blue runs along
every agreed stroke, the way a ruled line looks when three engravers
cut it from the same drawing.

## Materials

- **Paper:** A3 (297 × 420 mm) warm-white hot-press cotton rag, 300–350 gsm
  (e.g. Hahnemühle Museum Etching 350 or Arches Aquarelle HP 300). It needs
  to be smooth so the three passes sit on one another without feathering.
  Preview tone `#f3eee2`.
- **Inks.** All three must be **transparent dye-based inks** so the
  overprint mixes optically. Opaque gel or paint markers will not work,
  because the top colour would simply cover the others.
  1. **Gamboge** yellow, `#d9a21b` (witness 1, seed 11)
  2. **Madder** crimson, `#a8283a` (witness 2, seed 29)
  3. **Prussian blue**, `#1d3b78` (witness 3, seed 47)

  Use 0.3–0.4 mm dye fineliners (e.g. Stabilo point 88 / Staedtler triplus
  in yellow, carmine and dark blue), or refillable technical pens filled
  with transparent fountain-pen inks of those hues.
  **Test first:** on an offcut, plot one 50 mm rule three times, once per
  pen, in this order. The stack must read as a dark neutral. If it reads
  blue, swap in a lighter blue or a heavier crimson until it does.
- Low-tack drafting tape; a soft graphite pencil (HB) for the colophon.

## Process

1. Tape the sheet square to the plotter bed at all four corners. **The
   sheet must not move until step 6:** the whole piece depends on
   three-pass registration, because agreement only reads as black if the
   lines coincide.
2. Home the plotter. Load the gamboge pen and plot
   `artwork-layer-1-gamboge.svg`. Lightest ink first, so the darker inks
   seal it.
3. Let it dry for 15 minutes (dye on hot-press stays wet longer than
   you'd expect, and the next pen would pick it up).
4. Swap to madder **without re-homing in a way that shifts the origin**.
   Plot `artwork-layer-2-madder.svg`. Let it dry for 15 minutes.
5. Swap to Prussian blue and plot `artwork-layer-3-prussian.svg`.
6. Let it dry for 1 hour, then untape.
7. In pencil, bottom left, about 15 mm below the drawing's lowest point:
   `Three Witnesses — 11 · 29 · 47`. The seeds are the witnesses' names.
   Sign and number bottom right.
8. Float-mount in a deep white box frame with at least 60 mm of air
   around the sheet. The poles need empty paper above and below them.

`artwork.svg` is the **composite preview** (all three plates in one file,
multiply-blended). Do not plot it.

## Plot settings

- A3 portrait, 297 × 420 mm. The diamond's tips sit 52 mm from the top and
  bottom edges. The drawn mandorla spans about 221 × 316 mm, centred.
- One pen per plate, 0.3–0.4 mm. Rules are spaced about 1.8 mm apart
  (Aztec diamond of order 90).
- Each plate has about 1,950 strokes, about 14.5 m pen-down and about
  6.3 m pen-up. That's roughly 45 m of travel for the whole piece.
- The plot order is fixed: gamboge, then madder, then Prussian blue.

## Reproduction

From the repo root after `pnpm install && pnpm build`, save the script
below as `three-witnesses.mjs` and run:

```sh
node three-witnesses.mjs concept-brainstorming/2026-11-11-0612
node scripts/svg-to-png.mjs concept-brainstorming/2026-11-11-0612/artwork.svg \
  concept-brainstorming/2026-11-11-0612/preview.png --width 1600 --background '#f3eee2'
```

The seeds are 11, 29 and 47, with order 90 and wobble 1.4 px. Two runs
were verified to produce byte-identical SVGs.

```js
// three-witnesses.mjs — "Three Witnesses".
// Three independent, exactly-uniform random domino tilings of the same
// Aztec diamond (core generateArctic), one per ink. Only the two
// horizontal domino classes (N, S) are kept. Every sample is generated
// with marks:'all' so the page fit is computed from the FULL diamond —
// identical for every seed — and the three plates register exactly; the
// unwanted classes are then filtered out by pen layer.
// Usage (repo root, after `pnpm build`): node three-witnesses.mjs <outDir>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const { generateArctic, toSVG, orderPlot } = await import(
  join(process.cwd(), 'packages', 'core', 'dist', 'index.js')
);
const outDir = process.argv[2] ?? '.';
mkdirSync(outDir, { recursive: true });

const PX = 4;                       // px per mm
const W = 297 * PX, H = 420 * PX;   // A3 portrait
const BOX = H;                      // square virtual box, height-limited
const MARGIN = 52 * PX;             // diamond sits 52 mm from top & bottom
const ORDER = 90;                   // AD(90): 8,190 dominoes per witness
const WOBBLE = 1.4;                 // px — each witness's own hand
const KEEP = new Set(['domino-n', 'domino-s']);

// Plot order = list order: lightest ink first.
const WITNESSES = [
  { seed: 11, file: 'artwork-layer-1-gamboge.svg',  ink: '#d9a21b' },
  { seed: 29, file: 'artwork-layer-2-madder.svg',   ink: '#a8283a' },
  { seed: 47, file: 'artwork-layer-3-prussian.svg', ink: '#1d3b78' },
];

const dx = (W - BOX) / 2;  // centre the square box on the A3 sheet; the
                           // cropped E/W diamond corners are blank paper
const all = [];
const svgOpts = { strokeWidth: 1.4, physicalWidth: '297mm', physicalHeight: '420mm' };
for (const [i, w] of WITNESSES.entries()) {
  const r = generateArctic({
    width: BOX, height: BOX, margin: MARGIN, seed: w.seed,
    order: ORDER, marks: 'all', wobble: WOBBLE,
  });
  const plate = orderPlot({  // re-order after filtering: cuts pen-up travel
    lines: r.lines
      .filter((l) => KEEP.has(l.layer))
      .map((l) => ({ points: l.points.map((p) => ({ x: p.x + dx, y: p.y })), layer: `witness-${i + 1}` })),
    width: W, height: H, seed: w.seed,
  });
  const lines = plate.lines;
  writeFileSync(join(outDir, w.file), toSVG(plate, { ...svgOpts, strokeColor: w.ink }));
  all.push(...lines);
}

// Composite preview document (not for plotting): three inks, multiplied.
const layerColors = {}, layerBlend = {};
WITNESSES.forEach((w, i) => { layerColors[`witness-${i + 1}`] = w.ink; layerBlend[`witness-${i + 1}`] = 'multiply'; });
writeFileSync(join(outDir, 'artwork.svg'),
  toSVG({ lines: all, width: W, height: H, seed: 0 }, { ...svgOpts, layerColors, layerBlend, preserveLayerOrder: true }));
```

## Wishes

- **A `fitBox` / fixed-lattice option for `generateArctic`.** The page fit
  is computed from the *drawn* extents, so two seeds rendered with
  `marks: 'one'` or `'horizontals'` get different scales and won't
  register. This piece works around that by rendering `marks: 'all'`
  (whose extent is always the full diamond) and then filtering layers.
  A `fitTo: 'diamond'` option would make multi-sample overprints
  first-class.
- **Agreement as data:** a core helper that takes N samples of a
  stochastic generator and tags each mark by how many samples share it.
  That would allow a plate per agreement level, e.g. black only where
  all N agree, instead of relying on optical ink mixing.
