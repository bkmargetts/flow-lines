# Blind Emboss

## Artist statement

"Blind" is a printing term before it is anything else: a blind emboss (or
deboss) is a mark pressed into paper with no ink at all — the image made
of nothing but the paper's own shadow, raised or sunk under raking light.
It shares the word, not by accident, with the oldest tactile printing
there is: Braille is also nothing but paper pressed out of true, read by
a hand instead of an eye.

This repo has a generator, `warp-grid`, built to solve a purely optical
problem: how do you make a flat field of ruled lines read as a bulging
volume to a *sighted* eye, using nothing but where each line bends? Run
once, at one seed, it produces a single quiet swelling — a ruled sheet
lifted from beneath by something the size of a fingertip, just off
centre, calm on every side. As an inked drawing it is a trick: the paper
never moved, the eye is doing all the work of believing in the bump.

But the file underneath that trick is just deformed coordinates. Nothing
stops the exact same path data from being run through the plotter with
no ink at all — a blunt stylus in the pen carriage instead of a
fineliner, pressed into real paper from behind. Do that and the
generator's fiction stops being a fiction. The same swelling that only
*looked* raised in ink is now actually raised, physically, out of the
sheet. One seed, two plots, two senses: a version an eye is fooled by
and a version a hand can actually confirm.

The seed took thirty-odd candidates to land: most single-dome runs
either sat half off the page (the deformer's radius meeting the sheet
edge, breaking the closed, self-contained bump the concept needs — a
partial dome just reads as a torn edge, not a pressed one) or wandered
into a corner far from the calm field around it. Seed 19 keeps the whole
form on the sheet, centred slightly right and low of the true middle,
with a small asymmetric pinch on its lower-left flank where two of the
warped lines crowd close enough to nearly touch — the compression floor
that keeps offset lines from ever fully colliding, caught right at its
limit. It reads like a fingertip pressing at an angle rather than
straight down, which is closer to how a hand actually touches paper than
a perfectly radial dome would have been.

## Materials

**Sighted edition** (recto, inked)
- Paper: a warm ecru/fawn cotton rag sheet, smooth (hot-press) finish,
  ~250 gsm, A5 (148 × 210 mm).
- Ink: one fineliner, "Warm Graphite Grey," hex `#4b4740` — a soft
  warm-neutral, not true black, so the drawn line sits quietly on the
  toned paper rather than snapping to full contrast.
- Pen width: 0.4 mm.

**Blind edition** (verso, embossed, no ink)
- Paper: a heavier white cotton rag sheet, smooth (hot-press) finish,
  ~300 gsm (the extra weight holds a pressed line without the sheet
  cockling or the relief relaxing flat again over time), A5
  (148 × 210 mm).
- Tool: a blunt embossing/tracing stylus (or a spent ballpoint with the
  ink cartridge removed) in the pen carriage in place of a fineliner —
  the same fitting an AxiDraw embossing-stylus attachment uses.
- No ink, no colour: irrelevant to a plate that is read by touch, and
  the white sheet says so before a hand ever reaches it.
- Mounting: acid-free hinges, floated (unglazed, or glazed with an
  air-gap deep enough that a viewer can still reach the embossed sheet)
  in a single mat with two windows, under one raking gallery light set
  low and to one side.

## Process

1. Render `artwork-recto.svg` (below) — the sighted edition's exact
   line file, seed 19.
2. Derive `artwork-verso.svg` by mirroring `artwork-recto.svg`
   horizontally about its own centre (script below). This is the plate
   that gets plotted on the *back* of the embossed sheet: pressed from
   behind, the raised form pushes up and reads correctly on the front
   only if the plotted pattern is flipped first — the same reasoning as
   any intaglio or letterpress counter-plate.
3. **Sighted edition:** load the fawn cotton rag sheet, plot
   `artwork-recto.svg` with the 0.4 mm fineliner loaded with Warm
   Graphite Grey ink, one pass, standard plotter downforce. Done.
