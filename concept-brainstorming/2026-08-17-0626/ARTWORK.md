# By Heart

## Artist statement

Sixteen rows, one per year, age 3 to 18. Each row is the same exercise,
repeated across the line the way a school primer makes you repeat a
letter: draw a heart. At the top the hand is three years old — a heart
collapses into a lopsided flag, the outline doesn't close, the pen
retraces itself trying to find the start again. By the bottom it's an
adult's hand — small, confident, evenly spaced, done in one clean pass.
Between the two, right where you'd expect it, ages 13 to 16 fill with
cupid's arrows and a scatter of cracked hearts that isn't in any other
row. Nobody told the piece to put heartbreak there; it's just where the
generator's own `age` parameter — built to model closure failures,
sloppy retraces and schema-simplification in a child's drawing hand —
happens to overlap with the `arrows`/`broken` style weights I dialed up
for exactly those rows. The generator was built for one thing (what a
young hand gets wrong) and the piece asks it to carry a second, human
one (what growing up gets wrong) without changing a line of code to do
it.

The repo's `hearts` generator has an `age: 3..18` knob that nothing in
this studio's gallery had used yet — it's the most specific, most
narrative-capable parameter in the whole toolbox, and it had been
sitting there unused. Everything else in this piece — the ruled practice
lines, the dashed midline, the margin numbers — exists only to make that
one knob legible: to turn "a hand gets steadier with age" into "this is
a growth chart, read it top to bottom." I kept discarding versions that
looked like a novelty valentine (too much pink-holiday feeling, too
cute) until the practice-paper frame made it read as a record instead
of a greeting card. That's the version I'd stand behind.

## Materials

- **Paper** — A3 (297 × 420 mm), portrait. A warm ivory wove stock, e.g.
  Clairefontaine Triomphe Ivory 120 gsm (or any smooth, acid-free
  cartridge/laid paper in the same family) — hex reference `#f1e8d3`.
  Warm rather than stark white: it should read as a page pulled from an
  old exercise book, not a fresh sheet.
- **Ink 1 — "the child's hand"**: a lightfast oxblood/wine pigment ink,
  hex `#4a1220` (e.g. Diamine Oxblood, or an equivalent lightfast
  pigment ink loaded into a technical pen — Rotring Isograph 0.4 mm or
  equivalent). This is the only ink that draws a heart anywhere on the
  page.
- **Ink 2 — "the given structure"**: a pale, cool schoolbook blue, hex
  `#8fb3d1`, in a technical pen at 0.25 mm (Rotring Isograph 0.25 or
  equivalent). Draws only the ruled lines and the margin numbers —
  everything that was already on the page before anyone picked up a pen
  to draw a heart.
- Nothing else — no wash, no second sheet, no distressing. The paper's
  own warmth carries the "found document" feeling; adding aging effects
  on top read as costume, not object.

## Process

1. Load the A3 sheet, portrait, registered to the plotter's default
   origin.
2. Plot `artwork-rule-blue.svg` with the 0.25 mm technical pen loaded
   with the pale blue ink (hex `#8fb3d1`). This lays down the seventeen
   solid boundary rules, the sixteen dashed mid-lines, and the margin
   numbers 3–18 — the entire mechanical scaffold, drawn first because a
   real ruled page is printed before anyone writes on it.
3. Without moving or re-registering the paper, swap to the 0.4 mm
   technical pen loaded with the oxblood ink (hex `#4a1220`) and plot
   `artwork-oxblood.svg`. This is the only pass that draws hearts —
   sixteen rows, one age per row, running age 3 (top) to age 18
   (bottom).
4. Let both passes dry fully (pigment ink, ~30 min) before handling.
5. No further hand work. The piece is complete as the two-pass plot.

## Presentation

Single A3 sheet, float-mounted (not glued flat — a small air gap so the
paper's deckle/cut edge stays visible, like a preserved page) in a deep
box frame, simple black or dark walnut moulding, UV-filtering
non-reflective glass. No mat board beyond the float mount — the ivory of
the sheet itself is the field around the ruled page.

## Plot settings

- Paper: A3, 297 × 420 mm, portrait, 20 mm margin on all sides.
- Layer 1 (rule + numbers): 0.25 mm pen, ~471 strokes, ≈ 2.7 m pen-up
  travel.
- Layer 2 (hearts): 0.4 mm pen, ~812 strokes, ≈ 4.8 m pen-up travel.
- Both layers pass through the repo's `orderPlot` (reorder-only —
  no chaining, so no discrete heart or glyph outline gets fused with
  its neighbour) before export.

## Reproduction

Built against this repo's core package
(`pnpm --filter @flow-lines/core build` first). There is no CLI command
for the hearts generator's per-row scripting used here, so this is a
scratch Node script against the built core package — inlined below,
byte-for-byte reproducible at seed 42:

