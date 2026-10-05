# Three Blossoms, Late

## Artist statement

A single urn, five stems, three flowers — and the rest of the A3 sheet left
as paper. After a cull of vessel-and-bouquet renders (a crowded wreath, a
tangled jar, an amphora with too much going on) this one survived because
of its restraint: the stems rise from the urn mouth in a loose fan, the
shadow side of the vessel is built from broken contour lines like a
Japanese or Dutch botanical study, and the only colour accent is three
small rose-pink blossoms near the top right. It reads as the last cut
flowers of the season, drawn quickly and left alone. The work is in what is
*not* drawn — the high horizon of empty paper above the sprigs.

## Materials

- **Paper:** A3 (297×420 mm) warm natural cotton-rag, ~300 gsm, smooth/hot-press,
  colour approx. `#f1ead8`.
- **Layer 1 — structure** (stems, urn, ground line): Sakura Pigma Micron 03 /
  0.3 mm fineliner, *Sepia* (≈ `#5b4636`; the lighter urn-contour strokes
  are `#8a7a60`, plotted with the same pen — a single sepia is fine).
- **Layer 2 — leaves:** 0.3 mm fineliner, *Hunter / Forest Green* (≈ `#34602f`).
- **Layer 3 — blossoms:** 0.3 mm fineliner, *Rose / Magenta Madder* (≈ `#9c2b52`).
- Optional hand finish: very dilute Payne's grey or tea wash (see Process 6).
- Low-tack artist's tape, mount board for a float mount.

## Process

1. Tape the sheet to the plotter bed with low-tack tape, landscape-free
   portrait orientation, corner registration against a fixed stop.
2. Plot `artwork-layer-1-structure-brown.svg` with the sepia pen (0.3 mm).
   Mark the paper's position on the bed (pencil ticks at two corners) —
   do **not** move the sheet.
3. Swap the pen; plot `artwork-layer-2-leaves-green.svg` in green.
4. Swap the pen; plot `artwork-layer-3-blossom-rose.svg` in rose. The
   hidden-line occlusion is already resolved in each file, so order is
   cosmetic; this order keeps the dark pen first, so any smudging is minimal.
5. Let the ink cure 24 h (pigment fineliners dry fast, but cure before washing).
6. Hand step (optional, recommended): with a size-6 round brush and water-
   thinned warm grey (Payne's grey + a touch of burnt umber), lay a single
   pale wash inside the shaded (right-hand) third of the urn, stopping at the
   hatch lines. One pass, no re-wetting. Pigment fineliners won't bleed.
7. Float-mount on white mount board, 60 mm border, no glass glare — use
   museum glass.

## Plot settings

- Paper A3 portrait, margin 12 mm (default), pen width 0.3 mm on all layers.
- 1606 paths total (930 / 638 / 38 per layer); no pen travel optimisation
  needed beyond the generator's own ordering.

## Reproduction

Node 20+, `pnpm install && pnpm build` first.

```sh
node packages/cli/dist/cli.js botanical --paper a3 --composition bouquet \
  --vessel urn --ground-line --density 0.3 --seed-count 5 --gravitropism 0.5 \
  --negative-space 0.6 --tonal-massing 0.7 --value-bands 3 --seed 48 \
  --sketch 0.25 --palette botanical -o full.svg
```

The `--palette botanical` output is one SVG with stroke colours. It is split
into pen layers by stroke colour with this script (`node split.mjs full.svg <outdir>`):

```js
import fs from 'fs';
const [,, src, outDir] = process.argv;
const lines = fs.readFileSync(src,'utf8').split('\n');
const head = lines.filter(l=>!l.includes('<path') && !l.includes('</svg>') && l.trim());
const paths = lines.filter(l=>l.includes('<path'));
const layers = {
  'layer-1-structure-brown': ['#5b4636','#8a7a60'],
  'layer-2-leaves-green': ['#34602f','#3f6b3a'],
  'layer-3-blossom-rose': ['#9c2b52'],
};
for (const [n,cols] of Object.entries(layers)) {
  const p = paths.filter(l=>cols.some(c=>l.includes(`stroke="${c}"`)));
  fs.writeFileSync(`${outDir}/artwork-${n}.svg`, [...head, ...p, '</svg>',''].join('\n'));
}
```

Preview: `node scripts/svg-to-png.mjs full.svg preview.png --width 1400 --background '#f1ead8'`

## Wishes

- `--split-layers` on `botanical` (currently the palette must be split by
  colour after the fact).
- A way to place several vessels with different bouquets on one shelf.
