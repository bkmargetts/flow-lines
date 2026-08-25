# Talus

## Artist statement

There is no mountain in this drawing's algorithm. There is a uniformly
random tiling of an Aztec diamond by dominoes, sampled by domino
shuffling (Elkies–Kuperberg–Larsen–Propp, 1992) — a procedure with no
geometry in it at all, just annihilate-slide-refill, a coin flip per
vacated 2×2 block, repeated until the diamond is full. What that
procedure produces, provably, is the arctic circle theorem (Jockusch–
Propp–Shor, 1998): as the diamond grows, its four corners freeze solid
into perfect brick coursing, and the disorder that's left gets pushed
into a disc, inscribed in the diamond, with a boundary that becomes
razor-sharp in the limit. Nobody told the sampler to draw a circle. It
falls out of the combinatorics whether you ask for it or not.

This repo's `arctic` generator (new — its own CLI command doesn't exist
yet, so this ran from a scratch script against the built core package)
inks that theorem directly: pick one of the four domino classes, draw
only its dominoes as spines, and weld the ones that touch end to end.
In a frozen corner belonging to the inked class, every domino agrees on
direction, so the spines weld into unbroken parallel rules — solid tone,
no shading trick, just long-range order made visible. Inside the
disordered disc, dominoes of all four classes turn up at random, so an
inked one almost never has an inked neighbour to weld with, and the mark
degrades to short isolated dashes. In the other three corners — equally
frozen, equally orderly, just the wrong class — nothing is inked at all.
Paper.

What I did not expect, scanning close to thirty seeds at order 190
before this one, is how completely that description reads as a mountain
without me doing anything to make it one: a solid dark mass at the peak,
a jagged, entirely un-smoothed ridge line where the weld starts failing,
and a long scattered talus slope below it thinning to nothing at the
foot. Seed 17 earns the keep over the others I pulled because its ridge
refuses to be one clean silhouette — it breaks into two competing high
points with a shallow saddle between them, the kind of skyline a single
tidy Bézier curve never produces on its own, and the kind that reads,
correctly, as geology rather than as a rendering. Below it the scatter
thins with a slight bias to the left, so the whole shape leans instead
of sitting dead-centre and static.

I looked for a way to add weight to the summit mass and stopped myself.
The generator's own source comment rules it out on purpose: everywhere
else in this repo, bold linework comes from repeated offset passes of
the same pen, but doing that here would thread new strokes through a
mass that is *already solid* — solid because the tiling truly froze, not
because it needed help reading dark. Any extra pass would flatten the
one thing the theorem actually produced. So this plate is one pen, one
width, one pass, everywhere, and the peak is exactly as dark as ten
thousand welded dominoes agreeing with each other make it — nothing
more.

Talus is loose rock that has already let go of the face above it and
found the angle at which it will stay put. That is a fair description of
what this drawing is made of: a shattering, cell by cell, of one frozen
order into scattered agreement-with-nobody, governed by a boundary that
is exact, provable, and entirely indifferent to the picture it happens
to leave behind.

## Materials

- **Paper** — one A3 sheet (297 × 420 mm), portrait, Canson Mi-Teintes
  160 gsm in **Steel Grey** (335) — a cool, lightly toothed mid-grey with
  a blue undertone, used smooth-side up so a 0.3 mm nib stays crisp
  through the densest welded courses at the summit. Substitute: any
  smooth-finish 160–200 gsm printmaking/pastel stock in a comparable
  cool mid-grey (e.g. Hahnemühle British Coldpress "Grey", Strathmore
  400 Toned Grey).
- **Ink/pen** — one pen only: Faber-Castell PITT Artist Pen, **Indigo**
  (colour 247), pigment ink, 0.3 mm nib — hex **#26314A** for preview/
  reference. Archival, waterproof once dry, plotter-compatible
  (technical fineliner body). No second ink, no wash — see the statement
  above for why: this piece's whole point is that its darkest passage
  earns its weight from density alone.
