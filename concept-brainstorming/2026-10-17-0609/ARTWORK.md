# Four Quarters, One Thaw

## Artist statement

A uniformly random domino tiling of a square, sampled exactly (domino
shuffling, seed 7, order 140 — 19,740 dominoes), drawn as a single spine
per domino with one pen per domino orientation class. Nothing in the
algorithm mentions a circle, yet the tiling freezes into four perfectly
regular corners — each a field of parallel rules in its own colour — and
dissolves inside an exactly circular boundary into a thawed, mixed-up
centre where all four inks tangle. This is the arctic circle theorem
(Jockusch–Propp–Shor), and it is the first piece in the studio built on the
new `arctic` generator.

Why it survived the cull: the single-pen presets read as a diagram; the
horizon preset as a pleasant gradient. Giving each class its own ink turned
combinatorics into colour theory — four frozen colour fields with razor
edges and a rainbow-noise lake in the middle — and the upright square with
unequal corners (seed 7) has the most natural, un-diagrammatic balance. On
black card with metallic gel inks it should glow like stained glass or a
lit circuit board. The tone is entirely long-range order; there is no shading.

## Materials

- **Paper:** black cotton-rag card or smooth black cover stock, ~300 gsm
  (e.g. Canson Mi-Teintes Touch / Fabriano Tiziano black). Cut to
  **297 × 297 mm** (fits the A3 bed diagonally-free; plot on A3 with the
  square taped to centre).
- **Pens** (all opaque gel / paint pens, ~0.4 mm line, same width for all):
  1. Layer 1 (N, top corner, right) — **Gold** — Sakura Gelly Roll Metallic Gold, ≈ `#e0b84e`
  2. Layer 2 (E, bottom right) — **Copper** — Sakura Gelly Roll Metallic Orange / Copper, ≈ `#e08455`
  3. Layer 3 (S, bottom left) — **Ice blue** — Gelly Roll Metallic Sky Blue / Silver-blue, ≈ `#9cc3e6`
  4. Layer 4 (W, top left) — **Jade** — Gelly Roll Metallic Green / Mint, ≈ `#74d1a8`
- Low-tack masking tape, a drafting square, a soft pencil (to mark corner
  registration dots off-sheet), optional matte spray fixative.
- Presentation: float-mount in a deep black box frame, 40 mm paper-edge reveal.

## Process

1. Tape the 297 × 297 mm black card to the plotter bed. Mark two registration
   crosses on the bed (or on the tape) so the card can be removed and
   replaced exactly between pens — fix a corner stop with tape.
2. Plot `artwork-layer-1-n.svg` with the gold pen. Allow gel ink to dry
   10 minutes.
3. Swap pen, plot `artwork-layer-2-e.svg` (copper). Dry 10 min.
4. Plot `artwork-layer-3-s.svg` (ice blue). Dry 10 min.
5. Plot `artwork-layer-4-w.svg` (jade).
6. Let cure for 24 h. Optional: light matte fixative.
7. Float-mount.

Tip: strokes of the four layers never share a spine, but they do touch at
corners in the thawed region; slight (< 0.3 mm) misregistration only enriches
the centre, so strict alignment matters mainly at the four frozen/liquid
boundaries.

## Plot settings

- Sheet: 297 × 297 mm square, margin 24 mm (artwork 249 × 249 mm).
- Pen width 0.4 mm for every layer; ~19,700 short strokes in total
  (~4,900 per pen). Strokes are reordered (not chained) to minimise travel.
- Each layer SVG is plain black strokes; the colour is the pen you load.

## Reproduction

Build first (`pnpm install && pnpm build`), save the script below as
`repro.mjs` (outside the repo folder) and run `node repro.mjs concept-brainstorming/2026-10-17-0609`.

```js
import { generateArctic, toSVGLayers } from '<repo-root>/packages/core/dist/index.js';
import { writeFileSync } from 'node:fs';
const out = process.argv[2];
const mm = 297;
const r = generateArctic({ width: mm, height: mm, margin: 24, seed: 7, preset: 'weave', order: 140, upright: true });
const order = ['domino-n', 'domino-e', 'domino-s', 'domino-w'];
const num = { 'domino-n': 1, 'domino-e': 2, 'domino-s': 3, 'domino-w': 4 };
for (const { layer, svg } of toSVGLayers(r, { strokeWidth: 0.4, physicalWidth: mm, physicalHeight: mm }))
  writeFileSync(`${out}/artwork-layer-${num[layer]}-${layer.slice(7)}.svg`, svg);
```

(`<repo-root>` = absolute path of the checkout.) The preview is the four
layers recoloured on `#14141a` and rasterised with
`node scripts/svg-to-png.mjs comb.svg preview.png --width 1400`.

## Wishes

- An `arctic` CLI command (it is only reachable through the core API / web module).
- Per-class stroke offset or tilt so the frozen fields could be rendered as
  moiré-prone fine-line fields rather than welded rules.
