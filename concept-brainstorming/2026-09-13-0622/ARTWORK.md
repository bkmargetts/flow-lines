# Firn Line

## Artist statement

On a glacier, the firn line is the elevation where a year's accounting
settles: above it, snow survives the summer melt and compacts into
firn — dense, granular, on its way to becoming glacial ice, a little
more permanent every year. Below it, the same winter's snow is gone by
autumn. It's not a gradient. A glaciologist can walk the slope and put
a boot down on the exact contour where "stays" turns into "melts."

This repo's `arctic` generator produces something with the same shape
of truth, by an entirely different route. It samples a uniformly random
domino tiling of an Aztec diamond by domino shuffling — an exact
algorithm, no Markov chain, no burn-in, just fair coins — and the
arctic circle theorem (Jockusch–Propp–Shor, 1998) says that as the
diamond grows, the tiling freezes into perfectly ordered brick courses
in four corners while staying genuinely disordered everywhere inside a
circle inscribed in the diamond, and the wall between them sharpens
toward a razor edge. Nobody tells the algorithm about a circle. It falls
out of pure combinatorics, the same way the firn line falls out of nothing
but temperature and gravity — no one draws it, it's just where the two
regimes stop negotiating.

Ink one domino class (`marks: 'one'`) and the theorem becomes a picture
without a single shading trick: welded collinear dominoes in the frozen
corner fuse into long unbroken rules — solid tone — while the same class
inside the disordered region never gets the chance to weld and stays
broken, sparse dashes. The generator's own comment calls this "the tone
IS the long-range order," and it's the literal truth: every mark on this
page is a real domino from a real fair sample, not a rendering of one.

At order 220 the frozen wedge's overall envelope has already converged
close to its theoretical limit — that inscribed circle — so running the
same order across a dozen seeds barely moves where the boundary falls;
it only reshuffles the fine sawtooth of exactly where each unweldable
dash lands along it. That was the surprise worth keeping: I wasn't
hunting for a good silhouette so much as a good sample of a silhouette
that's basically fixed by the math. Seed 6 was the one where that
sawtooth read, unprompted, as a genuine double-summit ridgeline — a col
between two peaks, scree fanning out below with no ridge to hold it,
thinning to bare paper by the lower third of the sheet. I looked at
horizontal-pair and four-class ink strategies too (see Candidates
considered) — both read as texture or weave, not as a place. One class,
inked plain, is the only version where the theorem's own geometry
gets to be the whole subject instead of competing with a busier mark.

## Materials

- **Paper** — one A3 sheet (297 × 420 mm), portrait, Stonehenge White
  250gsm cotton rag, smooth press finish. A clean, cool-neutral white
  rather than a warm cream — the piece wants to read as snow and stone,
  not parchment — and heavy enough that a technical pen's fine line sits
  crisp with no feathering at the very dense hatching near the summit.
- **Ink** — one pen: Diamine Registrar's Ink, a blue-black iron-gall-style
  drawing ink (oxidises waterproof once dry), loaded in a Rotring Isograph
  technical pen, 0.35mm nib. Hex approximation for screen preview:
  `#2b2f36` — a graphite-blue-black rather than a flat black, closer to
  wet stone or old ice than to printed type.
- Nothing else — no wash, no second pass, no mount treatment beyond
  framing. One plate, one ink, the way a single-plate etching stays one
  plate.

## Process

1. Load the Rotring Isograph with Diamine Registrar's Ink and run it dry
   on scrap Stonehenge offcuts until the line is continuous — technical
   pens skip on the first few centimetres after a refill.
2. Register the plotter for one A3 sheet of Stonehenge White, portrait,
   18mm margin on all sides.
3. Plot `artwork.svg` in a single pass, 0.35mm pen width throughout —
   the drawing is one pen layer (`domino-n`), so there is no layer order
   to manage and nothing to re-register.
4. Let the ink cure flat for at least 15 minutes — iron-gall-style inks
   stay slightly workable while oxidising and will smear under a rushed
   hand.
5. Float-mount on white or off-white board, generous margin, glass with
   an anti-reflective coating if available — the summit's near-solid
   hatching is dense enough to catch glare off plain glass.

## Plot settings

- Paper: A3 (297 × 420mm), portrait, 18mm margin.
- Pen: 0.35mm, single pass, single layer (`domino-n`).
- Render density: 3 px/mm (`BASE_PX_PER_MM`).
- Seed: 6. Diamond order: 220 (n(n+1) = 48,620 possible dominoes; 5,604
  survive as drawn strokes after welding collinear runs into single
  paths and reordering for pen travel).
