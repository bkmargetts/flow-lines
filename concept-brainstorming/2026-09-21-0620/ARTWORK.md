# The Ice Rule

## Artist statement

Domino tilings of the Aztec diamond are the classical "ice-type" model of
statistical mechanics — the same combinatorics Linus Pauling used to
explain the residual entropy of water ice, because a domino covering
obeys exactly the local constraint ("two in, two out" at every vertex,
rephrased here as one tile per pair of cells) that ice crystals obey at
every oxygen atom. Sample one such tiling uniformly at random — no
physics, no image, just an exact O(n²) shuffle (Elkies–Kuperberg–
Larsen–Propp) that never once mentions geometry — and a circle appears
anyway. The arctic circle theorem (Jockusch–Propp–Shor, 1998) says the
tiling *must* freeze into perfect brick order in the four corners of the
diamond and *must* stay disordered inside the circle inscribed in it,
and that the boundary between them sharpens to a razor edge as the
diamond grows. Nothing draws that circle. It is a proof, not a design
choice.

This piece inks only the horizontal dominoes — the two classes the
theorem calls north and south — one pole in black, the opposite pole in
blue, on a single A3 sheet. At the top, courses of black ink weld into
solid, page-wide rules: absolute order. At the bottom, the same thing
happens in blue. Between them, both colours degrade from ruled lines
into hand-sized broken dashes, salt-and-peppering together into a dense
storm, bounded on every side by an arc that is, provably, a circle —
though no circle was ever computed, only inferred from where the ink
happens to weld and where it doesn't.

I tried the tool's other three presets first — a single frozen corner
dissolving alone (elegant but static: one shape, one gesture), the
uniform grey of every domino outlined (honest, but the circle carries no
tone and the picture reads as a diagram, not a drawing), and all four
classes as an orthogonal weave (too busy — the corners fight for
attention and the circle drowns). Two poles, two colours, meeting in a
zone neither can claim, is the one that stopped me: it draws exactly the
theorem and nothing else, and it reads — unprompted — as ice retreating
from two poles into open, turbulent water. That the mathematics here was
*literally invented to model ice* is not a coincidence I get to take
credit for; it's the reason the piece works. Among six seeds rendered at
full order, seed 3 was kept for its crest: the frozen/liquid boundary at
the top breaks into a triple ridge that reads, unassisted, as a distant
mountain range dissolving into weather.

## Materials

- **Paper**: Hahnemühle Bright White, 250gsm, hot-press (smooth) —
  A3 portrait, 297×420mm, full sheet, no trimming. Hot-press is
  important here: a toothy cold-press sheet would feather the 0.3mm
  nibs and blur the welded rules that carry the frozen corners' tone.
- **Pen 1 — north pole**: Sakura Pigma Micron 03 (0.35mm nib), colour
  Black, `#0a0a0a`. Pigment ink, archival, fast-drying, waterproof once
  set.
- **Pen 2 — south pole**: Uni Pin Fine Line 03 (0.3mm nib), colour Blue,
  `#1c4e78`. Same ink family (pigment, fast-drying) so the two passes
  behave identically on the paper.
- No wash, no mask, no second sheet — this is a single-sheet, two-pass
  line piece. The paper itself carries the "liquid" region's mid-tone;
  nothing is added beyond the two inks.

## Process

1. Mount the A3 sheet (297×420mm, portrait) on the plotter bed at the
   machine's normal home origin. **Do not move or re-home the sheet
   between passes** — both layers share one coordinate system and rely
   on the bed position staying fixed for registration.
2. Load **Pen 1** (Sakura Pigma Micron 03, Black). Plot
   `ice-rule-layer-1-north.svg` at 100% scale (the file declares its own
   297×420mm physical size). This draws the north pole's solid frozen
   courses at the top of the sheet and its half of the dissolving storm
   in the middle.
3. Leave the sheet on the bed and let the black ink dry for **at least
   10 minutes** — the second pass will travel close to freshly-inked
   dashes in the storm band.
4. Swap to **Pen 2** (Uni Pin Fine Line 03, Blue), same holder, same bed
   position.
5. Plot `ice-rule-layer-2-south.svg` at 100% scale. This draws the south
   pole's solid frozen courses at the bottom and its half of the storm,
   interleaving with the now-dry black dashes.
6. Let the sheet dry flat for 15 minutes before handling.
7. **Presentation (optional but recommended)**: float-mount on a cool
   grey or pale slate backing board sized roughly 350×470mm, leaving an
   even ~25mm reveal of the backing around the sheet. A plate-like
   presentation — generous, even margin, no decorative frame — suits a
   picture whose only content is a boundary that the mathematics drew,
   not the artist.

## Plot settings

- Paper: A3, portrait, 297×420mm
- Margin: 28mm clear border on all sides (baked into the render)
- Pen widths: 0.3mm nib, both layers (0.35mm actual Micron tip; both
  read the same at this scale)
