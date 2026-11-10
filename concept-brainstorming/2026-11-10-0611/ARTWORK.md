# Soft Downtown

## Artist statement
A city drawn the way a tired architect doodles one in a margin: towers that
slump, lean and bow, roofs that sag like bread, windows reduced to a few
shorthand ticks. The generator's `order` slider sits near the organic end
(0.12), where the rigid isometric grid gives way to wobble. What survived
the cull: the rigid (order 0.95) sibling is competent but reads as clip-art;
the loose version has a character and humour a human hand would have. The
paper does the work: the sun-side faces stay blank, the shadow faces carry
one confident diagonal hatch.

## Materials
- Paper: A3, 160–200 gsm warm toned cream (hex ~#E9DCC0), e.g. Strathmore
  Toned Tan / Canson Mi-Teintes "Cream".
- Pen: 0.35 mm archival fineliner in Ink Navy / Midnight Blue (~#1D2B44),
  e.g. Sakura Pigma Micron 03 in blue-black, or plotter-fitted equivalent.
- Optional hand step: dilute Payne's grey watercolour (~#536878), small
  round brush, a size 4.
- Masking/mounting: low-tack tape, float mount in an off-white frame.

## Process
1. Tape the cream sheet to the plotter bed, landscape, corners square.
2. Plot `artwork.svg` with the navy 0.35 mm pen (single layer, single pass).
3. Let ink cure 24 h (pigment ink must be waterproof).
4. Optional: with the dilute Payne's grey, wash only the hatched shadow
   faces, one flat pass each, leaving the lit faces and roofs bare paper.
   Let some washes bleed past the hatch lines slightly.
5. Dry flat under a weight, float-mount.

## Plot settings
A3 landscape (420×297 mm), margin 15 mm, pen 0.35 mm, one layer. The SVG is
already path-optimised (`optimize: true`).

## Reproduction
Requires `pnpm install && pnpm build`. From repo root:
```sh
node concept-brainstorming/2026-11-10-0611/render.mjs
node scripts/svg-to-png.mjs concept-brainstorming/2026-11-10-0611/artwork.svg \
  concept-brainstorming/2026-11-10-0611/preview.png --width 1600 \
  --background '#e9dcc0' --stroke '#1d2b44'
```
`render.mjs` (in this folder) calls `generateCity({width:420,height:297,
margin:15,seed:11,order:0.12,style:'towers',blockCols:7,blockRows:5,
density:0.8,windows:0.5,penWidth:0.35})`. artwork.svg sha256:
`024b294f09cea06d994956f8b8b376f080a9513ded1e3baf6cc12b5f03ab959b`.

## Wishes
- A `city` CLI command (currently core-only).
- A fixed-footprint mode so the same city could be drawn at two `order`
  values and overlaid as two misregistered colour plates; today the layout
  changes with `order`.
