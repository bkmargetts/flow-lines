# First Lesson

*A sphere on toned ground, drawn by a uniformly random domino tiling.*

## Artist statement

Nearly every drawing student starts with the same exercise. You get a sheet
of mid-toned paper, a dark crayon and a white chalk, and you draw a ball.
The paper is the middle value. The dark goes on the shadow side, the white
on the lit side, and the form turns between the two. It's the first lesson
in chiaroscuro and the oldest trick on toned ground: you don't draw the
mid-tones, the paper gives you them.

Nobody drew this ball. It comes out of the repo's new `arctic` generator,
which the studio hadn't used before. The generator samples a domino tiling
of an Aztec diamond (order 190, 36,290 dominoes) **exactly uniformly at
random** using domino shuffling. The arctic circle theorem says that a
tiling like this freezes into four brick-regular corners and stays
disordered inside an inscribed circle. Nothing in the algorithm mentions a
circle. Each domino belongs to one of four classes, and each frozen corner
is made of a single class.

The piece rests on one assignment. The South and East classes are plotted in
sepia and the North and West classes in white gel, on tan paper. The frozen
corners turn into a fully lit face and a fully shadowed face. Inside the
circle all four classes mix at random, so the dark and light dashes average
back to the tone of the paper. A density drift toward each pole gives the
gradient from light upper-left to shadow lower-right, and a woven, lit,
three-dimensional ball appears. No code does any shading. The "light source"
is a choice about which ink goes with which domino class, and the roundness
comes from combinatorics.

**Why this survived the cull.** I tried six directions before this one:
- The four classes in four colours as one weave: it read as a rug.
- Four stacked drafting-film sheets, one class per sheet: overlaid, all four
  classes are evenly dense, so the circle disappears into flat grey. The
  theorem hides when every class is drawn the same way.
- Two-colour "horizon" lenses: handsome but diagrammatic.
- An order sequence (n = 6 → 192) showing the circle crystallising: too
  didactic.
- The North + South "brain maze" on grey paper: less striking.

On toned paper the chosen version solves the flat-grey problem. The
disordered region doesn't need to carry tone because the paper already
does. It's also the only version that made me look twice. From across a
room it's a plaster study ball. Up close it breaks into thousands of
straight dashes with no curves at all.

## Materials

- **Paper**: one sheet of mid-tan toned drawing paper, A3 (297 × 420 mm),
  portrait. Use the smooth side, because a honeycomb tooth breaks the fine
  rules. Target colour ≈ `#bfa781`, a mid value (about L\* 70), so that the
  sepia and the white sit equally far from it. Suggested: Canson Mi-Teintes
  160 gsm in a mid tan ("Sand" / "Hemp" family), smooth face; or Strathmore
  400 Toned Tan cut from a larger sheet.
- **Pen 1, shadow side**: Sakura Pigma Micron **01 Sepia** (≈0.25 mm line),
  preview colour `#4a3122`.
- **Pen 2, lit side**: Sakura Gelly Roll **08 White** (≈0.4 mm line),
  preview colour `#f8f5ee`. Use a fresh pen; the white side alone is about
  25 m of line. Keep a spare to hand.
- Low-tack drafting tape, and a sheet of glassine for transport.
- Frame: a float mount on a cream backing board with a 15 mm shadow gap and
  UV glazing. The diamond should sit high and alone in the tan field.

## Process

1. Tape the A3 sheet portrait, smooth side up. **Do not move it again until
   both passes are done.** The two SVGs share one canvas, and registration
   depends on the sheet staying put.
2. Prime the Micron on scrap. Plot **`artwork-layer-1-sepia.svg`** (South +
   East classes) at a slow, even speed (≤ 40 mm/s pen-down) so the 0.68 mm
   rule spacing stays clean.
3. Let it dry for 15 minutes. Pigment liner is dry to the touch in seconds,
   but the gel pass crosses near every sepia endpoint.
4. Swap to the Gelly Roll 08 White. Prime it on tan scrap until it flows
   opaque. Plot **`artwork-layer-2-white.svg`** (North + West classes).
   Gel pens skip on long rules if they move fast: use ≤ 30 mm/s and a
   slightly longer pen-down delay. Watch the long rules at the North and
   West poles, and if a rule starts to skip, pause and re-prime.
5. Let the white dry flat for at least 30 minutes, untouched. Gel smears
   long after it looks dry.
6. Optional: sign small in sepia at lower right, well clear of the diamond.
   Don't fix: spray fixative greys the white gel.
7. Interleave with glassine and float-mount as above.

`artwork.svg` is a two-ink reference on a tan sheet and the source for the
preview. **Do not plot it.**

## Plot settings

