# Arctic Circle

## Artist statement

This piece has one source of geometry and no simulation anywhere in it. It
is a uniformly random domino tiling of an Aztec diamond, sampled *exactly*
by domino shuffling (Elkies–Kuperberg–Larsen–Propp) — no noise field, no
particle system, no erosion model standing in for ice. Only one of the
tiling's four domino classes is inked. The arctic circle theorem
(Jockusch–Propp–Shor, 1998) says that as the diamond grows, that class
freezes solid near its pole and disorders everywhere else, and the
boundary between the two regimes converges to a perfect circle — a circle
that appears nowhere in the code, the sampler, or the drawing instructions.
It is a pure consequence of counting.

I kept rendering this generator's four look-presets — the weave, the
horizon, the honest grey brick pattern — and they're all correct, but
`dissolve` is the only one that reads as an *event* rather than a
diagram: a solid mass giving way, at one exact latitude, to scatter. I
couldn't unsee the real Arctic Circle in it — the line at 66°33′N where
consolidated pack ice has, for most of human history, reliably begun. The
title is the coincidence of two things sharing a name for unrelated
reasons: a line theorems draw through probability, and a line
cartographers draw through the sky. Both are exact. Only one of them is
still where it used to be.

The piece stays purely mathematical on the page — one pen, one width, no
simulated melt curve fitted to the data. What turns it into "ice" is
entirely in the making: waterproof ink first, a cold wash after, applied
by eye along a boundary the plot already drew with more precision than a
brush ever could.

## Materials

- **Paper** — Hahnemühle Britannia, bright white, 300 gsm cold-press,
  A3 portrait (297 × 420 mm). Heavy enough to take a wash flat without
  buckling; bright white so the wash is the only source of any warmth or
  cold in the sheet.
- **Ink (plotted)** — Sakura Pigma Micron 05 (0.45 mm), Blue-Black.
  Pigment-based and waterproof once cured (~10 minutes) — chosen
  specifically so the wash step below cannot lift or feather it.
  Approximate colour: `#1c2b3a`.
- **Wash (hand-applied, after plotting)** — Winsor & Newton Professional
  Watercolour, Payne's Grey, diluted roughly 1 part paint to 15 parts
  water. Approximate colour at that dilution: `#536878`.
- Large soft round brush (a size 10–12 mop or squirrel-hair wash brush),
  a water jar, and a hairdryer or simply patience for drying between
  coats.

## Process

1. Plot `artwork.svg` on the Britannia sheet with the Micron 05 in the
   plotter's pen holder, at the pen width above. Let the ink cure at
   least 10 minutes before touching the paper — Pigma ink is waterproof
   once dry but not while still wet.
2. Look at the plot. The solid mass occupies roughly the top quarter of
   the sheet and its lower edge is not a straight line — it is the
   arctic circle itself, and on this print it is sharp enough to trace
   by eye without a ruler. Wet a clean brush with plain water and run it
   just outside that edge, a few millimetres into the untouched paper,
   to pre-wet a soft boundary the wash can bleed into rather than stop
   at abruptly (a standard wet-into-dry release edge).
