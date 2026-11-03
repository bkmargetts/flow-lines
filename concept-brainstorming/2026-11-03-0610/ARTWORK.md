# Eye of the Bath

## Artist statement

A suminagashi bath caught at the instant a vortex opens in it: seventy
ink drops, each ringed six times, sheared into a single cyclone whose eye
sits just off-centre while the unstirred drops drift at the edges like
moons. Three inks — gold, silver, verdigris — are dealt to the drops in
rotation, so the spiral arms interleave as coloured strata, like an
aerial photograph of a storm or a night-sea whirlpool drawn with
instruments.

It survived the cull against a dozen marbling variants (zig-zag feather
combs, calm stone patterns, sparse single-vortex seeds, a wave-like seed
90). Seed 8 won because the composition is decided: one still centre,
ink-free dark paper doing half the work, and the lines thickening into
bundles only where the shear is strongest. Metallic ink on midnight
paper turns a contour diagram into a night-sky object. Marbling is
unused in earlier sessions, so this adds a new material voice.

## Materials

- **Paper:** A3 (297 × 420 mm) portrait, midnight-blue / indigo card,
  ~220–300 gsm, smooth (e.g. Colorplan "Ink"/"Dark Blue" or Canson
  Mi-Teintes indigo). Approximates `#101b30`.
- **Pen 1 – gold:** metallic gold gel/paint pen, 0.3–0.7 mm bullet or
  fine tip (e.g. Sakura Gelly Roll Metallic Gold / Posca PC-1MR in gold),
  ≈ `#d9b45a`.
- **Pen 2 – silver:** white-silver opaque gel pen, same width
  (Sakura Gelly Roll Moonlight Silver / Uni-ball Signo Broad white),
  ≈ `#d7dde6`.
- **Pen 3 – verdigris:** opaque teal-green gel/paint pen, same width
  (e.g. Posca PC-1MR "light green" mixed toward teal, or Sakura Gelly
  Roll Moonlight Aqua), ≈ `#5fb3a1`.
- Low-tack masking tape, soft pencil for registration marks, optional
  matt spray fixative, deep float frame with museum glass.

## Process

1. Tape the sheet flat to the plotter bed with low-tack tape at all four
   corners. Mark the home position in pencil on the paper's outer edge so
   the sheet can be re-seated.
2. Load `artwork.ink-0.svg` with the **gold** pen. Pen-down height must be
   tuned on a scrap of the same card: metallic pens need light contact
   and a slow speed (≈ 15–20 mm/s) so ink flows without blobbing. Plot.
3. Let the gold dry ≥ 30 min (metallic pigment smears). Do not move the
   sheet.
4. Swap to the **silver** pen, load `artwork.ink-1.svg`, re-home to the
   same origin, plot. The layers are designed to overlap in places (they
   share the shear field), so keep the sheet still — no re-seating.
5. Dry 30 min, swap to **verdigris**, load `artwork.ink-2.svg`, plot.
6. Dry 24 h, lightly mist with matt fixative, and mount float-style on
   off-white board in a deep frame with museum glass so the metallic
   lines catch light at an angle.

## Plot settings

- A3 portrait, 297 × 420 mm, margin 10 mm, pen width 0.3 mm (nominal;
  a 0.5–0.7 mm paint pen reads bolder and is also fine).
- 234 strokes total across the three layers, chained and ordered by the
  default optimiser; pen travel is small and each layer plots in
  well under 30 minutes.

## Reproduction

Run after `pnpm install && pnpm build`, from the repo root:

```sh
node packages/cli/dist/cli.js marbling --pattern vortex --seed 8 \
  --paper a3 --drops 70 --drop-radius 70 --rings-per-drop 6 \
  --ink-groups 3 --vortex-strength 1 --comb-strength 0.6 --wobble 0.4 \
  --split-layers -o artwork.svg
```

This writes `artwork.ink-0.svg`, `artwork.ink-1.svg`, `artwork.ink-2.svg`
(byte-for-byte identical to the files in this folder; verified on
re-run). `preview.png` is the three layers merged with stroke colours
`#d9b45a`, `#d7dde6`, `#5fb3a1` on `#101b30`, rasterised with
`scripts/svg-to-png.mjs --width 1400`.

## Wishes

- Per-layer colour metadata in the split-layer SVGs (so previews don't
  need a hand-merged recolour step).
- A way to bias drop placement/ink assignment so each colour can own a
  region of the vortex rather than being dealt in rotation.
