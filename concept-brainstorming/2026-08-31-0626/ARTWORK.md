# Nothing Mentions a Mountain

## Artist statement

The Arctic module draws random domino tilings of the Aztec diamond — an
exact, uniform sample from combinatorics, via domino shuffling, with no
randomness left over to argue about. Its own source comment says the arctic
circle theorem "fixes" a razor-sharp boundary between frozen brick order and
disordered chaos as the tiling grows, and adds: *nothing in the algorithm
mentions a circle.* Inking only the northern domino class turns that boundary
into tone — solid welded rules where the tiling froze, broken dashes where it
didn't — and at large enough order the boundary doesn't read as a circle
either. It reads as a mountain: a jagged summit ridge with sub-peaks, snow-line
and all, dissolving downward through scree into an open talus field. Nothing
in the algorithm mentions a mountain. It's an accident of the same theorem
that supposedly draws a circle, seen from inside one small arc of it at a
scale where "circle" stops being the useful word.

That accident is what earned this piece the cull. Everything else I tried —
the full diamond drawn as an even brick grid, the four-class weave turned
upright into a woven disc, twin ridges mirrored top and bottom into a
lozenge — read as pattern. This reads as a place.

The piece leans into a second property of the same theorem: for a fixed
order, the *boundary* is asymptotically fixed regardless of which uniform
tiling gets sampled — only the fine, idiosyncratic ridge and speckle detail
differs between seeds. So the drawing is two independent rolls of the exact
same die, plotted on the same sheet at a small deliberate offset: a cooler,
fractionally-shifted "echo" pass first, then a "witness" pass in near-black
ink at true registration on top. They land almost exactly on top of one
another because the mathematics guarantees they must, and the sliver of
daylight between them — visible mostly as a soft double edge along the ridge
crest and a slightly thicker scree field — is the only trace of the fact that
two different, unrelated 36,290-domino shuffles produced them. It's a portrait
of a law, drawn twice, so you can see the law holding and the dice still
rolling.

## Materials

- **Paper** — Fabriano Tiziano "Ghiaccio" (Ice) pastel paper, 160gsm, A3
  (297 × 420mm), portrait. A pale, cool grey with a faint green-blue
  undertone — cold enough to read as sky/ice, light enough that both inks
  sit clearly above it.
- **Ink 1 — echo pass** — Faber-Castell PITT Artist Pen, Cold Grey IV,
  0.3mm nib. Hex used for the digital proof: `#8f9498`.
- **Ink 2 — witness pass** — black India-ink fineliner (e.g. a 0.5mm
  Staedtler Pigment Liner or equivalent plotter-loaded technical pen).
  Hex used for the digital proof: `#16130f` (a near-black with the faintest
  warmth, not a flat `#000000`).

## Process

1. Cut/load one sheet of Fabriano Tiziano Ghiaccio, A3 portrait, into the
   plotter. Set the pen-up travel height comfortably clear of the paper
   texture (pastel stock has visible tooth).
2. Load the Cold Grey IV pen. Plot `artwork-layer-1.svg` (the "echo" pass —
   4,223 strokes). This lays down the fainter, fractionally offset twin of
   the ridge.
3. Without moving or re-registering the sheet, swap to the black fineliner.
   Plot `artwork-layer-2.svg` (the "witness" pass — 4,237 strokes) directly
   on top, at the file's true coordinates. Because both SVGs already carry
   the deliberate offset baked into their coordinates (see Reproduction),
   this pass is plotted at nominal registration — do not manually offset the
   second pass; the misregistration is already in the data, not in the
   plotting.
4. Let the black pass dry (2–3 minutes is plenty for a fineliner on this
   stock) before handling.
5. No wash, no mask, no second sheet. The paper's own cool tone is the sky;
   restraint is the point — a third colour or a hand tint would flatten the
   one thing that makes this a portrait of a law rather than a picture of a
   mountain.
6. Float-mount on white or pale grey board, generous margin, no mat window —
   let the paper's edge and tone stay visible.

## Plot settings

- Paper: A3, portrait, 297 × 420mm, no crop/tile (single sheet).
- Margin: 22mm on all sides (baked into the SVG coordinates, not a plotter
  setting).
- Pen widths: 0.3mm (echo, grey), 0.5mm (witness, black) — two physical
  pens, not a stroke-width trick; each SVG is single-pen, single-width.
- Strokes: 4,223 (layer 1) + 4,237 (layer 2) = 8,460 total. Both layers are
  reorder-only optimized (`orderPlot`, applied inside `generateArctic`) —
  chaining is deliberately skipped so welded ridge-crest runs and scree
  dashes stay as separate strokes; reordering alone already keeps
  consecutive strokes spatially close, so travel stays reasonable for a
  piece this dense.
