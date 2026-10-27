# Nocturne for Onion Domes

## Artist statement

A photograph of St Basil's, re-drawn as if by an engraver working a night
scene in reverse: instead of black ink on white, a single white-ink pen
draws the cathedral out of deep Prussian-blue paper. The sky is carried
entirely by stipple that thins toward the clouds, which are left as dark
negative space and only edged with a light line; the building is built from
Doré-style hatching that tightens into cross-hatch in the shadowed flank
and goes quiet on the lit domes. Printed positive it reads as busy; inverted
it reads as moonlit frost on stone. It survived the cull against a
misty-ranges moonlit landscape (read as rain on a fence), ballpoint and
comic treatments (scribble-loops, mechanical) and a sumie street scene
(too sparse): the Doré preset with semantic labels was the only render that
felt drawn rather than filtered.

## Materials

- Paper: Colorplan / Canson Mi-Teintes style smooth card, 160–250 gsm,
  deep Prussian blue (approx. `#14183a`), A3 (297 × 420 mm), portrait.
- Pen: white gel pen, 0.3–0.4 mm tip (Sakura Gelly Roll Classic White
  0.4, or Uni-ball Signo UM-153 white 0.38), ink approx. `#e9e6da`
  (warm white). A fine-nib plotter-fitted gel refill works best.
- Optional: matte spray fixative; black float frame, 5 cm mount.

## Process

1. Tape the blue sheet flat to the plotter bed, A3 portrait, using the
   same origin as the SVG (page 297 × 420 mm).
2. Fit the white gel pen; test on scrap blue card for flow and skips.
3. Plot `artwork.svg` as one layer (13,492 strokes, ~0.3 mm line).
   Plot slowly (about 40% speed) so the gel flows; pause every ~30 min to
   re-prime the nib on scrap. Gel can be re-plotted over skips by re-running
   the file with the same registration only if the sheet has not moved.
4. Let dry 24 h flat. Lightly dust with fixative (optional).
5. Mount floating on off-white board; black frame.

## Plot settings

- Paper A3 portrait, margin default (~12 mm), pen width 0.3 mm.
- Pen-up travel already optimised (nearest-neighbour chaining).

## Reproduction

```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js image \
  -i test-images/landmark-stbasils.jpg \
  --label-image test-images/landmark-stbasils.labels.png \
  --paper a3 --seed 21 --style dore \
  -o concept-brainstorming/2026-10-27-0613/artwork.svg
node scripts/svg-to-png.mjs concept-brainstorming/2026-10-27-0613/artwork.svg \
  concept-brainstorming/2026-10-27-0613/preview.png \
  --width 1400 --background '#14183a' --stroke '#e9e6da'
```

## Wishes

- A `--invert` / light-on-dark tone mode for `image`, so hatch density
  tracks light instead of dark when plotting white ink on dark paper (here
  the tonal logic is "positive print inverted", so lit domes carry the
  densest lines).
- Per-label pen layers from `image` (sky stipple vs building) for a
  two-ink version (white sky, gold architecture).
