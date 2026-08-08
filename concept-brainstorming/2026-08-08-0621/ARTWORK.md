# Two Ways to Draw 3 : 2

## Artist statement

The harmonograph generator (`packages/core/src/harmonograph`) is really
three drawing machines wearing one API: a damped-pendulum harmonograph,
a spirograph, and a rose-engine guilloché rosette. Read the option list
closely and one parameter gives the whole game away — `damping`, "0..1,
0 = pure Lissajous." The rosette machine has no such knob. It can't: a
rose-engine lathe cuts a fixed gear ratio into metal, so the pattern it
turns out is a closed-form curve, indifferent to time, that would look
identical whether it took a second or a century to trace. A pendulum
harmonograph is the opposite kind of object — a swinging weight losing
real energy to real air and real friction, integrated stroke by stroke
until it runs down to a point. Two machines, and only one of them is
subject to entropy.

This piece asks both to draw the same relationship — a 3∶2 frequency
ratio, the interval a fifth is built from — and hangs their answers side
by side. *Fig. I* is the `engine-turn` preset with `jitter` locked to
`0`: every seeded randomness the generator has (phase drift, damping
asymmetry, ring-wave noise) switched off, so what's left is the pure
mechanism — forty concentric rings, each barleycorn wave stepping the
same 7.5° phase advance as the last, world without end. *Fig. II* is the
`rotary` harmonograph mode at the actual 3∶2 ratio, `damping` at 0.4,
`rotary` blended to 0.85 — the same coupled-oscillator idea, but this
time actually swinging, actually decaying: wide clean orbits at the
rim tightening into a dense, chaotic knot at the centre, exactly where
the pendulum finally gives up its energy.

Getting here took working through all seven look presets at low
resolution first. `pendulum` and `rotary` at their defaults gave the
harmonograph everyone already has stuck to a fridge somewhere — the
familiar crossed-oval "bowtie," a shape so recognisable it read as
clip art rather than a drawing. `spiro`/`wheelwork` were pleasant
Spirograph flowers but had nothing to say. `lissajous` was too thin to
carry a plate on its own. What earned engine-turn its place was how
instantly it reads as *engraved* — this is the pattern under a watch
dial or across a banknote, machine-perfect guilloché, and it needed
almost no persuasion to feel like a specimen worth mounting. The
`rotary` pendulum at ratio 1∶1 was tried too (a spinning pinwheel/fan,
too spiky and off-centre to sit as a matching plate) before settling on
3∶2 rotary — the one configuration whose outer rings still echo the
rosette's concentric order, so the eye reads it as *the same object,
run through time* rather than an unrelated tangle. Once both plates
were dressed in the same "plate furniture" — double neatline, ruled
header, engraved caption, plate number, built from the repo's own
`pageBorder` and `stroke-font` primitives the way the Machine generator's
plate does — the pairing clicked: not two renders, but one argument
about the difference between geometry and physics, made in two inks.

## Materials

- **Panel I — "The Ideal"**: G. F Smith Colorplan, 270 gsm, colour
  *Ebony*, cut to 170×170 mm. Ink: Sakura Gelly Roll Metallic 08,
  colour *Silver* (~0.4 mm effective line) — a cold, hard metallic on
  black card, reading as a polished steel movement or a struck medal.
- **Panel II — "The Actual"**: G. F Smith Colorplan, 135 gsm, colour
  *Bark*, cut to 170×170 mm. Ink: Sakura Pigma Micron 03, colour
  *Sepia* (0.35 mm, pigmented, waterproof) — a warm, oxidised line on
  warm kraft-brown card, reading as tarnished brass.
- No wash, no mounting tape in either piece itself — framing is
  presentation, not part of the plotted object.

## Process

1. Build the repo (`pnpm install && pnpm build`) and generate
   `artwork-panel-1.svg` and `artwork-panel-2.svg` with the reproduction
   script below.
2. Cut both Colorplan sheets to 170×170 mm square from parent stock
   (comfortably inside any A4/A3 plotter bed with room to tape down).