- Deterministic seeds: 13 (echo), 6 (witness). Order: 190 (AD(190) =
  190 × 191 = 36,290 dominoes per tiling).

## Reproduction

No CLI command exists yet for the Arctic generator (it's core-only), so this
drives `packages/core` directly, following the pattern in
`scripts/city-gallery.mjs`. Save the script below as `render-final.mjs`
anywhere, then run it **from the repo root**:

```sh
pnpm --filter @flow-lines/core build   # from the repo root
node path/to/render-final.mjs concept-brainstorming/2026-08-31-0626
```

`render-final.mjs`:

```js
// Reproduction script for "Nothing Mentions a Mountain"
// (concept-brainstorming/2026-08-31-0626). No CLI command exists yet for
// the arctic generator, so this drives the built core package directly
// (the packages/core/dist barrel — same pattern as
// scripts/city-gallery.mjs).
//
//   pnpm --filter @flow-lines/core build   # from the repo root
//   node render-final.mjs <outDir>          # also run from the repo root
import { join } from 'node:path';
import fs from 'node:fs';

const coreDist = join(process.cwd(), 'packages', 'core', 'dist', 'index.js');
const { generateArctic, toSVG } = await import(coreDist);

const outDir = process.argv[2] ?? '.';
fs.mkdirSync(outDir, { recursive: true });

// A3 portrait, working directly in millimetres.
const PAGE_W = 297;
const PAGE_H = 420;
const MARGIN = 22;
const contentW = PAGE_W - 2 * MARGIN;
const contentH = PAGE_H - 2 * MARGIN;
const ORDER = 190; // AD(190): 190*191 = 36,290 dominoes

function translate(lines, dx, dy) {
  return lines.map((l) => ({ ...l, points: l.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }));
}

// Same order, same box, two different seeds: the arctic circle theorem fixes
// the ENVELOPE (the boundary is deterministic in the large-order limit), so
// the two rolls land almost exactly on top of one another — only the
// idiosyncratic ridge and speckle detail differs. Layer 1 (seed 13, "echo")
// prints first in cool grey and sits fractionally offset; layer 2 (seed 6,
// "witness") prints on top in near-black at true registration. The offset is
// a deliberate misregistration, not a rendering trick.
const echo = generateArctic({
  width: contentW, height: contentH, margin: 0,
  seed: 13, preset: 'dissolve', order: ORDER, wobble: 0.35,
});
const witness = generateArctic({
  width: contentW, height: contentH, margin: 0,
  seed: 6, preset: 'dissolve', order: ORDER, wobble: 0.35,
});

const ECHO_DX = 3.2;
const ECHO_DY = -2.6;
const echoLines = translate(echo.lines, MARGIN + ECHO_DX, MARGIN + ECHO_DY);
const witnessLines = translate(witness.lines, MARGIN, MARGIN);

const echoSvg = toSVG(
  { lines: echoLines, width: PAGE_W, height: PAGE_H, seed: 13 },
  { strokeColor: '#8f9498', strokeWidth: 0.3, physicalWidth: PAGE_W, physicalHeight: PAGE_H }
);
const witnessSvg = toSVG(
  { lines: witnessLines, width: PAGE_W, height: PAGE_H, seed: 6 },
  { strokeColor: '#16130f', strokeWidth: 0.5, physicalWidth: PAGE_W, physicalHeight: PAGE_H }
);

fs.writeFileSync(join(outDir, 'artwork-layer-1.svg'), echoSvg);
fs.writeFileSync(join(outDir, 'artwork-layer-2.svg'), witnessSvg);

console.log('layer-1 (echo, grey):', echoLines.length, 'strokes');
console.log('layer-2 (witness, black):', witnessLines.length, 'strokes');
```

`preview.png` was rendered with:

```sh
node scripts/svg-to-png.mjs _preview-source.svg preview.png --width 1800 --background '#dde1dc'
```

where `_preview-source.svg` merges the `<path>` elements of both layer SVGs
(in order: layer-1 then layer-2) into one document so the raster preview
shows both inks together, at their true colours, on the approximate paper
tone — a scratch compositing step, not part of the plotted artwork.

## Wishes

- The Arctic generator has no CLI command yet (`flow-lines arctic`) — every
  session that wants to explore it has to hand-roll a scratch script against
  the core dist barrel. A thin CLI wrapper (order, preset, marks, upright,
  wobble, seed, the shared paper/margin/pen flags) would make it as fast to
  iterate on as `landscape` or `planet`.
- No shared "misregistered echo pass" helper exists (offset the same or a
  paired generator's output by a small dx/dy across two pens) — I hand-rolled
  the translate/merge logic here. It's a small, generator-agnostic
  compositing utility that would generalise well beyond Arctic (any
  generator with a stable large-scale envelope and seed-level fine detail
  could use it for the same effect).
