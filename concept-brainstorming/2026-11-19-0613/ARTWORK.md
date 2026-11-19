# Midnight Sun

## Artist statement

Take a diamond-shaped board drawn on a square grid and fill it with
dominoes, choosing uniformly among every possible way. You would expect
mush. Instead, once the board is large, a **perfect circle** appears.
Outside it, the four corners freeze into regular brick courses, each
corner made of only one kind of domino. Inside it, everything stays
random and liquid. This is the *arctic circle theorem* (Jockusch, Propp
and Shor, 1998). The circle isn't in the algorithm anywhere. It comes out
of the counting.

The name made the picture for me. Inside the Arctic Circle the sun
doesn't set in summer. So here the arctic circle *is* the sun, a woven
disc that hangs between a frozen sky and a frozen sea. Each of the four
domino classes gets its own pen. The north-pointing dominoes, which
freeze the top corner, are pale blue-grey sky. The south-pointing ones,
which freeze the bottom corner, are deep blue-black sea. The two
vertical classes are the sun's warm inks: orange for west and red for
east. Inside the liquid disc the classes aren't evenly mixed. West
dominoes crowd toward the west side and east dominoes toward the east.
So the sun shades itself from gold on the left to red on the right, and
nothing in the drawing does any shading. The theorem does it.

Then there are two things I didn't put there on purpose but kept:

- **The sheet is part of the maths.** An A3 sheet is 1 : √2. That is
  also the ratio between the Aztec diamond's diagonal and the diameter
  of its arctic circle. Scale the diamond so the circle spans the sheet
  from margin to margin, and the sky and sea points land just inside
  the top and bottom margins. The paper format and the theorem share a
  number, so the piece only works at this proportion.
- **Prediction against sample.** The warm pens ink only inside the
  circle the theorem *predicts*. A graphite pencil plots that circle as
  one hairline. The blue pens ink everything the *actual* random tiling
  did. Around the rim the two disagree. Frozen sky bricks dip into the
  sun at the top. On the left, liquid blue dashes spill out past the
  pencil line into blank paper. These are the real fluctuations of a
  finite sample, the jitter that probabilists describe with the
  Tracy–Widom/Airy laws. Seed 5 kept its fraying there, which is why it
  beat the others.

Across a room it reads as a low sun between sky and water, close to the
emblem-like geometry of a Hilma af Klint panel. Up close it turns into
textile. Every mark is a domino, and the disc reads like an Anni Albers
weave of short warp and weft threads in four colours. I tried about
twenty versions before this one: single-class "dissolve" droplets, the
four-ink full diamond on landscape A3 (handsome but a generic emblem),
a page-cropped hexagon with sun-dog wedges (an accident of the crop),
and a filter that dropped welded runs (it punched rain-streak holes in
the disc). This is the one where the concept, the sheet and the texture
all agree.

## Materials

- **Paper**: one sheet of A3 (297 × 420 mm), portrait. Fabriano
  Artistico *Traditional White* Hot Press, 300 gsm (~`#f2ead8`), cut down
  from a full sheet. Hot press matters because ~13,500 short strokes on
  a rough surface would skip. Fallback: Hahnemühle Bristol 250 gsm,
  slightly cooler.
- **Pens**: all pigment fineliners, about 0.35 mm line (size 03 /
  0.3 mm nib):
  1. **Prediction**: HB graphite, 0.5 mm mechanical pencil in the pen
     holder, light pressure. `#8b8b88`
  2. **West (sun, gold)**: Sakura Pigma Micron 03 *Orange*. `#ec8a24`
  3. **East (sun, red)**: Sakura Pigma Micron 03 *Red*. `#c8302a`
  4. **Sky**: Copic Multiliner 0.3 *Cool Gray* (any pale blue-grey
     pigment liner works). `#8e9db0`
  5. **Sea**: Sakura Pigma Micron 03 *Blue-Black*. `#1f2a44`
- Low-tack drafting tape, and a soft eraser for stray graphite only.
- **Mount**: float-mounted on a warm-white backing in a pale oak box
  frame with ~60 mm air around the sheet, under UV-filtering glass. The
  diamond's points need room to breathe.

## Process

1. Tape the sheet to the bed by all four corners, portrait. **Don't
   move it again until step 7.** The four ink layers interlock at a
   1.1 mm domino pitch, so even 0.5 mm of misregistration shows as
   doubled threads. Set the origin to the sheet's top-left corner. The
   SVGs are full-sheet (297 × 420 mm) with the margin already built in.
