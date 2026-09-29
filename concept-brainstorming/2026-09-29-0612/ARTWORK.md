# Well

## Artist statement

Two gratings, one hidden form. The `warp-grid` generator draws a flat
field of lines and lets invisible deformers bend it; the `blaze` preset
turns the base into rays fanning from a centre, and the same seed under
the `circles` pattern gives concentric rings bent by the *same* hidden
forms. Plotted in two colours on black card, rays and rings knit into a
warped polar grid — a gravity well, a lens, a cloth pulled through a
ring. Near the centre the lines crowd and pen-lift into a small dark
eclipse where the pull is too steep to draw; at the margins the grid
relaxes toward the sheet edge. It survived the cull against terrain
ridges, vortex combs and single-layer blaze because the second layer
converts a pretty sunburst into a *measured space*: you can read the
distortion cell by cell. Two warm metallics on black keep it quiet and
expensive.

## Materials

- Paper: black card, 250–300 gsm smooth (e.g. Colorplan Ebony), A3 (297×420 mm), portrait.
- Layer 1 (rays): pale gold gel/paint pen, 0.5 mm nib — #D9B45A.
- Layer 2 (rings): copper metallic pen, 0.5 mm nib — #C8643C.
- Low-tack masking tape, float-mount frame with black mount board.

## Process

1. Tape black card flat to the plotter bed, aligned to the corner stops. Mark the two registration corners lightly with pencil on the reverse of the tape edge so the sheet can be replaced exactly.
2. Load the gold pen. Plot `artwork-layer-1.svg` (rays). Test pressure on a scrap first — metallics need a slow pen speed (~20 mm/s).
3. Let dry 30 minutes. Do not move the sheet.
4. Swap to the copper pen, prime on scrap, and plot `artwork-layer-2.svg` (rings) without re-homing the sheet.
5. Dry 24 hours flat, then float-mount on black board.

## Plot settings

A3 portrait, 10 mm margin (CLI default), pen width 0.3 mm in the SVGs (use a 0.5 mm real nib for opacity on black; lines are ≥ 3 mm apart in the field, so nothing merges except near the centre). Layer 1: 139 strokes; layer 2: 95 strokes. Both are path-optimised for low pen-up travel.

## Reproduction

```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js warp-grid --preset blaze --seed 8 --paper a3 --deformers 3 -o artwork-layer-1.svg
node packages/cli/dist/cli.js warp-grid --preset blaze --pattern circles --seed 8 --deformers 3 --spacing 14 --paper a3 -o artwork-layer-2.svg
```

`preview.png` is both layers overlaid (rays #D9B45A, rings #C8643C) on #0B0B10.

## Wishes

- A two-pattern option in `warp-grid` so rays and rings come from one call with shared deformers and `--split-layers`.
