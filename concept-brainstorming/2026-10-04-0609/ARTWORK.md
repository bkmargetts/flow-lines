# Wreath for a Quiet Moon

## Statement
A hand-grown garland of flowers, berries and lance leaves rings a single
gilt moon, drawn in two pens on deep indigo. The wreath is the gesture of
mourning/celebration; the moon is the thing being honoured — wire-mesh
latitudes with traced maria, like an old armillary engraving. It survived
the cull because two quite different generators (botanical, planet) hold
a real compositional conversation: loose organic line against a rigorous
form-following grid, silver-white against gold, with the wreath's twigs
reaching in and just touching the moon's limb. Nothing is filled — the
indigo paper does the work.

## Materials
- Paper: dark indigo / Prussian-blue card, A3 (297×420 mm), ~200–300 gsm, smooth (approx. #16264A). Black or navy Canson Mi-Teintes also works.
- Layer 1 pen: white/ivory gel pen, 0.3–0.5 mm (e.g. Sakura Gelly Roll Moonlight white, approx. #F2EFE4).
- Layer 2 pen: gold/champagne metallic pen, 0.3–0.5 mm (e.g. Sakura Gelly Roll Metallic Gold, approx. #E8C872).
- Float mount, black or off-white mount board, thin natural wood frame.

## Process
1. Tape the indigo sheet flat to the plotter bed, portrait, A3.
2. Plot `artwork-layer-1-wreath.svg` with the white gel pen. Let the ink dry 20 min (gel pens smear on dark card).
3. Re-register without moving the sheet (or use the paper edge as stop), swap to the gold pen.
4. Plot `artwork-layer-2-moon.svg`. The moon sits centred in the wreath; where twigs touch its limb the gold is plotted over/near white — this is intended overprint.
5. Dry overnight, lay flat. Optionally touch a few berries with a dot of white gouache by hand.
6. Float-mount.

## Plot settings
A3 portrait, margin 20 mm, pen width 0.3 mm on both layers, single pass each. Both SVGs are chain-optimised by the generators.

## Reproduction
```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js botanical --composition wreath --paper a3 --margin-mm 20 --pen-width-mm 0.3 --seed 27 --flower-type mixed --fruit-type berry --leaf-type lance -o artwork-layer-1-wreath.svg
node packages/cli/dist/cli.js planet --type moon --paper a3 --margin-mm 20 --pen-width-mm 0.3 --radius-frac 0.5 --light-angle -40 --light-elevation 35 --seed 5 -o artwork-layer-2-moon.svg
```
preview.png: both SVGs' paths recoloured (#F2EFE4 and #E8C872) over a #16264A background rect, rasterised with `scripts/svg-to-png.mjs --width 1400`.

## Wishes
- A `--guide-radius`/centre option so the wreath's inner hole and a centred planet could be sized to each other precisely (here done by eye).
- A way to stack botanical + planet in one CLI call with `--split-layers`.