```js
// by-heart.mjs — practice-sheet of hearts, ages 3..18, one row per age.
// Usage: node by-heart.mjs <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const coreDist = resolve(process.cwd(), 'packages/core/dist/index.js');
const { generateHearts, toSVG, pageMetrics, getPaperSize, measurePenTravel, orderPlot } =
  await import(coreDist);
const { textToStrokes } = await import(
  resolve(process.cwd(), 'packages/core/dist/stroke-font.js')
);

const outDir = resolve(process.argv[2] ?? '.');
mkdirSync(outDir, { recursive: true });

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));

const PX_PER_MM = 3; // BASE_PX_PER_MM
const MARGIN_MM = 20;
const PEN_HEARTS_MM = 0.4;
const PEN_RULE_MM = 0.25;
const SEED = 42;

const paper = getPaperSize('a3');
const metrics = pageMetrics(paper, 'portrait', PX_PER_MM);
const { widthPx: W, heightPx: H, widthMm, heightMm } = metrics;
const margin = MARGIN_MM * PX_PER_MM;
const penHearts = PEN_HEARTS_MM * PX_PER_MM;
const penRule = PEN_RULE_MM * PX_PER_MM;

const x0 = margin, y0 = margin, x1 = W - margin, y1 = H - margin;
const bw = x1 - x0, bh = y1 - y0;

const AGES = Array.from({ length: 16 }, (_, i) => 3 + i); // 3..18
const rowH = bh / AGES.length;

// A bell curve centred on age 14-15 (first-heartbreak years), zero before
// 11 and fading back to zero by 18 — the one narrative beat in an
// otherwise formal developmental gradient.
function brokenWeight(age) {
  if (age < 11) return 0;
  const d = (age - 14.5) / 3;
  return Math.max(0, 0.42 * (1 - d * d));
}

function arrowWeight(age) {
  if (age < 11) return 0;
  return Math.min(0.35, lerp(0, 0.35, (age - 11) / 7));
}

let heartLines = [];
for (let i = 0; i < AGES.length; i++) {
  const age = AGES[i];
  const t = clamp01((age - 3) / (18 - 3));
  const rowTop = y0 + i * rowH;
  const cyNorm = (rowTop + rowH / 2 - y0) / bh;
  const hNorm = (rowH * 0.86) / bh;

  const heartScaleMm = lerp(19, 11.5, t);
  const count = Math.round(lerp(7, 12, t));

  const res = generateHearts({
    width: W,
    height: H,
    margin,
    seed: SEED + i * 7919,
    count,
    clustering: 0,
    minSeparation: heartScaleMm * PX_PER_MM * 0.95,
    region: { kind: 'rect', cx: 0.5, cy: cyNorm, w: 0.96, h: hNorm },
    heartScale: heartScaleMm * PX_PER_MM,
    scaleVariance: lerp(0.32, 0.16, t),
    depthGrade: 0,
    plumpness: 0.5,
    plumpVariance: lerp(0.3, 0.12, t),
    tilt: lerp(0.55, 0.22, t),
    age,
    mix: {
      outline: 1,
      solid: lerp(0.04, 0.22, t),
      hatched: lerp(0, 0.6, t),
      broken: brokenWeight(age),
    },
    fillDensity: 0.55,
    hatchAngle: -35 * (Math.PI / 180),
    hatchJitter: 0.3,
    arrows: arrowWeight(age),
    boldOutline: lerp(0.04, 0.35, t),
    shading: 0,
    occlude: true,
    penWidth: penHearts,
    wobble: 0.8,
    optimize: false, // merge first, order once at the end
  });
  heartLines.push(...res.lines.map((l) => ({ ...l, layer: 'hearts' })));
}

// Ruling: solid boundary line per row edge + a dashed midline per row —
// classic primary-ruled practice paper. Perfectly straight: the printed
// scaffold, in contrast to the hand-drawn hearts.
let ruleLines = [];
for (let i = 0; i <= AGES.length; i++) {
  const y = y0 + i * rowH;
  ruleLines.push({ points: [{ x: x0, y }, { x: x1, y }], layer: 'rule' });
}
const dash = 6 * PX_PER_MM, gap = 4 * PX_PER_MM;
for (let i = 0; i < AGES.length; i++) {
  const y = y0 + i * rowH + rowH / 2;
  let x = x0;
  while (x < x1) {
    const xEnd = Math.min(x1, x + dash);
    ruleLines.push({ points: [{ x, y }, { x: xEnd, y }], layer: 'rule' });
    x += dash + gap;
  }
}

// Age numbers in the left margin gutter, vertically centred per row.
let labelLines = [];
const labelSize = 6.2 * PX_PER_MM;
for (let i = 0; i < AGES.length; i++) {
  const age = AGES[i];
  const rowTop = y0 + i * rowH;
  const text = String(age);
  const strokes = textToStrokes(text, 0, 0, labelSize);
  let maxX = 0;
  for (const s of strokes) for (const p of s) maxX = Math.max(maxX, p.x);
  const tx = x0 - 8 * PX_PER_MM - maxX;
  const ty = rowTop + rowH / 2 - labelSize / 2;
  for (const s of strokes) {
    labelLines.push({ points: s.map((p) => ({ x: p.x + tx, y: p.y + ty })), layer: 'rule' });
  }
}

const heartsResult = orderPlot({ lines: heartLines, width: W, height: H, seed: SEED });
const ruleResult = orderPlot({
  lines: [...ruleLines, ...labelLines],
  width: W,
  height: H,
  seed: SEED,
});

const svgHearts = toSVG(heartsResult, {
  strokeWidth: penHearts,
  physicalWidth: `${widthMm}mm`,
  physicalHeight: `${heightMm}mm`,
});
const svgRule = toSVG(ruleResult, {
  strokeWidth: penRule,
  physicalWidth: `${widthMm}mm`,
  physicalHeight: `${heightMm}mm`,
});
const svgCombined = toSVG(
  { lines: [...ruleResult.lines, ...heartsResult.lines], width: W, height: H, seed: SEED },
  {
    physicalWidth: `${widthMm}mm`,
    physicalHeight: `${heightMm}mm`,
    layerColors: { hearts: '#4a1220', rule: '#8fb3d1' },
    layerWidths: { hearts: penHearts, rule: penRule },
  }
);

writeFileSync(join(outDir, 'artwork-oxblood.svg'), svgHearts);
writeFileSync(join(outDir, 'artwork-rule-blue.svg'), svgRule);
writeFileSync(join(outDir, 'artwork.svg'), svgCombined);

console.log('hearts lines:', heartsResult.lines.length, 'rule lines:', ruleResult.lines.length);
console.log('hearts travel (mm):', Math.round(measurePenTravel(heartsResult) / PX_PER_MM));
console.log('rule travel (mm):', Math.round(measurePenTravel(ruleResult) / PX_PER_MM));
```

