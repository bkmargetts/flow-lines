# Delta for a Body of No Water

## Artist statement

A slime mould (*Physarum*) given a plain sheet and no destination builds the
same network a river builds over ten thousand years: confluences, braided
ox-bows, blind spurs. Plotted as two passes — indigo bank lines, then a
burnt-sienna fill that slips a millimetre off the banks — it reads as an
aerial survey of a delta that never had water, or a leaf's veins, or a
wound. It survived the cull because it is the only candidate that stopped
reading as "simulation output" once the second colour was added: the
deliberate misregistration gives the channels a printed, hand-tinted-map
quality (like a hand-coloured 18th-century river chart), and the open
paper between the veins does most of the work. Of ~12 presets/styles and
four seeds, `denseWeb` seed 42 had the best balance of big empty
polygons, a few decisive trunk channels and fine capillaries. The
`veins`/`explore` presets collapsed into a column or a black knot.

## Materials

- **Paper:** A3 (297 × 420 mm) warm cream cotton, 300 gsm cold-press
  (e.g. Fabriano Artistico "Traditional White" / natural, ≈ #EFE6D2).
- **Pen 1 (layer 1, banks):** 0.3 mm pigment fineliner, Indigo — Sakura
  Pigma Micron-style "navy/indigo", ≈ #1C2766.
- **Pen 2 (layer 2, fill):** 0.3 mm pigment fineliner (or 0.5 mm gel for
  a denser fill), Burnt Sienna ≈ #B5532A.
- Low-tack masking tape, 4 registration pencil ticks, optional matte
  float-mount frame (oak, 40 mm white mat).

## Process

1. Tape the sheet to the plotter bed; mark two pencil corner ticks on the
   bed so the same sheet can be re-seated.
2. Plot `artwork-layer-2.svg` first (sienna) — it is the fill, and
   plotting it first keeps indigo lines crisp over it. Pen speed slow;
   hatch is dense (~2800 strokes), expect a long job.
3. Let ink dry 10 min. Do not move the paper; if you must, re-seat on
   the ticks.
4. Swap to the indigo pen and plot `artwork-layer-1.svg` (banks). The fill
   file already contains a 3 px / 2 px (≈ 1.06 mm / 0.7 mm) shift toward
   lower-right, so the sienna sits slightly off the indigo — this is the
   intended look; do not "correct" it.
5. Erase pencil ticks after 24 h. Float-mount, unglazed or with
   museum glass.

## Plot settings

- A3 portrait, 297 × 420 mm, SVG viewBox 842 × 1191 (1 px = 0.353 mm).
- Margin 40 px ≈ 14 mm clear border, both layers.
- Pen width ≈ 0.3 mm each; layer 1 ≈ 360 paths, layer 2 ≈ 2800 paths.

## Reproduction

From the repo root after `pnpm install && pnpm build`:

```sh
mkdir -p /tmp/out && node concept-brainstorming/2026-10-13-0609/render.mjs /tmp/out
```

`render.mjs` (in this folder) is the exact script; it calls
`generatePhysarum` with `{ width: 842, height: 1191, margin: 40, seed: 42,
preset: 'denseWeb', gridCols: 320 }`, `style: 'contour'` → layer 1, and
`style: 'hatch'` shifted by (+3, +2) px → layer 2, written through `toSVG`
with `optimize: true` and physical size 297 × 420 mm. Output is
byte-identical on re-runs (verified by md5).

`preview.png` was made by merging the two layers recoloured
(`#1c2766` banks, `#b5532a` fill) and rasterizing with
`node scripts/svg-to-png.mjs combo.svg preview.png --width 1400 --background '#efe6d2'`.

## Wishes

- A `physarum` CLI command with `--split-layers` so the two-pass
  contour/hatch split and a registration offset don't need a scratch script.
- A per-layer `offset` option in `toSVG`/stack recipes for intentional
  misregistration.
