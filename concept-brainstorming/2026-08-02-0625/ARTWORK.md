# Blastula — Six Plates

## Artist statement

In 1952 Alan Turing published his last major paper, *The Chemical Basis
of Morphogenesis*. It asks a question that has nothing to do with
computing and everything to do with it: how does a spatially uniform
egg — no head end, no tail end, nothing to read — turn into a patterned
organism? Turing's answer was that it doesn't need a plan. Two
substances diffusing at different rates, one feeding a reaction that
consumes the other, are enough: left alone, a flat field of them
spontaneously tears itself into spots, stripes, rings — not because
anything is deciding to make a pattern, but because the mathematics of
diffusion-plus-reaction has no stable flat state to fall back into. It
was theory when he wrote it, decades before anyone could stain a real
embryo for the morphogens involved.

This repo's reaction-diffusion generator runs a Gray–Scott variant of
exactly that system, and ships a handful of named feed/kill presets
tuned by earlier engineers purely for how they look — `coral`, `maze`,
`fingerprint`, `worms`. One is called `mitosis`, presumably because a
seeded blob buds into two once it grows past some size. I ran it from a
single small seed at the centre of an otherwise empty field and let it
go: one blob becomes a notched figure-eight, becomes a clean cross of
four, becomes a ring of eight, becomes a crowded double ring, and — by
the point the simulation's step budget runs out — a settled rosette of
roughly forty, arranged around a hollow centre. Structurally, that
last shape is a cross-section through a **blastula**: the hollow ball of
cells a real embryo forms after a handful of cleavage divisions, before
it is anything else. The software doesn't know that word. It got there
by diffusion and starvation, the same argument Turing made, run for a
few thousand steps instead of a few hundred million years.

The piece is the six stages of one run, not one finished pattern. I
kept the seed, the feed/kill rate, and the grid identical across all
six and varied only how long the field had been running — a set of
frames from a single unfolding, not six different drawings. Each frame
sits alone on its own small card, mostly bare paper around one small,
exact motif: the point isn't the density any of the presets can reach
if you let them run to fill the page (`coral`, `maze` and `holes` all
do, and are striking for it) — it's watching very little become a
little more, in six honest steps, with nothing hurried and nothing
padded out to look fuller than the chemistry earned. That restraint,
and the fact that the resemblance to real embryology is a coincidence
of geometry rather than a modelled one, is what earned this over every
denser, more "finished-looking" render from the same generator.

## Materials

- **Paper** — six cards of hot-press bright white printmaking stock
  (e.g. Somerset Velvet or Bristol, ~190gsm — heavy enough to stand as
  a card, still flexible enough to hinge cleanly), each trimmed to A6,
  105 × 148mm portrait.
- **Ink** — a single black pigment fineliner throughout, e.g. Sakura
  Pigma Micron 03 (~0.3mm) or an equivalent India/carbon-black
  technical pen. Hex equivalent for reference/preview: `#17140f`
  (a near-black with a little warmth, not flat print-black).
- **Binding** — cream/natural linen book-binding tape, ~20mm wide, to
  hinge the six cards into an accordion.
- **Captioning** — ordinary graphite pencil, for the hand-lettered
  title and step counts (see Process).

## Process

1. Plot `artwork-plate-I.svg` through `artwork-plate-VI.svg`, one per
   A6 card, each with the same single black pigment pen at ~0.3mm.
   Every plate already has its own 14mm clear margin and optimized
   stroke order baked in — no shared setup needed between plates beyond
   reloading the same pen and paper size.
2. Once dry, on the **reverse** of each card pencil, small, bottom
   corner: the plate number (I–VI) on the left, the simulation step
   count it was sampled at on the right — 20 / 65 / 200 / 2,000 /
   4,400 / 6,000 respectively. These are working captions, meant to
   read like a lab notebook, not typeset titles.
3. On the reverse of Plate I only, also pencil the title, small and
   plain: `BLASTULA`. Face-down and folded shut, this becomes the
   book's front cover.
4. Lay the six cards face-up in order I→VI, short (105mm) edges
   touching, long edge up.
