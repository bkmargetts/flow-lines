# Orbium

## Artist statement

*Orbium* is the name Bert Chan gave the first creature he found in Lenia
(2018), his continuous-valued generalisation of Conway's Game of Life —
literally "little disc," for its rounded, self-contained body. Where
Conway's automaton flips cells on or off by a hard majority count, Lenia
holds one continuous value per cell, convolves it against a smooth ring
kernel, and nudges it by a smooth Gaussian growth curve. Nothing else
changes, but the consequence is enormous: binary Life only ever produces
gliders that shuffle diagonally one discrete cell at a time, while
Lenia's smoothness lets a coherent blob glide continuously, at any
sub-cell speed and heading, indefinitely — a genuine self-perpetuating
travelling wave with no counterpart in the automaton it generalises.
Orbium is the plainest specimen of that: seeded once and left alone, it
simply goes, forever, in a straight line, changing nothing about itself
as it moves.

This repo's `lenia` module runs that simulation on a **toroidal grid** —
wrap-around boundaries, the same trick Conway's own long-exposure module
needs to keep a pattern alive indefinitely inside a finite array. A
single Orbium released onto a page long enough eventually reaches an
edge that, in the mathematics actually running underneath the drawing,
isn't there: it doesn't stop, and it doesn't bounce. It leaves the right
edge of the grid and is already re-entering at the left; the sheet is
secretly a cylinder, or given how few steps it takes to complete a lap
in both axes, closer to a torus. Everything on this page is one
creature's single, unbroken path. What looks like three separate marks
is the same line, cut three times by a seam we simply can't draw.

