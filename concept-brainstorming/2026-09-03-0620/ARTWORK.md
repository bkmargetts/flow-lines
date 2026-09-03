# Concordant

## Artist statement

In 1992, Elkies, Kuperberg, Larsen and Propp found a way to sample a
domino tiling of the Aztec diamond — the diamond-shaped region you get
by stacking rows of unit squares 2, 4, 6, … wide — that is *exactly*
uniform: no Markov chain, no burn-in, no question of whether it has
mixed. Six years later Jockusch, Propp and Shor proved something nobody
had put into the algorithm on purpose: run it at any size and the
tiling always freezes into four corners of perfect brick-course order,
with a disordered, everything-goes-uniformly-at-random region in the
middle — and the boundary between frozen and liquid converges to the
circle inscribed in the diamond. Nothing about a circle is coded
anywhere. It falls out of the combinatorics. It's called the arctic
circle theorem, and this repo has had a generator for it, `arctic`, for
several sessions now without anyone using it for a piece — the gap this
run set out to close.

One class of domino (`N`, the north-pointing horizontal ones) gets
inked as a spine the length of the domino; touching spines in the same
row weld into a single stroke. In the frozen corner that class owns,
every row is full-width and every spine welds with its neighbours —
solid ruled courses. Inside the circle the class shows up at random, so
spines rarely touch and stay short broken dashes — a scatter of tone
with no gradient function anywhere in the code, just the accounting of
which dominoes happen to be adjacent. Outside its own corner but still
frozen, the class doesn't appear at all — bare paper. Run the tiling
once at a large enough order and you get a shape that reads, entirely
by accident, as a snow-capped peak dissolving into scree — there's even
a jagged pale ridge line sitting right at the frozen/liquid transition
in every single seed I tried, an artifact of exactly how the last solid
courses break up that I did not ask for and cannot take credit for.

What earned this piece the keep, over just plotting that one drawing,
is what happens when you run the experiment more than once. The
frozen/liquid boundary is a theorem — it converges to the same circle
regardless of the coin flips inside the shuffle. The speckle inside it
is not; it's a fresh uniformly random tiling every time. So three
independent runs at the same order, inked in three different colours
and registered on the same sheet, should agree exactly on the boundary
and disagree everywhere inside it. That is precisely what the three
layers here do: the solid corner overprints into a near-black tri-tone
mass because all three seeds fill it identically, the disordered band
below breaks into a chromatic stipple of three unmixed hues because the
seeds never coincide there, and the paper below the circle stays paper
in all three because none of the seeds ever put a mark there. The piece
is a three-times-repeated measurement of an invariant, made visible with
no shading, no gradient fill, and no operation on the drawing except
"which dominoes are next to which" — the same honesty the codebase's own
comment on this generator insists on, extended from tone into colour.

## Materials

- **Paper** — one sheet, 297 × 366 mm (portrait, inside the A3 limit —
  chosen slightly shorter than full A3 height to match the drawing's own
  proportions and avoid dead margin), Winsor & Newton Bristol Board,
  Smooth, Bright White, 250 gsm.
- **Ink / pen 1** (`artwork-layer-1.svg`) — Prussian Blue drawing ink in
  a 0.35 mm technical pen (Rotring Isograph or equivalent AxiDraw-safe
  fineliner), hex `#1b3a5c`.
- **Ink / pen 2** (`artwork-layer-2.svg`) — Peacock/Teal drawing ink,
  same 0.35 mm pen, hex `#137a7f`.
- **Ink / pen 3** (`artwork-layer-3.svg`) — Imperial Purple / indigo
  drawing ink, same 0.35 mm pen, hex `#4b3a6e`.
- Low-tack removable tape or registration pins to hold the sheet
  perfectly still across the three pen changes — the whole piece depends
  on the three passes sharing one coordinate frame.

## Process

1. Tape the Bristol sheet to the plotter bed. Do not move it again until
   all three passes are plotted.
2. Load the Prussian Blue pen. Plot `artwork-layer-1.svg` (seed 11).
3. Swap to the Teal pen, same pen-down pressure/height. Plot
   `artwork-layer-2.svg` (seed 42) directly on top, unchanged page
   position.
