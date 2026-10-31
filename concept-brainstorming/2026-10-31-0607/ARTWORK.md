# Ferry, Slack Water

## Artist statement
A ferry idling on flat water, drawn twice: once the way a draughtsman would
(a fine indigo hatch that builds the water, the far-bank bridge piers and the
hull as tone) and once the way a brush painter would (a handful of fat,
confident sumi strokes — the skyline, the horizon, the hull's edges). The two
passes disagree slightly in register, and that disagreement is the piece: the
black gesture floats above the blue description of the same scene, the way an
ink sketch lies on top of a faded survey drawing. It survived the cull because
the `sumie` style's extreme economy (80 strokes for the whole photo) turned out
to be an excellent foil for the calm-water treatment — each makes the other
look deliberate. Most of the sheet is paper.

## Materials
- **Paper:** A3 (420×297 mm) warm off-white cotton/rag, ~300 gsm, smooth
  cold-press — e.g. Hahnemühle Bamboo or a cream Arches; approx. `#EFE6D2`.
- **Layer 1 pen:** 0.3 mm technical pen/fineliner, **Indigo / Prussian blue**
  waterproof ink, approx. `#2F4F78` (e.g. Sakura Pigma Micron-style, or a pen
  filled with Platinum Carbon-adjacent indigo).
- **Layer 2 pen:** 0.8 mm brush-like marker / thick fibre pen, **Sumi black**,
  approx. `#14110F` (e.g. Pentel Brush pen or a 0.8 mm fibre-tip with
  pigment ink). Must be waterproof.
- Masking tape, soft pencil for registration marks.

## Process
1. Tape the paper flat on the plotter bed; mark a corner registration
   (two pencil ticks at the sheet's top-left and bottom-right inside the margin).
2. Plot `artwork-layer-1.svg` (water, 1680 strokes) with the indigo 0.3 mm pen.
   Let dry 10 minutes.
3. Without moving the sheet, swap pens and plot `artwork-layer-2.svg`
   (80 sumi strokes) with the 0.8 mm black pen. If the sheet must be
   removed, re-register on the pencil ticks; a 0.5–1 mm misregistration is
   welcome.
4. Optional hand step: a single dry-brush swipe of diluted grey sumi across
   the lower-left water, unmasked, then sign and date at the lower right.

## Plot settings
A3 landscape, 12.7 mm default CLI margin; pen widths 0.3 mm and 0.8 mm. Two
pen changes, one sheet; layer 1 is the long job (~20–30 min), layer 2 under 5 min.

## Reproduction
```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js image -i test-images/boats.jpg -o artwork-layer-1.svg \
  --calm-water --no-outlines --min-spacing 7 --max-spacing 30 --white-cutoff 0.25 \
  --value-bands 3 --paper a3 --orientation landscape --pen-width-mm 0.3 --seed 7
node packages/cli/dist/cli.js image -i test-images/boats.jpg -o artwork-layer-2.svg \
  --style sumie --paper a3 --orientation landscape --pen-width-mm 0.8 --seed 7
```
`preview.png` composites both layers (recoloured `#2F4F78` / `#14110F`) on
`#EFE6D2`, rasterized with `scripts/svg-to-png.mjs --width 1600`.

## Wishes
- A `--split-layers`-style way to run the same photo through two styles in one
  command, with automatic hold-off of the lower layer under the upper's strokes.
- A style knob for the sumie budget to scale with paper size.
