# Desire Lines

## Artist statement
A brownstone city, drawn as a cold architectural specimen in navy, and a slime-mould transport network in rust copper that ignores every street. *Physarum* famously rebuilds rail maps from nothing but food and hunger; here it is let loose on the sheet and the city sits in its way. The mould's veins thread the avenues, pool in the open ground, and run out to the paper edge as though the plan were only a rough draft of where people actually walk. The rigid isometric blocks (order 0.9) against the soft, nested-contour arteries is the whole piece: planned versus grown. It survived the cull because the other candidates (small city + thin mould, cube blocks, tower stack with a busy web) either lost the city's mass or buried it; seed 27 leaves the city legible and lets the mould cross it in two clean arteries.

## Materials
- Paper: A3 (297×420 mm) warm cream, e.g. Canson Edition / Hahnemühle Bamboo, 150 gsm+, smooth (approx. `#efe6d0`).
- Layer 1 pen: 0.3 mm fineliner, deep navy ("Midnight Blue", approx. `#2b3a55`), pigment ink (e.g. Sakura Pigma Micron-style blue-black).
- Layer 2 pen: 0.3 mm fineliner or gel pen, rust copper ("Burnt Sienna / Copper", approx. `#b5532a`), pigment ink.
- Low-tack masking tape, 4 pen-plotter registration marks optional (see below).

## Process
1. Tape the sheet flat to the plotter bed; mark the sheet's bottom-left corner against a fixed stop so it can be removed and replaced.
2. Plot `artwork-layer-1.svg` (the city) with the navy 0.3 mm pen.
3. Let the ink dry 10 minutes. Do not unfasten the sheet if the plotter allows; otherwise re-seat it against the stop.
4. Swap in the copper pen and plot `artwork-layer-2.svg` (the mould) over the city. Slight misregistration (<0.5 mm) is welcome; the mould is meant to read as laid over the plan.
5. Optional: flat-mount in a white float frame with 40 mm margin.

## Plot settings
A3 portrait (297×420 mm), 18 mm margin, pen width 0.3 mm on both layers, SVG units are mm. Both layers are already ordered to reduce pen-up travel.

## Reproduction
From the repo root, after `pnpm install && pnpm build`:

```sh
node concept-brainstorming/2026-10-26-0609/make.mjs
```

The script (included in this folder) uses `generateCity` (seed 5, style `brownstone`, order 0.9, blockCols 9, blockRows 13, lotSize 14, street 6, buildingHeight 10, windows 0.3, penWidth 0.25) and `generatePhysarum` (seed 27, preset `denseWeb`, style `contour`, steps 500, gridCols 240, contourLevels 4) on a 297×420 canvas with 18 mm margin, and writes `artwork-layer-1.svg` (city) and `artwork-layer-2.svg` (slime). `preview.png` is both layers merged and rasterized with `node scripts/svg-to-png.mjs … --width 1400 --background '#efe6d0'`.

## Wishes
- A hold-off option for the CLI/core to keep the mould's lines out of building footprints, so veins pass behind facades instead of over them.
- A `city` CLI command so this piece could be reproduced without a scratch script.
