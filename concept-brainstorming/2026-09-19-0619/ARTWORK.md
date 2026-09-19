# Nine-Tenths

## Artist statement

`arctic` is the quietest generator in this repository: no CLI command,
no web module, not mentioned in CLAUDE.md's own toolbox table — just a
core module and its test file, built around a genuinely startling piece
of combinatorics. It samples a domino tiling of an Aztec diamond
*exactly* uniformly (Elkies–Kuperberg–Larsen–Propp domino shuffling —
no Markov chain, no burn-in, no mixing question, so the drawing is as
deterministic per seed as anything else in this repo). Then the arctic
circle theorem (Jockusch–Propp–Shor, 1998) does something no shading
routine in this codebase can: as the diamond grows, the tiling *freezes*
into four brick-regular corners while staying uniformly disordered
everywhere else, and the boundary between frozen and disordered becomes
an exact circle. Nothing in the sampling algorithm mentions a circle —
it falls out of pure counting.

The four frozen corners belong to four "domino classes," and inking a
single class turns the theorem into tone rather than a diagram: in that
class's own frozen corner the dominoes pack into perfect courses and
weld into long unbroken rules — solid tone; in the other three corners
nothing of this class ever appears — clean paper; inside the circle the
class turns up at random, so its marks stay short and broken — a fading
speckle. One rule, no shading trick, and the result was an accident I
wasn't looking for: run non-upright, the visible shape is a clean
triangle sitting on top of a ragged, gradually thinning disc — and that
triangle-over-disc, exactly at the point where solid tone gives way to
scattered marks, is the silhouette of an iceberg's ice-line. The ordered
part above the fold is small, faceted, and certain. What's below is
larger, disordered, only ever partially resolved, and it just trails off
rather than announcing an edge — the "tip of the iceberg" idiom, arrived
at from a uniform random sampling algorithm with no notion of water,
buoyancy, or ice in it anywhere. I did not go looking for a nautical
picture; the combinatorics produced one, and once seen it was hard to
read the same tiling as anything else.

Of the module's four presets, `dissolve` (a single inked class) was the
only one that reads this way. `horizon` (two opposed classes) makes a
symmetric lens/eye shape — elegant, but it announces its own symmetry
and never resolves into a single legible mass. `weave` and `brick` (all
four classes, or every outline) recover the theorem's promised even grey
— true to the maths, inert as a picture. Isolating one class is what
turns a distribution into an object.

The composition commits to that reading: the tiling sits in the upper
half of a tall sheet, small against a page that is mostly left as
plotter-untouched paper — not a page-filling drawing, an object adrift
in a page-sized sea. Dark paper, pale ink: the ink stands for the ice
that shows, and everything the pen never reaches is simply water.

## Materials

- **Paper**: Canson Mi-Teintes, Night Blue (Bleu Nuit), 160gsm, A3
  (297×420mm), plotted on the smooth (fine-grain) face — the other
  face's canvas-weave tooth would catch and skip a gel tip on this much
  fine broken linework.
- **Ink**: Sakura Gelly Roll White, 08 (medium tip) — an opaque pigment
  gel chosen specifically because it lays down full white coverage on a
  dark ground in one pass; a dye-based or fineliner ink would grey out
  against Night Blue instead of reading as ice-white.
- Nothing else: one pen, one pass, no wash, no second colour, no
  mounting hardware beyond a simple float mount if framed.

## Process

1. Load the Night Blue Mi-Teintes sheet smooth-face-up, A3, portrait.
2. Plot `artwork.svg` once, fitted to the full 297×420mm sheet, with the
   Sakura Gelly Roll White 08 loaded as the single pen.
3. Let the gel ink cure at least 15 minutes before handling — gel ink
   sits on top of smooth cardstock rather than sinking in the way a
   fineliner does on cotton rag, and smears more readily while wet,
   especially over the dense welded courses at the top of the mass.
