# No Mountain Was Drawn

## Artist statement

This is not a drawing of a mountain. It is a proof.

`generateArctic` (`packages/core/src/arctic/`) samples a uniformly random
domino tiling of the Aztec diamond AD(n) by domino shuffling
(Elkies–Kuperberg–Larsen–Propp, 1992) — an exact algorithm, no Markov
chain, no burn-in, nothing stochastic about *whether* it converges. Every
domino falls into one of four classes by the direction it would slide in
the shuffle (N/S/E/W), and the arctic circle theorem (Jockusch–Propp–Shor,
1998) says that as the diamond grows, each class freezes solid in its own
corner and the four frozen corners meet the disordered middle along a
curve that converges to the circle inscribed in the diamond. The code
that produces this drawing contains the word "circle" exactly nowhere. It
places dominoes, sorts them into four classes by a coin flip inherited
from earlier rounds, and welds the touching edges of one class into
strokes. The circle is not a mark anyone made. It is a fact about what
must happen when this many fair coins are flipped in this pattern, and it
would appear whether or not anyone was there to draw it.

What I did not expect, scanning `dissolve` (the preset that inks a single
class) across seeds, is that the picture it makes is a mountain — an
exact one, in the classical vocabulary: a firm triangular snow-line at
the top, where the frozen class is packed so densely its welded spines
read as solid hatch; a broken, ragged ridge where the freeze gives way;
and a long scree-field of speckle below it, thinning by the same law of
large numbers that sharpens the boundary as the diamond grows, until it
vanishes into clean paper. Every hatch line above the ridge, every fleck
of scree below it, and the ridge itself are the same welded-spine
operation applied to the same random object — there is no separate
"boundary" pass, no gradient fill, no noise field tuned to fall off
correctly. The tone is the theorem.

I scanned six seeds at order 170 — high enough that the boundary is
already close to its limiting shape, low enough that the smallest welded
strokes are still comfortably above a fine pen's nib width at A3. Seed 5
was the one I kept: a double-summit ridge with a real saddle between the
two high points, asymmetric enough that it doesn't read as a computed
curve, and a scree field whose density falls off unevenly to one side —
the kind of irregularity a die-hard skeptic would take as proof a human
retouched it. Nobody did. It is one seed's coin flips.

The composition leaves most of the sheet empty on purpose: the mountain
sits in the top half, small against the page, the way a specimen sits
small in the middle of a scientific plate — and the lower half is
reserved, not empty, for the plate's own apparatus: a title and a line of
mathematical provenance, hand-lettered the way a 19th-century survey
plate would carry its legend. The piece wants to be looked at twice —
once as a mountain, once as a proof that it isn't one.

## Materials

- **Paper** — one A3 sheet (297 × 420 mm), portrait, Fabriano Artistico
  Extra White 300 gsm, **hot-press** (smooth) finish. The drawing's whole
  argument is in its fine tonal texture — thousands of short welded
  strokes carrying tone by density alone — and a cold-press tooth would
  break up the finest scree marks and the sharp snow-line edge. Bright
  white, not the ivory/kraft stock this studio has reached for before:
  the piece needs maximum contrast to read as legitimately drawn rather
  than printed.
