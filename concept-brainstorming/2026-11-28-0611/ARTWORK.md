# Last Orders — 串揚

*Two pens on black card, A3 portrait. Diptych of inks, one sheet.*

## Statement

A back-alley drinking street in Setagaya, Tokyo, at night: paper lanterns,
hand-painted signs, a bicycle left against a shutter, the alley running away
into the dark. The obvious way to draw it — black ink on white paper — was
the first thing this session tried, and it failed: the photo is almost all
shadow, so the drawing collapsed into a black slab with a few white
blobs. The fix was to turn the whole problem inside out. **Nothing dark is
drawn at all.** The sheet is black card, and the pen only ever puts down
*light*: the photo's luminance is inverted before it reaches the hatcher, so
the brightest glow gets the densest strokes and the shadows are left as bare
card. The paper is doing the night; the pen is doing the lamps.

A second raster, pulled from the same photo, isolates only the saturated
red-orange light. That becomes a separate vermilion pass — the big
*kushiage* lantern (串揚, "fried skewers") on the right, the 和牛 sign
upper left, a hot spill of red off a sign in the near foreground — so the
red lives only where the street actually burned red, and the white
lettering of the glyphs is drawn *over* it in the second pass.

Why this one survived: it was the only candidate across ~25 renders where
the restraint felt chosen rather than accidental. The A3-portrait crop
throws away the photo's loud foreground sign and keeps the alley's depth —
lamps stringing back toward the vanishing point, the bottom third left
almost empty except for the ghost of a bicycle wheel. Three reds form a
loose triangle (top-left sign, right lantern, bottom-left spill) that walks
the eye round the sheet. The hatcher's diagonal strokes in the dimly lit
middle distance read as drizzle. It looks like a night-time urban sketch
made with a white gel pen in a pocket book — the drawing a person makes
after one drink, at the counter, looking back out the door.

## Materials

| Item | Spec |
|---|---|
| Paper | Hahnemühle *Nero* 310 gsm (smooth, deep black, gel-pen friendly), A3 297 × 420 mm, portrait. Any smooth true-black 250–310 gsm card works; avoid textured pastel card (gel skips). |
| Pen 1 — vermilion | Sakura Gelly Roll **Moonlight 06, Fluorescent Vermilion** (≈0.3 mm line, opaque on black). Preview hex `#e8452c`. |
| Pen 2 — white | Sakura Gelly Roll **05 White** (≈0.3 mm line). Preview hex `#efeae0` (it dries very slightly warm on black). Have a spare: this layer is ~130 m of line. |
| Other | Low-tack drafting tape; a scrap sheet of the same card for a test strip; glassine for interleaving; a float mount with a black backing board and a 20 mm reveal. |

## Process

1. **Tape the sheet** to the plotter bed at all four corners (portrait). It
   must not be untaped between the two passes — the two layers are
   registered by simply never moving the paper.
2. **Test strip.** On the scrap card, plot a few hundred mm of each pen at
   the chosen speed. Gel pens skip if driven fast: start at ~25 mm/s
   pen-down, and raise only while lines stay unbroken. Gel can starve on
   the long dense hatch inside the lantern — prime the pen by scribbling on
   scrap until it flows.
3. **Pass 1 — vermilion.** Plot `artwork-layer-1-vermilion.svg` with the
   Moonlight Fluorescent Vermilion. (~1,400 paths, ~50 m of line.)
4. **Dry 30 minutes.** Moonlight gel sits thick on black card; the white
   lettering in pass 2 crosses the solid red of the lantern, and wet gel
   will smear and pick up on the white tip.
5. **Pass 2 — white.** Swap to the Gelly Roll 05 White, re-home the pen
   (same origin, paper untouched), and plot
   `artwork-layer-2-white.svg`. (~3,800 paths, ~130 m of line; budget a
   long session and check the pen every ~20 minutes — swap to the spare
   at the first faint stroke rather than letting it run dry mid-hatch.)
6. **Dry overnight flat**, untaped only after the white has cured (gel
   white stays soft for hours).
7. **Hand step (optional, recommended):** with the white pen held
   freehand, add nothing — but sign small, in white, bottom right inside
   the margin, and write `串揚` in pencil on the back with the date.
8. **Present** float-mounted on a black backing board inside a black
   frame, with a 20 mm reveal so the card edge disappears into the
   backing: there is no visible border to the drawing — the black card,
   the reveal and the board are one night.

## Plot settings

- Sheet: A3 portrait, 297 × 420 mm; 10 mm margin (default).
- Pen width: 0.3 mm declared for both layers (matches the 05/06 gel line).
- Layer order: vermilion first, white second.
- Stroke order: chained + nearest-neighbour ordered by the CLI
  (`optimizePlot`, on by default).
- Line length (approx.): vermilion ~50 m, white ~130 m.

## Reproduction

Everything derives from `test-images/street-setagaya.jpg` and its
`street-setagaya.labels.png` sidecar. A short prep script (data only — no
repo code changes) builds the two plain input rasters the core consumes:
an inverted *light map* and a *red-glow map*, both cropped to an
A3-portrait window on the alley, plus the matching label crop.