4. **Blind edition:** tape the white 300 gsm sheet face-down (verso up)
   over a firm-but-yielding backing — a cutting mat with a sheet of
   craft foam or a thick mouse pad underneath, so the stylus has
   something to press the fibres into. Load `artwork-verso.svg` with the
   embossing stylus in the carriage, no ink. Plot it dry, at the
   plotter's maximum safe downforce, in **three identical passes over
   the same path** (not offset — the repo's usual bold-line trick of
   offset repeated passes is for building visual weight with ink; here
   the three passes are the same line retraced to push the fibres past
   their elastic recovery point, so the groove holds instead of
   springing back flat within the hour). Leave the sheet taped down and
   under light weight for a few hours after plotting before unmounting,
   so it dries flat rather than cockling at the pressed line.
5. Flip the embossed sheet face-up. The mirrored plate now reads as the
   same swelling as the inked sheet, raised instead of drawn.
6. Mount both sheets side by side in one mat, sighted edition on the
   left, blind edition on the right, under one raking light. From across
   a room the two look identical. Up close, only one of them casts a
   real shadow — and only one of them answers a fingertip.

## Plot settings

- Paper: A5, 148 × 210 mm, portrait, both editions.
- Margin: 15 mm clear border, both editions.
- Pen width: 0.4 mm (sighted edition only — the blind edition uses a
  stylus, not a pen, at whatever tip width the physical tool carries).
- Render resolution: 3 px/mm.
- Line count: 56 strokes, ~5.3 m of total drawn/pressed line per plate —
  a short plot, a few minutes at normal speed either way.
- The blind edition's three retrace passes triple the pen-down time on
  that plate but cover the same 5.3 m of path, so travel stays the same
  order of magnitude; no tiling, no multi-sheet assembly, single pen/
  stylus throughout.

## Reproduction

Built at the repo root after `pnpm install && pnpm build`.

```sh
node packages/cli/dist/cli.js warp-grid \
  --preset dome --pattern lines --deformers 1 --kinds dome \
  --spacing 12 --strength 0.9 --scale 0.24 --occlude on \
  --paper a5 --orientation portrait --margin-mm 15 --pen-width-mm 0.4 \
  --resolution 3 \
  --seed 19 \
  -o artwork-recto.svg
```

`artwork-verso.svg` is `artwork-recto.svg` with every path's x-coordinate
mirrored about the viewBox centre (all path data here is plain absolute
M/L/Q commands, so negating x per coordinate pair is exact — no `<g
transform>` wrapper, keeping the file plain stroked paths like every
other generator output in this repo):

```js
// mirror-svg.mjs — usage: node mirror-svg.mjs artwork-recto.svg artwork-verso.svg
import { readFileSync, writeFileSync } from 'node:fs';

const [, , input, output] = process.argv;
let svg = readFileSync(input, 'utf8');

const w = parseFloat(svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)[1]);

svg = svg.replace(/d="([^"]*)"/g, (_m, d) => {
  let i = 0;
  const mirrored = d.replace(/-?\d+\.?\d*/g, (num) => {
    const isX = i % 2 === 0;
    i++;
    return isX ? (w - parseFloat(num)).toFixed(2) : num;
  });
  return `d="${mirrored}"`;
});

writeFileSync(output, svg);
```

`preview.png` renders both editions from `artwork-recto.svg`: the left
panel is a direct rasterization (`scripts/svg-to-png.mjs
artwork-recto.svg --background '#efe6d5' --stroke '#4b4740'`, matching
the sighted edition's paper and ink); the right panel fakes the blind
edition's paper relief by rasterizing the same file twice more — once
with a warm shadow stroke, once with a white highlight stroke — then
compositing both onto a pale paper base offset by a couple of pixels in
opposite directions, the standard bevel trick for mocking up an emboss
in a flat raster. That compositing step only exists to make the preview
image; it has no bearing on the plotted files, which are exactly the two
SVGs above.

## Wishes

- No flag anywhere in the CLI mirrors an SVG horizontally (or
  vertically) about its own page — every generator that could feed a
  verso/counter-plate workflow (this one, or any intaglio-style
  registered-reverse process) currently needs a hand-rolled script like
  the one above. A generic `--mirror x|y` on `page.ts`'s shared output
  path would cover all of them at once.
- `warp-grid` has no explicit deformer-position control — only `--scale`
  (radius) and the seed, which places it by search. A `--center x,y`
  (0–1 fractions of the page) would have turned this run's ~30-seed
  hunt for "one clean, fully-contained bump, slightly off-centre" into a
  single deliberate placement.
