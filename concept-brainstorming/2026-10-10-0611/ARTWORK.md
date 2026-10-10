# Small World, Wreathed

## Artist statement
A hand-drawn-looking globe, a graticule of fine indigo lines, floats in the
middle of a loose wreath of climbing jasmine. It reads as a garden-party
keepsake for a planet: something to be looked after. It survived the cull
because the two generators already speak the same language. Both use the
same plain, un-fussy pen line, so the pairing looks like one illustrator
drew it. The globe stays cool and exact while the wreath is wild, and the
wide paper margin around them does the rest. The wreath's flowers kiss the
globe's lower-right limb. I kept that on purpose, as the one place the
garden touches the world.

## Materials
- Paper: 300 gsm warm cream cotton rag, hot-press, A4 (210 × 297 mm) — approx. #F1EAD8.
- Pen 1: leaf-green fineliner / gel pen, 0.3 mm — "Forest Green", approx. #2F6B3A.
- Pen 2: deep indigo fineliner, 0.3 mm — "Prussian Indigo", approx. #1B2A5C.
- Optional: very dilute pale-gold watercolour wash (e.g. Quinacridone Gold) inside the flower outlines, applied after the pens are fully dry (24 h).
- Mount: float mount in a warm white frame, A4 sheet visible.

## Process
1. Tape the sheet to the plotter bed, portrait, with the registration corner marked in pencil.
2. Load pen 2 (indigo) and plot `artwork-layer-2.svg` (the globe, 139 paths). Do this first, so ink lines from the wreath never overprint the globe by accident.
3. Let it dry 10 minutes. Without moving the paper, swap to pen 1 (green) and plot `artwork-layer-1.svg` (the wreath, 2891 paths).
4. Where the lower-right flowers meet the globe's limb, the lines cross slightly. This is intended; leave it.
5. After 24 h, optionally touch the petals with a dry-brush gold wash. Erase pencil marks. Float-mount.

## Plot settings
- A4 portrait, 12 mm margin, 0.3 mm pen width on both layers (SVG strokes are 0.9 user units, scaled from a 630×891 viewBox).
- Both layers are plain stroked paths, single pen each.
- Total plot time is short; the wreath's optimized path order keeps pen travel low.

## Reproduction
Run from the repo root after `pnpm install && pnpm build`:

```sh
node packages/cli/dist/cli.js botanical --paper a4 --composition wreath --seed 4 -o artwork-layer-1.svg
node packages/cli/dist/cli.js planet --paper a4 --type terrestrial --radius-frac 0.44 --light-elevation 20 --seed 3 -o artwork-layer-2.svg
```

The preview was made by recolouring layer 1 strokes `#2a2a26` → `#2f6b3a`
and layer 2 strokes → `#1b2a5c`, merging both into one SVG, and running:

```sh
node scripts/svg-to-png.mjs merged.svg preview.png --width 1600 --background '#f1ead8'
```

## Wishes
- A shared "place this generator inside that generator's hole" option, with hold-off, so the wreath could be sized to the globe and stay clear of it.
- A `--stroke` colour flag on the CLIs, so each layer's pen colour is written into the SVG.
