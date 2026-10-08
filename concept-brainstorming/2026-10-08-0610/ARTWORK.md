# Lee Slope

## Artist statement

A photograph of cloud, run through the repo's `sumie` ink philosophy, stops
being cloud. Sixty-nine strokes are all that survive: a bundle of long
parallel lines that bend together where the form turns, a few heavy
dry-brush dashes where an edge catches, and an enormous quantity of
untouched paper above. It reads as a snowdrift, a folded cloth or the
flank of a mountain seen from a long way off — the picture never says
which, and that is why it survived the cull.

The session tried `sumie` and `dore` on a ferry, a forest, a cat in snow, a
Moscow arcade and this cloudscape. `dore` turned everything into
cross-hatch mud (the forest became a woven mat); the ferry and arcade in
`sumie` were tidy but diagrammatic. The cat's back and the cloud both
showed what `sumie` is for — restraint — and the cloud has the cleanest
gesture: parallel strokes that lean into one diagonal like a single
sweep of a loaded brush, with the sky given entirely to the paper.
Roughly seven in ten of the page is left blank on purpose; the wash does
the sky.

## Materials

- **Paper:** warm off-white washi / kozo-gampi, ~110 gsm, A3 (297×420 mm),
  landscape. Preview approximates it as `#e9e2d0`.
- **Line pen:** Sakura Pigma Micron 05 (0.45 mm) in *sumi black* `#14130f`
  (archival pigment; it must not bleed under a wash).
- **Wash:** Daniel Smith watercolour *Indanthrone Blue* `#2b3a55`, very
  dilute (about 1 part pigment to 30 water), plus a soft brush (size 12 mop).
- Masking: low-tack artist tape, drafting dots, clean water brush.

## Process

1. Stretch the washi: tape all four edges to a board with low-tack tape so it
   stays flat when wet later.
2. Load `artwork.svg` in the plotter software at 100 % scale, A3 landscape.
   Plot with the Micron 05 in the holder, pen-down height set so it just kisses
   the surface (the heavy dashes are repeated offset passes of the same pen,
   not wider strokes). Plot the whole sheet in one pass.
3. Let the ink cure for 24 h. Micron pigment is waterproof once dry.
4. Wet the paper above the ridge line only (the upper ~60 % of the sheet)
   with a clean brush, stopping about 5 mm short of the topmost strokes so no
   water touches line work.
5. Drop in the dilute indanthrone wash, graded: strongest at the top edge,
   fading to nothing at the ridge. Tilt the board 10° to let it run toward the
   lines. No second coat.
6. Dry flat, untape, trim 10 mm of the taped border, float-mount.

## Plot settings

- Paper A3 landscape, 420×297 mm, default CLI margin.
- Pen width: CLI default for `--style sumie` (Micron 05).
- Single layer, one pen, 69 paths; low pen travel because strokes are long and
  continuous.

## Reproduction

```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js image -i test-images/sky-clouds.jpg \
  -o concept-brainstorming/2026-10-08-0610/artwork.svg \
  --style sumie --paper a3 --orientation landscape --seed 42
node scripts/svg-to-png.mjs concept-brainstorming/2026-10-08-0610/artwork.svg \
  concept-brainstorming/2026-10-08-0610/preview.png --width 1600 \
  --background '#e9e2d0' --stroke '#14130f'
```

## Wishes

- A `--crop` option on `image` to re-frame the subject: the drawing sits low
  and left with a large empty upper sheet (here it helps the wash, but a
  controlled crop would be better).
- Per-style stroke-width control so heavy dashes could be varied by pen swap.