- Strokes: 4,256 (north / black) + 4,153 (south / blue) = 8,409 discrete
  segments. Reordered for pen-up efficiency (`orderPlot`) but
  deliberately **not chained** — each domino is a separate square-ended
  unit, and chaining would fuse them into continuous paths with rounded
  interior joins, softening the brick geometry the whole piece is about.
- Estimated pen travel: ≈16.8m drawn ink + ≈16.9m pen-up travel (north),
  ≈16.8m drawn ink + ≈16.6m pen-up travel (south) — around 67m of total
  head motion across both passes.

## Reproduction

Deterministic per seed via exact domino shuffling (EKLP) — no Markov
chain, no burn-in, no run-to-run variance. Build core, then run:

```sh
pnpm --filter @flow-lines/core build
node reproduce.mjs concept-brainstorming/2026-09-21-0620
```

`reproduce.mjs`:

```js
// reproduce.mjs — regenerates both SVGs in this folder, byte-for-byte.
// Run from the repo root after building core:
//   pnpm --filter @flow-lines/core build
//   node reproduce.mjs <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const { generateArctic, toSVGLayers, getPaperSize, pageMetrics } = await import(
  resolve(process.cwd(), 'packages/core/dist/index.js')
);

const outDir = process.argv[2] ?? '.';
mkdirSync(outDir, { recursive: true });

const paper = getPaperSize('a3');
const page = pageMetrics(paper, 'portrait'); // 3 px/mm reference density -> 891x1260px
const marginMm = 28;
const marginPx = marginMm * page.pxPerMm;
const penWidthMm = 0.3;
const SEED = 3;

const result = generateArctic({
  width: page.widthPx,
  height: page.heightPx,
  margin: marginPx,
  seed: SEED,
  preset: 'horizon', // inks both horizontal domino classes: N (north pole) + S (south pole)
  order: 190,
  upright: false, // diamond/vesica orientation, poles at top & bottom
  wobble: 0.25,
});

const layers = toSVGLayers(result, {
  strokeWidth: penWidthMm * page.pxPerMm,
  physicalWidth: `${page.widthMm}mm`,
  physicalHeight: `${page.heightMm}mm`,
  layerColors: {
    'domino-n': '#0a0a0a', // Sakura Pigma Micron 03, Black
    'domino-s': '#1c4e78', // Uni Pin Fine Line 03, Blue
  },
});

const names = {
  'domino-n': 'ice-rule-layer-1-north.svg',
  'domino-s': 'ice-rule-layer-2-south.svg',
};
for (const { layer, svg } of layers) {
  if (!names[layer]) continue;
  writeFileSync(join(outDir, names[layer]), svg);
  console.log(`wrote ${names[layer]}`);
}
```

`preview.png` was rasterized from the same tiling with both layers
merged into one SVG (`toSVG` instead of `toSVGLayers`, same
`layerColors`, plus `includeBackground: true` with `backgroundColor:
'#fbfbf8'` to approximate the paper). `preview-source.mjs`:

```js
// preview-source.mjs — merged two-colour SVG, for preview.png only
// (the plotting files are the two layers above). Run from repo root:
//   node preview-source.mjs preview-source.svg
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { generateArctic, toSVG, getPaperSize, pageMetrics } = await import(
  resolve(process.cwd(), 'packages/core/dist/index.js')
);

const paper = getPaperSize('a3');
const page = pageMetrics(paper, 'portrait');
const marginMm = 28;
const marginPx = marginMm * page.pxPerMm;
const penWidthMm = 0.3;

const result = generateArctic({
  width: page.widthPx, height: page.heightPx, margin: marginPx,
  seed: 3, preset: 'horizon', order: 190, upright: false, wobble: 0.25,
});

const svg = toSVG(result, {
  strokeWidth: penWidthMm * page.pxPerMm,
  includeBackground: true,
  backgroundColor: '#fbfbf8', // approximate Hahnemühle Bright White hot-press
  physicalWidth: `${page.widthMm}mm`,
  physicalHeight: `${page.heightMm}mm`,
  layerColors: { 'domino-n': '#0a0a0a', 'domino-s': '#1c4e78' },
});
writeFileSync(process.argv[2], svg);
```

then:

```sh
node preview-source.mjs preview-source.svg
node scripts/svg-to-png.mjs preview-source.svg preview.png --width 1400
```

## Wishes

- `arctic` (the Aztec-diamond domino-tiling generator) has no CLI
  command yet — unlike every other generator in this session's toolbox,
  it can only be driven from a scratch Node script against
  `packages/core/dist`. A `flow-lines arctic` command (mirroring
  `--preset`, `--order`, `--marks`, `--upright`, `--multi-ink`, and a
  `--split-layers` for the per-class pens) would make this generator as
  reproducible-by-hand as the rest, without needing an inlined script in
  every write-up that uses it.
