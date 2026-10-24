# Graben

## Artist statement

A graben is the block of crust that drops between two parallel faults —
the floor of a rift valley. Geologists draw it in cross-section as strata
that run level, break, step down together, and carry on at a lower
elevation, the same beds on both sides of the gap. This piece is that
diagram, drawn as if the section had been cut with a ruling pen.

The repo's `terraces` generator has never been used in a brainstorming
run. It is lapidary's seam-and-texture machinery turned into a section:
nine beds, each with its own mark (ruled verticals, long laminae that
follow the bed walls and bend across every fault, one pale stippled
sandstone), separated by reserved-paper seams. The `rift` preset throws
four faults with a heavy, inclined throw. Seed 11 was the one that
survived the cull: two faults pair up near each end and the whole stack
sags between them, a legible valley. The other seeds produced staircases
and scatter. This one has a symmetric, almost architectural shape.

What lifts it above a diagram is the pens. Four earth inks are
*interleaved stroke by stroke* instead of one ink per bed. Each bed
reads as a woven mix of rust, ochre, umber and slate. The dense lower
beds darken into a heavy slate-brown, the upper beds stay airy, and the
stipple band in the middle is a held breath of bare sandstone. Because
the colours are shared across beds, a bed's identity comes only from its
mark and tone, the way a field geologist's pencil does the same job.
Nothing is filled. Paper does most of the work.

## Materials

- **Paper:** A3 (297 × 420 mm), 200–300 gsm, smooth-to-lightly-toothed
  oatmeal / buff sheet (e.g. Fabriano Tiziano "Sabbia" or Canson Mi-Teintes
  "Sand", approx. `#e6dbc3`). Landscape.
- **Pens** (all 0.3 mm fineliner-class, pigment ink, same model per layer):
  1. Layer 1 — **Burnt Rust** `#8a3b12`
  2. Layer 2 — **Yellow Ochre** `#d19a3a`
  3. Layer 3 — **Raw Umber (dark brown)** `#3b2a20`
  4. Layer 4 — **Slate Teal** `#2f4a5a`
- Low-tack masking tape, soft pencil for registration ticks, 2 mm
  matt white-core mounting board and a float frame (optional).

## Process

1. Tape the paper to the plotter bed, landscape, with a corner stop. Mark
   the paper's lower-left and upper-right corners in pencil on the bed so
   it can be removed and replaced.
2. Plot `artwork-layer-2.svg` (ochre) first, lightest ink first.
   Let dry 10 minutes.
3. Plot `artwork-layer-1.svg` (rust), then `artwork-layer-4.svg`
   (slate), then `artwork-layer-3.svg` (umber) last. Re-seat paper against the
   corner stops between pens; a half-millimetre misregistration is
   welcome — the layers are interleaved, not overprinted, so they rarely
   touch, and any wander gives the section a hand-ruled look.
4. When dry (24 h), erase pencil marks. Optional: a very dilute tea wash
   (1 teabag per 250 ml, one pass with a wide flat brush, laid
   horizontally) over the whole sheet *before* plotting for a more aged
   field-notebook ground; plot only once the sheet is fully dry and flat.
5. Float-mount on white board with 2 mm gap in a shallow frame; hang
   landscape.

## Plot settings

- A3 landscape, 12 mm margin, 0.3 mm pen (stroke 0.9 px at 3 px/mm).
- Four layers of roughly 1,200 paths each, 4,800 strokes in total. Paths
  are chained and ordered by the generator (`optimize` on).
- Plot time is modest; the stipple band is the slowest part per mark.

## Reproduction

From the repo root after `pnpm install && pnpm build`:

```sh
node concept-brainstorming/<this-folder>/make.mjs <outdir>
```

`make.mjs` is the committed script. It is inlined here so the folder is
self-sufficient:

```js
import { generateTerraces, TERRACES_PRESETS, toSVGLayers } from '../../packages/core/dist/index.js';
import fs from 'fs';
const outdir = process.argv[2] ?? '.';
const r = generateTerraces({
  width: 1260, height: 891, margin: 36, seed: 11,          // A3 landscape @ 3 px/mm, 12 mm margin
  ...TERRACES_PRESETS.rift,
  bands: 9, spacingPx: 4.5, pens: 4, penAssignment: 'interleave',
  sheetTone: 'light', sheetToneStrength: 0.5, toneStrength: 0.6,
  continuous: 'mixed', outlines: true,
});
const opt = { strokeWidth: 0.3 * 3, physicalWidth: '420mm', physicalHeight: '297mm' };
const n = { 'ink-0': 1, 'ink-1': 2, 'ink-2': 3, 'ink-3': 4 };
for (const { layer, svg } of toSVGLayers(r, opt)) fs.writeFileSync(`${outdir}/artwork-layer-${n[layer]}.svg`, svg);
```

`preview.png` recolours the four layers with the inks above on `#e6dbc3`
paper (via `scripts/svg-to-png.mjs --width 2000 --background '#e6dbc3'`).

## Wishes

- A `terraces` CLI command (it is only reachable through `stack` or
  scripts), with `--split-layers`.
- Per-pen colour assignment inside `stack` for generators that emit
  several `ink-N` pens, so a recipe could carry the colours.
- Fault pairs that are explicit (position/width) so a graben can be
  composed rather than found by seed.
