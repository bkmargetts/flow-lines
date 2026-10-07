# Growth Against the Current

## Artist statement

A single coral colony, drawn as a plan-view growth map, sits in a field of
current lines that part around it. The colony's final silhouette is a bold
navy contour; behind it, in a warm vermilion, run the onion-skin rings of
every earlier outline — the colony remembering how big it used to be. The
water is a rhythmic grating of long wavering navy lines that is cut away
from the coral by a stencil clip with a few millimetres of reserved paper,
so the animal appears to push the current aside.

It survived the cull because it is the first piece in the studio to use the
`stack` command's *clip* machinery: the coral's own base lines become a
stencil for a completely different generator. Earlier experiments (coral
filled with a second grating, coral over a hatch ground) went muddy — fills
inside a maze-like silhouette fight the maze. Restraint won: two
inks, two generators, one decision (paper where the animal is).

## Materials

- Paper: Fabriano Artistico hot-press, natural white, 300 gsm, cut to A3
  (297×420 mm). A warm-white sheet matters; the preview uses `#f1ece0`.
- Pen 1 — navy: Sakura Pigma Micron 03 (0.35 mm) or equivalent archival
  fineliner, "Midnight Navy" `#0b1d3a`.
- Pen 2 — vermilion: fineliner/gel in "Vermilion" `#c8452b` (e.g. Staedtler
  pigment liner in orange-red), same ~0.3 mm width.
- Mount: float-mount on off-white board, no glass glare; or 40×50 cm mat.

## Process

1. Tape the paper to the plotter bed; mark and note the registration
   position (bed corner stop).
2. Plot `artwork.L1-grid.svg` (the current) with the navy pen, 0.3 mm.
3. Swap to navy still loaded; plot `artwork.L0-edge.svg` (bold coral
   silhouette, three offset passes) — same pen, same sheet, no moving.
4. Swap to the vermilion pen. Plot `artwork.L0-ring.svg` then
   `artwork.L0-relic.svg` (growth-history rings and fragmentary relics).
   Do not move the paper between pens; the rings are meant to sit very
   slightly off the navy contour anyway.
5. Let ink cure 24 h. Erase nothing — there is no pencil.
6. Optional hand step: a single thin wash of very dilute raw-umber/tea
   over the area *inside* the colony only (the reserved-paper animal),
   applied after cure, to warm the figure against the cool current.

## Plot settings

A3 portrait (297×420 mm), margin 15 mm, pen width 0.3 mm, render density
3 px/mm. Four SVGs, two pens. Pen-travel is already chained/ordered.

## Reproduction

`recipe.json` in this folder is the full recipe. From the repo root after
`pnpm install && pnpm build`:

```sh
node packages/cli/dist/cli.js stack concept-brainstorming/2026-10-07-0610/recipe.json \
  -o concept-brainstorming/2026-10-07-0610/artwork.svg --split-layers
```

This writes the four `artwork.L*.svg` files byte-for-byte (verified by
running twice and comparing md5s). `preview.png` was made from the
un-split composite (same command without `--split-layers`) with
`node scripts/svg-to-png.mjs full.svg preview.png --width 1600 --background '#f1ece0'`.

## Wishes

- A `fill`-mode for the stencil clip (interior of the lobes rather than the
  base-line band) so the interior and the channels could take different pens.
- Per-layer pen names in the split-layer output for easier plotting.
