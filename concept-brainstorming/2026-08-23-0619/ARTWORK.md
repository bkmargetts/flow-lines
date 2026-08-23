# The Arctic Circle

## Artist statement

This plate draws nothing that resembles a mountain. What it draws is a
uniformly random domino tiling of the Aztec diamond AD(260) — 67,860
dominoes, sampled *exactly* by domino shuffling (Elkies–Kuperberg–
Larsen–Propp), inking only the spines of dominoes in one of the four
possible orientations. Only one class is inked, everywhere else is left
untouched paper. There is no gradient function anywhere in the code, no
tone map, no shading pass.

And yet: a solid triangle at the top, a jagged frozen edge, and below it
a field that thins from dense scribble to isolated flecks across a curve
that is — provably — a perfect circle. This is the arctic circle theorem
(Jockusch–Propp–Shor, 1998): as the diamond grows, the tiling freezes
into brick-regular order in each corner and stays disordered only inside
the inscribed circle, with the boundary between the two becoming razor
sharp in the limit. The mountain reading is an accident of geometry, not
a decision — a snow-line, not a horizon line, and it was the first thing
every version of this plate did, unprompted, at every seed I tried.

That repetition is what earned the piece its place over everything else
tried this session. I ran the tiling at a dozen seeds expecting a dozen
different silhouettes — the way `physarum` or `fracture` give you a
different creature every run — and got, instead, the same frozen
triangle and the same circle to within a few dominoes, every time, with
only the disordered speckle inside changing shape. That *is* the
theorem, sitting right there on the page: the boundary isn't random, the
snow is. Seed 5 was kept for the single best accident inside that
speckle — a double-summit ridge line, cleanly asymmetric, that reads
like a specific peak rather than a generic one. The diamond was run at
order 260, the algorithm's maximum, so the frozen edge is as close to
the true circular limit as this repository can currently draw it.

Rendered pale on deep indigo cardstock, the disordered field stops
reading as scree and starts reading as scattered stars or windblown
snow — the piece asks to be hung as a night mountain, even though the
generator has never heard of one.

## Materials

- **Paper** — GF Smith Colorplan "Dark Blue" 350gsm, A3 (420×297mm),
  smooth finish. Deep indigo, near-black in low light. (Preview
  approximates the sheet at `#12203a`; match by eye against a real swatch
  before committing the plot — cardstock colour never renders true on
  screen.)
- **Ink** — Sakura Gelly Roll White, 08 (medium, ~0.8mm ball), a warm
  glacial white rather than a cold pure white (approx. `#f5f7f2`). Gel
  ink sits on top of dark stock rather than soaking in, which is exactly
  what the dense apex needs: enough body to read as solid coverage
  rather than grey cross-hatch.
- **Mount** — black or dark-grey museum board, float mount, generous
  surround (60–80mm). A silver or white pencil for the caption, written
  directly on the mount board below the print rather than inside the
  plotted area — the plate itself is left completely clean of any hand
  mark.
- **Frame** — non-reflective glass; a dark or black moulding keeps the
  indigo sheet from reading as a rectangle cut out of the wall.

## Process

1. Generate `artwork.svg` with the reproduction script below
   (order 260, seed 5, the `dissolve` mark strategy — deterministic,
   byte-identical on every run).
2. Mount the Colorplan Dark Blue A3 sheet on the plotter bed. 350gsm is
   thick enough that it needs a firm hold (low-tack plotting tape at all
   four corners) rather than relying on a vacuum bed alone.
3. Load the Sakura Gelly Roll White 08 in the pen holder. Set the pen-up
   height generously — gel pens need consistent, fairly heavy nib
   pressure to lay ink evenly, more than a fineliner wants, so err
   toward too much contact rather than too little.
4. Plot the single layer at reduced speed (roughly 15–20% of a fineliner
   pass) and with a brief per-line pause enabled if the plotting software
   supports it. Gel ink skips and streaks at speed; the dense apex, where
   spine after spine sits nearly edge to edge, is the section most likely
   to show it if the plotter runs too fast.
5. Leave the sheet flat and undisturbed, ink side up, for at least
   24 hours before handling. Gel ink dries far slower than fineliner ink,
   especially under the near-solid coverage of the apex, and stays
   smearable well after it looks dry.
6. Once cured, float-mount on the dark museum board and hand-letter the
   plate data on the board itself, below the print, in silver or white
   pencil: `AD(260) · class N · seed 5`.
7. Frame under non-reflective glass.

## Plot settings

- Paper: A3, landscape (420×297mm)
- Margin: 20mm (the drawing itself is fit tight inside that margin —
  the apex sits close to the top edge, the speckle field close to the
  bottom, by design; this is a full-bleed composition, not a centred
  vignette)
- Pen: single pass, 0.5mm effective line width
- Lines: 8,018 strokes; because every spine that's collinear with its
  neighbour is welded into one continuous run before export, pen-up
  travel is already minimal without needing `optimizePlot` — chaining
  separate dominoes would round their corners and blur the exact
  lattice geometry the piece is about, so the generator deliberately
  uses `orderPlot` (reorder only) instead.

## Reproduction

Requires the built core package (`pnpm --filter @flow-lines/core build`,
or `pnpm build` at the repo root). There is no CLI command for this
generator yet — it's driven directly from `packages/core/dist/index.js`,
the same pattern as `scripts/city-gallery.mjs`.

```js
// arctic-circle.mjs
import { writeFileSync } from 'node:fs';

const coreDist = new URL(
  '../packages/core/dist/index.js',
  import.meta.url
);
const { generateArctic, toSVG, pageMetrics, getPaperSize } = await import(
  coreDist
);

const page = pageMetrics(getPaperSize('a3'), 'landscape'); // 420 x 297 mm
const marginMm = 20;
const penWidthMm = 0.5;

const result = generateArctic({
  width: page.widthPx,
  height: page.heightPx,
  margin: marginMm * page.pxPerMm,
  preset: 'dissolve', // marks='one' (class N): solid mass -> speckle
  order: 260,
  seed: 5,
});

const svg = toSVG(result, {
  strokeWidth: penWidthMm * page.pxPerMm,
  physicalWidth: `${page.widthMm}mm`,
  physicalHeight: `${page.heightMm}mm`,
});

writeFileSync('artwork.svg', svg);
```

Run with `node arctic-circle.mjs` from `scripts/` (or adjust the
`coreDist` URL to wherever the script lives). `preview.png` was rendered
with:

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png \
  --width 1800 --background '#12203a' --stroke '#f5f7f2'
```

## Wishes

- No CLI command for `arctic` yet — every other generator in the table
  gets `flow-lines <name>`; this one needed a scratch script. Worth
  promoting once a second use case shows up (the module already exports
  a clean `ArcticOptions` surface, so the command would be thin).
- `ArcticOptions` has no way to bias *which* domino gets a fractionally
  offset spine, so there's no way to soften the frozen-corner edge short
  of choosing a lower order — reasonable, since softening it would be
  editorializing against the theorem, but I looked for it while hunting
  for alternate compositions.
