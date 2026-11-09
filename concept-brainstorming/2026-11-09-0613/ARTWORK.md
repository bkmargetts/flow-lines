# Faultline Moon

## Statement
A moon drawn in tight, even contour lines — the calm of an old celestial
engraving — and then the *sheet itself* fails. A second, sparse network of
cracks (generated as a separate fracture layer) runs across both the paper and
the moon, ignoring the disc's edge entirely. Two inks, two kinds of order: the
patient engraved sphere, and the stress field that doesn't care about it.
It survived the cull because the cracks were kept *few* — a first, dense
craquelure fought the sphere; three generations of sparse, confident primaries
let the moon breathe and read as a break in the surface, not a pattern.

## Materials
- Paper: A3 portrait (297×420 mm), warm cream hot-press, 200 gsm (approx. #f1e8d2).
- Layer 1 pen: fineliner 0.3 mm, Prussian blue (#1f3a5f) — the moon.
- Layer 2 pen: fineliner 0.3 mm, burnt sienna / rust (#a8431f) — the cracks.
- Optional: diluted tea wash, masking tape for registration.

## Process
1. Tape the sheet to the plotter bed; mark the corners with pencil ticks.
2. Plot `artwork-layer-1.svg` with the blue pen.
3. Swap to the rust pen, re-align the sheet on the pencil ticks, plot `artwork-layer-2.svg`.
4. Let dry 24 h. Optional: brush a very dilute tea wash along the heaviest cracks, wiping off excess.
5. Float-mount on off-white board.

## Plot settings
A3 portrait, margin 18 mm, pen 0.3 mm, both layers. Layer 1 ~1900 paths, layer 2 ~50 paths (very quick).

## Reproduction
```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js planet --type barren --paper a3 --orientation portrait --margin-mm 18 --seed 21 --radius-frac 0.8 --light-angle -50 --light-elevation 20 --limb-darkening 0.4 --stipple 0.5 --hatch-spacing 4 --cross-hatch-layers 2 --crater-detail -o artwork-layer-1.svg
node packages/cli/dist/cli.js fracture --preset crazing --paper a3 --orientation portrait --margin-mm 18 --seed 14 --no-plate-hatch --generations 2 --crack-density 0.25 --straightness 0.8 --bold-passes 2 -o artwork-layer-2.svg
```
preview.png: both SVGs merged, layer 1 stroked #1f3a5f, layer 2 #a8431f, on #f1e8d2, via `scripts/svg-to-png.mjs --width 1400`.

## Wishes
- Let the fracture generator accept a stencil/exclusion so cracks could stop at or deflect around the planet limb.
- A planet option for a true cratered-moon surface; `barren` reads as continents-and-seas here.
