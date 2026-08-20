# A River That Never Was

## Artist statement

This is a hydrographic survey plate for a river that does not exist.

The repo's `meander` generator is not a decorative squiggle-maker — it
runs an actual bank-erosion simulation (`packages/core/src/meander/sim.ts`):
a channel migrates outward at every bend, its own past centerlines are
kept as snapshots, and loops that pinch their own neck are spliced off as
oxbows. This is the same process Harold Fisk's 1944 Mississippi meander-
belt atlas for the U.S. Army Corps of Engineers made famous — the plates
that hang in geology departments and, increasingly, in living rooms,
because a river's migration history turns out to be beautiful even to
people who couldn't tell you what a meander belt is. What draws me to
this candidate (seed 33, out of a few dozen scanned) is that it commits
completely to that cartographic authority — a confident double-line
"current channel" laid firmly over a dense sepia weave of "former
courses" — in service of a river that was never surveyed, because it was
never there. The rigor is real. The subject is invented. Nothing in the
drawing itself confesses that; only the title does.

I rendered marbled-messier settings first — more traces, more jitter,
tighter valleys — and every one of them looked like a scribble trying to
be a river. This seed, at a lower trace count (11) and a wide, unhurried
valley, is the one where the scroll-bar hatching reads as *texture on a
landform* rather than noise: it fans off each bend in the direction the
water actually would have swept sediment, and it thins out honestly
where the current channel has scoured the record clean. The composition
is a single wide S across the sheet with generous plate margin above and
below — which a first pass reads as empty, until you notice that's
exactly the proportion a real survey plate reserves for its title block,
scale bar, and legend. So that's what the empty paper is for here, too;
it isn't blank, it's reserved.

## Materials

- **Paper** — one A3 sheet (420 × 297 mm), landscape, Hahnemühle
  Nostalgie 190 gsm — a warm ivory, lightly toned cotton-blend stock sold
  specifically for antique/archival-look printmaking. Substitute: Canson
  Mi-Teintes "Ivory" 160 gsm if Nostalgie isn't on hand. Do not use bright
  white paper — the plate's authority depends on looking like it has
  been in a map drawer for decades.
- **Ink 1 — "survey blue"** (register/alignment ink, `artwork.register.svg`):
  a neutral warm grey, `#6b6156`, in a 0.2–0.25 mm fineliner. Any archival
  pigment liner (Sakura Micron 005/01 in warm grey, or a grey Copic
  Multiliner). Meant to read as close to invisible once the piece is
  hung — its only job is alignment.
- **Ink 2 — "former courses"** (`artwork.trace.svg`): a sepia drawing
  ink, `#8a5a2b`. Rohrer & Klingner Scabiosa or Winsor & Newton Sepia
  Ink, loaded in a 0.3 mm technical pen. This is the classic tone of
  foxed paper and old survey documents — the ink of things that are no
  longer current.
- **Ink 3 — "present channel"** (`artwork.channel.svg`): Prussian blue
  drawing ink, `#1a3a5c`. Rohrer & Klingner Berliner Blau (Prussian Blue)
  or an equivalent iron-gall-style blue, same 0.3 mm pen. Prussian blue
  is the historical colour of hydrographic and blueprint drafting for a
  reason — it is the one ink on this sheet that is allowed to look
  official.
- **Lettering ink** — black india ink (Winsor & Newton Calligraphy Ink,
  or any archival black), fine technical pen (0.2–0.25 mm, e.g. a Rotring
  Rapidograph or Micron 005), for the hand-lettered plate furniture in
  step 6 below.
- **Mounting** — a thin dark-wood or black metal frame under glass, wide
  cream mat (at least 40 mm) — the piece wants to read as a document
  taken out of a flat file, not as a poster.

## Process

1. Cut/select one A3 sheet of Nostalgie, landscape, matte side up.
   Register the plotter for a 420 × 297 mm sheet, 12 mm margin.
2. Load the register ink (grey, fine nib). Plot `artwork.register.svg`
   — four small corner crosses. These are the only marks that go down
   before anything else; every later pass and the hand-lettering in step
   6 re-aligns against them.
3. Load Ink 2 ("former courses", sepia), 0.3 mm. Plot `artwork.trace.svg`
   — the scroll-bar hatching. Let dry ~10 minutes.