4. Swap to the Imperial Purple pen. Plot `artwork-layer-3.svg` (seed 77)
   last, on top of the first two — plotting the darkest-reading ink last
   is what keeps the solid corner reading as a rich near-black rather
   than a muddy grey once all three overprint.
5. Let each pass dry fully before the next if the inks are at all
   wet/fountain-style; a pigment fineliner needs under a minute.
6. Unpin once pass 3 is dry. No wash, no further hand work — the colour
   separation is the whole material idea, and adding anything over it
   would be the "shading trick" the piece is explicitly refusing.

`preview.png` in this folder is a rasterised approximation of the three
layers overprinted with multiply blending on the paper colour — it is
not one of the plotter files, just the fastest way to judge the
registered result before committing ink.

## Plot settings

- Paper: custom 297 × 366 mm, portrait (`--paper 297x366 --orientation portrait`
  equivalent — the reproduction script sets width/height directly since
  `arctic` has no CLI command yet).
- Margin: 18 mm on all four sides.
- Pen width: 0.35 mm, one width for all three layers.
- Diamond order: 170 (clamped range is 4–260; 170 gives ~3,300–3,400
  welded strokes per pass, ≈10,075 total across the three layers —
  plots comfortably on one sitting).
- Optimize: on (`arctic`'s own `orderPlot` — reordering only, no
  chaining, so the welded dominoes stay geometrically exact).

## Reproduction

`arctic` is a core-only generator (no CLI command yet — see Wishes), so
it's driven directly from the built package, the pattern
`scripts/city-gallery.mjs` uses. Build core first
(`pnpm --filter @flow-lines/core build`), then run:

```js
// reproduce.mjs
import { writeFileSync } from 'node:fs';
const { generateArctic, toSVG } = await import(
  '/home/user/flow-lines/packages/core/dist/index.js'
);

const WIDTH_MM = 297;
const HEIGHT_MM = 366;
const MARGIN_MM = 18;
const ORDER = 170;
const LAYERS = [
  { file: 'artwork-layer-1.svg', seed: 11, color: '#1b3a5c' }, // Prussian Blue
  { file: 'artwork-layer-2.svg', seed: 42, color: '#137a7f' }, // Teal
  { file: 'artwork-layer-3.svg', seed: 77, color: '#4b3a6e' }, // Imperial Purple
];

for (const { file, seed, color } of LAYERS) {
  const res = generateArctic({
    width: WIDTH_MM,
    height: HEIGHT_MM,
    margin: MARGIN_MM,
    preset: 'dissolve', // single class ('N'), the strongest reading of the theorem
    order: ORDER,
    seed,
  });
  const svg = toSVG(res, {
    physicalWidth: WIDTH_MM,
    physicalHeight: HEIGHT_MM,
    strokeColor: color,
    strokeWidth: 0.35,
  });
  writeFileSync(file, svg);
}
```

Every SVG in this folder is byte-reproducible from this script — `arctic`
is exactly deterministic per seed (domino shuffling has no burn-in or
mixing to vary run to run), and `preset: 'dissolve'` fixes order 170,
margin and marks unless overridden above.

`preview.png` was rendered from the three layers merged in-memory
(same three `generateArctic` calls, tagged into one result and passed to
`toSVG` with `layerColors` + `layerBlend: 'multiply'` and
`backgroundColor: '#f7f8f6'`) via `scripts/svg-to-png.mjs`, purely for
proofing — it is not part of the reproduction chain above.

## Wishes

- A `flow-lines arctic` CLI command would remove the need for a scratch
  script entirely — every other generator explored in this session's
  toolbox has one, and `arctic` is the only one left without.
- `toSVGLayers` already exists for splitting one multi-class result into
  per-pen files; there's no equivalent helper for merging *several
  separate generator calls* (as this piece needed) into one multi-layer
  result — I hand-rolled the `{ ...l, layer }` remap above. A small
  `mergeLayers(results, names)` utility in `packages/core/src/lib/`
  would save the next multi-pass piece the same trick.
