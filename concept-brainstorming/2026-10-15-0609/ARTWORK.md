# Desire Lines

## Artist statement

A slime mould has no map and no brain, yet given enough time it lays down
transport networks that engineers would recognise as efficient. This piece
draws those trails literally: every line is the path one agent of a
*Physarum* simulation took, so the bundles are real traffic, not decoration.
Where many agents shared a channel the strokes pile into a thick braided
cable; where one wandered alone it leaves a lone hairline.

It survived the cull because it reads three ways at once: a rail map of a city
that doesn't exist, river braids seen from orbit, and the venation of a leaf.
Bundles clipped at the frame suggest the network continues past the sheet.
Rejected: botanical-on-fracture ground (specimen too weak), another
fracture/kintsugi piece (already done), tight ring-start vortex (one-note).
The three simulation tiers (`rim`, `mid`, `core`) become three inks, so the
colour is information: indigo is the many, oxblood the busy arteries, black the
rare trunks.

## Materials

- Paper: A3 (297×420 mm), warm cream cotton-rag or hot-press, 300 gsm (≈ #efe6d2).
- Layer 1 (`rim`): indigo fineliner/gel pen, 0.3 mm, ≈ #1f3a5f (e.g. Sailor "Blue-Black" or Pilot Iroshizuku Kon-peki, in a fine pen).
- Layer 2 (`mid`): oxblood / brick-red fineliner, 0.3 mm, ≈ #8a2b1e.
- Layer 3 (`core`): black fineliner, 0.3 mm, ≈ #14110f.
- Masking tape (low-tack) for registration stops; 40 mm-margin mount board.

## Process

1. Tape the paper to the plotter bed against two registration stops (bottom and left edge). Mark the stop positions with pencil so the sheet can be re-seated.
2. Plot `artwork-layer-1.svg` with the indigo pen (the bulk of the work, ≈ 815 KB of paths). Let ink dry 10 minutes.
3. Without moving the paper, swap to oxblood and plot `artwork-layer-2.svg`. Red drawn over blue is intended: arteries sit on top of the fibres they bundle.
4. Swap to black and plot `artwork-layer-3.svg` (sparse trunk accents).
5. Dry overnight, then press flat; mount float-style on board with a 40 mm paper border.
6. Optional: a faint tea wash (cold black tea, one pass) on the cream sheet before plotting for a foxed ground — wait until fully dry.

## Plot settings

A3 portrait, 297×420 mm, SVG in mm, viewBox 891×1260 (3 px/mm), margin 15 mm
(45 px), pen width 0.3 mm (stroke-width 1 px ≈ 0.33 mm). Paths are
pre-optimised by core; three pen swaps. Plot order: layer 1, 2, 3.

## Reproduction

From the repo root after `pnpm install && pnpm build`:

```sh
node concept-brainstorming/2026-10-15-0609/render.mjs concept-brainstorming/2026-10-15-0609
```

Settings (in `render.mjs`): `generatePhysarum` seed 15, preset `network`, style
`paths`, startLayout `scatter`, pathFraction 0.025, gridCols 260, steps 600,
margin 45 px, 891×1260 px. The script was run twice with identical output.
SHA-256: layer-1 `fc151b1f…cc4c1`, layer-2 `bd6bacf3…54e1`, layer-3 `c8b89011…84bd5`.

`preview.png` was made by merging the three layers on `#efe6d2` with strokes
recoloured to the inks above and `node scripts/svg-to-png.mjs … --width 1600`.

## Wishes

- A `physarum` CLI command (currently core-only) with `--split-layers`.
- Soft clipping at the margin so bundles taper out instead of ending in a square cut.
- Per-layer pen widths so trunks could be a heavier pen rather than relying on bundling.
