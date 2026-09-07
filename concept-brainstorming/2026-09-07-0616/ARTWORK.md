# Loose Coupling

## Artist statement

`machine` is this studio's least-used generator — thirty-five prior
sessions, never once touched — and the reason is probably that its
whole subject, "meshing gear trains, belts, ropes and weights," reads as
pure decoration: steampunk wallpaper, complexity for its own sake. What
changed my mind was one parameter buried in its option list,
`connectivity`, whose help text states its two poles plainly: *"1: one
interconnected mega-machine; 0: a wall of overlapping mechanisms."* That
is not a cosmetic slider. Reading `network.ts`, it is the literal on/off
switch for the belts and linkage rods that tie separate gear clusters
into a single transmission — at `connectivity` above ~0.75 the code adds
extra long chords between distant clusters specifically so the thing
reads as *one* machine; at 0 it draws no cross-links at all, and the
clusters are packed independently, each meshing only with itself.

*Loose coupling* is the mechanical term for a shaft joint deliberately
built with play in it, and it is also, unchanged, the software-design
term for a system whose parts don't depend tightly on one another. Both
readings of the phrase describe the same virtue: components that can be
swapped, removed, or left idle without dragging the rest of the system
down with them. I wanted a piece that held the phrase's two lives side
by side the way `connectivity` already does the mechanical work of
switching between them — a matched pair, same seed, same every other
knob, one hard cut between "this is a machine" and "this is a shelf of
parts that happen to be near each other."

What sold it was seed 66. At `connectivity: 1` the layout packs edge to
edge — the frame timbers, the register lines to the margin, three
distant hubs stitched together by two crossing drive belts that read,
at a glance, as power visibly moving across the whole sheet. At
`connectivity: 0`, with the identical seed and identical cluster sizes,
the composition doesn't even fill the page: the clusters settle into
the lower two-thirds and the top third is bare paper, because nothing
requires them to spread out to meet a partner they'll never be
introduced to. I didn't ask for that empty margin — it's what "nothing
here needs anything else" looks like when the packing algorithm has no
reason to reach for the top of the sheet. I dropped the hidden-line
shading and section cutaways on that second panel too: a working
assembly earns a cutaway because there's something underneath worth
proving; a shelf of unconnected parts has nothing to section.

## Materials

- **Paper** — two sheets of A4 (210×297mm) cream/ivory hot-press
  illustration board or heavyweight cartridge (e.g. Stonehenge Cream,
  250gsm, or any smooth hot-press stock that won't feather a fineliner).
  Same stock for both sheets — the piece is a controlled pair, so the
  paper must not be a variable.
- **Ink/pen** — one pen throughout, both sheets: a black pigment
  fineliner, 0.3mm tip (e.g. Sakura Pigma Micron 03, or Staedtler
  pigment liner 0.3, hex `#1a1a1a` as plotted — a true black reads
  slightly warm off cream stock, which is the intended effect; no
  colour mixing required).
- **Mount** — a single mat/frame (or two matched frames hung with a
  narrow gutter between) presenting the sheets as a horizontal diptych,
  fig. 1 (coupled) on the left, fig. 2 (decoupled) on the right — the
  reading order of the statement. A small printed or hand-lettered
  title card in the mat window (title + the two `connectivity` values)
  stands in for on-sheet captions; nothing is lettered on the plotted
  sheets themselves, keeping both drawings pure technical plates.

## Process

1. Plot `loose-coupling-fig1-coupled.svg` on sheet one at 0.3mm pen
   width, black ink, no colour changes.
2. Plot `loose-coupling-fig2-decoupled.svg` on sheet two, same pen,
   same ink, same settings — the only permitted difference between the
   two plots is which file is loaded.
3. Let both sheets dry fully (pigment liner sets in seconds, but give
   it a few minutes before handling to avoid smudging the dense
   hatching in fig. 1).
4. Mat and mount side by side as a diptych, fig. 1 left / fig. 2 right,
   with a narrow (10-15mm) gutter between mats so the two sheets read
   as a pair, not one continuous drawing.
5. Add the title card in the mat window: "Loose Coupling — fig. 1,
   connectivity 1.0 / fig. 2, connectivity 0.0."

No wash, no colour pass, no hand-inking — the entire piece is the two
plotted sheets as they come off the plotter. The restraint is the
point: the only thing allowed to differ between the panels is the one
parameter the piece is about.

## Plot settings

- Paper: A4, portrait, both sheets.
- Margin: 12mm.
- Pen width: 0.3mm.
- Render resolution: 3 px/mm (affects internal geometry scale — see
  reproduction commands; do not change without re-rendering both
  panels).
- Stroke colour: `#1a1a1a` (generator default).
- Fig. 1 (`coupled`): 4,078 lines generated.
- Fig. 2 (`decoupled`): 1,772 lines generated — well under half the
  line count of fig. 1, from the same seed and cluster count, purely
  because the missing transmission network and the dropped
  hidden-line/cutaway detailing draw far less ink. Expect noticeably
  shorter plot time and lighter pen wear on fig. 2.

## Reproduction

Both panels come from `flow-lines machine`, same seed and cluster
parameters, differing only in `--connectivity` and in the
documentation detail (`--cutaways`, hidden lines, `--shading`) that
only makes sense on a system meant to run:

```sh
# Fig. 1 — Coupled (one interconnected mega-machine)
node packages/cli/dist/cli.js machine \
  --paper a4 --orientation portrait --margin-mm 12 --pen-width-mm 0.3 --resolution 3 \
  --seed 66 --complexity 0.85 --connectivity 1.0 --mechanisms 0.8 --frame-density 0.7 \
  --cutaways 2 --shading 0.6 \
  -o loose-coupling-fig1-coupled.svg

# Fig. 2 — Decoupled (a wall of overlapping mechanisms)
node packages/cli/dist/cli.js machine \
  --paper a4 --orientation portrait --margin-mm 12 --pen-width-mm 0.3 --resolution 3 \
  --seed 66 --complexity 0.85 --connectivity 0.0 --mechanisms 0.8 --frame-density 0.7 \
  --cutaways 0 --no-hidden-lines --shading 0.15 \
  -o loose-coupling-fig2-decoupled.svg
```

`preview.png` was rendered by merging both SVGs side by side (a small
scratch script, not committed — it just concatenates the two `<svg>`
bodies into one wider canvas with a 12% gutter) and rasterizing with:

```sh
node scripts/svg-to-png.mjs diptych-merged.svg preview.png \
  --width 2200 --background '#f6f1e4' --stroke '#171310'
```

`--background`/`--stroke` there only recolour the *preview raster* to
approximate cream paper and pigment ink under screen light — the
committed SVGs themselves are plain black-on-white plotter output, as
plotted.

## Wishes

- No layer or annotation metadata comes back from `machine` about
  *which* clusters the transmission network actually links — I could
  only tell that fig. 1's belts crossed the whole sheet by eye. A
  `--split-layers` mode that put the network chords on their own pen
  layer would let a piece like this ink the "power path" in a second
  colour without hand-tracing it.
- `connectivity` has no documented value between "wall" and "mega-
  machine" that guarantees exactly *two* disconnected sub-networks
  (say, a piece about two machines that used to be one) — right now
  it's continuous and probabilistic, which was fine here but would need
  seed-hunting for that more specific idea.
