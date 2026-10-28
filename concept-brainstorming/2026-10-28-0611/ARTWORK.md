# Graticule for an Absent Mass

## Artist statement

A surveyor's polar graticule — rays and rings, the oldest chart of "where
things are" — is bent by something that is not drawn. Nowhere on the sheet
is the mass itself; only the grid's distress around it: rays crowding and
snapping short, rings pinching into a lopsided knot, a small paper-white
clearing where the lines refuse to go. Like a gravitational lens, or a
planet found only by the wobble of its star, the subject is inferred.

It survived a cull of botanical bouquets, misty-range landscapes and
Doré-style photo hatching (all too mechanical or too thin at this scale).
Two warp-grid passes with the *same seed* share one hidden deformer, so the
rust rays and indigo rings deform in perfect agreement and read as one
instrument. Printed in two inks on warm paper it looks like an antique
engineering plate that has seen something.

## Materials

- **Paper**: A3 (297 × 420 mm) portrait, warm cream smooth cartridge or
  hot-press, 160–220 gsm (approx. `#efe6d2`).
- **Pen 1 — rays** (`artwork-layer-1.svg`): brick/rust red fineliner or
  gel pen, `#b5342a`, 0.4 mm.
- **Pen 2 — rings** (`artwork-layer-2.svg`): indigo/navy fineliner,
  `#1d3f7a`, 0.4 mm.
- Low-tack masking tape for registration marks (optional).

## Process

1. Tape the sheet to the plotter bed; note its position with two corner
   pencil ticks.
2. Plot `artwork-layer-2.svg` (rings) with the indigo pen. Let dry 10 min.
3. Swap pens without moving the paper (or re-register to the ticks), plot
   `artwork-layer-1.svg` (rays) in rust. The two layers cross hundreds of
   times; a hair of misregistration is welcome.
4. Optional hand step: with a white gel pen, lightly ring the central void
   once, freehand, as if circling the missing body.
5. Float-mount on off-white board in a plain oak frame, no mat glare.

## Plot settings

A3 portrait, 10 mm margin (CLI default), 0.4 mm pen on both layers.
141 strokes (rays) + 95 strokes (rings).

## Reproduction

```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js warp-grid --preset pinch --pattern rays --seed 5 --deformers 2 --paper a3 --orientation portrait --pen-width-mm 0.4 -o artwork-layer-1.svg
node packages/cli/dist/cli.js warp-grid --preset pinch --pattern circles --seed 5 --deformers 2 --spacing 14 --paper a3 --orientation portrait --pen-width-mm 0.4 -o artwork-layer-2.svg
```

`preview.png`: both layers merged into one SVG with layer 1 stroke
`#b5342a`, layer 2 stroke `#1d3f7a`, then
`node scripts/svg-to-png.mjs merged.svg preview.png --width 1600 --background '#efe6d2'`.
(The generated SVGs themselves are black; ink colour is the pen.)

## Wishes

- A per-layer `--stroke-color` pairing with `--split-layers` for warp-grid,
  and a CLI way to overlay two warp-grid patterns sharing one deformer set.
