# Septa

## Artist statement

The tangles generator (`packages/core/src/tangles`) was built for one
job: corrugated vent hose and flat shoelace, worming across a page and
weaving over and under each other with real hidden-line removal. Every
seed I scouted read as *plumbing* — ducts behind a wall, cable slack in
a machine room. Seed 92, at a large radius and high wander, does
something the generator's own doc comment never claims for it: two of
the five strands each pull their whole length into a tight logarithmic
coil, corrugation rings stepping down toward the centre exactly the way
growth striations step down toward the tip of a shell. The open cuff
mouths — meant to read as a duct's cut end — sit right where an
ammonite's body chamber would open, and at this scale they read as
chambers, not pipe.

That's the piece: two coiled hose-masses that insist on being fossils,
built by a generator that has never seen a mollusc and doesn't know it
convinced me. Real ammonite septa — the internal walls that divide the
shell into chambers — are famous for being more complex than they need
to be; nobody has fully settled why a wall that only has to hold back
water pressure evolved into an intricately fluted suture line. A
corrugated hose's ring pitch is the reverse problem solved for the
reverse reason — flexibility, not strength — and landing on the same
silhouette from the opposite engineering brief is the coincidence I
wanted to keep. A diagonal duct crosses low between the two coils,
holding them together as one specimen instead of two studies side by
side, and the fourth strand hooks off the upper right in a stray loop —
the one moment the piece admits it's still a tangle of hose and not
a cabinet drawer.

Of the two dozen seeds scouted (materials hose and lace, radius 8–32mm,
wander 0.5–0.9, count 4–7), most either filled the sheet edge-to-edge
with no read at all or scattered into loose parallel runs with no
knot to anchor the eye. Seed 92 was the only one that produced *two*
legible coiled masses with breathing room between and around them
rather than one dense central knot (seed 2, also strong, filled the
frame corner to corner and lost the paper). A light hand-sketch pass
(0.15, `fine` style) was added last, purely for the faint double-line
overdraw at path ends — it reads as a confident, slightly re-inked
line rather than a plotted curve, without disturbing the geometry that
made the composition work.

## Materials

- **Paper**: Canson Mi-Teintes, colourway *Ardoise* (slate blue-grey),
  160gsm, A3 (297×420mm) — the textured (rougher) face up. Hex
  approximation for the preview: `#5f6670`. A cool, stony ground reads
  as rock matrix rather than a page.
- **Ink/pen**: one pen, one width, the entire sheet — a Rotring
  Isograph 0.3mm technical pen loaded with De Atramentis Document Ink,
  colour *Document Brown* (pigmented, waterproof, lightfast, refillable
  into technical pens). It sits between rust and burnt sienna — an
  iron-oxide colour, the stain real ammonite fossils pick up from the
  ferrous minerals in the rock they're preserved in. Hex approximation
  for the preview: `#c2703f`.
- Archival photo corners (4) and a black museum board backing for the
  mount; a 2H graphite pencil for the hand-lettered label.

## Process

1. Generate `artwork.svg` with the command below (single pen layer,
   already pen-travel-optimised — see Plot settings).
2. Tape the Ardoise sheet to the plotter bed, textured face up. Load the
   Isograph loaded with Document Brown ink at 0.3mm.
3. Plot `artwork.svg` in one uninterrupted pass — no pen swap, no
   re-registration.
4. Let the sheet sit flat, untouched, for 10 minutes (Document Ink
   dries fast but the pen lays down enough volume at the crossings'
   contact-shadow hatching to want a real cure before handling).
5. **Deckle the two long edges by hand**: score lightly with a bone
   folder against a steel ruler a few mm in from the plotted margin,
   then tear toward you for a soft, irregular fibre edge. Leave the top
   and bottom edges clean-cut. The torn edges read as a sample removed
   from a larger bed of matrix, not a manufactured rectangle.
6. Float-mount on a black museum board cut ~30mm larger than the sheet
   on all sides, held at the four corners with archival photo corners
   so the torn slate edges sit visibly above the black ground.
7. **Optional, hands-on finish**: in 2H graphite, hand-letter a small
   specimen caption directly on the black board beneath the float —
   small capitals, e.g. `SEPTA — DUCTUS SP. NOV.` — in the manner of a
   cabinet-of-curiosities specimen label. Freehand; no two need match.
8. Frame deep-set (enough clearance for the float) behind UV-filtering
   glazing, or leave unframed as a specimen board.

## Plot settings

- Paper: A3 (297×420mm), portrait, 15mm margin (extra room for the
  hand-deckled edge and float mount beyond the plotted margin).
- Pen width: 0.3mm.
- Render density: 3 px/mm (891×1260px canvas).
- Seed: 92. 7 strands after the sheet-area scale-up from the requested
  count of 5 (A3 is larger than the generator's A4 reference, so strand
  count scales with sheet area — see `packages/cli/src/commands/tangles.ts`).
  387 strokes; `optimize` (default on) already chains and reorders them
  for minimal pen-up travel — no further tuning needed.

## Reproduction

Built with `@flow-lines/cli` (`pnpm install && pnpm build` at the repo
root first):

```sh
node packages/cli/dist/cli.js tangles \
  --paper a3 --orientation portrait --margin-mm 15 --pen-width-mm 0.3 --resolution 3 \
  --material hose --count 5 --radius-min-mm 12 --radius-max-mm 30 --wander 0.75 \
  --shading 0.6 --shadow-hatch 0.7 \
  --hand-sketch 0.15 --hand-sketch-style fine \
  --seed 92 \
  -o artwork.svg
```

`preview.png` approximates the slate paper and rust ink:

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png \
  --width 1600 --background '#5f6670' --stroke '#c2703f'
```

## Wishes

- `TanglesOptions` has no direct control over where the composition's
  "knots" land — the two coiled masses in this piece are a lucky seed,
  not a request. A bias toward closed, tight-curvature loops on a
  fraction of strands (rather than uniform `wander` across all of them)
  would make "give me N coiled masses and M drifting strands" a
  deliberate ask instead of a scouting search.
