# Waterline

*Plate — the arctic circle of a random domino tiling, AD(160), seed 11. Matte white and metallic silver gel ink on midnight-blue card, A3.*

## Statement

An iceberg drawn by nobody. The image is a single uniformly random tiling of
the Aztec diamond — 25,760 dominoes placed by pure chance (domino shuffling,
seed 11). Nothing in the procedure mentions a circle or an ice shelf, yet the
arctic circle theorem forces one: the two poles of the diamond freeze into
perfectly ordered courses of brick, and everything inside the inscribed
circle melts into a broken, shifting pack of floes. The boundary between ice
and water is razor sharp and completely unplanned.

Only two of the four domino classes are inked, each in its own pen. The
north class — the one that freezes at the top — goes down in matte white:
the tip of the berg, catching the light. The south class, frozen at the
bottom, goes down in **metallic silver**: the submerged keel. Head-on, under
flat light, the two are almost the same pale grey and the piece reads as one
whole lens of ice. Tilt the frame, or walk past it under a spot, and the
lower half lights up while the top stays chalky — the waterline appears in
the middle of the pack where white and silver dashes interleave, and nowhere
is it drawn. Two inks are used precisely because the material difference is
invisible until you move.

Why this one survived: the cull began with every Arctic preset (brick,
weave, horizon, dissolve), upright and diagonal, four-ink "compass"
variants and a two-ink indigo/vermilion square. The four-ink versions turned
to optical mud in the core; the coloured square read as textile sampler. The
single-white "dissolve" drop on navy was the most immediately beautiful
render, and nearly won — but it was the module's default with a dark sheet.
Splitting the tiling into two pens and giving them two *surfaces* rather than
two *colours* turned a mathematical picture into an object you have to stand
in front of. Six seeds were compared at order 160; the theorem makes them
near-identical in outline, and seed 11 was kept for the jagged, mountain-like
crack along the upper freeze line.

## Materials

- **Paper:** A3 (297 × 420 mm) midnight-blue card, 270–300 gsm, smooth
  (e.g. Canson Mi-Teintes Touch "Midnight Blue" / Colorplan "Imperial Blue",
  approx. `#16233f`). Smooth side up — gel ink skips on tooth.
- **Pen 1 (layer 1):** Sakura Gelly Roll **08 White** (opaque, ~0.4 mm line),
  matte — preview `#f4f1e8`.
- **Pen 2 (layer 2):** Sakura Gelly Roll **Metallic 10 Silver** (#53), ~0.4 mm
  line — preview `#a9b1bb`.
- Low-tack drafting tape, scrap sheet of the same card for test strokes.
- Presentation: float-mounted on black core board in a deep box frame,
  ideally hung under a single directional spot so the silver catches.

## Process

1. Tape the card to the plotter bed at all four corners; mark the sheet's
   top-left corner on the bed tape so the sheet can be re-seated if it is
   ever lifted (it should not be).
2. Scribble the white Gelly Roll on scrap until it flows opaque. Plot a 20 mm
   test line on scrap card at the speed you'll use (gel ink: slow, ≤ 25 mm/s
   pen-down, to keep the white opaque).
3. **Plot `artwork-layer-1-white.svg`** with the white pen. ~3,000 strokes,
   ~15.5 m of line. Pause half-way and re-prime the pen on scrap — white gel
   starves on long runs and the frozen tip is all long runs.
4. **Let dry 30 minutes.** Do not move the sheet. White gel smears easily and
   the silver pass crosses the waterline zone, where the two layers'
   dashes sit side by side ~0.7 mm apart.
5. Swap to the silver pen (same holder height, same origin). Prime on scrap.
6. **Plot `artwork-layer-2-silver.svg`.** ~2,900 strokes, ~15.5 m. The
   layers never overlap (each domino belongs to exactly one class), so
   registration only has to be as good as the plotter's re-homing; a
   sub-millimetre slip is invisible in the pack and harmless at the poles.
