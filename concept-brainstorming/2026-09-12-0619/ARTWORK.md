# The Fourteenth View

## Artist statement

Hiroshige and Hokusai both built whole careers on the same device: a named,
real, findable place, caught at one decisive light — the moon over a
specific bridge, on a specific night. Some of the strongest sheets in that
tradition are printed in nothing but Prussian blue, the imported pigment
that hit Edo-period Japan in the 1820s and got its own name, *aizuri-e* —
"blue-printed pictures" — because it was new enough, and cheap enough
next to the old mineral colours, to justify a whole print in one ink. It's
the ink of choice for exactly this subject: still water at night.

This repo's `landscape` command has been sitting untouched since the first
commit of this studio, forty-odd sessions ago — everyone reaching for
procedural scenery has gone through the photo-based `image` pipeline or a
core generator run from a scratch script instead. Its `alpine-lake` preset
already does almost everything this piece needed on its own: a moon (the
generator calls it a sun, but nothing stops you parking it above the
horizon with a hard, cold radius) held as a clean circular reserve against
a wall of ruled vertical sky-hatch — the vertical-line sky is a real
convention out of 19th-century steel engraving, not a computer artefact —
jagged receding ridges, and a mirror-flat lake that carries the moon's
glint straight down the middle in broken dashes. What the preset didn't
hand me was the composition: two dozen seeds later, seed 14 was the one
where the moon's disc and the tallest peak on the right shoulder of the
ridge line landed as a genuine visual rhyme — two circles, one bitten out
of the sky, one drawn in silhouette — instead of just sitting side by side.
That's the detail the other seeds didn't have, and it's the reason this
one survived the cull over compositions with cleaner water or a bigger
moon.

There is no lake behind this. Nobody photographed it, no drone flew it, no
place-name attaches to it — it's a `landscape` render at seed 14 with a
hand-placed moon, which is either the opposite of Hiroshige's whole
method or its logical endpoint: a *meisho* (famous-place print) for a
place that provably isn't anywhere, numbered instead of named, the same
way this studio's seeds already work as a private numbering system for
things that never repeat by accident and never change once they're fixed.
Plot it again next year, in another country, on different paper, and the
same moon sits over the same water in the same place — the one thing a
real nocturne, painted from a real night, could never promise.

## Materials

- **Paper:** Awagami Factory *Kozo Thick* (110gsm), a handmade
  Japanese mulberry-fibre washi, natural white, trimmed to one A3 sheet
  (297 × 420mm), portrait. Washi is the correct paper family for the
  reference this piece is making, not just a texture choice — its long
  kozo fibres give a soft, slightly irregular line edge under a fine
  technical nib that a hot-press western stock won't, and it takes a
  hand-pressed ink stamp (see below) without feathering the way a
  cheaper absorbent paper would.
- **Ink/pen:** one pen, one width, the entire sheet — Faber-Castell PITT
  Artist Pen, Indigo (colour 247), fine (F) nib, ≈0.3mm line — India ink
  pigment, lightfast and waterproof once dry. Indigo rather than a
  literal Prussian-blue bottled ink because it's available pre-filled in
  a plotter-compatible fine felt tip at exactly this line weight, and the
  hue sits close enough to true Prussian blue (Faber-Castell's own colour
  chart places 247 in the same blue-black family aizuri-e used) that the
  reference reads without needing a refillable pen and loose ink.
- **Seal:** a small round hanko-style stamp, ~10mm diameter, in vermilion
  (shuniku) ink — any plain artist's chop the owner already owns, or a
  blank uncarved marker of a "corner mark" if none is on hand. Pressed by
  hand, not plotted; see Process.
- **Other:** a soft graphite pencil (2B) for the hand-lettered caption.
  Removable artist's tape for registration during plotting.

## Process

1. Tape the washi sheet flat to the plotter bed. Kozo paper has some
   give; tape all four edges, not just two, so the sheet can't creep
   during the ~35–45 minute plot.
