# Two Poles, One Weather

## Artist statement

Nothing in this drawing was shaded. It is a uniformly random tiling of a
diamond-shaped board by dominoes (sampled exactly, by domino shuffling),
and the only decision the pen makes is which dominoes to ink: the ones
lying flat. Near the top and bottom corners the tiling is forced, and the
dominoes line up in ruled ranks. Inside an inscribed circle they are
free, and the rules break into speckle. The arctic circle theorem says
that boundary is sharp, and this is that boundary drawn at 150-deep
resolution: a ragged, almost-circular shoreline where order gives way.

The piece survived the cull because it reads as a faceted lantern, or a
cut stone, lit from both ends. I split the two horizontal classes into
two inks. Frozen order at the top is cold blue-white, frozen order at the
bottom is hot copper, and in the middle the two inks interleave into a
dusk-coloured weather. The gradient is a theorem, not a gradient. The
orange appears in the top half and the blue in the bottom, flecked into
the "wrong" end, because disorder is the one place the two poles are
allowed to leak into each other. Compared against the other arctic-circle
studies this repo could make (one-class `dissolve`, four-colour `weave`,
`brick`), the two-pole `horizon` read most like a physical object.

## Materials

- **Paper**: A3 (297 x 420 mm), portrait, deep midnight-navy card, e.g.
  Canson Mi-Teintes Touch "Night Blue", or GF Smith Colorplan "Lapis"
  (~#14192b), 160-270 gsm, smooth side up.
- **Ink 1, "polar"** (`artwork-layer-1-blue.svg`): pale ice-blue gel
  pen, #bcd3ea (Sakura Gelly Roll Moonlight/Pastel Blue, or white gel mixed
  by use over blue). Tip about 0.4-0.5 mm.
- **Ink 2, "ember"** (`artwork-layer-2-copper.svg`): copper metallic or
  orange-copper gel/paint pen, #d9854f (Uni-ball Signo Metallic copper,
  or Posca PC-1MR copper). Same tip width.
- Low-tack masking tape; a soft rubber or 0.3 mm registration crosses
  pencilled in the margin (not in the SVG).

## Process

1. Tape the card flat to the plotter bed by its margins only. Pencil two
   light registration ticks on the paper edge (top-left and bottom-right)
   aligned to the plotter origin.
2. Load the ice-blue pen. Plot `artwork-layer-1-blue.svg` at A3 portrait,
   scale 100%. Let it dry 20 minutes (gel on dark card can smear).
3. Swap to the copper pen. Re-home using the pencil ticks. Plot
   `artwork-layer-2-copper.svg`. A hair of misregistration (under 0.3 mm)
   is welcome where the inks interleave.
4. Erase the pencil ticks. Mount in a float frame on a dark mat; the
   piece reads best under a single warm raking light.

## Plot settings

- A3 portrait, 297 x 420 mm, 15 mm margin, 1 px (0.26 mm) hairline in
  the SVG, drawn with a 0.4-0.5 mm pen.
- Layer 1 has 2,562 strokes, layer 2 has 2,618. Pen travel is already
  reduced by the built-in plot ordering.

## Reproduction

From the repo root after `pnpm install && pnpm build`:

```sh
node concept-brainstorming/2026-10-30-0614/render.mjs
```

This runs `generateArctic({ preset: 'horizon', order: 150, seed: 21,
upright: false })` on a 297 x 420 mm sheet with a 15 mm margin and
writes both layer SVGs (the script is `render.mjs` in this folder; two
runs give identical bytes). `preview.png` was made by recolouring the
two layers (#bcd3ea, #d9854f), merging them, and rasterizing with:

```sh
node scripts/svg-to-png.mjs merged.svg preview.png --width 1400 --background '#14192b'
```

## Wishes

- A CLI `arctic` command (there is none; this needed a scratch script).
- A way to give each domino class its own colour directly in `toSVGLayers`
  output, so the split layers don't need recolouring for preview.
