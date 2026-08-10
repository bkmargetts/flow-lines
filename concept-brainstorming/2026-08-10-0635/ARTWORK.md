# Delphos

## Artist statement

In the first decade of the 1900s the designer Mariano Fortuny developed a
silk gown so associated with its own technique that it has no other name:
the *Delphos*, a straight column of finely heat-set pleats, dyed by a
secret multi-dip process that could leave the silk shimmering between two
colours depending on how the fold caught the light, and weighted at the
hem and shoulder seams with tiny Murano glass beads so the pleats hung
dead straight instead of splaying. He named it for the bronze Charioteer
of Delphi, whose sculpted robe falls in exactly that kind of long fluted
column.

This repo's `overlapped-lines` generator has sat untouched since it was
built — an interleaved-grating texture where a second ink is offset from
the first by a drifting phase, so the two threads can sit exactly on top
of one another (reading as one dark line) or spread apart into two
visibly separate colours, depending on where along the sheet you look.
That is not a metaphor for shot silk. It is the same optical mechanism —
two periodic structures beating in and out of phase — that Fortuny's dye
and weave were producing by other means. I didn't have to invent a
translation; I had to stop hatching with it and let the beat itself carry
the whole drawing.

The piece is nine straight pleats filling an A3 panel, gold and emerald
threads coincident at the flat header and hem (each pleat's darkest,
densest band) and pulling apart through the body of the fold, at a
different rate in every pleat, so no two columns shimmer the same way.
Early tests gave each pleat its own gentle bow and a degree or two of
tilt, chasing a more "draped" silhouette — real cloth doesn't run in
perfectly parallel lines. It looked worse: a tilted grating sampled
through a mask that follows a different, barely-bowed curve loses and
regains lines unevenly down its own length, and at several seeds that
left thin false tears splitting individual pleats for no reason a viewer
could read as intentional. Fortuny's actual pleats are dead straight
columns anyway — the drama is in the colour, not the silhouette — so I
cut the bow and the tilt entirely and let per-pleat spacing and phase
drift carry all the variation. That version had no artifacts in any seed
I tried, and it's the more honest read of the reference besides. Seed 777
was the strongest of five: two pleats (the fourth and seventh) hold an
almost solid gold column for most of their length before breaking apart
sharply near the hem, which gives the panel a real focal point instead of
nine equally-busy columns.

## Materials

- **Paper**: Canson Mi-Teintes, Prune (deep aubergine-plum), 160gsm,
  smooth (fine-grain) face up, A3 (297×420mm). The heavier "toile"-grain
  back would catch and skip a fine gel tip on this much continuous
  vertical line — plot on the smooth side.
- **Ink 1 — the header/hem ink (coincident band)**: Sakura Gelly Roll
  Metallic, Gold (08, medium tip). Opaque metallic gel over dark stock.
  Approximate swatch: `#D9AD3F`.
- **Ink 2 — the second thread (drifting band)**: Sakura Gelly Roll
  Metallic, Green (fine tip). A cool emerald metallic that reads closer
  to black than to gold where the two coincide, and separates into its
  own clear colour toward the middle of each pleat. Approximate swatch:
  `#2F9273`.
- Optional finishing: ~40 clear or gold-tone 2mm glass seed beads and
  fabric-safe PVA, for the hem flourish in step 4 below (a direct nod to
  the Delphos gown's own beaded hem weights — entirely optional, the
  piece stands on the two ink passes alone).

## Process

1. Plot `artwork-gold.svg` first (the `band-00` layer): the undisturbed
   half of the interleave — every gold line sits on the plain, undrifted
   grid, so this pass alone already reads as nine even, faintly
   fringed columns. ~57m of gold ink.
2. Without moving the paper, swap to the Gelly Roll Green pen and plot
   `artwork-emerald.svg` (the `band-01` layer). This is the drifting
   half: coincident with the gold at the top and bottom margin (where the
   two inks should print close enough to look like one slightly thicker
   dark line) and pulling away from it through the middle of each pleat.
   Registration matters more here than in a typical two-pass piece — the
   whole point is that the coincidence at the header/hem is real, not
   approximate, so don't re-tape or shift the sheet between passes.
   ~56m of emerald ink; combined pen-down travel ≈113m.
3. Let both metallic gels cure flat at least an hour before handling —
   metallic pigment sits on the surface longer than dye ink before it
   scuffs clean.
4. Optional: along the bottom hem margin (inside the 18mm clear border),
   hand-glue a single evenly-spaced row of 2mm glass seed beads with
   fabric-safe PVA, one roughly every 20mm. Let dry flat overnight before
   hanging or framing — this is the Delphos gown's own hem-weighting
   trick, borrowed as a literal object rather than drawn.
5. Float-mount on black board, glazed, or frame with a narrow plain
   moulding — the piece is already doing all the colour work; a heavy
   mat or ornate frame would fight it.

## Plot settings

- Paper: A3, portrait, 297×420mm
- Margin: 18mm clear border, all sides
- Render density: 3px/mm
- Pen width: fine tip on both inks (~0.3–0.4mm nib); no offset/bold
  passes — every line in this piece is a single stroke of its pen, the
  bold read of the header/hem comes from two inks landing on top of each
  other, not from a wider nib
- Seed: 777 (9 pleats; per-pleat seed = `777 + i*9973 + 1`)
- Two plots, same sheet, no repositioning between them
- Estimated ink: ~57m gold + ~56m emerald ≈ 113m combined pen-down travel

