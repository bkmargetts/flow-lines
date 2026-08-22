# Residue

## Artist statement

In 1970, a handful of Conway's collaborators dropped a five-square
scrap called the R-pentomino onto an empty Game of Life board expecting
it to die out quickly, the way almost everything does. It didn't. It
boiled for over a thousand generations — hurling off gliders,
manufacturing and destroying its own debris — before most of the board
finally went still. It became the standard opening gambit for testing
any new Life implementation precisely because nobody, not even Conway,
could predict its outcome by eye. That unpredictability, run out and
then *held*, is what this repo's `conway` generator is for: it
accumulates one exposure value per cell — decayed each generation,
topped up by life — so a single still frame can carry the whole run's
history, the way a photographer's long exposure lets a fixed shutter
hold a firework's whole arc as one image.

I ran the sim to generation 190 across two dozen seeds and orientations
before this one stopped me. The `contour` render style traces that
exposure field as nested iso-lines rather than discrete marks, so the
two clusters of cells still alive at frame's end don't read as pixel
debris — they read as *landmasses*, solid islands with their own
internal ridgelines, holding the ground the pattern never gave back.
Radiating away from them: bare, tapering lines where gliders escaped
and kept going, most still travelling when the exposure closed; small
scattered clusters of four-cell blocks, the pattern's least interesting
possible output, stranded wherever a piece of the wreckage happened to
stabilize. The generator's own code names these two categories `present`
and `trail` — I didn't have to invent the split, only notice it was
already the whole idea: everything a small disturbance leaves behind
sorts itself into what stayed and what left, and neither one tells you
what the disturbance was actually like while it was happening. What
survives is never the event. It's the residue.

The piece earns its keep on the page, not just the concept: two
asymmetric island masses, one upper-right and one lower-centre,
connected by a single long trail curving between them like a strait,
with a loose scatter of stranded blocks either side and one isolated
pair of gliders that got clean away into the top-right corner. A good
third of the sheet — the whole upper-left — never got touched by
anything and stays empty. On a real long-exposure photograph that empty
region would just be the sky the fireworks didn't reach. I plotted it
the same way: nothing pretends to fill it.

## Materials

- **Paper** — one A3 sheet (420 × 297 mm), landscape, GF Smith
  Colorplan "Ebony" 270 gsm — a true, deep black, smooth uncoated card
  heavy enough that gel ink sits on top without feathering or
  show-through. This is a stock the plotter-art community already
  reaches for specifically because it takes gel and paint-pen inks
  cleanly; substitute Canson Mi-Teintes "Black" 160 gsm if Colorplan
  isn't on hand, though it's noticeably lighter-weight.
- **Ink 1 — "ever-present"** (`artwork.present.svg`): a warm bone-white
  pigment gel ink, `#f2ecdd`. Sakura Gelly Roll "08 Bold" White, or
  Uni-ball Signo Broad UM-153 White — both are opaque enough to stay
  solid white on black in one pass, which matters here since this layer
  carries almost all of the drawing's weight (503 of the piece's 564
  strokes). Nib/tip around 0.5–0.7 mm.
- **Ink 2 — "afterglow"** (`artwork.ghost.svg` + `artwork.trail.svg`,
  same pen, two passes): a pale, cool ice-blue gel ink, `#9fb9cc`.
  Sakura Gelly Roll "Stardust"-family pastel blue, or a Uni-ball Signo
  pastel blue — something visibly cooler and less opaque than the white,
  so the escaped/decayed record reads as *fainter*, further from now,
  without needing a second value of the same colour. Same nib size as
  Ink 1, ~0.5 mm, so both inks come off a matched-width pen and the only
  variable between them is colour and how much of the sheet they cover.
- **Register ink**: any fine dark pencil or a used-up grey marker —
  the four corner crosses (`artwork.register.svg`) are alignment
  reference only and are not meant to read once the piece is framed;
  they can also be plotted in Ink 2 if a third pen isn't wanted, since
  they're a handful of tiny marks tucked at the very corners.
- **Mounting** — a slim black or dark-walnut frame, no mat, glass with
  an anti-reflective coating if available (a glossy black ground under
  glass throws a lot of glare otherwise). The piece wants to look like
  it's still faintly lit from within, not sit behind a picture-frame
  border.

## Process