5. Hinge each adjoining pair of short edges on the reverse with a strip
   of linen tape, alternating the fold direction each time (valley,
   mountain, valley, mountain, valley) so the six-card strip closes
   into a flat Z-fold accordion rather than a spiral.
6. Fold shut for storage/handling (Plate I, titled side out, becomes
   the cover); stand it open in its full zigzag for display — opened
   flat, it reads exactly as the contact-sheet preview does: six
   frames of one growth, left to right, top row then bottom.

No wash, colour pass, or second plot — one pen, one pass per card, the
sequence itself is the whole piece.

## Plot settings

- Six plates, each A6 portrait, 105 × 148mm, 14mm margin.
- Single pen, ~0.3mm, black.
- Pen travel is negligible — each plate is 8 to 233 short strokes
  (already endpoint-chained via `optimize`, on by default), nothing
  close to needing a travel estimate.

## Reproduction

Same seed (`3`), same feed/kill preset (`mitosis`), same 220-column
grid, same single centred seed blob, across all six plates — only
`steps` (how long the field has run) changes between them.

```sh
pnpm install && pnpm build
node blastula.mjs concept-brainstorming/2026-08-02-0625
```

```js
// blastula.mjs — six frames of one Gray–Scott 'mitosis' reaction-diffusion
// simulation (same seed, same field, sampled at six step counts), each
// traced as nested contour rings and laid out on its own A6 card for a
// six-panel concertina book.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const coreDist = join(process.cwd(), 'packages', 'core', 'dist', 'index.js');
const outDir = process.argv[2] ?? '.';
mkdirSync(outDir, { recursive: true });

const { generateReactionDiffusion, toSVG } = await import(coreDist);

const widthMm = 105;
const heightMm = 148; // A6
const pxPerMm = 6; // finer than the repo's BASE_PX_PER_MM so the 220-cell grid traces smoothly on a small A6 card
const widthPx = Math.round(widthMm * pxPerMm);
const heightPx = Math.round(heightMm * pxPerMm);
const marginPx = Math.round(14 * pxPerMm);

const PLATES = [
  { n: 'I', steps: 20 },
  { n: 'II', steps: 65 },
  { n: 'III', steps: 200 },
  { n: 'IV', steps: 2000 },
  { n: 'V', steps: 4400 },
  { n: 'VI', steps: 6000 },
];

for (const { n, steps } of PLATES) {
  const res = generateReactionDiffusion({
    width: widthPx,
    height: heightPx,
    margin: marginPx,
    seed: 3,
    preset: 'mitosis',
    gridCols: 220,
    seedLayout: 'center',
    seedSize: 8,
    offCenter: 0,
    steps,
    style: 'contour',
  });
  const svg = toSVG(res, {
    width: widthPx,
    height: heightPx,
    physicalWidth: `${widthMm}mm`,
    physicalHeight: `${heightMm}mm`,
  });
  const file = join(outDir, `artwork-plate-${n}.svg`);
  writeFileSync(file, svg);
  console.log(`plate ${n}: t=${steps}, ${res.lines.length} lines -> ${file}`);
}
```

```sh
# preview.png — six plates laid out in a 3x2 grid at their true relative
# size, on bright white paper with the near-black ink described above.
# (The compositing script that stitches the six SVGs into one grid is a
# throwaway layout convenience, not part of the reproducible piece — the
# six artwork-plate-*.svg files above are the deliverable; the grid is only
# how this preview shows them all at once.)
node scripts/svg-to-png.mjs contact.svg preview.png \
  --width 1800 --background '#faf9f4' --stroke '#17140f'
```

## Wishes

- No CLI command for `reaction-diffusion` yet (core-only, per the
  toolbox notes) — a `flow-lines rd` command exposing `preset` /
  `steps` / `seedLayout` / `style` would make this kind of frame-by-frame
  study much less scratch-script-y to explore.
- There's no way to ask the generator for "stop me at the Nth budding
  event" directly — I found the six step counts above by bisecting on
  line count from a scratch loop. A mode that reports back the step at
  which the traced contour count last changed would turn this kind of
  staged-growth piece into a two-minute job instead of a search.