4. Swap to Ink 3 ("present channel", Prussian blue), 0.3 mm. Re-register
   against the corner crosses. Plot `artwork.channel.svg` — the bold
   double-line course. Plotting this *after* the sepia trace is
   deliberate: where the present channel crosses its own history, the
   blue physically sits on top of the sepia, the same way an active
   river erases the evidence of the ground it used to occupy. Let dry
   fully (20–30 minutes) before handling.
5. (Optional, but recommended) Antiquing wash: mask the plotted area
   with removable tape or a cut paper stencil, then run a very dilute
   cold tea or diluted raw-umber watercolour wash along the outer 15–20
   mm of the sheet only, working from the edges inward and fading to
   nothing. Remove the mask once dry. This deepens the sheet's edges
   without touching the plate itself, the way genuinely handled archival
   paper darkens at the corners and folds.
6. Hand-letter the plate furniture in black india ink, fine pen,
   freehand or with a straightedge and lettering guide, using the
   register crosses to keep the block square to the sheet:
   - **Upper-left, in the clear paper above the river:** the title,
     small caps — `A RIVER THAT NEVER WAS` — and beneath it, smaller,
     `ANCIENT COURSES · MEANDER BELT · PLATE I`.
   - **Lower-left, in the clear paper below the river:** a nominal scale
     bar (`0 ⊢ 5 ⊢ 10 km`, purely fictional — this river was never
     measured) and a small north arrow at an arbitrary bearing.
   - **Lower-right:** a two-line legend — a short blue tick labelled
     `present channel`, a short sepia tick labelled `former courses` —
     and below it, small, `ref. seed 33` in place of a survey reference
     number. The seed is the one true fact on the sheet: unlike a real
     river, this one can be resurveyed exactly, forever, by anyone who
     types that number back in.
7. Frame under glass with the wide mat once fully dry.

## Plot settings

- Paper: A3 (420 × 297 mm), landscape orientation, 12 mm margin.
- Pen width: 0.3 mm for the two ink layers; 0.2–0.25 mm for the register
  crosses (and for the hand-lettering, which is off-plotter).
- Pens: 2 plotted ink layers (`trace`, `channel`) plus 1 register layer.
- Resolution: 3 px/mm (CLI default).
- Strokes: 59 (trace) + 2 (channel, each already a bold 3-pass offset
  line under the hood) + 8 (register crosses) = 69 plotted paths total.
  This is a light, fast plot — the piece's strength is restraint, not
  density.

## Reproduction

Built with `packages/core`'s `meander` generator via the CLI, seed 33,
`atlas` preset with a wide, low-migration valley:

```sh
node packages/cli/dist/cli.js meander \
  --preset atlas --iterations 2400 --migration 0.5 --bend-scale 0.28 \
  --valley-width 1.05 --traces 11 --fade 0.35 --jitter 0.08 --flow-lines 0 \
  --bold-passes 3 --taper 0.4 --channel-width 12 --seed 33 \
  --paper a3 --orientation landscape --margin-mm 12 --pen-width-mm 0.3 \
  --crosses --cross-offset 4 \
  --split-layers \
  -o artwork.svg
```

This writes `artwork.channel.svg`, `artwork.trace.svg` and
`artwork.register.svg` — all three are byte-identical to the files in
this folder except for stroke colour (the CLI emits `#000000` for every
layer; the committed files have each layer's physical ink hex baked in
by a one-line `sed` substitution: `channel` → `#1a3a5c`, `trace` →
`#8a5a2b`, `register` → `#6b6156`).

`preview.png` is the three recoloured layers merged into one throwaway
SVG (paint order: trace, then channel, then register — matching the plot
order in step 2–4 above) and rasterized:

```sh
node scripts/svg-to-png.mjs merged.svg preview.png --width 2000 --background '#f5ecd8'
```

(`merged.svg` is not committed, since the three layer SVGs it merges
already are.)

## Wishes

- The simulation supports oxbow lakes (`sim.ts`'s `cutOffLoops`), but I
  could not get one to trigger through the CLI's exposed knobs
  (`--migration`, `--bend-scale`, `--valley-width`, `--channel-width`)
  across a wide sweep of seeds and settings within a single studio
  session — the neck-pinch threshold (`channelWidth * 1.35`) seems to
  need a tighter, more self-crossing valley than the current preset
  ranges comfortably reach on an A3 sheet. A direct `--oxbow-*` tuning
  knob (or a preset biased toward frequent cutoffs) would make the third
  layer (`oxbow`) — genuinely the most iconic mark on a real Fisk plate —
  reachable without editing generator code.
- No other gaps: `meander` + `atlas` + a hand-picked seed and a two-ink
  recolour did everything this piece needed.
