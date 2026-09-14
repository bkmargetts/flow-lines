# Firn Line

## Artist statement

This is a mountain that nobody designed. It is a uniformly random domino
tiling of an Aztec diamond, sampled exactly by domino shuffling (Elkies–
Kuperberg–Larsen–Propp) and inked by a single rule: draw the spine of
every domino belonging to one of the tiling's four combinatorial classes,
weld the ones that touch and run the same way into single strokes, and
leave the rest of the sheet blank. Nothing about that recipe mentions a
mountain, a snowline, or a slope. What comes out anyway is the arctic
circle theorem (Jockusch–Propp–Shor, 1998): near the diamond's corners
the tiling has no choice but to freeze into perfect brick courses, so the
welded strokes there fuse into long unbroken rules — solid tone. Toward
the middle every class appears at random, so the same strokes stay short
and scattered — flecks of tone that thin to nothing well before the
diamond's far corners, which the inked class never reaches at all. The
boundary between the two regimes is not modelled or drawn; it is an
exact circular arc that the mathematics forces to appear, and it happens
to fall exactly where a mountain's ice would meet its rock.

`packages/core/src/arctic/` — genuinely built for this repository and,
as far as this studio's session history goes, never once used for a
piece in thirty-plus prior runs. Every other generator here earns its
"drawn by a person" quality by fighting *against* algorithmic regularity:
wobble, patchiness, hand-sized clusters, deliberate imperfection. Arctic
does the opposite, and that is exactly what makes it worth a plate:
its authority comes from being *unable* to lie. A pen-and-ink illustrator
drawing a snowline is making a judgement call about where the ice gives
way to scree. This mountain's snowline is a theorem. I kept coming back
to the `dissolve` preset over `weave` and `horizon` — both denser, both
more obviously "generated" — because `dissolve` alone gives you the
plainest possible reading: a solid triangle of ice, a scatter of loose
rock, and a hard line the maths insists on between them. It is the one
render in this whole session that, cropped to a photograph, someone
could mistake for a real 19th-century survey plate of an unclimbed peak
— right up until they notice the caption crediting a probability
theorem instead of a surveyor.

## Materials

- **Paper**: Fabriano Artistico Extra White, Hot Press (smooth), 300gsm,
  one A3 sheet (297×420mm), portrait. Hot press because the piece is
  worked twice — a wet wash first, a 0.3mm pen second — and any tooth
  would both muddy the wash edge and catch the fine nib on the densest
  strokes near the summit.
- **Wash**: a thin, graduated watercolour sky laid by hand *before*
  plotting — a mix of Winsor & Newton Payne's Grey and a touch of
  Prussian Blue, heavily diluted. Full strength at the top edge, fading
  to bare white paper by roughly 60% down the sheet (just above where
  the scree scatter thins out), applied wet-on-dry with a large flat
  wash brush in one continuous graded pull, left to dry completely
  (30–60 min) before the sheet goes on the plotter.
- **Ink**: Noodler's Polar Black, loaded into a refillable technical
  drawing pen (Rotring Isograph, 0.25mm nib) — a bottled ink formulated
  not to freeze at low temperature, chosen for a glacier drawing on
  purpose. One pen, one width, the whole sheet; the generator builds its
  own tonal weight from how densely the welded strokes pack, so there is
  no bold-emphasis pass to add. Rendered hex for proofing/preview:
  `#1c2b3a` (a cool blue-black that sits close to the wash without
  disappearing into it).
- **Mount**: simple float mount, white core, in a plain dark frame —
  enough space around the sheet that the paper's own white margin reads
  as more sky, not a border.

## Process

1. Cut and tape down the A3 sheet (hot-press side up) on a rigid board;
   mask nothing — the wash is meant to run right to the sheet edges.
2. Mix the wash (Payne's Grey + a whisper of Prussian Blue, diluted to
   a very pale value — test on a scrap until a dry swatch reads as
   "overcast sky", not "storm"). Load a large flat brush generously.
3. Lay the wash in one continuous graded pull from the top edge: full
   strength at the top, easing off by the two-thirds mark, clear water
   only below that, so the wash is fully spent by about 60% down the
   sheet. Let dry flat and completely — do not force-dry near the pen
   stage, cockling will throw off registration on the plotter bed.
4. Once bone dry, re-tape flat to the plotter bed and home the machine.
5. Plot `artwork.svg` once, in full, with the Rotring Isograph
   (0.25mm nib) loaded with Noodler's Polar Black. One pass — the
   drawing's own weight (solid welded courses at the summit thinning to
   broken dashes at the base) is already built into the line file; nothing
   is plotted twice.
6. Let the ink cure per the ink's instructions (Noodler's iron-gall-free
   pigment inks are usually dry to the touch in minutes but benefit from
   an hour before handling) before unmasking/trimming.
7. Float-mount and frame.

## Plot settings

