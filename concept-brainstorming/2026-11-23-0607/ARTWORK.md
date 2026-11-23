# Concordance

*Four uniformly random domino tilings of the Aztec diamond of order 240, one
domino class inked, plotted over one another in four dilutions of one indigo.
A3 portrait, single sheet.*

## Statement

Take an Aztec diamond, a stepped square tilted 45°, and cover it with
dominoes chosen uniformly at random. Any one of the possible arrangements is
as likely as any other, and there are astronomically many. All the same,
every large sample does the same thing. The four corners freeze into perfect
brick courses and the middle stays liquid, and the border between them gets
sharper as the diamond grows until it is an exact circle (the *arctic circle
theorem*, Jockusch–Propp–Shor). Nothing in the sampler mentions a circle.

Ink only the north-pointing dominoes and that law becomes a teardrop. Where
they are frozen, the spines weld into solid rules: the black tip. Inside the
circle they turn into scattered dashes that thin out towards the south pole.

*Concordance* plots four samples on the same sheet: seeds 1, 2, 3 and 4,
the first four, with no curation. In the frozen tip all four agree line for
line, so the pen draws the same rules four times and that region darkens
past anything a single pass could reach. Inside the circle the samples
disagree, and laid over each other their dashes add up to the expected
density, a smooth probability gradient that no single tiling contains. Just
below the tip the four arctic boundaries each wander in their own way
(these are the random fluctuations of the edge). They show as four pale,
tangled ridges, the only place you can still tell the four apart. Tone
here comes from agreement, and texture from disagreement.

**Why this survived the cull.** The session started with a contact sheet of
every Arctic preset, which no earlier studio run had used. The four-class
colour weave looked muddy, and the two-ink "horizon" lens was pretty but
already a preset. A sheet of "rain" (eighteen small drops at a constant mark
scale) read as Christmas trees: below order ~60 the theorem is not sharp
yet, and the subject needs size. Overlaying several samples was the idea that
added meaning. Six or eight passes in one dark ink looked like mezzotint but
filled the interior with mud. Four passes at four ink strengths kept the
air inside the circle and made the seams legible. Grading the passes from
pale to dark is also how an aquatint builds tone: each bite darker than the
last, with the deepest values where all of them land.

## Materials

- **Paper:** A3 (297 × 420 mm) hot-pressed cotton watercolour paper,
  300 gsm, natural white. For example Fabriano Artistico HP *Traditional
  White* or Arches HP Natural White (≈ `#f2eee3`). It needs to be hard-sized,
  because the tip takes four passes of ink and soft paper will feather and
  pill.
- **Pen:** one refillable 0.30 mm technical pen or plotter pen suitable for
  fountain-pen ink. Use **the same nib for every pass** so line weight stays
  constant, and flush it with distilled water between strengths.
- **Ink:** one bottle of a dye-based indigo or blue-black fountain-pen ink
  (for example Diamine *Indigo*), plus distilled water, mixed by volume into
  four small labelled jars:

  | Pass | Mix (ink : water) | Dried colour (approx.) | Name |
  |---|---|---|---|
  | 1 | 1 : 6 | `#c3c8d4` | Frost |
  | 2 | 1 : 2 | `#8d97ad` | Slate |
  | 3 | 2 : 1 | `#4f5d7e` | Dusk |
  | 4 | neat | `#1c2440` | Indigo |

  Mix all four before starting and keep them capped, so evaporation does not
  shift the values halfway through the plot.
- Low-tack artist tape and a squared corner jig (or the plotter's own sheet
  stops) to hold registration across four passes.
- Mount: a float mount on a 50 × 60 cm white board behind a 4-ply window
  mat. Let the drop breathe: the sheet's own white is part of the piece.

## Process

1. Tape the sheet to the plotter bed at all four corners, flush against the
   corner jig. **Do not move it again until step 7.** Registration depends
   on the sheet staying put; there are no registration marks because any
   drift would show as doubled rules in the tip.
2. Fill the pen with **Frost (1:6)**. Plot `artwork-layer-1.svg`. Let it
   dry for **20 minutes** (touch-test a corner of the tip).
3. Flush the pen with distilled water, blot it, fill with **Slate (1:2)**,
   plot `artwork-layer-2.svg`, and let it dry for 20 minutes.
4. Flush, fill with **Dusk (2:1)**, plot `artwork-layer-3.svg`, and let it
   dry for 30 minutes. The tip is now carrying a lot of water.
5. Flush, fill with **Indigo (neat)**, and plot `artwork-layer-4.svg`.
6. Leave it flat for at least 2 hours, then check the tip with a loupe. The
   rules should still read as separate lines (pitch ≈ 0.48 mm with a 0.30 mm
   nib), not as a flooded patch. If they flood, use a harder-sized paper or
   lengthen the drying times on the next copy.
7. Untape, sign in pencil below the drop at the right, and float-mount.