Run from the repo root after building core:

```sh
pnpm --filter @flow-lines/core build
node by-heart.mjs ./out
```

Preview (paper and inks as specified above):

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png \
  --width 1800 --background '#f1e8d3'
```

(`artwork.svg` already carries explicit per-layer stroke colours via
`layerColors`, so the preview needs no `--stroke` override; the two
single-ink files — `artwork-oxblood.svg` and `artwork-rule-blue.svg` —
are what actually get sent to the plotter, one per pass.)

## Candidates considered

- **A single mixed field of hearts at random ages, no rows.** The `age`
  effect reads as noise rather than a trend when it isn't sorted by
  anything — you can't tell a 6-year-old's heart from a 9-year-old's
  without a spatial axis to compare along. Discarded immediately.
- **First render of the row idea, no narrative shaping of `arrows` /
  `broken`.** Broken hearts and cupid's arrows appeared at a low,
  constant rate across every row (see the mix weights in an early
  version), including age 4 and age 17 alike. Technically fine, but it
  wasted the one thing a chronological layout can do that a random
  field can't: place a feeling at a specific age. Reworked so `broken`
  is exactly zero before 11 and after 18, peaking at 14–15, and `arrows`
  only switches on at 11+ — both narrative choices, not generator
  defaults.
- **Solid (concentric-ring) fill as the dominant "confident adult"
  style.** Looked more like a target/bullseye motif than a heart filled
  in with practiced ink, especially stacked several to a row — too
  decorative, competed with the growth-chart read. Cut the `solid`
  weight's ceiling from 0.55 to 0.22 and let `hatched` (a proper
  diagonal ink fill) carry most of the "this hand can commit to a fill
  now" signal instead.
- **A3 vs A4.** Tried the same layout scaled to A4 to see if the
  smaller, more literally exercise-book-sized sheet felt more intimate.
  It didn't — sixteen rows of hand-drawn hearts need room to be read
  individually, and A4 crowded the youngest, biggest rows against the
  margin. Kept A3: still a single sheet, but each row gets space to
  breathe.
- **A printed title on the sheet** ("Practice," a name, a date range).
  Cut. The margin numbers already tell you what you're looking at, and
  a printed title turned the object from "a page you found" into "a
  page someone designed" — worked against the piece.

## Wishes

- `HeartsOptions` has no direct "row of N practice attempts, evenly
  spaced left to right" placement mode — `count` + `clustering: 0` +
  `minSeparation` gets close, but true even spacing across a wide, thin
  region (rather than rejection-sampled scatter) would have saved
  several rows' worth of the awkward left/right gaps still visible in
  the final piece. A `layout: 'row'` option alongside the existing
  scatter would generalize to any wide/thin region, not just this
  piece.