4. No second pass, no wash, no registration step — the piece is
   finished off the plotter. Float-mount under glass if framing, since a
   window mat would cut into the large deliberately-empty lower field
   the piece depends on.

## Plot settings

- Paper: A3, portrait, 297×420mm.
- Render scale: 3px/mm (page canvas 891×1260px).
- Content square: 230×230mm (690×690px), placed 45mm from the top edge
  and 26mm from the left edge (45mm/145mm top/bottom split, 26mm/41mm
  left/right split) — off-centre and high on the sheet, so roughly a
  third of the page height below it stays untouched paper.
- Pen width: 0.35mm (SVG `stroke-width` 1.05 at the 3px/mm render
  scale) — a single width throughout, no offset/bold passes (the
  generator's own docs are explicit that bold emphasis has no place
  here: the tone is already the tiling's long-range order, and extra
  passes would thread new lines through a mass that reads as solid
  precisely because it's frozen).
- Seed 555, order 200 (Aztec diamond AD(200): 200 × 201 = 40,200
  dominoes), preset `dissolve` (single class `N` inked as welded
  spines), hand-drawn wobble 0.3px.
- 4,638 plotted strokes after `orderPlot` reordering (reorder-only, not
  chained — the welded spines are discrete objects like the repo's other
  discrete-shape generators, so chaining would fuse separate rules and
  round-cap the joins across the sharp brick-corner edge).
- Estimated pen travel: ~13.6m drawn ink, ~8.7m pen-up travel.

## Reproduction

```sh
pnpm install && pnpm build   # builds packages/core/dist/index.js
```

Save as `render-nine-tenths.mjs` and run with `node render-nine-tenths.mjs`
(exactly the script this session ran):

```js
import { writeFileSync } from 'node:fs';
const { generateArctic, toSVG } = await import(
  './packages/core/dist/index.js'
);

const PX_PER_MM = 3;
const PAGE_W_MM = 297, PAGE_H_MM = 420;
const PAGE_W = PAGE_W_MM * PX_PER_MM, PAGE_H = PAGE_H_MM * PX_PER_MM;
const CONTENT_PX = 230 * PX_PER_MM;
const offX = 26 * PX_PER_MM, offY = 45 * PX_PER_MM;

const res = generateArctic({
  width: CONTENT_PX,
  height: CONTENT_PX,
  margin: 10,
  seed: 555,
  preset: 'dissolve',
  order: 200,
  wobble: 0.3,
  optimize: true,
});

const translated = {
  ...res,
  width: PAGE_W,
  height: PAGE_H,
  lines: res.lines.map((l) => ({
    ...l,
    points: l.points.map((p) => ({ x: p.x + offX, y: p.y + offY })),
  })),
};

const svg = toSVG(translated, {
  strokeColor: '#000000',
  strokeWidth: 1.05,
  physicalWidth: `${PAGE_W_MM}mm`,
  physicalHeight: `${PAGE_H_MM}mm`,
  precision: 2,
});

writeFileSync('concept-brainstorming/2026-09-19-0619/artwork.svg', svg);
```

Then the preview (recolours only the raster preview; `artwork.svg` itself
stays default black-on-transparent so the SVG is a pure geometry file):

```sh
node scripts/svg-to-png.mjs concept-brainstorming/2026-09-19-0619/artwork.svg \
  concept-brainstorming/2026-09-19-0619/preview.png \
  --width 1400 --background '#0a1a2e' --stroke '#eef6fb'
```

## Wishes

- No CLI command for `arctic` yet (core-only) — a `flow-lines arctic`
  command mirroring the other generators would let this preset (and the
  `horizon`/`weave`/`brick` alternatives) be explored without a scratch
  script.
- `arcticLayerName` already tags each domino class for per-pen export,
  which reads like an invitation for a four-colour variant (all four
  frozen corners inked in four inks, so the "liquid" middle becomes a
  genuine dithered blend of colours rather than one class's speckle) —
  worth a future session once there's a CLI or web surface to drive it
  from.
