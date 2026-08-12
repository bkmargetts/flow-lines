# Vigil

## Artist statement

Six hundred and eighty tiny figures, drawn from directly above, standing
in a broken ring around nothing. The circle doesn't close — there's a
gap at the top, the width of two or three people, facing straight up
into an enormous field of empty paper. Nobody drew what they're facing.
That's the whole piece.

This came out of the repo's stick-figure crowd generator, which exists
to fill a page with a milling, occluding mass of people — its default
mode is closer to a stadium or a market square. I turned that instinct
off. `region: ring` confines the crowd's feet to a thin annulus instead
of the whole ground plane, and I cut a `region: polygon` gap into that
annulus by hand — an outer arc traced forward and the inner arc traced
back, closing into a single "C"-shaped band — so the ring reads as an
opening, not a closed geometric shape. Pose energy is turned down to
0.25 and the mode is `procedural`: at low energy the joints barely move
off a resting stance, so the crowd holds still instead of milling. Every
other generator run this month has been an abstract pattern — cracks,
gratings, reaction-diffusion, harmonograph curves. This is the first
piece all session to put people in the frame, and the first to let
absence — the 60% of the sheet above the ring that never gets touched
by the pen — carry the emotional weight instead of a mark.

What kept this out of the discard pile: candidates with the ring dead
centre, or scaled to fill the sheet, read as a diagram — a doughnut, a
target, an "O." Pushing the ring down into the lower third and leaving
the rest of the page as sky is what turned a shape into a gathering.
Once it's off-centre and small against that much emptiness, the eye
reads it immediately as a crowd seen from a great height, at night —
the composition is doing figure-ground work no shading or texture could
do as directly. Adding the gap was the second unlock: a perfect O is a
pattern; a broken O with three empty ranks either side of the opening
is a place people walked into and are still arriving at. I tried this
at several counts and ring widths (see "Candidates considered" below);
this one holds the most tension between "legible as a crowd" and
"legible as a single quiet shape" at arm's length.

## Materials

- **Paper**: GF Smith Colorplan "Ebony" 350gsm smooth black card,
  A3 (297×420mm), portrait.