Save as `prep.cjs` anywhere and run from the repo root after
`pnpm install && pnpm build`:

```js
// prep.cjs — derive the two plain input rasters for "Last Orders" from
// test-images/street-setagaya.jpg, plus the matching label crop.
// Run from the repo root: node prep.cjs <outDir>
const path = require('path'), fs = require('fs');
const req = (m) => require(path.resolve('packages/cli/node_modules', m));
const jpeg = req('jpeg-js'), { PNG } = req('pngjs');
const out = process.argv[2];
const CROP = { x: 900, y: 0, w: 1203, h: 1701 }; // A3-portrait aspect window on the alley
const src = jpeg.decode(fs.readFileSync('test-images/street-setagaya.jpg'), { useTArray: true });
const lab = PNG.sync.read(fs.readFileSync('test-images/street-setagaya.labels.png'));
const light = new PNG({ width: CROP.w, height: CROP.h });
const red = new PNG({ width: CROP.w, height: CROP.h });
const labels = new PNG({ width: CROP.w, height: CROP.h });
for (let r = 0; r < CROP.h; r++) for (let c = 0; c < CROP.w; c++) {
  const s = ((r + CROP.y) * src.width + (c + CROP.x)) * 4, d = (r * CROP.w + c) * 4;
  const R = src.data[s] / 255, G = src.data[s + 1] / 255, B = src.data[s + 2] / 255;
  const lum = 0.2126 * R + 0.7152 * G + 0.0722 * B, mx = Math.max(R, G, B), mn = Math.min(R, G, B);
  // light map: where the alley GLOWS becomes "dark" (= inked, in white gel)
  const v = Math.round(255 * (1 - (mx * 0.5 + lum * 0.5)));
  // red map: bright, saturated red/orange light becomes "dark" (= vermilion)
  const sat = mx > 0 ? (mx - mn) / mx : 0;
  const redness = Math.max(0, Math.min(1, (R - Math.max(G * 0.9, B)) * 2.2)) * Math.min(1, sat * 1.5) * Math.min(1, mx * 1.6);
  const rv = Math.round(255 * (1 - redness));
  for (const [P, val] of [[light, v], [red, rv]]) { P.data[d] = P.data[d + 1] = P.data[d + 2] = val; P.data[d + 3] = 255; }
  const ls = ((r + CROP.y) * lab.width + (c + CROP.x)) * 4;
  for (let k = 0; k < 4; k++) labels.data[d + k] = lab.data[ls + k];
}
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'light.png'), PNG.sync.write(light));
fs.writeFileSync(path.join(out, 'red.png'), PNG.sync.write(red));
fs.writeFileSync(path.join(out, 'labels.png'), PNG.sync.write(labels));
```

```sh
node prep.cjs /tmp/last-orders
I=/tmp/last-orders
OUT=concept-brainstorming/2026-11-28-0611

# Layer 1 — vermilion (the red-glow map)
node packages/cli/dist/cli.js image -i $I/red.png \
  --paper a3 --orientation portrait --resolution 3 --seed 7 \
  --no-sky-stipple --white-cutoff 0.12 --layers 3 \
  --outline-threshold 0.4 --outline-passes 1 \
  --hand-sketch 0.4 --hand-sketch-style fine \
  --stroke-color '#e8452c' -o $OUT/artwork-layer-1-vermilion.svg

# Layer 2 — white (the inverted light map, with the cropped labels)
node packages/cli/dist/cli.js image -i $I/light.png --label-image $I/labels.png \
  --paper a3 --orientation portrait --resolution 3 --seed 7 \
  --no-sky-stipple --tone-gamma 1.25 --white-cutoff 0.18 --layers 4 \
  --outline-threshold 0.5 --outline-passes 2 --wobble 1 \
  --hand-sketch 0.4 --hand-sketch-style fine \
  --stroke-color '#efeae0' -o $OUT/artwork-layer-2-white.svg
```

`preview.png` is the two layers stacked (white over vermilion is the
reverse of the plot order, but neither layer covers the other enough to
matter at preview scale) on `#17181c`, rasterized with
`node scripts/svg-to-png.mjs <merged.svg> preview.png --width 1600`; the
merge just concatenates both SVGs' `<path>` elements under one root with
a background `<rect>`.

## Wishes

- **An `--invert` flag on `image`** (or a `light-on-dark` style): drawing
  light rather than shadow for dark-stock work currently needs an external
  raster. With it, sky stipple / calm water / halos could also flip their
  logic properly (halos should reserve *dark* around a glow, not paper).
- **A colour-key layer split** — `--split-by-hue` producing one pen layer
  per ink from a photo's own colour (here: red light vs. all light),
  instead of a hand-derived redness raster.
- **A `--crop x,y,w,h` flag** on `image`: the composition here is a crop,
  and choosing a window shouldn't need a prep script.
- **Gel-pen awareness** in density protection: a max-ink-per-area cap per
  layer, since gel on card pools where hatch is very dense (the lantern
  fill).