- Reordered for pen travel via `orderPlot` (not full endpoint-chaining —
  the generator deliberately avoids `optimizePlot` here, since chaining
  would fuse separate dominoes into one path and round-cap the joins,
  softening the crisp lattice geometry the drawing depends on).

## Reproduction

There is no CLI command for the arctic-circle generator yet (per the
README's core-only list), so this is a scratch Node script against the
built core package:

```js
// firn-line.mjs — node firn-line.mjs <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const coreDist = resolve(process.cwd(), 'packages/core/dist/index.js');
const { generateArctic, toSVG, pageMetrics, getPaperSize } = await import(coreDist);

const outDir = resolve(process.argv[2] ?? '.');
mkdirSync(outDir, { recursive: true });

const PX_PER_MM = 3; // BASE_PX_PER_MM
const PEN_MM = 0.35;
const MARGIN_MM = 18;
const SEED = 6;
const ORDER = 220;

const paper = getPaperSize('a3');
const metrics = pageMetrics(paper, 'portrait', PX_PER_MM);
const { widthPx: W, heightPx: H, widthMm, heightMm } = metrics;
const margin = MARGIN_MM * PX_PER_MM;
const penWidth = PEN_MM * PX_PER_MM;

const res = generateArctic({
  width: W,
  height: H,
  margin,
  seed: SEED,
  preset: 'dissolve',
  order: ORDER,
  upright: false,
  wobble: 0.35,
});

const svg = toSVG(res, {
  strokeWidth: penWidth,
  physicalWidth: `${widthMm}mm`,
  physicalHeight: `${heightMm}mm`,
});
writeFileSync(join(outDir, 'artwork.svg'), svg);
console.log(res.lines.length, 'lines');
```

Run from the repo root after building core:

```sh
pnpm --filter @flow-lines/core build
node firn-line.mjs ./out
```

Preview (approximating blue-black ink on Stonehenge White):

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png \
  --width 1800 --background '#f4f3ee' --stroke '#2b2f36'
```

## Candidates considered

- **`marks: 'horizontals'`** (two classes inked). Rules top and bottom
  of the diamond, disorder in a band between — reads as a woven texture
  or a technical diagram (a "cut" through something), not as a place.
  The second class competes with the first instead of clarifying it.
  Discarded.
- **`marks: 'all'`** (weave preset, all four classes, upright). A dense
  orthogonal weave that freezes into four directions at the corners —
  genuinely striking as pure pattern, closer to op-art or a textile
  swatch than to ink illustration. Kept as the strongest alternative but
  set aside: it's a picture of the algorithm's *mechanism*, this piece
  wanted a picture of its *consequence*.
- **`marks: 'outline'`** (every domino edge, brick preset). An even
  grey lattice — technically the most "honest" rendering (nothing is
  hidden) but exactly the failure mode the generator's own docs warn
  about: no class separation means no tone, so the arctic circle is
  present in the geometry but invisible to the eye. Discarded.
- **`upright: true`.** Rotates the diamond 45° so the frozen corner
  becomes a corner-anchored quarter-disc rather than a peak centred on
  the page — reads as a fragment or a radar sweep, not a summit.
  `upright: false` puts the pole exactly on the page's vertical axis,
  which is what lets the boundary read as a skyline instead of an arc.
  Discarded.
- **Seeds 1–5, 7–12 at the same order.** All converge to essentially the
  same envelope (the theorem leaves seeds little room to move it) with
  more symmetric, single-summit ridgelines — competent but generic, "a
  mountain" rather than a specific one. Seed 6's col between two peaks
  was the only draw across twelve that stopped looking like an
  average and started looking like a place. Discarded the rest.

## Wishes

- `ArcticOptions` has no way to bias where along the boundary a
  particularly interesting sawtooth lands — composition-hunting here
  meant re-rolling the whole seed (which also reseeds the hand-drawn
  wobble) and eyeballing a dozen renders rather than nudging the
  ridgeline directly. A way to sample several boundary realizations at
  a fixed order cheaply (skip the wobble pass, or expose the raw
  boundary trace before welding) would make this faster than seed
  roulette next time.
- There's no `flow-lines arctic` CLI command yet (core-only, per the
  README table). Given how legible the four presets already are and how
  little else the generator needs (order, seed, marks, upright), it
  seems like a natural, low-effort CLI addition — this session's whole
  iteration loop was a hand-rolled scratch script for lack of one.