## Reproduction

`overlapped-lines` has no CLI command yet (core-only generator, per
`concept-brainstorming/README.md`), so the piece comes from a standalone
script driving `packages/core` directly. Save as `delphos.mjs` in the
repo root and run from there:

```sh
pnpm --filter @flow-lines/core build   # or: pnpm build

node delphos.mjs .   # writes artwork-gold.svg + artwork-emerald.svg into the given dir
```

```js
// delphos.mjs — nine straight interleaved-grating pleats, coincident ink
// at the header/hem, drifting apart through the body of each pleat.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const core = await import('./packages/core/dist/index.js');
const { generateOverlappedLines, toSVG, bandLayerName, orderPlot, pageMetrics, getPaperSize } = core;

const OUT = process.argv[2] ?? dirname(fileURLToPath(import.meta.url));

// mulberry32 — deterministic PRNG for per-pleat variation, independent of
// the core RNG (which seeds each pleat's own noise field); the same
// master seed always produces the same sequence of pleat parameters.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const lerp = (rnd, lo, hi) => lo + rnd() * (hi - lo);

function buildDelphos({ width, height, margin, foldCount, seed }) {
  const rnd = mulberry32(seed);
  const usableW = width - 2 * margin;
  const usableH = height - 2 * margin;
  const foldSpan = usableW / foldCount;
  const overlapFrac = 0.32;
  const halfWidthPx = (foldSpan / 2) * (1 + overlapFrac);
  const capExtendPx = halfWidthPx * 1.6; // pushes the band's rounded cap off-canvas -> flat header/hem

  const lines = [];
  for (let i = 0; i < foldCount; i++) {
    const cx = margin + foldSpan * (i + 0.5);
    // Pleats are dead straight (no bow, no angle tilt): a tilted grating
    // sampled through a mask that bows on a different curve loses and
    // regains coverage unevenly down its length, leaving thin false
    // tears. Straight mask + angleDeg 0 keeps every pleat a clean
    // parallel-sided column; per-pleat seed, spacing and phase-drift
    // still keep no two pleats identical.
    const path = [
      { x: cx, y: margin - capExtendPx },
      { x: cx, y: margin + usableH + capExtendPx },
    ];

    const res = generateOverlappedLines({
      width, height, margin,
      angleDeg: 0,
      spacingPx: lerp(rnd, 6, 7.6),
      colorCount: 2,
      phaseDriftAlongPx: lerp(rnd, 11, 15.5),
      phaseNoiseAmpPx: lerp(rnd, 0.6, 1.1),
      phaseNoiseScale: 0.012,
      wobbleAmpPx: 0.5,
      wobbleWavelengthPx: 120 + rnd() * 50,
      edgeSmoothPx: 28,
      maskShapes: [{ type: 'band', path, halfWidthPx }],
      seed: seed + i * 9973 + 1,
      optimize: false,
    });
    lines.push(...res.lines);
  }
  return orderPlot({ lines, width, height, seed });
}

const SEED = 777;
const size = pageMetrics(getPaperSize('a3'), 'portrait', 3);
const margin = 18 * size.pxPerMm; // 18mm clear border

const result = buildDelphos({
  width: size.widthPx,
  height: size.heightPx,
  margin,
  foldCount: 9,
  seed: SEED,
});

const goldLines = result.lines.filter((l) => l.layer === bandLayerName(0));
const emeraldLines = result.lines.filter((l) => l.layer === bandLayerName(1));

const svgOpts = {
  strokeWidth: 1,
  precision: 2,
  physicalWidth: `${size.widthMm}mm`,
  physicalHeight: `${size.heightMm}mm`,
};

writeFileSync(join(OUT, 'artwork-gold.svg'), toSVG({ ...result, lines: goldLines }, svgOpts));
writeFileSync(join(OUT, 'artwork-emerald.svg'), toSVG({ ...result, lines: emeraldLines }, svgOpts));
```

`preview.png` was composited from the two SVGs with a one-off scratch
script (not part of the deliverable) that recoloured each layer's stroke
to its ink swatch and laid them over a `#3a1530` (deep aubergine) ground,
then rasterized with `scripts/svg-to-png.mjs`. The gist, for reference:

```js
// recolor each split-layer SVG's stroke, stack on the paper colour, rasterize
const goldBody = extractInner(goldSvg).replace(/stroke="#000000"/g, 'stroke="#d9ad3f"');
const emeraldBody = extractInner(emeraldSvg).replace(/stroke="#000000"/g, 'stroke="#2f9273"');
// <rect fill="#3a1530"/> + <g>{emeraldBody}</g> + <g>{goldBody}</g>, then:
// node scripts/svg-to-png.mjs composed.svg preview.png --width 1600
```

## Wishes

- `overlapped-lines` has no CLI command yet — every option in this piece
  had to be reached by scripting `packages/core` directly. A thin
  `flow-lines gratings` command (mirroring the `city`/`stickmen` pattern
  of "core generator first, CLI wrapper later") would make this
  generator explorable the way the others are, and would be worth doing
  before the next session reaches for it.
- The `band` mask shape is a straight-segment capsule with no per-point
  width control — a fold that gradually widened toward the hem (a real
  Fortuny pleat flares very slightly under its own weight) would need
  either a tapered-capsule mask primitive or a second, narrower `band`
  layered on top. Not needed for this piece, but noted for a future one
  that wants literal drape rather than a straight column.
