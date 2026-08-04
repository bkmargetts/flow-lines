# Order Parameter

## Artist statement

In physics, an *order parameter* is the single quantity a system's phase
transition is measured by — zero in the disordered phase, nonzero and
growing in the ordered one: magnetisation appearing as a hot metal cools
past its Curie point, crystallinity appearing as a liquid freezes. One
number, dialled from 0 to 1, and an entire phase of matter reorganises
around it.

This repo's city generator (`packages/core/src/city`) has a slider
literally named `order`, and it does the same thing to a skyline. Every
building's footprint, height, and position is drawn once from a stable
per-cell genome and *never re-rolled* — only how that genome is expressed
changes: at `order: 0` walls bow, lean and taper like something grown
under its own weight; at `order: 1` the same walls snap to plumb, storeys
stack in ruled bands, and windows tile in a perfect grid. Same seed, same
plan, same 43 buildings in the same places — two completely different
built worlds.

I rendered seed 21 across the full range before settling here. Most seeds
gave a competent skyline; this one gives a composition — two towers near
the centre pull into a tight, almost embracing lean at `order: 0`, the
kind of gesture that reads as *decision* rather than noise, and at
`order: 1` those same two footprints resolve into the tallest, most
confident pair of office blocks in the frame. The eye recognises the same
city in both plates before it can articulate why. That recognition — not
either plate alone — is the piece: a diptych about how much of what looks
like an inevitable, engineered skyline was actually just one dial's
position, decided after the plan, not before it.

The left plate is inked warm and drawn loose (a light hand-sketch pass,
`sketchStyle: loose` at intensity 0.35) — an ink that wants to read as
grown, not drafted. The right plate drops the sketch pass entirely and
uses a finer, harder line — ruled, crisp, unapologetically drafted. Two
pens, two disciplines, one plan underneath both.

## Materials

- **Paper** — two identical sheets of warm ivory hot-press illustration
  card, 220gsm, A4 landscape (297×210mm) each. Same stock for both plates
  is deliberate: one ground, two cities.
- **Ink, left plate ("As Grown")** — a warm sepia/walnut fineliner or
  fountain-pen ink, e.g. **Walnut Brown**, hex `#5b3a29`, 0.45mm nib.
- **Ink, right plate ("As Built")** — a cool graphite-grey technical
  fineliner, e.g. **Graphite Grey**, hex `#3a3f46`, 0.32mm nib (noticeably
  finer than the left plate — precision is part of the character).
- **Mounting** — both sheets float-mounted side by side on a single
  backing board behind one mat, a 3mm gap between them, no dividing line
  needed (the plates separate themselves). A single caption card beneath
  the pair, hand-lettered in graphite pencil: *"ORDER PARAMETER — seed 21,
  order 0.00 / order 1.00"*.

## Process

1. Plot `artwork-grown.svg` on the first ivory sheet with the walnut-brown
   0.45mm pen. This is the `order: 0`, sketch-pass plate — expect visibly
   looser, wobbled linework; that is the intended hand-drawn character of
   this plate, not a plotting fault.
2. Plot `artwork-built.svg` on the second identical ivory sheet with the
   graphite-grey 0.32mm pen. This plate has no hand-sketch pass — lines
   should come off the plotter clean and ruled. Use a fresh/sharp pen here
   specifically so the contrast with plate one reads as deliberate, not as
   the same pen running low.
3. Let both sheets dry fully (fineliner/gel ink, ~10 minutes) before
   handling.
4. In the bottom margin of each sheet, in graphite pencil, hand-letter the
   small caption already described in Materials — echoing the fine-art
   print convention of pencilled title/edition notes below the plate.
5. Float-mount both sheets side by side (left = grown, right = built) on
   one backing board with a 3mm gap, behind one mat and glazing.

No wash, no colour pass, no misregistration — the two plates are meant to
be read clean, side by side, at arm's length, so the eye can do the
comparing the piece is actually about.

## Plot settings

| | As Grown (left) | As Built (right) |
|---|---|---|
| Paper | A4, landscape, 297×210mm | A4, landscape, 297×210mm |
| Margin | 25mm | 25mm |
| Pen width | 0.45mm (walnut brown) | 0.32mm (graphite grey) |
| Seed | 21 | 21 |
| `order` | 0 | 1 |
| Hand-sketch | `loose`, intensity 0.35 | none |
| Lines / pen-up moves | 2,866 lines (`orderPlot`-reordered) | 2,827 lines (`orderPlot`-reordered) |

Both plates reorder-only optimised (`optimize: true`, the city generator's
default) — buildings are discrete shapes, so strokes are travel-ordered
but never chain-fused; every building silhouette is byte-identical to the
un-reordered geometry.

## Reproduction

The city generator has no CLI command yet (per `concept-brainstorming/
README.md`'s toolbox notes) — both plates come from one scratch script
against the built core package.

```sh
pnpm install && pnpm build   # builds packages/core/dist used below
node order-parameter.mjs
```

`order-parameter.mjs`:

```js
import { writeFileSync } from 'node:fs';
const { generateCity, toSVG } = await import(
  './packages/core/dist/index.js'
);

const pxPerMm = 3;
const widthMm = 297, heightMm = 210;
const W = Math.round(widthMm * pxPerMm), H = Math.round(heightMm * pxPerMm);
const marginMm = 25;
const marginPx = marginMm * pxPerMm;
const seed = 21;

const common = {
  width: W, height: H, margin: marginPx, seed,
  style: 'mixed', blockCols: 8, blockRows: 8, density: 0.8,
};

const variants = [
  { file: 'artwork-grown.svg', order: 0, sketch: 0.35, sketchStyle: 'loose', penWidthMm: 0.45 },
  { file: 'artwork-built.svg', order: 1, sketch: 0, penWidthMm: 0.32 },
];

for (const v of variants) {
  const penWidthPx = v.penWidthMm * pxPerMm;
  const res = generateCity({
    ...common,
    order: v.order,
    sketch: v.sketch ?? 0,
    sketchStyle: v.sketchStyle ?? 'loose',
    penWidth: penWidthPx,
  });
  const svg = toSVG(res, {
    optimize: true,
    strokeWidth: penWidthPx,
    physicalWidth: `${widthMm}mm`,
    physicalHeight: `${heightMm}mm`,
  });
  writeFileSync(v.file, svg);
  console.log(v.file, res.lines.length, 'lines');
}
```

`preview.png` was composed from both raw SVGs (recolouring each plate's
paths to its ink and laying them side by side with captions on an ivory
background) via a second scratch script using `@resvg/resvg-js`, the same
library `scripts/svg-to-png.mjs` uses — the two source SVGs in this folder
are plotted in plain black; the preview is the only place the two inks
and the side-by-side mount are simulated.

## Wishes

- A CLI command for the city generator (`flow-lines city …`, mirroring
  `landscape`/`planet`/`botanical`) would have saved writing a scratch
  script here, and would make this kind of order-continuum exploration
  much faster to iterate on from the command line.
- A way to render two `order` values from *one* call and get back a
  guaranteed-matching pair (right now the pairing works only because nothing
  in the module re-seeds noise streams when `order` changes — worth
  making that guarantee explicit/tested rather than implicit, so future
  tuning can't accidentally break the "same city, two disciplines" trick
  this piece depends on).
