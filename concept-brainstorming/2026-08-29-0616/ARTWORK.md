# The Arctic Circle

## Artist statement

`arctic` is the one generator in this repository that nobody has drawn
from yet. It doesn't simulate anything — it samples a domino tiling of
the Aztec diamond AD(n) *exactly* uniformly, by domino shuffling
(Elkies–Kuperberg–Larsen–Propp): no Markov chain, no burn-in, no mixing
time to worry about, just a closed combinatorial procedure that either
runs or doesn't. What makes that worth looking at rather than just
correct is the arctic circle theorem (Jockusch–Propp–Shor, 1998): as
the diamond grows, its four corners freeze solid into brick-regular
tiling while a disc inscribed inside it stays disordered, and the
boundary between frozen and liquid sharpens to a perfect circle.
Nothing in the code draws a circle. The circle is a fact about random
tilings that happens to be true, and this piece is what that fact looks
like on paper.

I chose the `horizon` reading over the others I tried (a single-pole
dissolve, a four-direction basket-weave) because inking just the two
horizontal domino classes turns the theorem into a shape that reads
immediately, before anyone knows what a domino shuffle is: two solid
poles, top and bottom, and a mottled globe caught between them, held
inside a lens. It looks like a plate from an astronomy text or a cut
mineral specimen. It is neither — it's a frequency count.

The name is the pun I couldn't pass up and don't think I need to
apologize for: the *arctic circle* in this theorem's name is a witty
mathematician's borrowing from cartography (a sharp line, frozen on one
side, open on the other), and inking it in a permanent registrar's ink
— the kind used historically for entries that are not allowed to be
argued with later — pushes on the theorem's other defining property:
this exact same seed produces this exact same tiling forever, on any
machine, with no approximation anywhere in the pipeline. It's a
combinatorial fact, notarized.

What I'm drawn to in the final print is the inversion nobody asked for:
the "frozen" zones are the dense, dark, confident masses, and the
"liquid" zone — the one that's actually in motion, mathematically
speaking — is the paler, broken, more delicate texture in the middle.
Ice is supposed to be the white part. Here the order is the ink and the
disorder is the light. I like that it argues with the metaphor it's
named after instead of just illustrating it.

## Materials

- **Paper** — Fabriano Artistico, Extra White, Hot Press, 300gsm.
  Trimmed to a 260 × 260mm square. Keep the sheet's natural deckle edge
  on the bottom side only; trim the other three edges straight. The
  one raw, un-engineered edge is a deliberate foil to the perfectly
  circular mathematical boundary sitting a few centimetres above it —
  hex reference for the preview background: `#fdfbf5`.
- **Ink — Diamine Registrar's Ink.** A genuine UK registrar's-office
  ink: permanent, waterproof once cured, historically specified for
  entries in official ledgers precisely because it can't be lifted or
  argued with afterward — the material equivalent of "exactly
  reproducible per seed." Deep blue-black, cooler than a true black.
  Hex reference for the preview: `#152238`. Loaded in a single
  technical pen (e.g. a Rotring Isograph 0.30mm); hex is the source of
  truth, any drawing ink close to it works.
- One pen, one width, one pass. No wash, no second colour, no mount
  board specified beyond the optional float-mount below.

## Process

1. Cut/trim the Artistico sheet to 260 × 260mm, keeping the mill's
   deckle edge on the bottom side and trimming the other three edges
   straight and square.
2. Load a technical pen (0.30mm nib) with Diamine Registrar's Ink; run
   a few priming strokes on scrap paper until the line is solid and
   even.
3. Tape the sheet to the plotter bed along the three trimmed edges
   only, leaving the deckle edge unrestrained so it isn't crushed under
   tape.
4. Plot `arctic-circle.svg` once, at native scale (the SVG already
   carries `260mm × 260mm` physical dimensions with a 20mm margin baked
   into the drawing itself — no additional plotter-side margin is
   needed).
5. Leave the sheet flat and undisturbed for at least 30 minutes so the
   ink cures fully before handling; Registrar's ink is formulated to
   set slowly.
6. Optional presentation: float-mount on cool mid-grey conservation
   board so the paper's edges (deckle included) sit visibly proud of
   the window, in a narrow black-anodised aluminium frame with
   non-reflective glass. No mat board — the deckle edge is the frame's
   only ornament.

## Plot settings

- Sheet: 260 × 260mm square (custom, well under the A3 ceiling) — no
  tiling required.
- Margin: 20mm on all four sides, baked into the drawing geometry.
- Pen: single 0.30mm technical pen, single ink, single pass.
- Content: 3,991 strokes (welded domino spines for the N/S classes;
  short broken dashes inside the arctic circle, long welded rules in
  the two frozen poles). Reordered for minimal pen-up travel via the
  generator's own `orderPlot` step — deliberately *not* chained end to
  end, since fusing separate dominoes into one path would round-cap the
  joins and soften the crisp lattice geometry the drawing depends on.
- Seed: `1` (exactly reproducible — no burn-in, no approximation).

## Reproduction

There is no CLI command for `arctic` yet (see Wishes) — it's driven
directly from the built core package, the same pattern as
`scripts/city-gallery.mjs`:

```js
// node run-arctic.mjs   (after `pnpm --filter @flow-lines/core build`)
import { writeFileSync } from 'node:fs';
const { generateArctic, toSVG } = await import(
  '/home/user/flow-lines/packages/core/dist/index.js'
);

const PX_PER_MM = 3;
const SIDE_MM = 260;
const MARGIN_MM = 20;
const PEN_MM = 0.3;

const W = Math.round(SIDE_MM * PX_PER_MM); // 780
const H = W;
const margin = Math.round(MARGIN_MM * PX_PER_MM); // 60
const strokeWidth = PEN_MM * PX_PER_MM; // 0.9

const res = generateArctic({
  width: W,
  height: H,
  margin,
  preset: 'horizon', // inks only the N/S domino classes
  order: 130,        // AD(130): fine enough for a 260mm sheet, coarse
                      // enough to stay above a 0.3mm nib (the doc note
                      // in arctic/index.ts caps ~200 at full A3)
  seed: 1,
});

const svg = toSVG(res, {
  optimize: true,
  strokeColor: '#000000',
  strokeWidth,
  physicalWidth: `${SIDE_MM}mm`,
  physicalHeight: `${SIDE_MM}mm`,
});

writeFileSync('arctic-circle.svg', svg);
```

`preview.png` was rasterized with:

```sh
node scripts/svg-to-png.mjs arctic-circle.svg preview.png \
  --width 1400 --background '#fdfbf5' --stroke '#152238'
```

## Wishes

- No `flow-lines arctic` CLI command exists yet — every other generator
  in the toolbox table has one, and this one is worth promoting out of
  "drive it from a scratch script" once it's used more than once.
  `--preset`, `--order`, `--seed`, `--marks`, `--upright` would cover
  the whole option surface already defined in `ArcticOptions`.
- The `weave`/`upright` preset tags each domino class (`domino-n/s/e/w`)
  for per-pen export and is clearly built for a four-ink piece —
  `--split-layers` support (already a pattern on other commands) would
  make that the natural next session to run on this generator.
