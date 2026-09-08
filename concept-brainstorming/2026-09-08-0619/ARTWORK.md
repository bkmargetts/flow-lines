# Two Arctic Circles

## Artist statement

In 1998, Jockusch, Propp and Shor proved something about a game that has
nothing to do with geography: tile a diamond-shaped board with dominoes,
uniformly at random, and as the board grows the tiling *freezes* into four
perfectly ordered brick courses at the four corners while staying chaotic
in the middle — and the boundary between order and chaos converges to an
exact circle, inscribed in the diamond. Nothing in the sampling procedure
mentions a circle. No one draws one in. It is simply the only shape that
boundary can settle into, proven with total rigour, and it happens to be
named — because mathematicians reach for the word that fits — the
**arctic circle theorem**. A random process that has never seen a map of
the Earth keeps producing, exactly, the shape of a coastline of ice.

This repo's `arctic` generator (`packages/core/src/arctic`) samples the
tiling itself by domino shuffling (Elkies–Kuperberg–Larsen–Propp): exact
uniform sampling, no Markov chain, no burn-in, no question of whether it's
"mixed enough" — the tiling you get is a true, unbiased draw every time,
deterministic from nothing but a seed. Reading only one of its four domino
classes back as ink (the generator's own `dissolve` logic) turns the proof
directly into tone: a solid welded mass where that class froze, blank
paper where the others own the corner instead, and inside the circle a
scatter of short broken dashes where the class shows up at random. Three
textures, no shading, no gradient tool — the darkness *is* the order, and
the edge between dark and blank is the theorem made visible.

One panel would already say this. Two, side by side, say it properly.
Seed 41 and seed 99 are independent draws — nothing about one is derived
from or adjusted toward the other — and their interiors prove it: the
jagged transition line has completely different teeth, the speckle inside
falls in different places, no two dashes land the same way twice. But the
outer silhouette — the straight diamond flanks up top, the precise curved
drop into the disordered field below — is, to the eye, the same shape at
the same size in the same position on the page. That repetition is not a
coincidence I engineered; it is the theorem holding, on demand, twice,
because it is a theorem and not a tendency. Once I saw the two panels
side by side I stopped looking for a third — a diptych argues the point
by repeating it exactly once; a grid of them would have turned proof into
wallpaper.

I tried the busier readings first and put them back down. `horizontals`
(both the north and south classes inked at once) fills the circle with a
dense woven ball that reads as a storm cell or a tangle — striking, but
it buries the one relationship the piece is actually about under second
relationship nobody asked for. The `weave`/`brick` readings (every class,
or every domino's outline) even out into a uniform grey that carries the
boundary but no longer carries any tone at all — correct, but mute. The
single-class reading was the plainest option in the generator and the
only one that let the paper do most of the work, which is the whole point
of drawing this in ink instead of just plotting the raw tiling data.
I also pulled the hand-drawn wobble down from the generator's 0.35
default to 0.15: the frozen corner is the one place in this entire
project's output that is supposed to look exactly as regular as the
algorithm actually made it, and a looser wobble was fighting that on
every test render, softening brick courses that should read as
machine-straight against the disorder they're bordering.

What I'm drawn to is the double meaning the title is allowed to carry
honestly, because it isn't a metaphor I imposed — it's the term
mathematicians already settled on, decades before anyone thought to plot
it in ink: this is a picture of the *arctic circle theorem*, and it looks,
without any help from me, exactly like a chart of the *Arctic Circle*.

## Materials

- **Paper** — GF Smith Colorplan, *Ebony*, 270 gsm smooth card, A3
  (420 × 297 mm), landscape. Black card rather than white paper for the
  same reason a night sky needs dark ground: the piece is two pale shapes
  suspended in emptiness, and white paper turns that emptiness into a lit
  room instead of open dark. Hex reference for screen preview:
  `#0b0d14` (a hair off true black — Colorplan Ebony has a faint cool
  cast, not a warm one).
- **Ink** — one pen only: Sakura Gelly Roll Metallic, *Silver*, fine
  point (05 nib, ~0.35 mm laid line). Opaque metallic gel — one of the
  few families that lays a genuinely bright, cool line on black card in
  one coat, which matters here: no second pass, no correction, every
  stroke has to read first time the way welded dominoes and scattered
  dashes are supposed to. Approximate swatch for screen preview:
  `#d7dee7` (a flat approximation only — the actual pen carries a
  metallic shimmer under raking light that no sRGB hex can hold; the
  polished silver is part of the piece, not a rendering nicety).
- Nothing else: no wash, no second colour, no mount board specified
  beyond the frame note below. Both panels, one pen, one pass.

## Process

1. Tape the A3 Colorplan Ebony sheet flat to the plotter bed, all four
   corners, smooth side up.
2. Load the plotter with the Gelly Roll Metallic Silver pen, 05 nib.
   Shake/prime per the pen's usual routine — metallic gel inks settle
   between uses and the first few centimetres can run dry if skipped.
3. Plot `artwork.svg` in a single pass. One pen, one width, the whole
   sheet — both panels are already composited into the one file, so there
   is no swap and no re-registration.
4. Let the gel ink cure fully flat and undisturbed — metallic gel sits
   proud of the surface longer than a fineliner or a fountain ink;
   30–60 minutes minimum before the sheet is handled or stacked, longer
   in a cold or humid room.
5. Float-mount both panels together as one work in a single deep black
   or near-black frame, generous dark or graphite mount board
   (60–80 mm), non-glare glazing. No caption card, no printed title on
   the sheet itself — the two shapes and the gap of paper between them
   are the whole composition; a busy mount or an on-sheet label would
   compete with the negative space instead of holding it.

## Plot settings

- Paper: A3, 420 × 297 mm, landscape
- Two panels, each fit to a 160 × 160 mm box, 20 mm gutter between them,
  centred on the sheet (40 mm outer margin left/right, ≈68.5 mm above
  and below each panel)
- Pen: single pen, ~0.35 mm laid line, single pass
- Render resolution: 3 px/mm (repo default, `BASE_PX_PER_MM`)
- Diamond order 170 per panel (AD(170): 170 × 171 = 29,070 dominoes
  sampled per panel, of which the inked 'N' class owns 7,476 in the left
  panel's tiling and 7,340 in the right — close to the theorem's ~25%
  share, before welding collapses the frozen ones into long strokes)
- Seeds: 41 (left panel), 99 (right panel) — independent draws, same
  generator call
- Output: 6,760 strokes total, single layer, ≈9.94 m of pen travel
  (`orderPlot` reordering only — chaining would fuse welded dominoes at
  their shared endpoints into one path and round-cap the joins, softening
  exactly the crisp brick geometry the frozen corners depend on)

## Reproduction

Deterministic from two seeds (`41`, `99`) and one fixed layout. Build the
repo, save the script below as `two-arctic-circles.mjs` in the repo root,
then run:

```sh
pnpm install && pnpm build
node two-arctic-circles.mjs concept-brainstorming/2026-09-08-0619
```

This writes `artwork.svg` byte-for-byte identical to the committed file.
`preview.png` was then made with:

```sh
node scripts/svg-to-png.mjs concept-brainstorming/2026-09-08-0619/artwork.svg \
  concept-brainstorming/2026-09-08-0619/preview.png --width 1800 \
  --background '#0b0d14' --stroke '#d7dee7'
```

`two-arctic-circles.mjs`:

```js
// "Two Arctic Circles" — a domino tiling of the Aztec diamond AD(170),
// sampled twice from independent seeds, each read through the arctic
// generator's single-class 'dissolve' mark (only the 'N' domino class
// inked): a solid welded mass at the frozen pole, unravelling through the
// exact circle the arctic circle theorem predicts, into blank paper beyond.
// No code changes — generateArctic + toSVG exactly as the repo already
// exports them, called twice and composited onto one A3 sheet by hand
// (core-only generator, no CLI command yet, so this is a scratch script
// per concept-brainstorming/README.md's documented pattern).
//
// Run from repo root after `pnpm build`:
//   node two-arctic-circles.mjs <outDir>
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const { generateArctic, toSVG, getPaperSize, pageMetrics, measurePenTravel, orderPlot } =
  await import(resolve(process.cwd(), 'packages/core/dist/index.js'));

const OUT_DIR = resolve(process.argv[2] ?? '.');
mkdirSync(OUT_DIR, { recursive: true });

const PXPERMM = 3; // BASE_PX_PER_MM
const paper = getPaperSize('a3');
const metrics = pageMetrics(paper, 'landscape', PXPERMM);
const { widthPx: W, heightPx: H, widthMm, heightMm } = metrics;

// Two square plates, side by side, centred on the sheet.
const PANEL_MM = 160;
const GUTTER_MM = 20;
const OUTER_MARGIN_MM = (widthMm - PANEL_MM * 2 - GUTTER_MM) / 2; // 40mm

const PANEL_PX = Math.round(PANEL_MM * PXPERMM);
const INNER_MARGIN_PX = Math.round(6 * PXPERMM);

const ORDER = 170; // AD(170): 170*171 = 29,070 dominoes per panel
const WOBBLE = 0.15; // restrained — the frozen zone is meant to read exact
const SEEDS = [41, 99]; // two independent samples of the same random process

let lines = [];
for (let i = 0; i < SEEDS.length; i++) {
  const seed = SEEDS[i];
  const r = generateArctic({
    width: PANEL_PX,
    height: PANEL_PX,
    margin: INNER_MARGIN_PX,
    seed,
    order: ORDER,
    marks: 'one', // MARK_CLASSES.one = ['N'] — the 'dissolve' reading
    upright: false, // diamond, not square — N sits at the top point
    wobble: WOBBLE,
  });
  const offXmm = OUTER_MARGIN_MM + i * (PANEL_MM + GUTTER_MM);
  const offYmm = (heightMm - PANEL_MM) / 2;
  const offXpx = offXmm * PXPERMM;
  const offYpx = offYmm * PXPERMM;
  for (const line of r.lines) {
    lines.push({
      points: line.points.map((p) => ({ x: p.x + offXpx, y: p.y + offYpx })),
      layer: line.layer,
    });
  }
}

let result = { lines, width: W, height: H, seed: SEEDS[0] };
result = orderPlot(result); // reorder only — chaining would fuse welded dominoes

const svg = toSVG(result, {
  strokeColor: '#000000',
  strokeWidth: 1,
  physicalWidth: `${widthMm}mm`,
  physicalHeight: `${heightMm}mm`,
});

writeFileSync(resolve(OUT_DIR, 'artwork.svg'), svg);

const travelMm = measurePenTravel(result) / PXPERMM;
console.log(`strokes: ${lines.length}`);
console.log(`pen travel: ${(travelMm / 1000).toFixed(2)} m`);
console.log(`sheet: ${widthMm}×${heightMm}mm, panels ${PANEL_MM}×${PANEL_MM}mm, order ${ORDER}, seeds ${SEEDS.join(', ')}`);
```

## Wishes

- `arctic` has no CLI command yet (core-only, like several other
  generators listed in the studio README) — a `flow-lines arctic`
  command with `--order`, `--marks`, `--upright` flags would have let
  this run through the normal CLI instead of a scratch script, and would
  make a multi-panel layout like this one (fit N independent renders into
  a grid of boxes on one sheet) a reusable flag rather than hand-rolled
  offset math every time a piece wants more than one panel.
- The per-domino-class layer tagging (`arcticLayerName`) is already
  multi-pen-ready (one pen per N/S/E/W class) but this piece deliberately
  used only one class in one ink; a future piece inking all four classes
  in four registered passes — the `weave` preset, four pens instead of
  one — is a genuinely different, more decorative object and worth its
  own session rather than folding into this one.