| | Sepia (layer 1) | White (layer 2) |
|---|---|---|
| Sheet | A3 portrait, 297 × 420 mm | same sheet, same position |
| Margin | 20 mm (diamond is 257 mm tip-to-tip, centred) | same |
| Pen | Micron 01 Sepia, ~0.25 mm | Gelly Roll 08 White, ~0.4 mm |
| Strokes | 8,435 | 8,482 |
| Pen-down | ~24.6 m | ~24.6 m |
| Pen-up travel | ~21.8 m (`orderPlot`-ordered) | ~22.2 m |

The lattice unit is 0.68 mm. In the frozen corners, rules are spaced 0.68 mm
apart, so expect roughly 2–3 hours per pass.

## Reproduction

From the repository root, run `pnpm install && pnpm build` and then
`node first-lesson.mjs` (the script below). It writes all three SVGs
byte-for-byte:

- `artwork-layer-1-sepia.svg`: sha256 `3deb1a0f…`
- `artwork-layer-2-white.svg`: sha256 `8ed03b12…`
- `artwork.svg`: sha256 `8df649e5…`

The only generator call is `generateArctic` with **seed 77, order 190,
marks 'all', diamond orientation**.

```js
// First Lesson — regenerates every SVG in concept-brainstorming/2026-11-13-0613/.
// Run from the repo root after `pnpm install && pnpm build`.
import { writeFileSync } from 'node:fs';
const { generateArctic, toSVG } = await import(process.cwd() + '/packages/core/dist/index.js');

const OUT = 'concept-brainstorming/2026-11-13-0613';
const PX_PER_MM = 4;
const [Wmm, Hmm] = [297, 420];                 // A3 portrait
const W = Wmm * PX_PER_MM, H = Hmm * PX_PER_MM;

const r = generateArctic({
  width: W, height: H,
  margin: 20 * PX_PER_MM,                      // 20 mm → 257 mm diamond
  seed: 77,
  order: 190,                                  // AD(190): 36,290 dominoes
  marks: 'all',                                // spines for all four classes
  upright: false,                              // diamond, poles at N/E/S/W
  wobble: 0.35,
  optimize: true,
});

// Shadow side = South + East poles (dark ink); light side = North + West (white).
const DARK = ['domino-s', 'domino-e'];
const LIGHT = ['domino-n', 'domino-w'];
const SEPIA = '#4a3122', WHITE = '#f8f5ee';
const phys = { physicalWidth: Wmm, physicalHeight: Hmm };

const pick = (layers) => ({ ...r, lines: r.lines.filter((l) => layers.includes(l.layer)) });
writeFileSync(`${OUT}/artwork-layer-1-sepia.svg`, toSVG(pick(DARK), { ...phys, strokeColor: SEPIA, strokeWidth: 0.25 * PX_PER_MM }));
writeFileSync(`${OUT}/artwork-layer-2-white.svg`, toSVG(pick(LIGHT), { ...phys, strokeColor: WHITE, strokeWidth: 0.4 * PX_PER_MM }));
// Combined two-ink reference (and the preview source), on the toned sheet.
const colors = Object.fromEntries([...DARK.map((l) => [l, SEPIA]), ...LIGHT.map((l) => [l, WHITE])]);
const widths = Object.fromEntries([...DARK.map((l) => [l, 0.25 * PX_PER_MM]), ...LIGHT.map((l) => [l, 0.4 * PX_PER_MM])]);
writeFileSync(`${OUT}/artwork.svg`, toSVG(r, { ...phys, includeBackground: true, backgroundColor: '#bfa781', layerColors: colors, layerWidths: widths }));

// Plot stats
for (const [name, ls] of [['sepia', DARK], ['white', LIGHT]]) {
  const lines = pick(ls).lines;
  let down = 0, up = 0, prev = null;
  for (const l of lines) {
    for (let i = 1; i < l.points.length; i++) down += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
    if (prev) up += Math.hypot(l.points[0].x - prev.x, l.points[0].y - prev.y);
    prev = l.points[l.points.length - 1];
  }
  console.log(name, 'strokes', lines.length, 'pen-down m', (down / PX_PER_MM / 1000).toFixed(1), 'pen-up m', (up / PX_PER_MM / 1000).toFixed(1));
}
```

Preview:

```sh
node scripts/svg-to-png.mjs concept-brainstorming/2026-11-13-0613/artwork.svg \
  concept-brainstorming/2026-11-13-0613/preview.png --width 1600
```

(The tan background and both inks are baked into `artwork.svg`, so no
`--background` or `--stroke` flags are needed.)

## Wishes

- **An `arctic` CLI command with `--split-layers`**. Today the generator is
  core-only, so this piece needs a scratch script. A `--pen-map n=…,e=…`
  flag that assigns domino classes to pens would make toned-ground pieces
  like this one a one-liner.
- **Weighted (q-biased) tilings.** Weighting the shuffle would move and
  deform the arctic curve, for example making it elliptical. In this piece
  that would act as a real light-direction and form control for the sphere:
  an egg, or a ball lit from higher up.
- **Domino-scale marks other than spines** (for example a short tick or a
  dot per domino). These would give a finer "stipple" reading of the
  disordered zone for smaller sheets.