I ran the preset's default first — five gliders seeded at once, their
wakes crossing and reinforcing into a dense, frame-filling tangle. It
was a striking image and the wrong one: this studio has already spent a
page on that exact register, twice (a physarum network's reinforced
channels, a coral colony's confined folding) — another reticulated mass
would read as the same idea a third time. Setting the glider count to
one changed everything. Alone, Orbium leaves too little ink to fill a
page and too much shape to read as noise: a rounded "head" where it
currently sits, a spine of nested contour bands behind it, a tail that
frays into broken dashes and vanishes as the long-exposure decay eats
the oldest ink. I scanned sixteen seeds at a fixed exposure decay,
keeping only the runs where the wrap produced a clean, legible second
(or third) fragment rather than an overlapping mess, then swept step
count on the two strongest seeds to find exactly how many simulated
steps earns one full wrap without earning a second — the difference
between a composition that reads as "one path, revealed" and one that
just reads as clutter. Seed 12 at 180 steps was the cleanest: a small
newborn curl opens top-left, tight and self-contained like a fiddlehead;
a long central quill is sliced clean off by the top-right corner of the
page mid-flight, as if the frame had simply run out before the creature
did; and the creature's present, brightest position anchors the lower
right, pointed and alone in a wide field of empty paper. Three moments,
one line, one small animal that has been moving since long before this
sheet existed and will keep moving after it's rolled up.

The render's own accounting of exposure — brightest where the creature
is now and has lingered, dimmest at the outer edge of its oldest,
almost-decayed wake — is tagged in the data as three literal pen layers
(`core`/`mid`/`rim`). Instead of treating that as a hatching instruction,
this piece plots it as three actual inks of falling intensity on black
card: the decay curve *is* the ink, not a simulation of one.

## Materials

- **Paper**: Canson Mi-Teintes, "Black" (shade 425), 160gsm, vellum
  (textured) face up — the tooth grips gel ink that skids on the smooth
  face. A3 (297×420mm), portrait.
- **Ink 1 — core** (the creature's current position and its densest,
  freshest wake): Sakura Gelly Roll 08, White, 0.7mm bullet tip. Plotted
  **twice** — full dry between passes — for true bold-by-repetition, the
  same technique this repo's own emphasis passes use; never a wider
  stroke.
- **Ink 2 — mid** (recent wake, one exposure band out): Sakura Gelly
  Roll Metallic, Sky Blue, 0.4mm, single pass.
- **Ink 3 — rim** (the oldest, most decayed fringe of the exposure
  field): Sakura Gelly Roll Metallic, Silver, 0.4mm, single pass — a
  metallic ink is duller and more variable under raking light than a
  flat pigment, which is exactly the "barely still glowing" quality this
  outermost band wants.

## Process

1. Cut/select one sheet of Canson Mi-Teintes Black, A3, vellum face up.
   Register the plotter for a 297×420mm sheet, 15mm margin all round.
2. Load Ink 3 (Sakura Metallic Silver, 0.4mm). Plot `artwork-rim.svg`
   (13 strokes). This is the faintest layer and goes down first, so any
   later handling of the sheet can't smudge ink already meant to read as
   almost gone. Let dry 5 minutes.
3. Load Ink 2 (Sakura Metallic Sky Blue, 0.4mm). Plot `artwork-mid.svg`
   (23 strokes) in the same registration. Let dry 5 minutes.
4. Load Ink 1 (Sakura Gelly Roll White, 0.7mm). Plot `artwork-core.svg`
   (6 strokes) in the same registration. Let dry fully (10 minutes — a
   fresh gel pass over card takes longer than the metallic inks).
5. Re-plot `artwork-core.svg` a second time, same pen, same
   registration, no offset. This is the one "bold" layer in the piece —
   built by repetition, per the repo's own convention — and it needs the
   first pass fully dry so the second doesn't drag wet ink.
6. Float-mount on black board, or frame under glass with a shadow-gap
   mat — the sheet should read as if lit from within, not sitting flush
   against a white wall mat.

## Plot settings

- Paper: A3 (297×420mm), portrait, 15mm margin.
- Pen widths: 0.7mm (core, ×2 passes), 0.4mm (mid), 0.4mm (rim).
- Pen travel is minimal — 42 strokes total across three sparse marks;
  no travel optimisation concerns for a plot this size (`optimizePlot`
  runs by default regardless).

## Reproduction

Requires the core package built (`pnpm install && pnpm build` from the
repo root). There is no CLI command for `lenia` yet (core-only
generator, see README), so this is a scratch Node script against the
built core package:

```js
// render-orbium.mjs — node render-orbium.mjs <outputDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const {
  generateLenia,
  toSVGLayers,
  PAPER_SIZES,
  pageMetrics,
  BASE_PX_PER_MM,
} = await import('/path/to/flow-lines/packages/core/dist/index.js');

const outputDir = process.argv[2] ?? '.';
mkdirSync(outputDir, { recursive: true });

const a3 = PAPER_SIZES.find((p) => p.id === 'a3');
const metrics = pageMetrics(a3, 'portrait', BASE_PX_PER_MM);
const marginMm = 15;

const res = generateLenia({
  width: metrics.widthPx,
  height: metrics.heightPx,
  margin: Math.round(marginMm * BASE_PX_PER_MM),
  seed: 12,
  preset: 'orbium',
  seedSpots: 1, // one creature, not the preset's default five
  steps: 180, // one full toroidal wrap, the start of a second
  decay: 0.99,
  style: 'contour',
  offCenter: 0.85,
});

const CORE_MM = 0.7;
const FINE_MM = 0.4;
const layerWidths = {
  core: CORE_MM * BASE_PX_PER_MM,
  mid: FINE_MM * BASE_PX_PER_MM,
  rim: FINE_MM * BASE_PX_PER_MM,
};

const svgOpts = {
  physicalWidth: `${metrics.widthMm}mm`,
  physicalHeight: `${metrics.heightMm}mm`,
  layerWidths,
};

for (const { layer, svg } of toSVGLayers(res, svgOpts)) {
  writeFileSync(join(outputDir, `artwork-${layer}.svg`), svg);
}
```

`preview.png` was rendered from the same simulation with all three
layers composited into one document (`toSVG` with `layerColors: { core:
'#f7f4e8', mid: '#7fb2c4', rim: '#55606a' }`, `includeBackground: true`,
`backgroundColor: '#12141a'`) via
`node scripts/svg-to-png.mjs preview-combined.svg preview.png --width 1200`.

## Wishes

- No CLI command for `lenia` yet — every other page-scale generator in
  this repo has one; this session had to drive it from a scratch script
  against the built core package the whole way through.
- No way to phase-shift the page window within the periodic simulation
  field. A literal two-panel diptych — panel B showing the exact same
  field shifted by half a page-width, so the fragment sliced off panel
  A's right edge visibly continues onto panel B's left edge — would make
  the toroidal-wrap claim demonstrable rather than asserted. Currently
  the only page window onto the field is the one anchored at the
  simulation's own origin.
- `rotateBitmap` only offers quarter turns for the Orbium seed, so a
  solitary glider always travels at one of four fixed diagonals. A
  continuous heading parameter would open up compositions where the
  travel direction is chosen rather than landed on by seed search.
