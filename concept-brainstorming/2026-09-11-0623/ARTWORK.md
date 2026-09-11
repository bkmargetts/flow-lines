# Ice Edge

## Artist statement

This repo grew a generator nobody had used yet: `arctic`, which samples a
uniformly random domino tiling of the Aztec diamond by domino shuffling
(Elkies–Kuperberg–Larsen–Propp) — an exact, O(n²), no-burn-in algorithm,
so the tiling is genuinely random but costs the same every time. The
reason it earns a page: the *arctic circle theorem* (Jockusch–Propp–Shor,
1998) proves that as the diamond grows, every such tiling freezes into
four corners of perfect brick order and stays disordered everywhere else,
with the boundary between them converging to the exact circle inscribed
in the diamond. Nothing in the sampling algorithm mentions a circle. It
falls out of the combinatorics on its own, the way a soap film finds a
minimal surface without being told what one is.

Inking only one of the four domino classes (`marks: 'one'`) turns the
theorem directly into tone, with no shading anywhere in the code: in the
frozen corner that class belongs to, collinear dominoes weld into long
unbroken rules — solid black. Inside the circle every class appears at
random, so the same dominoes stay short, broken dashes — a scatter. Where
a class never appears at all, there's nothing — bare paper. Three honest
textures, one razor boundary, zero fabrication.

What decided this over the piece's dozen sibling renders wasn't the
math — it's that the picture the math draws, completely unprompted, is a
satellite photograph of pack ice. A solid mass at the pole. A ragged
snow line where it starts to break. A scatter of floes thinning outward.
And then, precisely where probability theory says it must, open water —
bounded by a curve as clean as a coastline drawn with a compass, because
in the geometry of both a discrete tiling and a real ice sheet, "circle"
is what a boundary looks like once nothing is anisotropic enough to bend
it. Glaciology has its own name for this exact edge: the *ice edge*, the
boundary of the *marginal ice zone* where consolidated pack gives way to
drifting floes. A century-old theorem in enumerative combinatorics and a
term coined by polar oceanographers turned out to be describing the same
shape. I didn't have to force that reading onto the render — I went
looking through a dozen seeds for the one where it held together best,
and order 190 / seed 13 is the keep: an asymmetric snow line with a real
notch in it (not a bland symmetric cone), and no dead gaps in the floe
scatter as it thins toward the edge.

One structural honesty worth naming: unlike almost every other generator
in this studio, changing the seed barely changes the *composition* here.
That's the theorem, not a limitation — the arctic circle is a law of
large numbers, so the macroscopic silhouette concentrates near the same
curve for every seed at this order, and only the fine texture (which
dominoes fall where) is free. That makes this piece function less like a
one-off render and more like an edition: every impression is provably
unique at the domino level and statistically identical at the composition
level, the same way no two real ice floes match but the ice edge sits in
about the same place every winter.

## Materials

- **Paper**: A3 (297 × 420 mm) heavyweight black or deep-indigo cardstock
  with a smooth-to-vellum finish that won't skip a fine marker tip —
  e.g. Colorplan "Ebony" 270 gsm, or Canson Mi-Teintes "Bleu Nuit"
  (dark navy reads as "polar sea at dusk" slightly better than a flat
  black; either works).
- **Ink, pass 1 (shadow)** — a pale glacial blue, laid down first:
  Sakura Gelly Roll "Blue" or any 0.4 mm gel pen in a cold light blue,
  approx. hex `#a9c7e0` for reference when matching a substitute.
- **Ink, pass 2 (ice)** — opaque white, plotted second so it sits on top
  and hides any seam at the registration shift: Uni-ball Signo White
  (gel, 0.28 mm) or Posca PC-1M (white paint marker, ~0.7 mm tip) —
  gel gives the crisper fine dashes in the outer scatter; paint marker
  gives more opaque, confident weight in the frozen mass. Either is a
  legitimate single-pen reading of this file; the gel pen was used to
  set the plot settings below.

## Process

1. Plot `arctic-circle.svg` on the black/indigo sheet with the **pale
   blue** pen at 0.3 mm, using the plotter software's origin offset (not
   a file edit) to shift the plot **+0.8 mm right, +1.2 mm down** from
   true register. This is pass 1 — the "shadow" pass, a soft
   misregistered ghost of the whole drawing.
