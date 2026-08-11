# After a Machine Named Doré

## Artist statement

The repo's photo-to-ink `image` command has a style called `dore` —
dense, form-wrapping line systems that carry tone by *weight* rather
than count, the way a burin swells a groove through shadow and lifts to
a hairline in the light. It's named for Gustave Doré, the 19th-century
engraver who illustrated the Bible, Dante, Milton, and a shelf of
travel volumes (*London: A Pilgrimage* among them), and whose plates
made real cities look every bit as invented as Hell. This piece takes
that style at its word and points it at the one building on Earth that
already looks like it walked out of a Doré plate: Saint Basil's
Cathedral, Red Square, Moscow — onion domes twisted like barley sugar,
a silhouette that reads as storybook architecture even in an ordinary
tourist snapshot. Feeding a "Doré" engine a subject Doré never drew but
plainly *could* have felt like the strongest possible test of the
style, and it survived that test.

It's also the first `image`-command piece in this session's history —
every prior run reached for the noise-field and cellular generators;
the repo's actual namesake feature (photos into plotter ink) had never
been brought to the brainstorm. That gap turned out to be the idea:
nothing here needed a concept bent out of an abstract generator, only
a subject good enough that a straight, honest run of an existing style
was already the plate.

Getting here meant one real rejection. The same `dore` style tried on
a neon Tokyo backstreet (`street-setagaya.jpg`) collapsed into hatch
mud — night photography has no tonal range for a style built to
distribute weight across shadow-to-light gradients, and everything
degenerated into uniform cross-hatch with no legible structure. Doré's
engraving needs daylight and real contrast to have anything to say;
Saint Basil's, shot in full sun with a blue sky, gave it exactly that.
Even on the winning photo, the first pass (no label sidecar) hatched
the sky at a flat mechanical diagonal — competent but obviously
algorithmic. Adding `test-images/landmark-stbasils.labels.png` let the
sky material trigger the repo's dedicated sky treatment: stipple
density carrying the tone, cloud shapes carved as traced negative
space instead of hatched. That's the moment it stopped reading as a
filtered photo and started reading as an aquatint sky over an etched
foreground — the single biggest quality jump in the whole session.
Three seeds were compared at that point (1, 7, 42); 7 was kept for how
the foreground foliage rakes in one confident diagonal sweep, playing
against the cathedral's vertical thrust — 42's foliage sat more upright
and read calmer, but flatter.

The plate furniture — double neatline, ruled header and caption,
stroke-font captions — reuses the exact same core primitives
(`pageBorder`, the deep `stroke-font` import, `toSVG`) as the
2026-08-08 harmonograph diptych in this same folder, not reinvented.
The byline is deliberately plain: *"drawn by machine"*, not *"after
Doré"* dressed up as an anonymous 19th-century hand. The whole point of
plotter art is that the machine did it — the plate should say so.

## Materials

- **Paper**: Hahnemühle Bugra, 300 gsm, colour *Ivory* — a warm-toned,
  lightly textured mixed-fibre printmaking sheet (the closest common
  stock to foxed antique book paper), cut to full A3 (297×420 mm).
- **Ink**: Sakura Pigma Micron 02, colour *Black* — 0.30 mm pigment
  fineliner, waterproof and lightfast once dry (matches the plot's
  0.3 mm stroke width exactly).
- **Wash**: strong black tea, cooled, applied after plotting — the
  ageing step below. (Substitute a very dilute walnut-ink wash for a
  more even, less variable tone if preferred; tea gives more
  character/mottling.)
- Wide flat wash brush (25–38 mm), a board and low-tack tape to hold
  the sheet flat while damp, blotting paper or a clean towel.

## Process

1. Build the repo and run the reproduction script below to produce
   `artwork.svg` (A3 portrait, 297×420 mm, seed 7, single pen, single
   0.3 mm stroke width throughout — border, title, figure, and caption
   are all one ink pass).
2. Tape the Bugra Ivory A3 sheet to the plotter bed, all four corners.
3. Load the Pigma Micron 02 Black.
4. Plot `artwork.svg` in one pass. There is only one pen and one width
   in this file, so no layer swap or re-registration is needed.
5. Let the ink cure ~2 minutes (Pigma pigment ink sets fast).
6. **Age the sheet.** Brew strong black tea, let it cool to room
   temperature. With the sheet still taped flat to a rigid board,
   load the wash brush and lay one continuous wash edge-to-edge in
   long horizontal strokes, top to bottom, slightly overlapping each
   pass, working quickly so the front doesn't dry before the next
   stroke lands (avoids a hard tide line). One pass only — the pigment
   ink is fully waterproof and won't lift or feather, but re-wetting
   the same area repeatedly can pill a cotton-blend sheet. The wash
   will pool very slightly in the low-lying dot/hatch texture,
   deepening the darkest passages a shade further — a genuine
   printmaker's accident, not a rendering trick.
