# Ikebana for a Red Sun

## Artist statement

A single sweep of the brush, and a single plant. In ikebana the vase and
the stem are the *argument*; the empty space is the point. Here the
space is given a body: one dry-brush ensō in vermilion rises behind a
sparse flowering stem, cradling it without touching it, then slips down
across the shoulder of the vase as if the sun were setting through the
pot. The black pen layer is the quiet, careful, botanical-plate half of
the picture; the red layer is the reckless half — a gesture done once
and left. The two never agree about edges (they are different pens, with
no hold-off), and that disagreement is the piece.

It survived the cull because it is restrained: nothing is hatched to
death, the paper does most of the work, and the red arc is the only
loud thing on the sheet. Rejected: ensō seeds that floated free of the
plant, arcs that cut the sheet in half, and denser botanical seeds that
competed with the brush.

## Materials

- **Paper:** A4 (210 × 297 mm), warm natural/cream cotton-rag or
  heavy hot-press, 250–300 gsm (preview uses `#f3ecd9`). Slight tooth is
  welcome under the red layer.
- **Layer 1 pen — black:** 0.3 mm fineliner, e.g. Sakura Pigma Micron 03
  in Black (`#1a1a1a`). Waterproof pigment ink.
- **Layer 2 pen — red:** 0.3 mm pen with vermilion ink (`#b5301f`);
  e.g. a Pilot Hi-Tec-C or Uni-ball Signo in a warm red/vermilion, or a
  fineliner filled with Platinum Carbon-style red. Dry-brush look comes
  from many offset passes of the same pen.
- Optional: a washi-tape mount / float frame in off-white.

## Process

1. Tape the A4 sheet flat in the plotter, portrait, origin top-left.
   Mark the paper corners in pencil (lightly, outside the 15 mm margin)
   so the sheet can be re-seated.
2. Plot `artwork-layer-2-enso-red.svg` first with the red pen (0.3 mm).
   Red first so the black line sits on top of any bled pigment.
3. Let the red dry fully (10 minutes for pigment ink; 24 h if using
   dye/alcohol markers, which can feather and lift under a second pen).
4. Re-seat the sheet against the pencil corner marks. Plot
   `artwork-layer-1-botanical-black.svg` with the black pen (0.3 mm).
   A slight registration drift (≤1 mm) is welcome; it reads as hand work.
5. Optional hand step: with a dry fine brush, drag a little thinned red
   along the underside of the ensō's thickest passage to deepen the
   "ink-loaded" belly. Skip if it competes with the plotted dry-brush.
6. Float-mount on off-white board, no glass reflection if possible.

## Plot settings

- Paper: A4, portrait, margin 15 mm, pen width 0.3 mm for both layers.
- Layer 1: 691 paths. Layer 2: 78 paths (heavy offset passes; short travel).
- Both layers use `optimize` (default on).

## Reproduction

Build once: `pnpm install && pnpm build`. Then, from the repo root:

```sh
node packages/cli/dist/cli.js botanical --paper a4 --orientation portrait \
  --composition specimen --vessel vase --seed 11 --margin-mm 15 \
  --pen-width-mm 0.3 -o artwork-layer-1-botanical-black.svg

node packages/cli/dist/cli.js gesture --preset sumi --paper a4 \
  --orientation portrait --margin-mm 15 --pen-width-mm 0.3 \
  --dryness 0.6 --spatter 0.05 --seed 14 -o artwork-layer-2-enso-red.svg
```

`preview.png` is both SVGs composited (red `#b5301f` under black
`#1a1a1a`) on a `#f3ecd9` rectangle, rasterized with
`scripts/svg-to-png.mjs --width 1400`. (The SVGs themselves are
colour-agnostic black; recolour via pen choice.)

## Wishes

- A way to run `gesture` with a guide anchor (e.g. "arc centred on this
  point") so the ensō can be placed around a chosen bloom deliberately
  instead of by seed hunting.
- A hold-off/clip between CLI-generated layers (the `stack` command
  covers this for core generators; gesture and botanical vessel combos
  could be recipe-driven).
