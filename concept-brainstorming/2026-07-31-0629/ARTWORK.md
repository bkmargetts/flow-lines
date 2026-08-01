# One Breath

## Artist statement

An *ensō* is the circle Zen calligraphers draw in a single breath and a
single motion of the arm: no retouching, no second pass to close a gap
that didn't close on its own. The gap, when it's there, isn't a mistake
held over from a first draft — there was no first draft. It's just where
the ink ran out, or the arm's arc happened to fall short of the start
point, at the exact moment the breath ended. Zen teaching reads the whole
circle in that: completion that doesn't require closure, an infinite
form made by one finite, unrepeatable act.

This repo's `gesture` generator has a code comment that states the same
idea in a different vocabulary, and it's the reason this piece exists.
The module builds every stroke from one function — a heading integrated
forward with slowly-varying curvature, "an arc that breathes, never
wiggles" — and its own docstring notes: *"a closed sumi enso is the same
function with |κ0|·length approaching 2π — no special case."* There is
no `if (isClosed)` branch, no separate circle-drawing routine held in
reserve for when the arc happens to go all the way around. An open
gesture and a closed one are the same computation with the same number
of moving parts; the circle isn't a special achievement the code reaches
for, it's just what the ordinary arc does when it's long enough. That is,
almost verbatim, the Zen point about the ensō itself — the sacred and
the everyday running on the same machinery — arrived at by someone
tuning a stroke-width function who, as far as I can tell, wasn't trying
to make that argument at all.

The sumi archetype's sweep range (about 200° to 315° of total turn) never
quite reaches a full 2π on its own — which turns out to be correct, not
a shortfall: a genuine ensō almost always keeps a deliberate gap, and
200°–315° is exactly the family of gaps calligraphy manuals call
correct. Getting one specific, well-placed gap took a brute-force seed
search rather than a dial, though: the CLI (and the options object
behind it) expose energy, dryness, ink weight, spatter — but not the
archetype's total-turn range itself, so there's no direct way to ask for
"almost closed, gap at the top." I rendered forty seeds at low
resolution and read them as a contact sheet. Most were rejected fast:
several were honestly beautiful arcs but read as crescents, not
circles — too much gap, the eye doesn't complete them. A few closed so
tight they lost the breath and started to look drafted rather than
thrown. Seed 37 survived because the gap sits exactly where the
brush would lift on a real held breath — upper-left, small, with the
last few dry-brush hairs visibly failing to reach the start point rather
than being cut off mid-stroke — and because the taper at both ends is
unhurried: thin at the opening, most of its ink spent by the base, dense
and confident on the near side where the arm was already moving fastest.
I generated the same seed with its two calligraphic whip-echoes turned
on (the generator's default for `sumi`) and pulled them back out — they
read as a second, lesser gesture competing with the first, which is the
one thing a real ensō practitioner never allows. What's left is one
mark and the paper around it, which is the whole piece.

## Materials

- **Paper** — Awagami Factory Kozo Thick, White, 110gsm, dosa-sized
  (gelatin/alum-sized, the standard washi treatment for ink and pen work
  so a fine nib holds a clean edge instead of feathering into the
  mulberry fibre). Cut to one 300 × 300mm square — a deliberately small,
  square sheet rather than the A3 maximum; an ensō this quiet gets
  smaller, not bigger, and square is the traditional *shikishi* format
  for this kind of single-subject ink work.
- **Ink/pen** — one pen, one width, the whole piece: a Rotring Isograph
  technical pen, 0.45mm nib, loaded with Platinum Carbon Ink (a
  waterproof, lightfast black pigment ink, hex approximation `#0a0a0a`).
  0.45mm is wide enough that the repeated offset passes the generator
  already plots build up into a convincingly brush-like taper without an
  excessive stroke count, and fine enough that the dry-brush breaks near
  the gap stay crisp gaps, not a smeared line.
- **Mounting** — acid-free black-core board, float mount (a few mm of
  reveal on all sides so the square paper appears to hover, edges
  visible, the way a shikishi is traditionally displayed rather than
  matted under a window), a thin blackened-oak frame, UV-filtering
  glazing for the paper's long-term protection.

## Process

1. Build the repo (`pnpm install && pnpm build`) and run the
   reproduction command below to generate `artwork.svg`.
2. Tape the 300×300mm Awagami Kozo Thick sheet to the plotter bed,
   square to the bed's home corner, with enough surrounding waste margin
   for the tape to grip (the plotted image sits inside a 30mm border on
   all sides, so a few mm of taping margin outside the finished square is
   fine, or plot to a larger offcut and trim to the square afterward).
3. Fit the plotter with the 0.45mm Rotring Isograph loaded with Platinum
   Carbon Ink.
4. Plot `artwork.svg` in one unattended pass — single pen, single layer,
   no swaps or registration needed. Total pen-down travel is short
   (see Plot settings), so this is a quick, low-risk single session.
5. Let the ink cure fully before handling — pigment ink on sized washi
   is dry to the touch in minutes but benefits from at least an hour
   before the sheet is moved, to avoid burnishing the densest part of
   the stroke.
6. Trim to the finished 300×300mm square if it was plotted on a larger
   offcut, float-mount on the black-core board, frame, and glaze as
   described above.

## Plot settings

- Paper: custom 300×300mm square, single sheet (well inside the A3
  maximum)
- Margin: 30mm on all sides
- Pen width: 0.45mm
- Render density: 6px/mm (1800×1800 viewBox)
- Estimated pen-down travel: ~7.8m of ink; pen-up travel (after
  `optimizePlot` reordering): ~0.6m — 112 strokes, a short single-session
  plot
- Single pen layer throughout — the generator internally tags strokes
  `gesture`/`spatter`, but both plot in the same ink at the same width,
  so there is nothing to split

## Reproduction

Deterministic from one seed and the exact CLI invocation below (no
scratch script needed — `gesture` has a full CLI):

```sh
pnpm install && pnpm build

node packages/cli/dist/cli.js gesture \
  --paper "300x300" --margin-mm 30 --resolution 6 --pen-width-mm 0.45 \
  --seed 37 --preset sumi --whips 0 --dryness 0.6 --energy 0.55 \
  -o artwork.svg
```

`--dryness 0.6` (default 0.5) and `--energy 0.55` (default 0.6) are
deliberate: slightly drier brush breakup for a more visible fray at the
gap, and a touch less speed for a steadier, more held arc rather than a
flicked one. `--whips 0` removes the archetype's default calligraphic
echo strokes so the sheet carries exactly one gesture.

`preview.png` was rendered with:

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png --width 1800 \
  --background '#f6f1e4' --stroke '#0a0a0a'
```
approximating the Awagami Kozo Thick White sheet under Platinum Carbon
Ink.

## Wishes

- `generateGesture`'s per-archetype composition table (`gestures`,
  `whips`, `knots`, `sweep`, `lengthFrac`, `headings`, …, defined in
  `compose.ts`) isn't exposed through `GestureOptions` at all — a caller
  can pick a named preset but can't nudge its `sweep` range toward a
  near-closed loop or bias where the gap in a `sumi` sweep falls. Finding
  this piece's specific gap position and closure meant rendering and
  eyeballing forty seeds; a `sweepRange` or `gapBias` override (even
  preset-specific) would turn that kind of search into a couple of
  direct calls, the same way `warp-grid`'s per-deformer placement could
  use a `centerBias` (noted as a wish in an earlier session's `LATENT`).
