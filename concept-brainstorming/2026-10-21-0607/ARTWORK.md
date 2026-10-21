# Scale of Play (Plate I)

## Artist statement

A natural-history plate for objects nobody classifies. Six balls — basketball,
football, volleyball, baseball, tennis ball, table-tennis ball — are drawn at
their *true relative diameters* (24.0, 22.0, 21.0, 7.4, 6.7 and 4.0 cm, at
1 : 1.82) and tilted at different angles so each shows its seam logic. Each
carries a single crescent of shadow-side hatching and nothing else: the
paper does the lighting. Beneath each, a red engineer's dimension line
measures its diameter, and a ten-centimetre scale bar sits in the corner —
the way an archaeologist photographs a find.

It survived the cull because it is quiet. Earlier candidates were piles and
patterns of balls; they read as clip-art. Isolating each ball, spacing them
like specimens and adding one measuring pen turned the same generator into
something between a museum label and a draughtsman's study. The gap between
the huge trio and the tiny trio is the whole joke and the whole picture.

## Materials

- Paper: warm off-white cartridge / hot-press, 200 gsm, A3 (297 × 420 mm), portrait
  (preview approximates it with #f1ebdd).
- Pen 1 (balls): 0.35 mm fineliner, Sepia-black / carbon "Warm Black" #1b1b1b
  (e.g. Sakura Pigma Micron 03 in black).
- Pen 2 (measurements): 0.35 mm fineliner, Signal Red #b3261e
  (e.g. Staedtler Pigment Liner 308, red).
- Mount: float-mount in a plain pale-oak frame with a 60 mm off-white mat.

## Process

1. Tape the paper flat and square to the plotter bed, A3 portrait.
2. Load Pen 1; plot `artwork-layer-1.svg` (all six balls). Let dry 10 min.
3. Without moving the paper, swap to Pen 2 and plot `artwork-layer-2.svg`
   (dimension lines + scale bar). The two layers share the same 297 × 420 mm
   frame, so registration is guaranteed if the paper has not moved.
4. Optional hand step: with a fine brush pen, write each diameter
   ("24.0 cm", "22.0 cm", "21.0", "7.4", "6.7", "4.0") above its red line and
   "0 — 10 cm" under the scale bar, in a small draughtsman's hand.
5. Frame.

## Plot settings

A3 portrait, 297 × 420 mm, no page margin in the SVG (composition keeps
≥ 14 mm clear of every edge), pen width 0.35 mm on both layers (1 px = 1/3 mm
in the files). Layer 1 ≈ 175 strokes per ball set; layer 2 is 43 strokes.

## Reproduction

`make-plate.mjs` (in this folder) is the generator; it uses the core
`generateSportsBalls` once per ball (seeds 3…8, one ball each, `spin 0.6`,
`shading 0.9`, `castShadows 0.5`, `wobble 0.5`, `lightAngle -2.2`) and places
each result at a fixed page position. From the repo root, after
`pnpm install && pnpm build`:

```sh
mkdir -p /tmp/out && cd /tmp/out
node <repo>/concept-brainstorming/2026-10-21-0607/make-plate.mjs
# writes artwork-layer-1.svg and artwork-layer-2.svg, byte-identical to this folder
```

`preview.png` is both layers recoloured (#1b1b1b / #b3261e) and rasterised
with `scripts/svg-to-png.mjs --width 1600 --background '#f1ebdd'`.

## Wishes

- A `sports-balls` CLI command exposing per-ball placement (a `--layout row|grid|explicit`).
- Text glyph strokes (a single-line font) so labels could be plotted rather than hand-lettered.
- Seam drawing for baseballs (stitches) — the baseball currently reads close to a tennis ball.
