# Moonfall

## Artist statement

A gold-engraved moon hangs over a black sea, and the sky beneath it is not
filled but *rained*: long, broken vertical strokes that thin out upward and
stop dead at the moon's edge, so the moon seems to have shouldered the sky
aside. The sea answers in horizontal dashes, a headland of slanted hatching
anchors the corner, and the one warm colour sits in the only place the eye
should land. Two generators that never meet in the CLI — `landscape` and
`planet` — are married through the layer stack, using hold-off to carve the
moon out of the sky hatching as reserved paper.

It survived the cull because the first pass (everything white, a full-density
sky) read as a screensaver; thinning the sky tone to almost nothing at the
top and making the moon the only gold object turned it into a nocturne.
Earlier studio pieces use planets alone or landscapes alone; this is the
first to stack them.

## Materials

- **Paper:** A3 (297 × 420 mm), portrait, midnight-indigo stock ~200 gsm —
  e.g. a dark navy cover paper (≈ `#14172B`). Matte, smooth enough for gel pens.
- **Layer 1 — moonlight white:** opaque white/ivory gel pen, 0.5 mm nib
  (Sakura Gelly Roll Moonlight white, or Uni-ball Signo broad white), ink
  ≈ `#E8E4D8`.
- **Layer 2 — moon gold:** gold gel pen or paint marker, 0.5 mm
  (Sakura Gelly Roll Metallic Gold), ink ≈ `#D9B45A`.
- **Layer 0 — registration:** corner crosses, plotted first in a soft pencil
  or any pen — they sit 3 mm from the paper edge, outside the trimmed area.
- Optional: float mount in a black box frame, no glass reflections (acrylic).

## Process

1. Tape the sheet flat to the plotter bed; square it to the carriage.
2. Plot `artwork-layer-0-register-crosses.svg` with a pencil (or skip if the
   bed has hard stops).
3. Swap to the white gel pen. Plot `artwork-layer-1-moonlight-white.svg`
   (sky, sea, headland). Let dry 15 min — gel ink smears if touched.
4. Swap to the gold pen. Re-register on the crosses, plot
   `artwork-layer-2-moon-gold.svg` (the moon). The moon needs no overlap with
   white: the stack already held the sky strokes off it by 1.5 mm-class
   hold-off, so there is nothing to misregister into.
5. Optional hand step: with a dry-brush and diluted gold ink, glaze a single
   pass along the moon's lit limb to catch the light.

## Plot settings

A3 portrait, 16 mm margin, 0.3 mm nominal pen width in the file (use a 0.5 mm
gel nib on dark stock; scale-up is cosmetic only), two pen swaps,
~2,700 strokes.

## Reproduction

```sh
pnpm install && pnpm build
D=concept-brainstorming/2026-11-01-0607
node packages/cli/dist/cli.js stack $D/recipe.json --crosses -o $D/artwork.svg
node $D/split.mjs   # writes the three per-pen layer SVGs
node scripts/svg-to-png.mjs $D/artwork.svg $D/preview.png --width 1400 --background '#14172b'
```

`recipe.json` (committed alongside) holds every seed: landscape seed 11,
planet seed 5. Output is byte-deterministic.

## Wishes

- A `mirror`/`flipY` transform on stack layers, so the moon could be
  reflected in the water as a broken gold column instead of relying on the
  landscape's small built-in shimmer (which here is faint).
- Sun-position-in-mm in the landscape generator, so the sun hole could be
  aligned to a stacked planet without hand-converting to pixels.