1. Register the plotter for one A3 sheet of Colorplan Ebony, landscape,
   15 mm margin. Tape or clip all four corners — black card curls more
   than white stock and a lifted corner will scrub the pen.
2. Load the register pen (pencil or spare marker). Plot
   `artwork.register.svg` — four small corner crosses, 5 mm in from the
   paper edge. These are the only marks placed before anything else;
   every later pass re-registers against them if the sheet has to come
   off the bed and go back on.
3. Load Ink 2 (afterglow, pale ice-blue), ~0.5 mm tip. Plot
   `artwork.ghost.svg`, then `artwork.trail.svg` without swapping pens —
   they're the same ink, just two separate exported layers (the faint
   in-between exposure marks, then the traced glider paths). Let the gel
   ink set for a couple of minutes; it's slower to dry than a fineliner.
4. Swap to Ink 1 (ever-present, warm white), same tip size. Re-register
   against the corner crosses if the sheet moved. Plot
   `artwork.present.svg` — the two island masses and every stranded
   block. This goes down last and sits on top of the blue wherever the
   trail passes near the settled clusters, the same way the piece's own
   logic works: what's still standing is drawn over what already left.
5. Let the full sheet cure flat for at least an hour before framing —
   gel ink stays workable longer than dye-based fineliner ink and will
   smear under glass pressure if rushed.
6. Frame under glass, no mat, in a slim dark frame.

## Plot settings

- Paper: A3 (420 × 297 mm), landscape orientation, 15 mm margin.
- Pen width: 0.5 mm for both ink layers (register crosses can use
  whatever's on hand — they're not part of the finished image).
- Pens: 2 plotted ink layers (`present`, `ghost`+`trail` share one pen)
  plus 1 register pass.
- Resolution: 3 px/mm (CLI default).
- Strokes: 503 (present) + 22 (ghost) + 31 (trail) + 8 (register) = 564
  plotted paths total.

## Reproduction

Built with `packages/core`'s `conway` generator via the CLI — one
R-pentomino, seed 21, run out to generation 190 with a slow 0.94 decay
so the exposure field still shows plenty of history, rendered in the
`contour` style so the final still-lifes trace as landmasses rather than
pixel marks:

```sh
node packages/cli/dist/cli.js conway \
  --style contour --seed 21 --generations 190 --decay 0.94 \
  --paper a3 --orientation landscape --margin-mm 15 --pen-width-mm 0.5 \
  --crosses --cross-offset 5 \
  --split-layers \
  -o artwork.svg
```

This writes `artwork.present.svg`, `artwork.ghost.svg`,
`artwork.trail.svg` and `artwork.register.svg` — all four are
byte-identical to the files in this folder except for stroke colour
(the CLI emits `#000000` for every layer; the committed files have each
layer's physical ink hex baked in by a one-line `sed` substitution:
`present` → `#f2ecdd`, `ghost` and `trail` → `#9fb9cc`, `register` →
`#3a3a3a`).

`preview.png` merges the four recoloured layers into one throwaway SVG
(paint order: ghost, trail, present, register — matching the plot order
in steps 2–4 above) and rasterizes it against the paper colour:

```sh
node scripts/svg-to-png.mjs merged.svg preview.png --width 2000 --background '#0e0d0b'
```

(`merged.svg` is not committed, since the four layer SVGs it merges
already are.)

## Wishes

- Composition depends entirely on where the seeded rule-of-thirds
  placement (`thirdsOrigin` in `sim.ts`) happens to drop the
  pentomino and which of its 8 orientations gets picked — both are
  bundled into the single `--seed` value together with the hand-drawn
  wobble, so finding this layout meant re-rolling the whole seed and
  eyeballing dozens of results rather than nudging placement directly.
  A `--placement-bias <0-1>` (pull the origin toward centre vs. the
  thirds points) separate from the wobble/orientation seed would make
  deliberate composition-hunting faster than seed roulette.
- The simulation can detonate more than one R-pentomino at once
  (`stampPentomino`/`detonate` support a `count`, per the code in
  `sim.ts`), which reads as genuinely different material — multiple
  independent origin points colliding and merging debris fields — but
  there's no `--count` flag on the `conway` CLI command to reach it.
  That felt like the more interesting piece to make next; I stayed with
  a single detonation here because the brief for this run was to ship
  one considered piece, not chase a second concept mid-session.