2. Without moving or re-taping the sheet, reset the origin offset to
   (0, 0) and re-plot the same `arctic-circle.svg`, now with the
   **white** pen at 0.3 mm. This is pass 2 — the true-registered "ice"
   pass, plotted on top of the ghost.
3. The result: every welded rule and every scattered dash in the frozen
   mass and the floe field carries a barely-there blue fringe on its
   lower-right edge — a shadow with no light source anywhere in the
   code, purely a printmaking artifact of the offset, reading as cold
   directional light raking across ice.
4. No wash, no mask, no hand-inking. The piece is finished at two dry
   plotted passes; float-mount under glass (the paper's black edge
   should show, not be trimmed to the ink).

## Plot settings

- Paper: A3, portrait, 297 × 420 mm.
- Margin: 40 px at the generator's internal 3 px/mm scale ≈ 13.3 mm
  clear border on all sides (both passes share this margin — it is
  baked into the SVG, not a plotter setting).
- Pen width: 0.3 mm both passes (0.28–0.4 mm gel pens both read
  correctly at this line density; do not go coarser than ~0.5 mm or the
  outer scatter's shortest dashes start to blob together).
- 4223 strokes per pass (welded rules + broken dashes), reordered
  (`optimize: true`, `orderPlot`) to cut pen-up travel — chaining was
  deliberately *not* used: welding is already done by the generator at
  the domino level, and further chaining would fuse unrelated dashes
  into one path and round-cap the joins, softening the one thing this
  drawing is about.

## Reproduction

Built and run against this commit of the repo (`pnpm install && pnpm
build`). There is no CLI command for `arctic` yet, so the SVG is
generated with a small script against the built core package, following
the pattern in `scripts/city-gallery.mjs`:

```js
// node arctic-ice-edge.mjs   (run after `pnpm --filter @flow-lines/core build`)
import { writeFileSync } from 'node:fs';
const { generateArctic, toSVG, getPaperSize, pageMetrics, BASE_PX_PER_MM } =
  await import('./packages/core/dist/index.js');

const paper = getPaperSize('a3');
const m = pageMetrics(paper, 'portrait', BASE_PX_PER_MM); // 891 x 1260 px, 3 px/mm

const res = generateArctic({
  width: m.widthPx,
  height: m.heightPx,
  margin: 40,
  preset: 'dissolve', // one class, one solid mass dissolving to speckle
  order: 190, // AD(190): 190*191 = 36,290 dominoes
  upright: false, // diamond on its point — the mountain/ice-cap silhouette
  marks: 'one', // only the 'N' class inked
  seed: 13, // chosen for its asymmetric snow line and even floe scatter
  wobble: 0.25, // light hand-drawn wobble, less than the 0.35 default
  optimize: true, // orderPlot — reorder only, no chaining (see Plot settings)
});

const svg = toSVG(res, {
  strokeColor: '#000000',
  strokeWidth: 0.9, // 0.3 mm at 3 px/mm
  includeBackground: false,
  physicalWidth: `${m.widthMm}mm`,
  physicalHeight: `${m.heightMm}mm`,
});

writeFileSync('arctic-circle.svg', svg);
```

`preview.png` approximates the finished piece (single flat white-on-navy
pass, not the two-ink misregistration — that's a plotting-table effect,
not a rasterizer one):

```sh
node scripts/svg-to-png.mjs arctic-circle.svg preview.png \
  --width 1600 --background '#0b1524' --stroke '#f4f7fa'
```

The SVG was regenerated twice from the script above and byte-compared —
identical both times, confirming the seed reproduces exactly.

## Wishes

- `toSVG`/`toSVGLayers` have no way to express a *per-pass* origin
  offset in the file itself — the misregistration in this piece has to
  happen at the plotter, not the SVG, because there's currently no
  "shadow copy of this layer, offset by (dx, dy), different ink" concept
  the way `transform` (echo/rotate/scale) exists for the web layer
  stack. A CLI-level `--echo-offset dx,dy --echo-layer name` (distinct
  from the existing compounding `transform` echoes, which duplicate
  geometry rather than misregister a *whole separate plotted pass*)
  would let a piece like this one be fully reproduced by command line
  alone, with the offset recorded in the file instead of prose
  instructions for the plotter operator.
- `arctic` has no CLI command yet (`flow-lines arctic ...`) — every
  other generator in the toolbox does. Worth adding given how directly
  its options map to plottable presets.