3. **Panel I.** Load the plotter with the Gelly Roll Metallic Silver
   pen. Gel ink lays down more pigment than a fineliner and is prone to
   skipping if driven too fast on a cold nib — run the plot slower than
   default (≈15–20 mm/s) and scribble a short warm-up stroke on scrap
   Colorplan first so the ball is fully wetted before the pen touches
   the real sheet. Tape the Ebony square to the bed, plot
   `artwork-panel-1.svg` in one pass (single pen, no layer swap), then
   let it cure a full 10 minutes undisturbed — gel ink stays wet longer
   than a fineliner, especially over the dense inner rings where passes
   sit close together.
4. **Panel II.** Load the Pigma Micron 03 Sepia. Tape the Bark square to
   the bed, plot `artwork-panel-2.svg` in one pass at normal speed.
   Pigma pigment ink sets in under a minute; still, let it sit ~2
   minutes before handling.
5. Mount: float-mount both squares side by side in one wide box frame
   (or two matching narrow frames hung with a small, consistent gap —
   ~25–30 mm reads well), a few mm of breathing room between the
   neatline and the mat window on each, not trimmed to it. One frame
   moulding (plain black or dark walnut) for both panels unifies the
   diptych despite the two paper colours. Non-glare glazing — the
   metallic silver line on Panel I catches direct glare badly under
   normal glass.

## Plot settings

- Paper: custom square, 170×170 mm, each panel its own sheet (well
  under the A3 plotter maximum).
- Margin: baked into the composition (14 mm outer neatline, a second
  rule 3 mm further in) — no additional plotter margin needed.
- Pen: one pen per panel — 0.4 mm (Panel I, metallic gel) / 0.35 mm
  (Panel II, fineliner).
- Panel I: 128 plotted strokes after `optimizePlot`. Panel II: 85
  plotted strokes after `optimizePlot`.

## Reproduction

Deterministic from one seed (`3`) shared by both panels — Panel I is
`jitter: 0`, so it is only very slightly seed-sensitive (a single global
start-phase); Panel II's decay pattern is fully seed-dependent. Build
the repo, save the script below as `plate.mjs` **in the repo root** (it
imports `packages/core/dist` by relative path), then run:

```sh
pnpm install && pnpm build
node plate.mjs concept-brainstorming/2026-08-08-0621 1 3
node plate.mjs concept-brainstorming/2026-08-08-0621 2 3
mv concept-brainstorming/2026-08-08-0621/panel-1.svg concept-brainstorming/2026-08-08-0621/artwork-panel-1.svg
mv concept-brainstorming/2026-08-08-0621/panel-2.svg concept-brainstorming/2026-08-08-0621/artwork-panel-2.svg
```

`plate.mjs`:

```js
// "Two Ways to Draw 3:2" — a diptych plate.
//
// Panel I  ("THE IDEAL"):  engine-turned guilloché rosette — a closed-form
//          curve, no time, no friction, jitter=0 (a perfectly repeatable
//          mechanical pattern from a rose-engine lathe).
// Panel II ("THE ACTUAL"): a damped two-pendulum harmonograph trace at the
//          same 3:2 frequency ratio — a real physical process integrated
//          over time, losing energy to friction until it dies at a point.
//
// Both panels share one layout: a double neatline, a header rule, a
// centred circular figure, and an engraved caption band — assembled from
// core's own exported primitives (generateHarmonograph, pageBorder,
// stroke-font, toSVG). No repo source changed.
//
// Run from repo root after `pnpm build`:
//   node plate.mjs <outDir> <panel:1|2> <seed>
import { writeFileSync } from 'node:fs';

const { generateHarmonograph, toSVG, pageBorder, optimizePlot } = await import(
  process.cwd() + '/packages/core/dist/index.js'
);
const { textToStrokes, textWidth } = await import(
  process.cwd() + '/packages/core/dist/stroke-font.js'
);

const PXPERMM = 3;
const mm = (v) => v * PXPERMM;

const OUT_DIR = process.argv[2] ?? '.';
const PANEL = process.argv[3] ?? '1';
const SEED = Number(process.argv[4] ?? 3);

const PAGE_MM = 170; // square sheet

const outerMargin = 14;
const innerInset = 3;
const ix0 = outerMargin + innerInset; // 17
const ix1 = PAGE_MM - outerMargin - innerInset; // 153

const headerY = ix0 + 4; // 21
const rule1Y = ix0 + 8; // 25
const figY0 = rule1Y + 4; // 29
const figSize = 96;
const figY1 = figY0 + figSize; // 125
const figLabelY = figY1 + 4; // 129
const rule2Y = figLabelY + 4; // 133
const captionY = rule2Y + 7; // 140

const lines = [];

function centeredText(text, cyMm, sizeMm, layer = 'label') {
  const w = textWidth(text, mm(sizeMm));
  const x = mm(PAGE_MM / 2) - w / 2;
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

// ---- neatline (double rule) -----------------------------------------------
lines.push(...pageBorder({ width: mm(PAGE_MM), height: mm(PAGE_MM), marginPx: mm(outerMargin), layer: 'border' }));
lines.push(...pageBorder({ width: mm(PAGE_MM), height: mm(PAGE_MM), marginPx: mm(ix0), layer: 'border' }));

// ---- header + rule ----------------------------------------------------------
centeredText('TWO WAYS TO DRAW 3 : 2', headerY + 2, 3.0);
lines.push({ points: [{ x: mm(ix0), y: mm(rule1Y) }, { x: mm(ix1), y: mm(rule1Y) }], layer: 'border' });

// ---- figure -------------------------------------------------------------
let figure;
let figLabel;
if (PANEL === '1') {
  figure = generateHarmonograph({
    width: mm(figSize),
    height: mm(figSize),
    margin: mm(2),
    seed: SEED,
    preset: 'engine-turn',
    jitter: 0,
    scale: 0.94,
  });
  figLabel = 'FIG. I - THE IDEAL - ROSE ENGINE, NO FRICTION';
} else {
  figure = generateHarmonograph({
    width: mm(figSize),
    height: mm(figSize),
    margin: mm(2),
    seed: SEED,
    preset: 'rotary',
    mode: 'harmonograph',
    ratioNum: 3,
    ratioDen: 2,
    rotary: 0.85,
    damping: 0.4,
    detune: 0.004,
    periods: 60,
    scale: 0.94,
  });
  figLabel = 'FIG. II - THE ACTUAL - PENDULUM, DAMPED';
}
translate(figure.lines, (PAGE_MM - figSize) / 2, figY0);

leftText(figLabel, ix0 + 2, figLabelY, 2.6);
lines.push({ points: [{ x: mm(ix0), y: mm(rule2Y) }, { x: mm(ix1), y: mm(rule2Y) }], layer: 'border' });
centeredText(PANEL === '1' ? 'PLATE I' : 'PLATE II', captionY + 1.5, 3.2);

let result = { lines, seed: SEED, width: mm(PAGE_MM), height: mm(PAGE_MM) };
result = optimizePlot(result, {});

writeFileSync(
  `${OUT_DIR}/panel-${PANEL}.svg`,
  toSVG(result, {
    strokeColor: '#000000',
    strokeWidth: PANEL === '1' ? 0.4 : 0.35,
    physicalWidth: `${PAGE_MM}mm`,
    physicalHeight: `${PAGE_MM}mm`,
  })
);
console.log(`panel ${PANEL}: ${result.lines.length} strokes -> ${OUT_DIR}/panel-${PANEL}.svg`);
```

`preview.png` was composited from both SVGs, each recoloured to
approximate its ink-on-paper (`stroke="#000000"` swapped for `#c9ccd1`
silver on a `#141414` near-black ground for Panel I; `#8a4a2f` sepia on
a `#efe4cd` kraft ground for Panel II), then laid side by side with a
narrow gap — the same layout the framed diptych will have.

## Wishes

- `textToStrokes`/`textWidth` (`packages/core/src/stroke-font.ts`) keep
  getting reached for as an unexported deep import for "plate furniture"
  captions — this is the third brainstorming session to hand-roll a
  `centeredText`/`leftText` pair around it. Promoting the font plus a
  small `plateCaption()` helper (title/number/rule bundled) to the core
  barrel would save every future plate-styled piece the same
  boilerplate.
- The stroke font has no parenthesis, em dash, or colon-adjacent
  kerning control — captions here were written around the gap (`-`
  instead of `—`, no `()`) rather than against it. A handful of extra
  punctuation glyphs would open up more natural plate-caption prose.