- **Nothing else.** No wash, no mask, no second pass, no mounting media
  beyond a standard frame (see Process, step 4).

## Process

1. Build the repo (`pnpm install && pnpm build`) and run the
   reproduction script below to generate `talus.svg`.
2. Register one A3 sheet of Canson Mi-Teintes "Steel Grey" (smooth side
   up) on the plotter bed.
3. Load the single 0.3 mm Faber-Castell PITT Indigo pen. Plot
   `talus.svg` once, at the pen width above. There is only one pen and
   one pass across the whole sheet — no layer changes, no repeat offset
   passes, no registration to manage.
4. Optional, by hand, after the ink is fully dry (pigment ink, ~10–15
   min): in pencil, in the blank paper at the lower-left corner, letter
   a small specimen label — `AD(190) · seed 17 · dissolve/N` — in a
   light, small hand. This is the one deliberately hand-worked step: a
   plate label, not a correction, kept small enough to read as
   documentation rather than decoration.
5. Mount: float-mount on acid-free board in a deep-set (shadow-gap)
   frame, with enough gap between paper and glass that the sheet reads
   as an object rather than a print flattened under glass. A plain
   archival mat with a generous window is an equally correct, simpler
   alternative.

## Plot settings

- Paper: A3 (297 × 420 mm), portrait orientation, 20 mm margin.
- Pen: 1, Faber-Castell PITT Indigo, 0.3 mm nib, single pass throughout
  (no bold-emphasis passes — see statement).
- Resolution: 3 px/mm (repo default), rendered at true page size
  (891 × 1260 px) so the SVG's physical dimensions match the sheet
  exactly.
- Diamond order: 190 (AD(190) holds 190×191 = 36,290 dominoes; only the
  `N` class is inked).
- Hand-drawn wobble: 0.35 px amplitude (generator default) — the small
  per-stroke waver that keeps every line honestly hand-plotted rather
  than ruler-straight.
- Strokes: 4,233 plotted paths (single layer, single pen). A light,
  fast plot for its visual density — welding collapses most of the
  frozen corner into long unbroken rules well before the SVG is written.

## Reproduction

There is no `arctic` CLI command yet (see Wishes), so this ran as a
scratch script against the built core package — byte-identical every
time, same as any CLI invocation, because `generateArctic` takes only
its documented options and an explicit seed.

```sh
pnpm install && pnpm build   # builds packages/core/dist/index.js
node - <<'EOF'
const { generateArctic, toSVG } = await import(
  '/home/user/flow-lines/packages/core/dist/index.js'
);
const fs = await import('node:fs');

const res = generateArctic({
  width: 891,          // 297mm @ 3px/mm
  height: 1260,         // 420mm @ 3px/mm
  margin: 60,           // 20mm @ 3px/mm
  seed: 17,
  order: 190,
  preset: 'dissolve',   // marks: 'one' (domino class N only), upright: false
});

fs.writeFileSync(
  'talus.svg',
  toSVG(res, {
    optimizePaths: true,
    strokeColor: '#26314A',
    strokeWidth: 1,
    physicalWidth: '297mm',
    physicalHeight: '420mm',
  })
);
console.log(res.lines.length, 'strokes, seed', res.seed);
EOF
```

Preview PNG (recoloured to approximate the Steel Grey paper / Indigo ink
pairing):

```sh
node scripts/svg-to-png.mjs talus.svg preview.png \
  --width 1600 --background '#A9AFB8' --stroke '#26314A'
```

## Wishes

- A `flow-lines arctic` CLI command — right now this generator can only
  be driven from a scratch script against the built core package, which
  is a higher bar than every other generator in the toolbox table.
- Public access to a single custom `marks` class list (the public
  `ArcticOptions.marks` only accepts the four named presets; `'one'`
  is hard-wired to class `N`). A second plate inked on class `S` instead
  — the same seed, the same tiling, the mountain's exact mirror twin
  frozen at the diamond's other pole — would make a genuinely interesting
  diptych, and right now there's no supported way to ask for it without
  reaching past the public API.