- **Ink** — a single archival pigment ink, cool near-black with a faint
  blue-grey undertone (the paper's only mark), `#16171d`. De Atramentis
  Document Ink "Black" or Rohrer & Klingner "Scabiosa" are both close;
  any archival document/drawing ink sold as a true (not warm-sepia) black
  will do.
- **Pen** — one technical fineliner, 0.3 mm nib (Rotring Isograph 0.3,
  or a Sakura Pigma Micron 03). One pen, one width, for the whole plate —
  the generator deliberately has no bold-emphasis pass here (see the code
  comment in `arctic/index.ts`): the tone is carried by how densely the
  welded strokes pack, not by repeated offset passes, so a second pass
  would be lying about what the theorem actually produces.
- **Lettering ink** — the same black, same pen, for the hand-lettered
  plate caption (step 3 below) — one ink for the whole sheet, no second
  color.
- **Mounting** — simple black or dark walnut frame, generous cream or
  white mat (at least 50 mm), UV-filtering glass. The piece is quiet; the
  frame shouldn't compete with it.

## Process

1. Register the plotter for one A3 sheet (297 × 420 mm), portrait,
   0 mm plotter margin (the artwork's own margins are baked into the
   SVG's coordinate space — see Plot settings).
2. Load the 0.3 mm pen with the black ink. Plot `artwork.svg` in full.
   This is the only plotted pass — one pen, one pass, the whole drawing.
   Let the ink cure ~10 minutes before handling.
3. Hand-letter the plate caption in the reserved lower half of the sheet,
   using the same pen and ink, small caps, ranged left starting about
   60 mm from the left edge and roughly 300 mm down from the top (well
   clear of the lowest scree marks):
   - Title, larger: `NO MOUNTAIN WAS DRAWN`
   - Beneath it, smaller: `ARCTIC CIRCLE OF AD(170) · SEED 5`
   - Smaller still, a third line: `AFTER JOCKUSCH · PROPP · SHOR, 1998`
   Keep the lettering light and even — it is provenance, not decoration;
   it should read like a caption under a specimen, not a logo.
4. No wash, no color pass, no second sheet. The whole piece is one pen on
   one sheet, once.

## Plot settings

- Paper: A3, portrait (297 × 420 mm), plotter margin 0 mm (margins are
  in the artwork's own coordinates).
- Pen width: 0.3 mm, single pass, single pen — no `--hand-sketch-bold`
  or repeated-offset emphasis anywhere in this piece.
- The mountain occupies a 210 × 210 mm square positioned 45 mm from the
  top edge and centered horizontally (43.5 mm side margins), leaving
  165 mm of clear paper at the bottom for the hand-lettered caption.
- Pen travel: 3,483 strokes, already reordered (`orderPlot`, on by
  default in `generateArctic`) to minimize pen-up travel; not chained
  (chaining would fuse separate domino edges into one path and
  round-cap the joins, softening the lattice geometry the drawing is
  about — see the code comment in `arctic/index.ts`).

## Reproduction

Requires the repo built once (`pnpm install && pnpm build`), which
compiles `packages/core` to `packages/core/dist/index.js`. Save the
following as `compose-plate.mjs` and run
`node compose-plate.mjs concept-brainstorming/2026-09-22-0617 5 170`
(output dir, seed, order) — it writes `artwork.svg` byte-for-byte
identical to the one in this folder:

```js
// Final composition: arctic-circle "dissolve" mountain, placed in the
// upper portion of an A3 portrait sheet with a reserved lower margin for
// the hand-lettered plate caption. Pure translation of the generator's
// own output — no new geometry, no code changes.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const core = await import(new URL('packages/core/dist/index.js', `file://${process.cwd()}/`));
const { generateArctic, toSVG, getPaperSize, pageMetrics, BASE_PX_PER_MM } = core;

const outDir = process.argv[2] ?? '.';
mkdirSync(outDir, { recursive: true });

const SEED = Number(process.argv[3] ?? 5);
const ORDER = Number(process.argv[4] ?? 170);

const page = pageMetrics(getPaperSize('a3'), 'portrait', BASE_PX_PER_MM);
const mm = BASE_PX_PER_MM; // px per mm

// Layout, in mm, then converted to px.
const CONTENT_MM = 210; // square content area
const TOP_MARGIN_MM = 45;
const SIDE_MARGIN_MM = (297 - CONTENT_MM) / 2;

const contentPx = CONTENT_MM * mm;
const offX = SIDE_MARGIN_MM * mm;
const offY = TOP_MARGIN_MM * mm;

const inner = generateArctic({
  width: contentPx,
  height: contentPx,
  margin: Math.round(contentPx * 0.02),
  preset: 'dissolve',
  order: ORDER,
  seed: SEED,
});

const lines = inner.lines.map((line) => ({
  ...line,
  points: line.points.map((p) => ({ x: p.x + offX, y: p.y + offY })),
}));

const result = { lines, width: page.widthPx, height: page.heightPx, seed: SEED };

const svg = toSVG(result, {
  strokeColor: '#16171d',
  strokeWidth: 0.9,
  physicalWidth: '297mm',
  physicalHeight: '420mm',
  optimizePaths: true,
});

const file = join(outDir, `artwork.svg`);
writeFileSync(file, svg);
console.log(`wrote ${file} (${lines.length} lines)`);
```

`preview.png` was rendered with:

```sh
node scripts/svg-to-png.mjs concept-brainstorming/2026-09-22-0617/artwork.svg \
  concept-brainstorming/2026-09-22-0617/preview.png \
  --width 1600 --background '#fbfbf8'
```

(`--background` approximates the bright-white hot-press paper; the ink
color baked into the SVG is already the true `#16171d`.)

## Wishes

- `generateArctic` has no way to offset or crop the diamond within its
  own page box independent of `margin` (it always centers) — I worked
  around this by rendering into a small square canvas and translating
  the resulting points into the final page, which was easy enough not to
  need a fix, but a `placement: {x, y}` option would save every future
  session the same trick.
- There is no CLI command for `arctic` (it is core/web-only per
  `CLAUDE.md`'s list of core-only generators, alongside city and
  ribbon-weave) — worth adding if this generator gets used again, so a
  session doesn't have to hand-roll page placement from scratch.
