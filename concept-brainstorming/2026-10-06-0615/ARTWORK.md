# Gyre

## Artist statement

A still bath of dark water, three inks dropped on it, one hard stir.
Across the upper two-thirds of the sheet the drops sit as they fell —
slightly squashed rings, stacked like stones in a river. Low on the page
the bath has been dragged into a vortex: the same rings are sheared,
folded and wound into a spiral, and the colours (white, gold, teal)
interleave where the flow tore them past each other.

It survived the cull because it has a *place*: calm above, turbulence
below, and a single eye you reach by following the lines downhill.
Eleven seeds and four patterns (feather, bouquet, stone, vortex) were
rendered; feather and bouquet read as hatching or fringe, small-drop
vortex sheets were empty. Drop radius 60 with 80 drops gave full coverage
and seed 12 was the one where the whirl sits off-centre with room to
breathe. Marbling is hardly used elsewhere in the studio, and never in
metallic ink on night-blue stock — the only context where its line-only
rings read as light on water rather than as a contour map.

## Materials

- **Paper:** A3 (297 × 420 mm) midnight / navy cover stock, 200–300 gsm,
  smooth (e.g. Colorplan "Mulberry"-style dark blue, or Canson Mi-Teintes
  "Indigo"), approx. `#10142a`.
- **Pens (0.3 mm line, opaque on dark paper):**
  1. ink-0 — white gel pen, "Snow White" `#f0ede4` (Sakura Gelly Roll Classic 0.4 or Uni-ball Signo UM-153)
  2. ink-1 — gold paint marker/gel, "Pale Gold" `#d9b45b` (Sakura Gelly Roll Metallic Gold)
  3. ink-2 — teal/aqua gel, "Sea Glass" `#6fbfb8` (opaque pastel teal gel pen)
- Low-tack masking tape, soft float-mount board.

## Process

1. Tape the A3 sheet portrait to the plotter bed with low-tack tape at the
   corners only; mark the sheet's top-left corner position with a pencil
   tick on the bed for re-registration.
2. Fit the white gel pen. Plot `artwork.ink-0.svg` at true size (A3 portrait,
   no scaling; the page margin is already built into the SVG).
3. Let the gel set 30 minutes (opaque gel on dark paper smears if touched).
4. Swap to gold, return the sheet to the pencil tick without untaping if
   possible; plot `artwork.ink-1.svg`.
5. Repeat with teal for `artwork.ink-2.svg`. Order matters only slightly —
   white last would sit crispest on top where lines cross, so swap steps 2
   and 5 if the crossings look muddy.
6. Cure 24 h flat, then float-mount without glass contact (gel stays tacky
   for days).

## Plot settings

A3 portrait, 891×1260 px canvas = 297×420 mm, default margin, pen width
0.3 mm (0.9 px) per layer. Stroke counts: 89 / 85 / 93 (267 total); the
rings are smooth Q-curves so plotting is quick, about 20 minutes per layer.

## Reproduction

```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js marbling --pattern vortex -s 12 \
  --paper a3 --orientation portrait --ink-groups 3 \
  --drops 80 --drop-radius 60 --rings-per-drop 5 --vortex-strength 0.8 \
  --split-layers -o artwork.svg
```

This writes `artwork.ink-0.svg`, `artwork.ink-1.svg`, `artwork.ink-2.svg`.
Preview recolour: layers recoloured `#f0ede4`, `#d9b45b`, `#6fbfb8` on `#10142a`
and rasterized with `scripts/svg-to-png.mjs`.

## Wishes

- A `--vortex-center` flag to place the eye deliberately instead of by seed.
- Per-layer colour hints in the exported SVGs (stroke colour per ink group)
  so a preview needs no recolouring step.
