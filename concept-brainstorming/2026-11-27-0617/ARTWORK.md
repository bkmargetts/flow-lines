# Four Poles

*Four sheets, one tiling. Plotted in Indanthrene blue and sanguine on hot-press
cotton, float-mounted as a 2 × 2 with a 3 mm shadow-cross. 551 × 551 mm.*

## Artist statement

Take a staircase-edged square tilted 45° (the *Aztec diamond*) and cover it
with dominoes, choosing one tiling uniformly at random from the
astronomically many that fit. You would expect mush. What you get instead,
once the diamond is big enough, is a picture: four corners where every
domino has locked into dead-regular brick courses, and a disc in the middle
where they lie every which way. The boundary between the two is a circle,
and it gets sharper as the diamond grows. Nobody put a circle in the rules.
Jockusch, Propp and Shor proved in 1998 that it has to be there, and called
it the **arctic circle**: the frozen corners are the polar regions, the
disordered disc the temperate zone.

The repo's `arctic` generator samples these tilings exactly, by domino
shuffling, with no burn-in and no approximation. No other studio session
had touched it. Every domino falls into one of four classes, and each class
freezes in a *different* corner: north-going dominoes lock up in one pole,
south-going in the opposite one, and so on. Drawn together, the four classes
blur into confetti. I tried that (four inks, then four stacked sheets of
drafting film) and threw it out. It read as a QR code.

What survived was taking the tiling apart. **Each sheet holds one class
of the same tiling.** I turned the sheets so that all four frozen corners
point inward, then pushed them back together. The four poles, which in
the original sit as far apart as they can, now meet at the centre and
make one solid four-pointed star. Out of each point the temperate zone
spreads in a petal of short broken dashes that thin out to bare paper
near the rim. The star is drawn in deep Indanthrene blue and the petals
in warm sanguine, so the two phases of the theorem get two colours: cold
where the dominoes froze, warm where they stayed liquid.

From across the room it's a quatrefoil, like a family crest or a compass
rose. Close up it turns into what kept me looking: each blue point is a
herringbone peak, and it doesn't stop cleanly. Ordered runs break off its
flanks as long blue shards and drift out into the warm rain, the way ice
calves off a shelf. That calving zone is the Tracy–Widom fluctuation of
the arctic boundary, and it's the one part of the drawing the seed
decides. I compared eight seeds; seed 11 won because its eastern point
runs out into a long blade and its south-western flank shatters, which
gives a strict four-fold symmetry something to fight against.

The seams of the mount matter. The thin shadow-cross that splits the
star runs exactly along the cuts that separated the four classes, so the
frame shows how the drawing was taken apart.

## Materials

- **Paper:** 4 sheets of Fabriano Artistico Hot Press 300 gsm, *Traditional
  White* (warm, approx. `#f3ecdc`), cut to A3 (297 × 420 mm). Hot press
  matters: the frozen hatch runs 0.5 mm lines on ~1 mm centres, and cold
  press tooth would break them up. Pencil `NW`, `NE`, `SW`, `SE` on the
  back of each sheet, top edge marked with an arrow.
- **Ink 1, "temperate":** Faber-Castell PITT Artist Pen **Sanguine (188)**,
  **S tip (0.3 mm)**, approx. `#a4432e`. Plots the liquid-zone dashes *and*
  the crop marks.
- **Ink 2, "frozen":** Faber-Castell PITT Artist Pen **Indanthrene Blue
  (247)**, **F tip (0.5 mm)**, approx. `#233a5e`. Plots the frozen hatch
  and the calved shards.
  Both are pigment India inks: waterproof and lightfast once dry, and they
  don't bleed into each other. Have a fresh pen of each on hand. Each
  temperate sheet lifts the pen ~3,600 times and each blue sheet lays
  ~5 m of dense hatch, so a pen per two sheets is realistic.
- **Mount:** one 4-ply 100 % cotton museum board, *antique white*,
  700 × 700 mm (backing); 16 risers of 5 mm acid-free foam board,
  40 × 40 mm; Japanese tissue hinges + wheat-starch paste (or
  self-adhesive linen hinging tape); a 700 × 700 mm box frame with
  ≥ 25 mm rebate depth and UV-filtering acrylic.
- Steel rule, scalpel with a fresh blade, cutting mat, set square.

## Process

1. **Prepare.** Cut four A3 sheets and label their backs `NW`, `NE`, `SW`,
   `SE` with an up-arrow. Every SVG is an A3 *portrait* document
   (297 × 420 mm). Plot each one with the sheet in the same position and
   orientation and **no margin/scaling applied by the plotter software**.
   The trim geometry depends on the absolute positions.
