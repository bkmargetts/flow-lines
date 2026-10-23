# Ember, Ruled

## Artist statement

A star drawn with nothing but a ruler's worth of vertical lines. Every
stroke on the sheet runs top to bottom at the same pitch (1.5 mm); the
only thing that changes is *which pen* a given stroke is drawn with. Five
inks are laid out radially from the centre — cream-white, sun yellow,
orange, crimson, violet — and the generator's colour-field mixer lets
neighbouring inks interleave so the hot core cools into the rim through
real optical mixing (yellow lines beside orange lines read as amber),
never a hard boundary. A slow noise warp of the gradient coordinate makes
the burn irregular, and a coarse dither drops strokes out in small dark
fissures, so the disc reads as a convecting surface — a gas giant, a sun,
a coal — while being, line for line, a barcode.

It survived the cull over two siblings. A ring wreath of sports balls
(discarded: a lumpy necklace, no tension) and the same disc in a single
cream ink (discarded: a lovely moon, but the idea is colour built from
line density, and one pen can't say that). The finished piece is the
simplest of the three and the only one that glows from across a room.

## Materials

- **Paper:** black or near-black card, e.g. Colorplan "Ebony" / Canson
  Mi-Teintes Touch black, 160–270 gsm, A3 (297 × 420 mm), portrait.
- **Pens (all ~0.4 mm, opaque gel / paint-marker, one per layer):**
  | File | Ink | Hex |
  |---|---|---|
  | `artwork-layer-0.svg` | Cream white (e.g. Sakura Gelly Roll "White") | `#fff4d6` |
  | `artwork-layer-1.svg` | Sun yellow (Posca PC-1MR "Yellow") | `#ffd23f` |
  | `artwork-layer-2.svg` | Orange (Posca PC-1MR "Orange") | `#ff7a1a` |
  | `artwork-layer-3.svg` | Crimson / hot pink (Posca PC-1MR "Pink"/"Red") | `#e0245e` |
  | `artwork-layer-4.svg` | Violet (Posca PC-1MR "Purple") | `#6a3dc9` |
- Low-tack masking tape, 4 corner registration pins or tape stops,
  float-mount frame (black box frame, 5 mm gap).

## Process

1. Tape the black card flat on the plotter bed against fixed corner stops
   so it can be removed and returned to exactly the same place.
2. Plot `artwork-layer-2.svg` (orange, the bulk of the surface) first.
3. Swap to `artwork-layer-3.svg` (crimson); plot.
4. `artwork-layer-1.svg` (yellow); plot.
5. `artwork-layer-0.svg` (cream, the white-hot core — sparse); plot.
6. `artwork-layer-4.svg` (violet — only a handful of strokes on the very
   rim, a cold edge); plot.
7. Let paint markers cure 24 h before handling. Mount floating, unglazed
   or with spacers so nothing touches the ink.

Order is warm-bulk first so lighter, more opaque inks sit on top where
strokes meet. Pen swaps need no re-registration if the stops hold; if
the sheet is removed, re-seat it in the corner stops.

## Plot settings

A3 portrait, 297 × 420 mm, disc of Ø 224 mm centred at (148.5, 210) mm,
vertical lines at 1.5 mm pitch, pen width 0.4 mm, five pens, ~770 strokes
total (35 / 144 / 307 / 313 / 6 per layer), no pen travel optimisation
needed — all strokes are short verticals.

## Reproduction

From the repo root after `pnpm install && pnpm build`:

```sh
node concept-brainstorming/2026-10-23-0615/render.mjs concept-brainstorming/2026-10-23-0615
```

`render.mjs` (committed in this folder) calls `generateColorField` with
seed 5 and writes `artwork-layer-0..4.svg` (band-00 … band-04). The
preview was made with:

```sh
PREVIEW_DIR=<scratch> node concept-brainstorming/2026-10-23-0615/render.mjs <scratch>
node scripts/svg-to-png.mjs <scratch>/combined.svg concept-brainstorming/2026-10-23-0615/preview.png --width 1400
```

(`combined.svg` is coloured per layer on `#101014` paper.)

## Wishes

- A CLI command for `color-field` with `--split-layers`.
- A radial colour-field that can be masked to an *annulus*, to leave a
  paper-black eclipse disc in the middle.