- **Ink**: one pen — Sakura Gelly Roll Metallic 08, "Gold" (~0.4mm gel
  tip on the card; the plotted line width is set to 0.3mm at the
  generator level, close to the pen's laid-down width on this stock).
  Hex approximation for screen preview: `#d9b26a`.
- Nothing else — no wash, no second pass, no mount. The whole piece is
  one plotted layer in one ink.

## Process

1. Load the pen with Sakura Gelly Roll Metallic Gold and confirm a
   clean, unbroken line on a scrap corner of the same Colorplan stock —
   gel ink skips on cold card until it's warmed up under the nib.
2. Home the plotter on the A3 Colorplan Ebony sheet, portrait, pen
   loaded at 0.3mm.
3. Plot `artwork.svg` in a single pass — one pen, one pass, no
   registration to worry about.
4. Let the ink cure flat for at least 20 minutes before handling (gel
   ink on coated black stock stays tacky longer than on matte paper).
5. Float-mount on black or near-black board with enough margin that the
   sheet reads as sitting in more darkness, not framed tight — the
   piece's logic (a small lit gathering in a lot of night) continues
   past the sheet edge into the mount.

No wash, misregistration, or multi-pass work — a second ink here would
compete with the one thing the piece depends on: a single ring of marks
against everything the pen didn't touch.

## Plot settings

- Paper: A3, 297×420mm, portrait
- Margin: 15mm
- Pen: 0.3mm, single pass, single layer
- Render density: 3px/mm (`BASE_PX_PER_MM`)
- Seed: 42
- Figures: 680 (the generator always places exactly `count` — a
  candidate that keeps failing `minSeparation`/clustering rejection is
  still accepted on its last try, so the crowd size never drifts)
- Lines in the plotted SVG: 4,838 strokes
- Not optimized for pen-travel reordering beyond the generator's own
  default (`orderPlot`, applied internally — stick figures are discrete
  shapes, so full endpoint-chaining is correctly not used here; see
  CLAUDE.md's note on `optimizePlot` vs `orderPlot`)

## Reproduction

Built against this repo's core package (`pnpm --filter @flow-lines/core build`
first). There is no CLI command for the stick-figure crowd generator yet,
so this is a scratch Node script against the built core package —
inlined below, byte-for-byte reproducible at seed 42:

```js
// vigil.mjs — node vigil.mjs <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const coreDist = resolve(process.cwd(), 'packages/core/dist/index.js');
const { generateStickmen, toSVG, pageMetrics, getPaperSize } = await import(coreDist);

const outDir = resolve(process.argv[2] ?? '.');
mkdirSync(outDir, { recursive: true });

const PX_PER_MM = 3;   // BASE_PX_PER_MM
const PEN_MM = 0.3;
const MARGIN_MM = 15;

const paper = getPaperSize('a3');
const metrics = pageMetrics(paper, 'portrait', PX_PER_MM);
const { widthPx: W, heightPx: H, widthMm, heightMm } = metrics;
const margin = MARGIN_MM * PX_PER_MM;
const penWidth = PEN_MM * PX_PER_MM;

const bw = W - 2 * margin;
const bh = H - 2 * margin;
const minBox = Math.min(bw, bh);

// A "C"-shaped annulus polygon: outer arc traced forward, inner arc
// traced back, leaving a gap of `gapDeg` centred on `gapCenterDeg`
// (0 = right, 90 = down the page, -90 = up, toward the open field).
function gappedRing(cx, cy, rOuterFrac, rInnerFrac, gapCenterDeg, gapDeg, n = 120) {
  const rO = rOuterFrac * minBox;
  const rI = rInnerFrac * minBox;
  const rxO = rO / bw, ryO = rO / bh;
  const rxI = rI / bw, ryI = rI / bh;
  const gapCenter = (gapCenterDeg * Math.PI) / 180;
  const gapHalf = (gapDeg * Math.PI) / 360;
  const startA = gapCenter + gapHalf;
  const endA = gapCenter - gapHalf + Math.PI * 2;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = startA + (i / n) * (endA - startA);
    pts.push({ x: cx + Math.cos(a) * rxO, y: cy + Math.sin(a) * ryO });
  }
  for (let i = n; i >= 0; i--) {
    const a = startA + (i / n) * (endA - startA);
    pts.push({ x: cx + Math.cos(a) * rxI, y: cy + Math.sin(a) * ryI });
  }
  return { kind: 'polygon', points: pts };
}

const SEED = 42;
const region = gappedRing(0.42, 0.66, 0.30, 0.205, -90, 28);
const res = generateStickmen({
  width: W, height: H, margin, seed: SEED,
  count: 680, region,
  clustering: 0.3, minSeparation: 6.8,
  figureScale: 4.5 * PX_PER_MM, scaleVariance: 0.28, proportionVariance: 0.5,
  depthGrade: 0, penWidth, limbCurve: 0.7,
  poseEnergy: 0.25, poseMode: 'procedural', facing: 'random',
  occlude: true, groundContact: false, wobble: 0.6,
});

const svg = toSVG(res, {
  strokeWidth: penWidth,
  physicalWidth: `${widthMm}mm`,
  physicalHeight: `${heightMm}mm`,
});
writeFileSync(join(outDir, 'artwork.svg'), svg);
console.log(res.lines.length, 'lines');
```

Run from the repo root after building core:

```sh
pnpm --filter @flow-lines/core build
node vigil.mjs ./out
```

Preview (approximating gold ink on black Colorplan):

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png \
  --width 1600 --background '#0a0908' --stroke '#d9b26a'
```

## Candidates considered

- **Ring dead-centre on the page, no gap.** Technically clean but reads
  as a diagram (a doughnut/target/letter O) rather than a gathering —
  the symmetry is too total. Discarded.
- **Ring filling most of the sheet at high density (~950 figures).**
  More visually "impressive" at a glance but loses the vast-emptiness
  contrast that makes the small version feel like grief rather than
  pattern-making. Discarded.
- **Tiny ring (`rOuter` 0.22) centred in a huge void.** Went too far the
  other way — reads as lonely/decorative rather than as a specific
  place with specific people. Discarded.
- **`poseMode: 'library'`.** Archetype poses (walking, running,
  cheering) put visible motion and gesture into a third of the crowd —
  wrong register entirely for a still gathering; some figures read as
  mid-stride or flailing. Reverted to `procedural` at low energy, which
  collapses toward a calm, near-mannequin stance with just enough
  per-figure jitter to avoid looking stamped.
- **No gap (closed ring).** Solid and legible, but static — nothing for
  the eye to enter through, no relationship to the empty field above it.
  Adding the 28° opening, aimed up into the open part of the page, is
  what made the negative space feel connected to the crowd instead of
  just surrounding it.

## Wishes

- `generateStickmen`'s `region` only ships four shape kinds (rect,
  ellipse, ring, polygon) plus the named polygon presets (star, heart,
  diamond, blob) — there's no built-in "ring with a gap" or general
  annulus-arc helper, so this piece hand-rolled one as a `polygon` in
  the scratch script (see Reproduction). A `ringArcRegion(cx, cy,
  rOuter, rInner, startDeg, endDeg)` helper alongside `starRegion` /
  `heartRegion` in `stickmen/region.ts` would make this a one-liner
  next time, and would be a natural fit for the web Stickmen module's
  region picker too.
- There's no `flow-lines stickmen` CLI command (per the README table,
  core-only for now) — every iteration in this session went through a
  scratch script. Given `region` already exists and is this expressive,
  a CLI wrapper (mirroring `lapidary`'s recent addition) seems
  worthwhile — the crowd generator has more compositional range than
  its current "fill the page" framing in the docs suggests.