3. Load the brush with the diluted Payne's Grey and wash freely from
   that boundary down to the bottom edge of the sheet, working in
   horizontal passes and letting the tone pool very slightly heavier
   near the very bottom of the page (a second light pass over the
   lowest third only, once the first pass has flattened, is enough —
   don't chase perfect evenness). Leave the solid ice mass at the top
   completely dry and untouched; it stays pure paper-white ground with
   ink lines and nothing else.
4. Let the sheet dry flat, ink side up, away from direct heat.
5. Optional, if the wash dried lighter than intended: a second very
   thin glaze over the lower third only, once the first coat is bone
   dry, deepens the "open water" region without disturbing the ice mass
   or the scattered floes sitting inside it.

No masking fluid or tape is required — the ink is genuinely waterproof
and the boundary is precise enough on the page to follow by eye; framing
the piece under a step-2 pre-wet is only there to keep the wash's edge
soft rather than a hard tide-line.

## Plot settings

- Paper: A3, portrait, 297 × 420 mm
- Margin: 30 mm
- Pen: 0.45 mm (Sakura Pigma Micron 05)
- Strokes: 4,144 · drawn length ≈ 16.6 m · pen-up travel ≈ 10.5 m
  (reorder-only optimisation — see Wishes)
- Estimated plot time: 45–75 minutes on an AxiDraw-class plotter at
  default speed

## Reproduction

The arctic generator has no CLI command yet (see `concept-brainstorming/
README.md`'s toolbox notes) — it comes from `packages/core`'s
`generateArctic`, driven here by a scratch script against the built core
package.

```sh
pnpm install && pnpm build   # builds packages/core/dist used below
node make-artwork.mjs
```

`make-artwork.mjs`:

```js
import { writeFileSync } from 'node:fs';
const { generateArctic, toSVG } = await import(
  './packages/core/dist/index.js'
);

const pxPerMm = 3;
const widthMm = 297, heightMm = 420; // A3 portrait
const W = Math.round(widthMm * pxPerMm), H = Math.round(heightMm * pxPerMm);
const marginMm = 30;
const marginPx = marginMm * pxPerMm;
const penWidthMm = 0.45;

const res = generateArctic({
  width: W,
  height: H,
  margin: marginPx,
  seed: 44,
  preset: 'dissolve', // ink only domino class N — one pole, one circle
  order: 190,          // Aztec diamond AD(190): 190×191 dominoes, exactly
  upright: false,      // diamond orientation, not rotated onto a square
  wobble: 0.15,        // just enough hand tremor to read as drawn, not printed
  optimize: true,      // orderPlot: travel-ordered, never chained (see index.ts)
});

const svg = toSVG(res, {
  strokeWidth: penWidthMm * pxPerMm,
  precision: 3,
  physicalWidth: `${widthMm}mm`,
  physicalHeight: `${heightMm}mm`,
});

writeFileSync('artwork.svg', svg);
console.log(res.lines.length, 'lines, seed', res.seed);
```

The tiling is sampled *exactly* by domino shuffling — there is no burn-in
and no mixing question, so seed 44 at order 190 reproduces this precise
tiling byte-for-byte every time, on any machine, forever.

`preview.png` approximates the physical piece (paper tone, ink colour,
and the hand-wash gradient) and is not itself plotted; it was composed
with a second scratch script that wraps the same `artwork.svg` paths
(recoloured to the ink hex) over a paper-coloured rect and a soft
linear-gradient "wash" rect, then rasterizes the composite with
`@resvg/resvg-js` (the same library `scripts/svg-to-png.mjs` uses):

```js
import { readFileSync, writeFileSync } from 'node:fs';
const { Resvg } = await import('@resvg/resvg-js');

const widthMm = 297, heightMm = 420, pxPerMm = 3;
const W = widthMm * pxPerMm, H = heightMm * pxPerMm;
const rasterWidth = 1600;

const inkSvg = readFileSync('artwork.svg', 'utf8');
const inkColor = '#1c2b3a';
const paperColor = '#fbfaf6';
const washColor = '#536878';

const inkBody = inkSvg
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/stroke="[^"]+"/g, `stroke="${inkColor}"`);

const composite = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${rasterWidth}" height="${Math.round(H * (rasterWidth / W))}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${washColor}" stop-opacity="0"/>
      <stop offset="0.30" stop-color="${washColor}" stop-opacity="0"/>
      <stop offset="0.40" stop-color="${washColor}" stop-opacity="0.22"/>
      <stop offset="0.92" stop-color="${washColor}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${washColor}" stop-opacity="0.16"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${paperColor}"/>
  <rect width="${W}" height="${H}" fill="url(#wash)"/>
  ${inkBody}
</svg>`;

const resvg = new Resvg(composite, { fitTo: { mode: 'width', value: rasterWidth } });
writeFileSync('preview.png', resvg.render().asPng());
```

The 0.30/0.40 gradient stops were eyeballed against the actual render
(the solid mass ends roughly a third of the way down the sheet at this
seed and order) — the real wash line in Process step 2 is placed by
eye against the plotted paper, not against these numbers.

## Wishes

- `generateArctic` has no CLI command (`flow-lines arctic …`) — this
  entire brainstorming session went through a scratch script instead of
  the usual `--paper a3 --seed …` flags every other generator gets.
  Given how squarely it fits the "configuration only" brief (four
  presets, one order slider, one seed), it's a strong candidate for the
  next CLI command added.
- No way to ask the generator for the exact circle centre/radius it
  computed internally (in mm, in the caller's coordinate space). It
  fits the tiling into the page after the fact from the *drawn*
  geometry's bounding box, not the diamond's theoretical extent, so a
  caller can't cheaply derive the exact boundary for a masking
  guide — I ended up relying on "trace the visible edge by eye," which
  is honestly fine for this piece's hand-wash process, but a documented
  `{ cx, cy, radius }` return value (in the same units as the output
  lines) would let a future piece use the boundary programmatically —
  for a second registered pass, say, rather than only by eye.