2. Load the Faber-Castell PITT Indigo (F nib) as the single pen.
3. Plot `artwork.svg` once, at the pen width baked into the file
   (0.3mm). This is a single-pen, single-pass piece — there is no second
   plot, no registration pass, no colour separation. The file is already
   pen-travel-optimised (`optimizePlot`, on by default), so there is one
   continuous drawing pass per contiguous line group; expect on the
   order of 3,800 line segments chained down to a few hundred pen lifts.
4. Let the ink cure fully (Faber-Castell PITT India ink dries fast, but
   give it a genuine 15–20 minutes before touching the sheet — washi
   holds surface ink a little longer than hot-press cotton).
5. In the bottom-right corner of the paper margin (inside the 15mm clear
   border the plot already reserves, not on the drawn image), hand-press
   the vermilion seal once. This is the piece's one non-plotted mark —
   the equivalent of a publisher's chop on a woodblock sheet — and it is
   what turns "a render" into "a numbered view."
6. In pencil, in the bottom-left margin, letter by hand: *The Fourteenth
   View* / *seed 14* / *unique impression*. Small, quiet, no more than
   two lines of lowercase — a printmaker's edition note, not a title
   card competing with the image.
7. Float-mount on acid-free museum board (washi's deckle-adjacent trimmed
   edge is worth showing, not covering with a window mat), simple dark
   walnut or black timber frame, UV-filtering glazing.

## Plot settings

- Paper: A3 (297 × 420mm), portrait.
- Margin: 15mm clear border.
- Pen width: 0.3mm (single pen, single pass).
- Resolution: 3 px/mm (the tool's default internal sampling density).
- Estimated line count: 3,825 strokes pre-optimisation; pen-travel
  ordering is on by default (`optimizePlot`), so physical pen-up travel
  is a small fraction of the ~15–20m of drawn line implied by that count.

## Reproduction

Built and run from a clean `pnpm install && pnpm build` at the repo root.
Single command, single seed, produces `artwork.svg` byte-for-byte:

```sh
node packages/cli/dist/cli.js landscape \
  --scene alpine-lake --seed 14 \
  --paper a3 --orientation portrait --margin-mm 15 --pen-width-mm 0.3 \
  --sun-x 339 --sun-y 265 --sun-radius 80 --sun-halo 1.0 \
  --clouds 0.1 --atmosphere 0.6 --rocks 0.0015 --trees 3 --focus-x 339 \
  --sketch 0.18 --sketch-style fine \
  -o artwork.svg
```

Verified deterministic: two independent runs of this exact command
produce identical output (`sha256sum` match).

`preview.png` approximates the paper/ink pairing above (warm white ground,
indigo line) via:

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png \
  --width 1600 --background '#f6f0e2' --stroke '#1c3f6e'
```

Note: `alpine-lake`'s scene preset sets its own internal palette
(`cyanotype`, a family of four related blues used to separate sky/ridge/
water/foreground tonally in an on-screen preview) regardless of the
CLI's `--palette` flag — passing `--palette` has no effect on this scene
and was left out of the command above. That per-element colour variation
in the raw SVG is preview-only bookkeeping; nothing about single-pen
plotting cares what hex a path's `stroke` attribute carries, so the
physical piece is genuinely monochrome indigo regardless.

## Wishes

- `landscape --scene alpine-lake` (and presumably every scene) hard-codes
  its own `palette` in `LANDSCAPE_SCENES`, which silently wins over an
  explicit `--palette` flag with no warning printed. A CLI note ("scene
  overrides --palette; pass --scene custom to opt out") would have saved
  a few confused renders where a palette flag appeared to do nothing.
- There's no direct way to ask for "moon, not sun" — `--moon-rim` only
  changes the disc to a crescent rim, and the actual celestial body is
  still internally `sun` end to end (options named `sunX`/`sunHalo`/
  etc.). A `--night` flag that just relabels intent (and maybe nudges
  the default sky tone darker) would be a small but genuine ergonomics
  win for exactly this use.
