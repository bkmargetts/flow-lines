# Equilibrium Line

## Artist statement

Glaciologists have a precise term for the boundary partway up a glacier
where snowfall stops winning and melt starts winning: the *equilibrium
line*. Above it, the glacier accumulates — solid, compacted, permanent.
Below it, whatever falls is lost by the end of the season. It is not a
gradient. On a real glacier it is measured, mapped, and it moves a
little every year.

This piece did not start from any glacier. It started from the repo's
newest generator, `arctic`, which has nothing to do with ice — it draws
a uniformly random domino tiling of an Aztec diamond, sampled *exactly*
by domino shuffling (Elkies–Kuperberg–Larsen–Propp), and inks one of the
four domino orientations as welded spines. The Arctic Circle Theorem
(Jockusch–Propp–Shor, 1998) says that as the diamond grows, this
produces a completely deterministic macroscopic shape: a solid
brick-regular mass in one corner, frozen into perfect order, meeting an
exact circular arc beyond which the same domino class exists only at
random, scattered, disordered, thinning to nothing. No gradient is
computed anywhere in the code. The tone you see — solid to speckled to
gone — is pure combinatorics; the circle is a hard theorem, not a
rendering trick.

The moment I generated one and looked at it, I didn't see a diamond and
a circle. I saw a mountain — a jagged, snow-line silhouette sitting on a
scattered field of scree — because that *is* the shape of an
equilibrium line, drawn by an argument that has never heard of
glaciology. So I ran the same generator three times, at three scales,
nested on one sheet, each an independent random tiling: three
equilibrium lines, palest and largest to darkest and smallest, reading
like retreat contours on a survey plate even though no two lines share a
single domino, and no line is a smaller copy of another — the boundary
is exact at every scale but the ice inside it is different every time.
That tension — a law that is rigid and a texture that is never twice the
same — is what earned this one the keep. It also does something I did
not plan for: because the three passes are independently random, they
partially cancel where they overlap, and the palest ring's disordered
zone reads as mist behind the harder shapes in front of it, the way real
atmospheric haze desaturates a distant ridge. That's an accident of
combinatorics, not an atmospheric-perspective routine.

## Materials

- **Paper** — one sheet of Fabriano Artistico Extra White, Hot Press,
  300 gsm, A3 (297 × 420 mm), portrait. Hot-press for tooth-free fine
  linework at high line density (each pass is ~3,000 short welded
  strokes); 300 gsm to take three registered passes without cockling.
- **Pen 1 — "Meltwater"** (`artwork.pen-1-meltwater.svg`, outermost,
  palest, largest): pale glacial-blue drawing ink, `#a9c4d8`. Dr. Ph.
  Martin's Bombay India Ink — Cloud, or an equivalent light dye ink,
  loaded in a 0.25 mm technical pen (e.g. Rotring Isograph 0.25).
- **Pen 2 — "Glacier"** (`artwork.pen-2-glacier.svg`, middle): mid
  slate-blue drawing ink, `#3d6f95`. Dr. Ph. Martin's Bombay India Ink —
  Denim, in a 0.30 mm technical pen.
- **Pen 3 — "Ice Core"** (`artwork.pen-3-ice-core.svg`, innermost,
  darkest, smallest, plotted last so it sits crisp on top): near-black
  deep indigo drawing ink, `#0f1e2c`. Dr. Ph. Martin's Bombay India Ink —
  Indigo Night, or a black-blue pigment ink, in a 0.40 mm technical pen
  — deliberately the widest nib of the three, so the innermost, most
  "present" line reads boldest without any stroke-width trick inside a
  single pass (each SVG is one pen at one constant width; the weight
  difference between passes is three genuinely different physical
  nibs, exactly like loading three different technical pens for a
  multi-pen plot).
- No wash, no mask, no fixative required — the piece is linework only.

## Process

1. Tape the Fabriano Artistico sheet to the plotter bed, A3 portrait,
   registration marks at the four corners if your plotter software
   doesn't hold absolute page origin between pen changes.
2. Load Pen 1 (Meltwater, 0.25 mm, `#a9c4d8` ink). Plot
   `artwork.pen-1-meltwater.svg` at 0 mm margin offset (the file already
   carries the full A3 page geometry — do not rescale). This is the
   largest, faintest triangle-and-scatter; it will occupy nearly the
   whole sheet.