7. Dry overnight, flat, uncovered. Sign in silver, lower right, small.
8. Float-mount and frame with a deep spacer (no glass touching the ink).

## Plot settings

| | |
|---|---|
| Paper | A3 portrait, 297 × 420 mm |
| Margin | 20 mm (the diamond is width-limited: ~257 mm wide, ~364 mm tall) |
| Pen width | 0.4 mm both layers (set in the SVGs' stroke width for preview) |
| Layer 1 | `artwork-layer-1-white.svg` — 2,977 strokes, ~15.5 m pen-down |
| Layer 2 | `artwork-layer-2-silver.svg` — 2,935 strokes, ~15.5 m pen-down |
| Combined preview | `artwork.svg` (both layers, coloured) — do not plot |
| Pen-up order | `orderPlot` (reordered, never chained — chaining would fuse dominoes) |

Domino unit ≈ 0.8 mm at this size, so the frozen poles are a 0.4 mm line on
~0.8 mm pitch: solid tone with paper still breathing between rules.

## Reproduction

Built from `generateArctic` in `packages/core` (no CLI command exists for
Arctic). From the repo root, after `pnpm install && pnpm build`, save the
script below as `waterline.mjs` and run `node waterline.mjs <outDir>`. It
writes all three SVGs byte-for-byte (sha256 prefixes: layer-1 `4e28ff15b5f102a5`,
layer-2 `4b7c58c12705f722`, combined `df18362258d9d149`).

```js
// Waterline — run from the repo root after `pnpm install && pnpm build`:
//   node waterline.mjs <outDir>
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { generateArctic, toSVG } = await import(join(process.cwd(), 'packages/core/dist/index.js'));
const out = process.argv[2] ?? '.';
const W = 297, H = 420, K = 4;          // A3 portrait, 4 px per mm
const PEN = 0.4;                         // mm
const res = generateArctic({
  width: W * K, height: H * K, margin: 20 * K,
  seed: 11, order: 160, marks: 'horizontals', upright: false, wobble: 0.35,
});
const svgOpts = { strokeWidth: PEN * K, physicalWidth: `${W}mm`, physicalHeight: `${H}mm` };
const only = (layer) => ({ ...res, lines: res.lines.filter((l) => l.layer === layer) });
writeFileSync(join(out, 'artwork-layer-1-white.svg'), toSVG(only('domino-n'), { ...svgOpts, strokeColor: '#f4f1e8' }));
writeFileSync(join(out, 'artwork-layer-2-silver.svg'), toSVG(only('domino-s'), { ...svgOpts, strokeColor: '#a9b1bb' }));
writeFileSync(join(out, 'artwork.svg'), toSVG(res, { ...svgOpts, layerColors: { 'domino-n': '#f4f1e8', 'domino-s': '#a9b1bb' } }));
for (const l of ['domino-n', 'domino-s']) {
  const ls = only(l).lines;
  const mm = ls.reduce((s, x) => s + x.points.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - x.points[i].x, p.y - x.points[i].y), 0), 0) / K;
  console.log(l, ls.length, 'strokes', (mm / 1000).toFixed(1), 'm of ink');
}
```

Preview:

```sh
node scripts/svg-to-png.mjs concept-brainstorming/2026-11-22-0607/artwork.svg \
  concept-brainstorming/2026-11-22-0607/preview.png --width 1600 --background '#16233f'
```

(The preview can only hint at the white/silver difference — it is a
reflective effect, not a hue one.)

## Wishes

- An `arctic` CLI command (with `--split-layers`), so this piece is one
  command instead of a script.
- A custom class subset for `marks` (e.g. `N,E`) — adjacent-pole pairings
  give asymmetric compositions the three fixed strategies can't.
- A way to tilt the domino weights (biased / two-periodic Aztec diamonds),
  which deform the arctic circle into ellipses and open a gaseous facet in
  the middle — an iceberg that is 90% below the waterline, as real ones are.
