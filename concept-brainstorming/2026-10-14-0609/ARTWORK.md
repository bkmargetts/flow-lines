# Frozen Quartet

## Artist statement

Shuffle a deck of dominoes onto an Aztec diamond — every tiling equally
likely — and something impossible happens. Nobody tells the dominoes
where to go, yet at large size they freeze into four perfectly
brick-regular corners and stay random only inside a circle, with a
boundary that sharpens to a razor as the board grows (the *arctic circle
theorem*, Jockusch–Propp–Shor 1998). Nothing in the algorithm mentions a
circle.

No past session has touched the `arctic` generator, so this piece starts
from it. The dominoes come in four orientations, and the theorem separates
them: each corner freezes into exactly one. I gave each orientation its
own ink. Standing the diamond upright makes a square whose four corners
are four pure colours — gold, white, teal, coral — each hatched in its
own diagonal ruling, bleeding into a roiling mixed interior. It reads as a
colour wheel that nobody drew, or four weather fronts meeting; the circle
is an exact consequence of combinatorics, and you see it as the edge where
order gives out. I chose seed 3 at order 90 over a dozen others because
its circle sits slightly off-centre and bulges toward the top right, so the
frozen corners are unequal — the coral and gold corners are broad, the
white corner is pinched — and the piece has a lean instead of a diagram's
symmetry. Order 90 (not 140+) keeps rules about 3 mm apart so each pen line
stays individually legible on the sheet.

## Materials

- Paper: A3 (297×420 mm), deep midnight-navy card, ~250 gsm smooth
  (e.g. Colorplan "Mulberry/Midnight" equivalent, approx. #101A33).
- Pens, all 0.4 mm opaque gel/paint-marker (must cover dark stock):
  1. Pen 1 — `domino-n`: white / soft ivory, #F2EFE6
  2. Pen 2 — `domino-e`: teal, #46C2B0
  3. Pen 3 — `domino-s`: coral, #F08A7E
  4. Pen 4 — `domino-w`: marigold gold, #E8B94A
- Masking tape (low-tack), 4 small registration pencil ticks.
- Mount: float-mount on off-white board; no glass contact with gel ink.

## Process

1. Tape the card to the plotter bed; mark the corner ticks so the sheet
   can be removed between pens and replaced exactly.
2. Plot `artwork-layer-1.svg` with pen 1 (ivory). Dry 30 min (gel on dark card).
3. Swap pens; re-seat the sheet on the ticks; plot `artwork-layer-2.svg`
   (teal). Dry 30 min.
4. Plot `artwork-layer-3.svg` (coral). Dry 30 min.
5. Plot `artwork-layer-4.svg` (gold).
6. Dry overnight, then float-mount. Layers do not overlap (each domino
   inks one class), so there are no overprint concerns; a ≤0.3 mm
   misregistration just reads as hand-set colour.

## Plot settings

A3 portrait, 15 mm margin (the drawing is a ~267 mm square centred on the
sheet), 0.4 mm pen on every layer, wobble 0.35 px, `orderPlot` ordering
(no chaining). `artwork.svg` holds all four pens in one file for preview.

## Reproduction

From the repo root after `pnpm install && pnpm build`:

```sh
node concept-brainstorming/2026-10-14-0609/render.mjs
```

`render.mjs` (in this folder) calls
`generateArctic({ width: 297, height: 420, margin: 15, seed: 3,
marks: 'all', upright: true, order: 90 })`, splits the lines by layer
(`domino-n/e/s/w` → layers 1–4) and writes `artwork.svg` and
`artwork-layer-{1..4}.svg` byte-for-byte. The preview was produced with:

```sh
node concept-brainstorming/2026-10-14-0609/render.mjs /tmp/prev.svg   # coloured preview SVG
node scripts/svg-to-png.mjs /tmp/prev.svg preview.png --width 1400 --background '#101a33'
```

## Wishes

- An `arctic` CLI command (the generator is core-only) with
  `--split-layers`.
- Per-class pen angles or a way to leave the corners solid-filled rather
  than ruled.