2. **For each sheet** (order doesn't matter; do NW, NE, SW, SE):
   1. Tape the sheet down at its four corners, well outside the crop marks.
   2. Load **Sanguine S (0.3 mm)**. Plot `artwork-<quad>-temperate.svg`. This
      lays the petal of dashes plus 16 short crop-mark ticks in the margin.
      Pen-down speed moderate. These are thousands of 2 mm dashes, and
      pen-lift height should be the minimum that clears the paper.
   3. Don't move the sheet. Let it dry 10 minutes.
   4. Load **Indanthrene Blue F (0.5 mm)**. Plot `artwork-<quad>-frozen.svg`:
      the solid hatched point and its shards. Slow the pen-down speed by
      about a third. Adjacent hatch lines are only ~0.5 mm apart edge to
      edge, so the nib should glide, not skate.
   5. Leave the sheet flat to dry at least 1 hour before handling.
3. **Trim.** On each sheet the crop ticks mark a 274 × 274 mm square. Lay
   the steel rule across opposite tick pairs and cut with the scalpel. The
   ticks are in the waste and go with it. On each finished square the
   drawing sits **2 mm** from the two edges where the blue point is, and
   **22 mm** from the other two. If your plotter can't reach the left and
   right ticks (they sit 2.5 mm from the sheet edge), cut the vertical
   edges from the top and bottom ticks with a set square instead.
4. **Lay out.** Arrange the four squares on the backing board so every blue
   point touches the centre: NW top-left, NE top-right, SW bottom-left, SE
   bottom-right, all upright as plotted. Leave a **3 mm gap** between
   neighbours (use two 3 mm offcuts of board as spacers while
   positioning). The whole group is 551 × 551 mm, centred on the 700 mm
   board, so there's ~74 mm of board on each side.
5. **Float.** Glue four foam risers under each sheet, 15 mm in from its
   corners, so the sheets stand 5 mm proud of the backing. Hinge each sheet
   at its top edge with two tissue hinges onto its risers. The risers make
   the 3 mm gap read as a thin shadow-cross, not a line of board.
6. **Frame** in the box frame behind UV acrylic, and keep the acrylic clear
   of the sheets.

## Plot settings

| | |
|---|---|
| Sheets | 4 × A3 portrait (297 × 420 mm), each trimmed to 274 × 274 mm |
| Drawing | 250 × 250 mm per sheet; finished assembly 551 × 551 mm |
| Margins (finished) | 2 mm on the two inner edges, 22 mm on the two outer edges |
| Pen widths | temperate 0.3 mm (Sanguine S); frozen 0.5 mm (Indanthrene Blue F) |
| Ink per sheet | temperate ≈ 11 m in ~3,600 strokes; frozen ≈ 5 m in 127–158 strokes |
| Pen-up travel | temperate ≈ 10.5 m per sheet; frozen ≈ 0.6–0.7 m per sheet (stroke order already optimised with `orderPlot`) |
| Tiling | Aztec diamond AD(180), 32,580 dominoes, seed 11, uniform by domino shuffling |

The SVGs use 2 px per mm (viewBox 594 × 840). Every path is a plain stroked
polyline with round caps.

## Reproduction

From the repo root, after `pnpm install && pnpm build`, save the script
below as `four-poles.mjs` anywhere, then run:

```sh
node /path/to/four-poles.mjs concept-brainstorming/2026-11-27-0617
```

It writes all eight SVGs byte-for-byte (verified: two independent runs
`cmp` identical).

```js
// Four Poles — one exact uniform domino tiling of the Aztec diamond AD(180),
// split into its four domino classes, one class per A3 sheet, and re-gathered
// in a 2x2 so the four frozen corners meet at the centre.
// Usage: node four-poles.mjs <outDir>   (run from the flow-lines repo root after pnpm build)
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const core = await import(resolve('packages/core/dist/index.js'));
const { generateArctic, toSVG, orderPlot, measurePenTravel } = core;
const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });

const ORDER = 180, SEED = 11, FROZEN_RUN = 6;   // welded runs >= 6 dominoes = frozen
const S = 2;                                     // px per mm
const PAGE_W = 297, PAGE_H = 420;                // A3 portrait
const D = 250;                                   // drawing square, mm
const INNER = 2, OUTER = 22;                     // trim distance from drawing edge, mm
const TRIM = D + INNER + OUTER;                  // 274 mm finished sheet
const P = D * S;

const tiling = generateArctic({ width: P, height: P, margin: 0, seed: SEED, order: ORDER, marks: 'all', upright: true });
const unit = P / (ORDER * Math.SQRT2);
const onEdge = (q) => Math.min(q.x, q.y, P - q.x, P - q.y) < unit * 0.8;

// Each class's frozen corner lies at the panel corner named here; that corner
// must touch the centre of the 2x2, so the panel sits in the opposite quadrant.
const PANELS = [
  { cls: 'domino-e', quad: 'nw' },
  { cls: 'domino-s', quad: 'ne' },
  { cls: 'domino-n', quad: 'sw' },
  { cls: 'domino-w', quad: 'se' },
];

const report = [];
for (const { cls, quad } of PANELS) {
  const east = quad.endsWith('e'), south = quad.startsWith('s');
  // trim rect: inner edges (toward the 2x2 centre) INNER mm from the drawing, outer edges OUTER mm
  const trimX = (PAGE_W - TRIM) / 2, trimY = (PAGE_H - TRIM) / 2;
  const dx = trimX + (east ? INNER : OUTER), dy = trimY + (south ? INNER : OUTER);
  const layers = { temperate: [], frozen: [] };
  for (const l of tiling.lines) {
    if (l.layer !== cls) continue;
    const p = l.points;
    const L = Math.hypot(p.at(-1).x - p[0].x, p.at(-1).y - p[0].y);
    const frozen = L / unit / 2 >= FROZEN_RUN || (onEdge(p[0]) && onEdge(p.at(-1)));
    layers[frozen ? 'frozen' : 'temperate'].push({ points: p.map((q) => ({ x: q.x + dx * S, y: q.y + dy * S })) });
  }
  // crop marks (cut away with the waste): 6 mm ticks, 3 mm clear of the trim rect
  const tick = (x0, y0, x1, y1) => layers.temperate.push({ points: [{ x: x0 * S, y: y0 * S }, { x: x1 * S, y: y1 * S }] });
  const xs = [trimX, trimX + TRIM], ys = [trimY, trimY + TRIM];
  for (const x of xs) { tick(x, trimY - 9, x, trimY - 3); tick(x, trimY + TRIM + 3, x, trimY + TRIM + 9); }
  for (const y of ys) { tick(trimX - 9, y, trimX - 3, y); tick(trimX + TRIM + 3, y, trimX + TRIM + 9, y); }
  for (const [name, lines] of Object.entries(layers)) {
    const res = orderPlot({ lines, width: PAGE_W * S, height: PAGE_H * S, seed: SEED });
    const svg = toSVG(res, { physicalWidth: `${PAGE_W}mm`, physicalHeight: `${PAGE_H}mm`, strokeWidth: (name === 'frozen' ? 0.5 : 0.3) * S });
    writeFileSync(`${out}/artwork-${quad}-${name}.svg`, svg);
    const t = measurePenTravel ? measurePenTravel(res) : null;
    report.push(`${quad} ${name}: ${res.lines.length} strokes ${t ? JSON.stringify(t) : ''}`);
  }
}
console.log(report.join('\n'));
```

**How it works, in one paragraph.** `generateArctic` with `marks: 'all'`
inks every domino as a *spine* and welds collinear touching spines into
single strokes, tagging each with its class (`domino-n/s/e/w`), and
`upright: true` turns the diamond 45° into a square with the four poles at
its corners. The script sorts each class's strokes into two phases. A
welded run of six or more dominoes counts as **frozen**. So does a short
diagonal with both ends on the panel border, since near the very corner
the frozen hatch lines are short only because the corner is narrow.
Everything else counts as **temperate**. The script then places each
class on its own A3 sheet, positioned so its pole is the inner corner.

**Preview.** `preview.png` is assembled from `scripts/svg-to-png.mjs`
renders: each temperate SVG recoloured `--stroke '#a4432e'` on
`--background '#f3ecdc'`, each frozen SVG `--stroke '#233a5e'`. The two
are multiplied together with ImageMagick, cropped to the 274 mm trim, and
laid out 2 × 2 with 3 mm gaps and a soft drop shadow for the float mount.

```sh
# K=4 px/mm; run per quad q in nw ne sw se, from the run folder
node scripts/svg-to-png.mjs artwork-$q-temperate.svg t.png --width 1188 --background '#f3ecdc' --stroke '#a4432e'
node scripts/svg-to-png.mjs artwork-$q-frozen.svg    f.png --width 1188 --background '#ffffff' --stroke '#233a5e'
convert t.png f.png -compose multiply -composite -crop 1096x1096+46+292 +repage $q.png
# then composite the four on a #ebe5d8 ground with 12 px gaps (3 mm) and a blurred shadow
```

## Wishes

- **Phase as a first-class output of `arctic`.** The generator knows the
  tiling exactly, so it could tag each domino *frozen* vs *temperate*
  directly (e.g. via the height function or local brick regularity) and
  export the two phases as separate pen layers. The run-length heuristic
  here works, but sometimes it promotes an ordered shard of the liquid
  zone to "frozen". I like that effect, but it should be a choice.
- **A `flow-lines arctic` CLI command** with `--split-layers`, so pieces
  like this don't need a scratch script.
- **Per-layer tiling / quadrant export.** A general "place layer X on its
  own sheet at offset/orientation Y, with crop marks" step in the stack
  recipe would make deconstructed multi-sheet works like this one
  declarative.
- **Crop marks as a page option** on every generator (`--crop-marks`,
  with per-edge trim distances), drawn into the waste.