7. Leave taped to the board, ink-side up, away from direct heat, until
   fully dry (a cotton-blend 300 gsm sheet: roughly 2–3 hours to touch-
   dry, best left overnight before untaping to guarantee it lies flat).
8. Untape. Trim close to the outer neatline if a hard edge is wanted,
   or leave the natural deckle/tape-line for a softer presentation
   edge.
9. Float-mount in a frame with a generous mat window (~40 mm on every
   side) so the sheet's aged edge is visible rather than hidden under
   the mat bevel. Plain black or dark walnut moulding; non-glare
   glazing (the wash flattens sheen unevenly and reads badly under
   direct glass glare).

## Plot settings

- Paper: A3 portrait, 297×420 mm — the plotter maximum, used at full
  size (no tiling needed).
- Margin: baked into the composition (16 mm outer neatline, a second
  rule 3 mm further in; the figure sits in its own inset band with
  further breathing room above/below).
- Pen: single pen, 0.3 mm width, for the entire file.
- Seed: 7.
- 10,413 strokes after chaining/optimisation; ≈24.1 m of pen travel.

## Reproduction

Deterministic from one seed (`7`). Build the repo, save the script
below as `plate.mjs` **in the repo root** (it imports
`packages/core/dist` and `packages/cli/dist` by relative path and
reads `test-images/landmark-stbasils.jpg` + its committed
`.labels.png` sidecar), then run:

```sh
pnpm install && pnpm build
node plate.mjs concept-brainstorming/2026-08-11-0620 7
```

This writes `concept-brainstorming/2026-08-11-0620/artwork.svg` byte-
for-byte identical to the committed file.

`plate.mjs`:

```js
// "Saint Basil's, After a Machine Named Dore" — a single engraved plate.
//
// The repo's photo-to-ink "dore" style is named after Gustave Dore, whose
// 19th-century engravings made fantastical, half-invented places look real.
// This plate runs that style, honestly, on the one real building that
// already looks like it was invented by an illustrator: Saint Basil's
// Cathedral. No code changes — imageToPenInk + resolvePenInkStyle('dore')
// exactly as the CLI's `image --style dore` resolves them — wrapped in the
// same hand-built "plate furniture" (double neatline, ruled header/caption,
// stroke-font text) as the 2026-08-08 harmonograph diptych, built from the
// core's own exported primitives (pageBorder, stroke-font, toSVG). Nothing
// here is copy-pasted repo source; it is core's public API used the way a
// CLI command uses it.
//
// Run from repo root after `pnpm build`:
//   node plate.mjs <outDir> <seed>
import { writeFileSync } from 'node:fs';

const {
  imageToPenInk,
  resolvePenInkStyle,
  optimizePlot,
  measurePenTravel,
  toSVG,
  pageBorder,
} = await import(process.cwd() + '/packages/core/dist/index.js');
const { loadImage, loadLabelImage } = await import(process.cwd() + '/packages/cli/dist/io.js');
const { textToStrokes, textWidth } = await import(
  process.cwd() + '/packages/core/dist/stroke-font.js'
);

const OUT_DIR = process.argv[2] ?? '.';
const SEED = Number(process.argv[3] ?? 7);

const PXPERMM = 3;
const mm = (v) => v * PXPERMM;

// ---- page layout (mm) -----------------------------------------------------
const PAGE_W = 297; // A3 portrait — the plotter maximum, used in full
const PAGE_H = 420;

const outerMargin = 16;
const innerInset = 3;
const ix0 = outerMargin + innerInset; // 19
const ix1 = PAGE_W - outerMargin - innerInset; // 278
const iyTop = outerMargin + innerInset; // 19
const iyBot = PAGE_H - outerMargin - innerInset; // 401

const titleY = iyTop + 6; // 25
const rule1Y = iyTop + 11; // 30
const figBandTop = rule1Y + 6; // 36
const bylineY = iyBot - 17; // 384
const rule2Y = bylineY + 6; // 390
const captionY = rule2Y + 6.5; // 396.5
const figBandBottom = bylineY - 6; // 378

const lines = [];

function centeredText(text, cyMm, sizeMm, layer = 'label') {
  const w = textWidth(text, mm(sizeMm));
  const x = mm(PAGE_W / 2) - w / 2;
  const y = mm(cyMm) - mm(sizeMm) / 2;
  for (const stroke of textToStrokes(text, x, y, mm(sizeMm))) lines.push({ points: stroke, layer });
}

function leftText(text, x0Mm, cyMm, sizeMm, layer = 'label') {
  const y = mm(cyMm) - mm(sizeMm) / 2;
  for (const stroke of textToStrokes(text, mm(x0Mm), y, mm(sizeMm))) lines.push({ points: stroke, layer });
}

function translate(srcLines, dxMm, dyMm) {
  for (const l of srcLines) {
    lines.push({ ...l, points: l.points.map((p) => ({ x: p.x + mm(dxMm), y: p.y + mm(dyMm) })) });
  }
}

// ---- neatline (double rule) ------------------------------------------------
lines.push(...pageBorder({ width: mm(PAGE_W), height: mm(PAGE_H), marginPx: mm(outerMargin), layer: 'border' }));
lines.push(...pageBorder({ width: mm(PAGE_W), height: mm(PAGE_H), marginPx: mm(ix0), layer: 'border' }));

// ---- header + rule ----------------------------------------------------------
centeredText("SAINT BASIL'S CATHEDRAL", titleY, 5.2);
lines.push({ points: [{ x: mm(ix0), y: mm(rule1Y) }, { x: mm(ix1), y: mm(rule1Y) }], layer: 'border' });

// ---- figure: the engraving itself -----------------------------------------
const image = loadImage(process.cwd() + '/test-images/landmark-stbasils.jpg');
const labelMap = loadLabelImage(process.cwd() + '/test-images/landmark-stbasils.labels.png');

const bandWidthMm = ix1 - ix0 - 4; // small inset off the inner rule
const bandHeightMaxMm = figBandBottom - figBandTop;
const contentWidthPx = Math.round(mm(bandWidthMm));

const penInkOptions = resolvePenInkStyle('dore', {
  width: contentWidthPx,
  seed: SEED,
  labelMap,
  optimize: false, // one optimize pass over the whole assembled plate, below
});

const figure = imageToPenInk(image, penInkOptions);
const figWidthMm = figure.width / PXPERMM;
const figHeightMm = figure.height / PXPERMM;
if (figHeightMm > bandHeightMaxMm) {
  throw new Error(`figure too tall: ${figHeightMm}mm > ${bandHeightMaxMm}mm band`);
}
const figX0 = ix0 + 2 + (bandWidthMm - figWidthMm) / 2;
const figY0 = figBandTop + (bandHeightMaxMm - figHeightMm) / 2;
translate(figure.lines, figX0, figY0);

// ---- byline + rule + caption ------------------------------------------------
leftText('DRAWN BY MACHINE, IN THE MANNER OF DORE', ix0 + 2, bylineY, 3.0);
lines.push({ points: [{ x: mm(ix0), y: mm(rule2Y) }, { x: mm(ix1), y: mm(rule2Y) }], layer: 'border' });
centeredText('PLATE I - MOSCOW, RUSSIA', captionY, 3.6);

// ---- assemble, optimize once, export ---------------------------------------
let result = { lines, seed: SEED, width: mm(PAGE_W), height: mm(PAGE_H) };
result = optimizePlot(result, {});

writeFileSync(
  `${OUT_DIR}/artwork.svg`,
  toSVG(result, {
    strokeColor: '#000000',
    strokeWidth: 0.3,
    physicalWidth: `${PAGE_W}mm`,
    physicalHeight: `${PAGE_H}mm`,
  })
);
const travelMm = measurePenTravel(result) / PXPERMM;
console.log(`${result.lines.length} strokes, ${(travelMm / 1000).toFixed(1)}m pen travel -> ${OUT_DIR}/artwork.svg`);
console.log(`figure: ${figure.lines.length} strokes, ${figWidthMm.toFixed(1)}x${figHeightMm.toFixed(1)}mm`);
```

