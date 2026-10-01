# Eddy Current

## Artist statement

A single combed-and-twisted marbling bath, drawn as contour only: three
families of nested rings that a vortex has dragged out of round and
wound into a slow spiral. Tradition says a marbler lifts the colour;
here the plotter lifts only the *edge* of each ink, so the picture is
the water's structure with the stain removed. Three pens (old gold,
burnt copper, pearl) are one bath's three ink groups, plotted onto
midnight-indigo stock so they glow like lamplight on a night river.

It survived the cull because it is the one vortex seed where the
twist lands off-centre and high, leaving a big quiet hollow lower
right for the eye to rest in while the spiral argues with the page
edge. Other seeds (and a "tuned" drops/radius run) gave either
scattered pebbles or uniform swirl. The default drop scale was the
right one; the discovery was that A3 portrait, seed 3, is the
composition. Prior marbling work in this studio (Suminagashi — Three
Castings) used rings and calm water; this is the turbulent end of the
same module, in colour, as a single large sheet.

## Materials

- **Paper**: A3 (297×420 mm) deep midnight/indigo cotton or card,
  ~300gsm, smooth (e.g. Canson Mi-Teintes Touch-style dark blue, or
  Colourfix-free black-navy card; approx. `#14213d`).
- **Pens** (all 0.3 mm line, opaque pigment/gel so they show on dark):
  - Layer 1 — old gold, `#d9a441` (metallic gold gel pen / paint marker fine tip)
  - Layer 2 — burnt copper, `#c8673a` (copper metallic or opaque orange-brown gel)
  - Layer 3 — pearl white, `#ece6d2` (white/ivory gel, e.g. Sakura Gelly Roll 0.3-ish)
- Low-tack masking tape, 4 corner registration pencil dots, black float mount frame.

## Process

1. Tape the sheet flat to the plotter bed with low-tack tape; mark the
   corners with a soft pencil/chalk register so the sheet can be
   re-seated exactly.
2. Plot `artwork-layer-1.svg` (gold). Let ink dry fully (gel metallics: ~30 min).
3. Without moving the sheet if possible (else re-seat to register
   marks), swap to copper and plot `artwork-layer-2.svg`.
4. Swap to pearl and plot `artwork-layer-3.svg` last, so the brightest
   lines sit on top where the layers touch.
5. Dry 24 h, remove tape, mount floating in a black frame with a wide
   indigo or black mount; no glazing contact with the ink.

## Plot settings

A3 portrait, 18 mm margin, 0.3 mm pen, three pen swaps, 123 strokes
total (very short travel; plots in well under 30 minutes).
Preview `preview.png` recolours the three layers to the hex values above on `#14213d`.

## Reproduction

```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js marbling --paper a3 --pattern vortex \
  --seed 3 --ink-groups 3 --margin-mm 18 --pen-width-mm 0.3 \
  --split-layers -o artwork.svg
# writes artwork.ink-0.svg / ink-1 / ink-2  → artwork-layer-1/2/3.svg
```

Preview: recolour each layer's `stroke` to `#d9a441`, `#c8673a`, `#ece6d2`,
merge into one SVG and run
`node scripts/svg-to-png.mjs merged.svg preview.png --width 1600 --background '#14213d'`.

## Wishes

- `svg-to-png.mjs` accepting several layer SVGs with a colour per layer.
- A `marbling` flag to bias vortex centre placement.