3. Swap to Pen 2 (Glacier, 0.30 mm, `#3d6f95` ink). Plot
   `artwork.pen-2-glacier.svg` on the same registered sheet. This nests
   inside pass 1.
4. Swap to Pen 3 (Ice Core, 0.40 mm, `#0f1e2c` ink). Plot
   `artwork.pen-3-ice-core.svg` last, on top. This is the smallest,
   darkest, innermost peak — the only pass bold enough to read as solid
   black at the summit.
5. Allow each pass to dry ~10 minutes before the next pen change if
   using dye inks, so a dragging nib on a later pass never lifts an
   earlier line.
6. No wash, no hand-finishing. Float-mount under glass or a simple
   black wood frame, single white or pale grey mat, A3 aperture.

## Plot settings

- Paper: A3, 297 × 420 mm, portrait, 0 mm plotter margin (each SVG
  already reserves its own clear border — see Reproduction).
- Pen widths: 0.25 mm / 0.30 mm / 0.40 mm for passes 1/2/3 respectively.
- Each pass is single-pen, plain stroked paths, reordered (not chained)
  for pen-up travel — `optimize: true` (the generator's default), which
  is `orderPlot` under the hood: reordering only, since chaining would
  fuse separate welded dominoes into one path and round-cap the joins,
  softening the crisp brick edges that carry the whole effect.
- Approximate stroke counts: pass 1 ≈ 2,977 strokes, pass 2 ≈ 2,961,
  pass 3 ≈ 2,975 (~8,900 total, all short — pen-up travel is the
  dominant cost, which `orderPlot` already minimises).

## Reproduction

There is no CLI command for `arctic` yet — it's driven directly from the
built core package. Build once (`pnpm install && pnpm build`), then run:

```js
// produce-equilibrium-line.mjs
import { writeFileSync } from 'node:fs';
const { generateArctic, toSVG, pageMetrics, PAPER_SIZES } =
  await import('./packages/core/dist/index.js');

const a3 = PAPER_SIZES.find((p) => p.id === 'a3');
const PX_PER_MM = 4;
const pm = pageMetrics(a3, 'portrait', PX_PER_MM);

const passes = [
  { marginMm: 12, seed: 11, order: 160, color: '#a9c4d8', penMm: 0.25, file: 'artwork.pen-1-meltwater.svg' },
  { marginMm: 55, seed: 47, order: 160, color: '#3d6f95', penMm: 0.30, file: 'artwork.pen-2-glacier.svg' },
  { marginMm: 100, seed: 83, order: 160, color: '#0f1e2c', penMm: 0.40, file: 'artwork.pen-3-ice-core.svg' },
];

for (const p of passes) {
  const res = generateArctic({
    width: pm.widthPx,
    height: pm.heightPx,
    margin: p.marginMm * PX_PER_MM,
    seed: p.seed,
    order: p.order,
    preset: 'dissolve', // ink only the frozen N domino class
  });
  const svg = toSVG(res, {
    strokeColor: p.color,
    strokeWidth: p.penMm * PX_PER_MM,
    includeBackground: false,
    physicalWidth: `${pm.widthMm}mm`,
    physicalHeight: `${pm.heightMm}mm`,
  });
  writeFileSync(p.file, svg);
}
```

Run with `node produce-equilibrium-line.mjs` from the repo root (with
`packages/core` built). All three passes are byte-for-byte
deterministic per seed — `generateArctic` uses exact domino shuffling
(no Markov burn-in), so seeds 11 / 47 / 83 at order 160 reproduce these
exact files every time.

`preview.png` was rendered by merging all three passes into one SVG
(same geometry, tagged by layer, `layerColors` set to the three inks
above, `includeBackground: true` with `backgroundColor: '#f6f3ec'` to
approximate the paper) and rasterizing with:

```sh
node scripts/svg-to-png.mjs merged-preview.svg preview.png --width 1600
```

## Wishes

- `ArcticOptions.marks` only exposes the preset-level `'one'` class
  (always the `N` orientation). Being able to choose which of the four
  domino classes gets inked directly would let a multi-pass piece like
  this pick a *different* frozen corner per pass instead of always `N`
  — e.g. two equilibrium lines facing each other from opposite corners
  on one sheet.