2. Pencil: plot `artwork-layer-1-prediction.svg`, a single circle
   ~267 mm across. Light pressure, so it reads as a hairline and not a
   rule. Brush away graphite dust (don't wipe).
3. Orange: plot `artwork-layer-2-west.svg`.
4. Red: plot `artwork-layer-3-east.svg`.
5. Cool Gray: plot `artwork-layer-4-sky.svg`.
6. Blue-Black: plot `artwork-layer-5-sea.svg` last. It's the darkest
   ink, so any pen drag shows least on top. Pigment liners are dry to
   the touch almost immediately, so no wait is needed between layers.
   Do check the nib every ~1,000 strokes. Short-stroke plots with many
   pen-downs wear fineliner tips, and a 03 that goes soft or dry
   mid-layer will leave a visible band, so keep a fresh spare of each
   colour.
7. Untape and let it rest flat for an hour. Sign in pencil, lower right,
   under the sea point, with title and `n = 170 · seed 5`.
8. Float-mount and frame as above.

## Plot settings

- A3 portrait (297 × 420 mm), 15 mm margin. The circle spans the margin
  box edge to edge, and the diamond points sit ~6 mm inside the top and
  bottom margins.
- Pen width 0.35 mm everywhere (SVG `stroke-width` matches).
- Diamond order n = 170 (28,730 dominoes), so the domino unit is
  ≈ 1.11 mm.
- Strokes and pen-down distance: prediction 1 (0.8 m); west 3,370
  (12.3 m); east 3,265 (12.1 m); sky 3,483 (16.6 m); sea 3,336
  (16.6 m). That's ≈ 13,450 strokes and 58 m of ink. Strokes are
  ordered by `orderPlot` and deliberately not chained, so each domino
  stays a crisp separate mark. Expect several hours per layer on a pen
  plotter. Pen-lift count dominates the time, not distance.

## Reproduction

The arctic generator has no CLI command yet, so this is a scratch Node
script over the built core package. From the repo root:

```sh
pnpm install && pnpm build
node midnight-sun.mjs out/        # writes the five artwork-layer-*.svg
```

```js
// Midnight Sun — run from the repo root after `pnpm install && pnpm build`:
//   node midnight-sun.mjs <outDir>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const { generateArctic, toSVG } = await import(resolve('packages/core/dist/index.js'));

const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });

const SEED = 5, ORDER = 170, MARGIN_MM = 15, PEN_MM = 0.35, PX = 3;
const W = 297 * PX, H = 420 * PX, M = MARGIN_MM * PX;

// A3 is 1:√2, and so is the Aztec diamond's diagonal to its arctic circle's
// diameter: size the diamond so the circle spans the margin box exactly.
const D = (W - 2 * M) * Math.SQRT2;
const tiling = generateArctic({ width: D, height: D, margin: 0, seed: SEED, order: ORDER, marks: 'all', wobble: 0.35 });

// Spine bbox runs n-½ lattice units from centre; the theorem's circle has radius n/√2.
const unit = D / (2 * ORDER - 1);
const R = (ORDER / Math.SQRT2) * unit;
const dx = (W - D) / 2, dy = (H - D) / 2, cx = W / 2, cy = H / 2;

const layers = { sky: [], sea: [], west: [], east: [] };
const name = { 'domino-n': 'sky', 'domino-s': 'sea', 'domino-w': 'west', 'domino-e': 'east' };
for (const l of tiling.lines) {
  const pts = l.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  const key = name[l.layer];
  if (key === 'sky' || key === 'sea') { layers[key].push({ points: pts }); continue; }
  // The warm pens ink only inside the circle the theorem PREDICTS.
  let cur = [];
  for (const p of pts) {
    if (Math.hypot(p.x - cx, p.y - cy) <= R) cur.push(p);
    else { if (cur.length > 1) layers[key].push({ points: cur }); cur = []; }
  }
  if (cur.length > 1) layers[key].push({ points: cur });
}
// The prediction itself, for a graphite pass.
const circle = [];
for (let i = 0; i <= 720; i++) {
  const a = (i / 720) * 2 * Math.PI;
  circle.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
}
layers.prediction = [{ points: circle }];

const svgOpts = { strokeWidth: PEN_MM * PX, physicalWidth: '297mm', physicalHeight: '420mm' };
const files = { prediction: 'artwork-layer-1-prediction', west: 'artwork-layer-2-west', east: 'artwork-layer-3-east', sky: 'artwork-layer-4-sky', sea: 'artwork-layer-5-sea' };
for (const [k, f] of Object.entries(files)) {
  writeFileSync(join(out, f + '.svg'), toSVG({ lines: layers[k], width: W, height: H, seed: SEED }, svgOpts));
  const len = layers[k].reduce((s, l) => s + l.points.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - l.points[i].x, p.y - l.points[i].y), 0), 0) / PX / 1000;
  console.log(f, layers[k].length, 'strokes,', len.toFixed(1), 'm pen-down');
}
```

The script writes every layer with `stroke="#000000"`. The committed
files then have each layer's ink hex baked in with a one-line `sed`
(`s/stroke="#000000"/stroke="<hex>"/`): prediction `#8b8b88`, west
`#ec8a24`, east `#c8302a`, sky `#8e9db0`, sea `#1f2a44`. Apart from
that colour, the files are byte-identical to the script's output.

`preview.png`: the five recoloured layers' `<path>` elements are
concatenated, in plot order, into one throwaway `merged.svg` (not
committed), and then:

```sh
node scripts/svg-to-png.mjs merged.svg preview.png --width 2000 --background '#f2ead8'
```

## Wishes

- **An `arctic` CLI command** (with `--split-layers`, so each domino
  class lands on its own pen), plus a `--fit circle` option that sizes
  the diamond by its arctic circle rather than its bounding box. That
  would make the A3 √2 composition one command.
- **A "liquid-only" mark mode** that inks a class only where it isn't
  frozen, judged by local disorder rather than a geometric clip. I tried
  approximating it by dropping long welded runs, and that punches holes
  inside the disc. It needs a proper local-order estimate, such as a
  height-function gradient.
- **Height-function contours** of the same tiling, as an alternative
  mark: the tiling's height function is a natural "terrain", and its
  iso-lines would draw the arctic boundary as a topographic map.
