# Crossing

## Artist statement

A ferry, a far shore, and almost nothing else. The `sumie` style of the
`image` command reduces a harbour photograph to a handful of confident,
tapering brush-like strokes: a skyline that is barely a skyline, a
horizon pulled taut, a wake of long parallel lines. It survived the cull
because every other photo-to-ink render I made (Doré-style St Basil's,
the boots in cross-hatch) answered "how much can be drawn?" — this one
answers "how little must be?" The paper does nearly all of the work, and
the single hand step (an indigo wash laid under the horizon) turns an
empty page into water. Seed 23 beat seeds 7 and 11 because it keeps the
long left-hand swell out of the frame and lets the wake carry the
composition diagonally toward the lower right.

## Materials

- **Paper:** warm off-white washi-style or lightly toned cotton rag,
  200–300 gsm (must take a wet wash without cockling), cut to A3
  (297 × 420 mm) — preview approximates `#e9dfc8`.
- **Pen:** one waterproof, pigment-based fineliner, 0.8–1.0 mm brush-bullet
  or felt tip, black-brown "Sumi" `#1b1a20` (e.g. Pentel Pigma / Sakura
  Pigma Brush class; must be waterproof — test on offcut).
- **Wash:** indigo watercolour or diluted Chinese ink in indigo `#3b4a6b`,
  one large flat brush (25 mm), clean water, masking tape.

## Process

1. Tape the paper to the plotter bed; fit the pen.
2. Plot `artwork.svg` (single layer, single pen). Let the ink cure at
   least 24 hours.
3. Mask the sky with tape along the horizon line, 3 mm above the long
   horizontal stroke, leaving the water area open (tape the paper's
   outer edge so the wash stops short of the margin).
4. Wet the water area with clean water, then drop in a very dilute
   indigo wash with the flat brush in horizontal passes, deeper toward
   the foreground and fading to nothing toward the horizon. Leave the
   ferry's hull unwashed by lifting colour with a damp brush.
5. Dry flat, remove tape, press under a board overnight.
6. Float-mount in an off-white mount, 70 mm borders.

## Plot settings

- A3, landscape, default margin of the `image` command, pen width
  0.9 mm (the CLI default for the `sumie` style); ~81 paths, a short,
  quick plot.

## Reproduction

```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js image -i test-images/boats.jpg \
  -o concept-brainstorming/2026-10-03-0609/artwork.svg \
  --style sumie --paper a3 --orientation landscape --seed 23
node scripts/svg-to-png.mjs concept-brainstorming/2026-10-03-0609/artwork.svg \
  concept-brainstorming/2026-10-03-0609/preview.png --width 1600 \
  --background '#e9dfc8' --stroke '#1b1a20'
```

Verified byte-identical on a second run.

## Wishes

- Hand-brush "wet edge" and wash-region output from the `image`
  command (a second SVG layer of the water silhouette to use as a mask
  template).