Always plot in this order: lightest first, darkest last. Then the neat
indigo sits on top in the tip, while each pale pass shows wherever it
differs from the others.

## Plot settings

- Paper: A3 portrait, 297 × 420 mm (the SVGs carry physical mm dimensions,
  4 px/mm).
- The drop's bounding diamond is 230 mm wide, centred horizontally and
  vertically, so there is 33.5 mm side margin. The ink runs from about 95 mm
  to 291 mm down the sheet, just above the optical centre.
- Pen: 0.30 mm, the same nib for all four passes.
- Each pass is about 6,650 strokes and **≈ 20.2 m of line**, so ≈ 81 m for
  the piece. The strokes are short, so plan on many pen lifts: use a modest
  pen-down/up speed and add a nib-wipe pause if the plotter software
  supports one.
- Strokes are reorder-optimised (`orderPlot`) but deliberately not chained,
  so every domino spine keeps its crisp ends.

## Reproduction

From the repo root, after `pnpm install && pnpm build`:

```sh
node concordance.mjs concept-brainstorming/2026-11-23-0607
# optional 2nd arg writes the coloured preview SVG:
node concordance.mjs concept-brainstorming/2026-11-23-0607 /tmp/preview.svg
node scripts/svg-to-png.mjs /tmp/preview.svg concept-brainstorming/2026-11-23-0607/preview.png --width 1600
```

Seeds: **1, 2, 3, 4**, at order 240 with marks `one` (north class), not
upright, and the default wobble of 0.35. The file below regenerates all four
SVGs byte-for-byte (sha256 prefixes `e5a62ce2…`, `fdefda89…`, `704e3a4a…`,
`7c6e0dbd…`).

```js
// concordance.mjs — "Concordance": the first four uniformly random domino
// tilings of the Aztec diamond AD(240), one domino class inked, plotted
// over one another on a single A3 sheet. One SVG per pass.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const { generateArctic, toSVG } = await import(
  join(process.cwd(), 'packages', 'core', 'dist', 'index.js')
);
const outDir = process.argv[2] ?? '.';
mkdirSync(outDir, { recursive: true });

const PXPMM = 4;                 // 4 px per mm
const W_MM = 297, H_MM = 420;    // A3 portrait
const DROP_MM = 230;             // width of the diamond / drop
const ORDER = 240;
const SEEDS = [1, 2, 3, 4];      // the first four samples, uncurated
const PEN_MM = 0.3;

const W = W_MM * PXPMM, H = H_MM * PXPMM;
const margin = ((W_MM - DROP_MM) / 2) * PXPMM;

const passes = SEEDS.map((seed) =>
  generateArctic({ width: W, height: H, margin, seed, order: ORDER, marks: 'one', upright: false })
);

const svgOpts = {
  physicalWidth: `${W_MM}mm`,
  physicalHeight: `${H_MM}mm`,
  strokeWidth: PEN_MM * PXPMM,
};
passes.forEach((res, i) => {
  // retag so every pass is a single pen layer
  const r = { ...res, lines: res.lines.map((l) => ({ ...l, layer: `pass-${i + 1}` })) };
  writeFileSync(join(outDir, `artwork-layer-${i + 1}.svg`), toSVG(r, svgOpts));
  let len = 0;
  for (const l of r.lines)
    for (let k = 1; k < l.points.length; k++)
      len += Math.hypot(l.points[k].x - l.points[k - 1].x, l.points[k].y - l.points[k - 1].y);
  console.error(`pass ${i + 1}: seed ${SEEDS[i]}, ${r.lines.length} strokes, ${(len / PXPMM / 1000).toFixed(1)} m of line`);
});

// Optional preview composite (not plotted): four dilutions of one indigo.
if (process.argv[3]) {
  const inks = ['#c3c8d4', '#8d97ad', '#4f5d7e', '#1c2440'];
  const lines = passes.flatMap((res, i) => res.lines.map((l) => ({ ...l, layer: `pass-${i + 1}` })));
  const layerColors = Object.fromEntries(inks.map((c, i) => [`pass-${i + 1}`, c]));
  writeFileSync(
    process.argv[3],
    toSVG({ lines, width: W, height: H, seed: 0 }, {
      ...svgOpts, layerColors, preserveLayerOrder: true, includeBackground: true, backgroundColor: '#f2eee3',
    })
  );
}
```

## Wishes

- `arctic` has no CLI command yet, so the piece needs a scratch script.
  `flow-lines arctic --order --marks --seed` would make it a one-liner, and
  a `--samples N` flag that overlays N seeds as N pen layers would make this
  piece a preset.
- A way to sample the **expected density** directly (the limit-shape
  probability field) and hatch it, as a counterpoint to averaging a few
  samples by hand.
- Per-pass misregistration control in `stack` (a deliberate 0.1–0.2 mm
  nudge per layer). A second edition might *want* the tip to shimmer.