- Paper: A3, 297×420mm, portrait, no additional plotter margin (the
  composition carries its own ~23mm side margins and generous top/bottom
  space as part of the drawn layout).
- Pen: 0.25mm technical nib, one ink, one width, one layer — the whole
  piece is a single SVG with a single `stroke-width`.
- Resolution: 3 px/mm (the repo's `BASE_PX_PER_MM`).
- Strokes: 3,833 welded domino spines + 145 caption strokes = 3,978
  plotted paths. Total drawn length ≈ 16.8 m. `orderPlot` (reorder-only,
  the default for this generator) is applied, so travel is already cut
  without fusing separate dominoes into one chained path.

## Reproduction

The tiling and its ink marks come straight from `packages/core`'s
`arctic` generator (no CLI command exists for it yet — it's driven
directly, same pattern as `scripts/city-gallery.mjs`). The plate caption
is set with the repo's internal single-stroke engraving font
(`packages/core/src/stroke-font.ts`) so the whole sheet, drawing and
label alike, is one pen pass. Build core first (`pnpm --filter
@flow-lines/core build`), then run:

```js
// firn-line.mjs
import { writeFileSync } from 'node:fs';
const core = 'packages/core/dist/index.js';
const strokeFont = 'packages/core/dist/stroke-font.js';
const { generateArctic, toSVG, pageMetrics, getPaperSize, BASE_PX_PER_MM } =
  await import(core);
const { textToStrokes, textWidth } = await import(strokeFont);

const ORDER = 180;
const SEED = 777;

const m = pageMetrics(getPaperSize('a3'), 'portrait', BASE_PX_PER_MM);
const sideMargin = 70;
const drawBoxW = m.widthPx - 2 * sideMargin;
const topGap = 150;

// Generate width-constrained (height is deliberately generous) so the
// diamond's natural aspect ratio decides its own height.
const raw = generateArctic({
  width: drawBoxW, height: 2400, margin: 0,
  preset: 'dissolve', order: ORDER, seed: SEED,
});

let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
for (const l of raw.lines) for (const p of l.points) {
  if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
  if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
}
const dx = sideMargin - x0;
const dy = topGap - y0;
const placedLines = raw.lines.map((l) => ({
  ...l,
  points: l.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
}));
const drawingBottom = topGap + (y1 - y0);

// Plate caption, centred, same pen, set in the repo's stroke font.
const capGap = 46, titleSize = 15, subSize = 8.4, lineGap = 9;
const centerX = m.widthPx / 2;
let capY = drawingBottom + capGap;
const capLines = [];
function addLine(text, size, y) {
  const w = textWidth(text, size);
  for (const s of textToStrokes(text, centerX - w / 2, y, size)) {
    capLines.push({ points: s, layer: 'caption' });
  }
  return y + size + lineGap;
}
capY = addLine('FIRN LINE', titleSize, capY);
capY = addLine(`AZTEC DIAMOND AD${ORDER} - DOMINO SHUFFLE - SEED ${SEED}`, subSize, capY);
capY = addLine('ARCTIC CIRCLE THEOREM - JOCKUSCH, PROPP, SHOR 1998', subSize, capY);

const result = {
  lines: [...placedLines, ...capLines],
  width: m.widthPx, height: m.heightPx, seed: SEED,
};
writeFileSync('artwork.svg', toSVG(result, {
  strokeColor: '#1c2b3a',
  strokeWidth: 1.05,
  physicalWidth: `${m.widthMm}mm`,
  physicalHeight: `${m.heightMm}mm`,
}));
```

Run with `node firn-line.mjs` from the repo root — byte-identical to
`artwork.svg` in this folder (order 180, seed 777, deterministic: the
EKLP domino shuffle has no burn-in or mixing question, so this is exact,
not statistically likely).

`preview.png` approximates the physical piece: it takes `artwork.svg`,
recolours every stroke to `#1c2b3a`, and inserts a graduated
`linearGradient` background rect (pale grey-blue at top fading to warm
white by ~62% down the sheet) standing in for the hand-laid watercolour
wash, then rasterizes with the same `@resvg/resvg-js` library
`scripts/svg-to-png.mjs` uses (that script's own `--background` only
takes a flat colour, so this one extra step — not committed — swaps in
a two-stop gradient rect before calling Resvg directly at 2000px wide).

## Wishes

- `scripts/svg-to-png.mjs --background` only accepts a flat colour. A
  `--background-gradient "stop%,color;stop%,color;..."` flag would let a
  graduated-wash preview (this piece, and presumably future ones) go
  through the documented tool instead of a one-off script.
- No CLI command wraps `arctic` yet, unlike every other core generator
  with real presets. Even a bare `flow-lines arctic` exposing `--preset`,
  `--order`, `--seed`, `--upright` would have saved re-deriving the
  page-fit/placement math this session hand-rolled.