`preview.png` was rendered with `scripts/svg-to-png.mjs
concept-brainstorming/2026-08-11-0620/artwork.svg
concept-brainstorming/2026-08-11-0620/preview.png --width 1800
--background '#f2e8d5' --stroke '#231a12'` — an ivory ground and a
soft warm-black line, approximating the Bugra Ivory sheet and the
tea-aged Micron line without literally re-rendering the wash.

## Wishes

- `textToStrokes`/`textWidth` (`packages/core/src/stroke-font.ts`) are
  still an unexported deep import for plate captions — the third
  brainstorming session in a row to reach for them this way (noted
  before on 2026-08-08). This run also found the font has no accented
  glyphs at all: `textToStrokes('É', ...)` silently returns zero
  strokes (confirmed for `É`, `@`, em dash, and both parens — same
  empty-string behaviour, just a wider set than previously logged).
  The byline had to read "DORE" instead of "Doré" as a result. A
  handful of common accented Latin glyphs (é, è, ñ, ü, ö...) plus the
  small punctuation set already flagged would let plates cite proper
  names and loanwords correctly.
- No dedicated "plate layout" helper exists for the header/figure/
  caption band arithmetic this script (and the harmonograph diptych
  before it) both hand-derive from `pageBorder` and raw mm offsets. A
  `plateLayout({ page, headerBandMm, footerBandMm, ... }) -> { titleY,
  ruleY, contentRect, ... }` helper in core would remove the copy-
  pasted geometry from every future plate-styled piece.
- `imageToPenInk` has no built-in crop/region-of-interest option —
  composing a subject into a reserved content band (as opposed to
  filling the whole canvas via `--paper`/`--fit`) currently means
  rendering at a computed content width and manually translating the
  result, same as the harmonograph figure did. A `contentInset` or
  explicit target-rect option would make this a one-line call instead
  of hand-placed translation.
