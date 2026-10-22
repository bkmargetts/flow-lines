# Red Moon, One Breath

## Artist statement
A cartographer's moon — engraved contour hatching, craters, maria — is struck through by a single sumi sweep that the moon cannot hold. Two ways of making a mark meet on one sheet: the patient survey (vermilion, thin) and the unrepeatable gesture (black, bold). The sweep wraps the disc like a tide or an orbit and ends in whips and spatter. It survived the cull against a wireframe gas giant, a Kline-bar composition and two other sweep seeds (one with a floating, disconnected arc) because here the stroke both crosses the moon and frames its lower edge, and the lower-left bleed-like tail gives the page momentum.

## Materials
- Paper: warm cream, 200 gsm smooth/hot-press, A3 (297×420 mm), e.g. #efe8d6.
- Layer 1 pen: vermilion fineliner/gel, 0.3 mm — "Vermilion" #b8321f.
- Layer 2 pen: black archival fineliner, 0.3 mm (plotted at the generator's offset passes, which build the bold sweep) — "Sumi Black" #15130f.
- Optional: a dry-brush pass of diluted sumi over the sweep by hand after plotting.

## Process
1. Tape paper to plotter bed, portrait; mark the corners for re-registration.
2. Plot `artwork-layer-1.svg` (moon) with the vermilion pen. Let ink dry 10 min.
3. Without moving the paper, swap pen and plot `artwork-layer-2.svg` (sweep) in black. Black overprints the red where they cross.
4. Optional: soften sweep edge with a damp brush. Float-mount on white board.

## Plot settings
A3 portrait, margin default, pen width 0.3 mm per layer (the CLI defaults), optimize on.

## Reproduction
```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js planet --type moon --paper a3 --orientation portrait --craters --crater-count 140 --mare-level 0.1 --light-angle -50 --light-elevation 35 --stipple 0.4 --hatch-spacing 5 --radius-frac 0.62 --seed 21 --sketch 0.3 -o artwork-layer-1.svg
node packages/cli/dist/cli.js gesture --paper a3 --orientation portrait --preset sumi --seed 8 --ink-weight 0.9 --dryness 0.6 --spatter 0.5 --negative-space 0.3 -o artwork-layer-2.svg
```
Preview: layers recoloured (#b8321f, #15130f) and merged, rendered with `scripts/svg-to-png.mjs --width 1600 --background '#efe8d6'`.

## Wishes
- Hold-off between layers across CLI commands so the sweep could knock out the moon's hatching instead of overprinting.
