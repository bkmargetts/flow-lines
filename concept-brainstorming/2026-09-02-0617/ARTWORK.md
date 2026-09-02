# 66°33′

## Artist statement

This is not a picture of ice. It is a proof, inked.

The repo's newest generator, `arctic`, samples a uniformly random domino
tiling of the Aztec diamond by domino shuffling (Elkies–Kuperberg–Larsen–
Propp) — an exact algorithm, no Markov chain, no burn-in, no question of
whether it's converged. Every tiling it produces is a genuine draw from
the uniform distribution, and the sampler tags each domino with one of
four classes by its position's parity: `N`, `S`, `E`, `W`. Ink only the
`N` class as welded spines and something the algorithm never mentions
appears on its own: the arctic circle theorem (Jockusch–Propp–Shor,
1998) says that as the diamond grows, the `N` dominoes freeze into
perfect brick courses in one corner of the diamond and scatter at random
everywhere else, with the boundary between order and disorder converging
to an exact circle. Nothing in the code draws a circle. The circle is a
consequence of the combinatorics, the same way condensation is a
consequence of thermodynamics — and it happens to land the frozen corner
at the top of the page, because that's the corner this sampler's own
class-naming calls `N`. North.

I didn't have to reach for the metaphor. The generator handed it to me
labelled.

What earned this a place on the wall rather than in the discard pile:
first, the `dissolve` preset over `horizon` (bands top and bottom),
`weave` (all four classes, a woven textile), and `brick` (every outline,
an even grey grid) — the others are handsome but they're patterns.
`dissolve` is a single figure with a beginning, a middle, and an end: a
solid mass, a fraying edge, silence. Second, seed 71 over eleven other
candidates at the same order — most gave a flatter, plateau-like frozen
edge; 71's welded courses break into a proper jagged ridgeline before
the scatter starts, and the disorder below thins out evenly rather than
clumping to one side. Third, the crop: centred with a generous border
read as a specimen pinned to a page, correct but timid. Pushing the fit
box 40mm past every edge (a negative margin — the diamond's true corners
run off all four sides of the sheet) fills the page with the circle
itself instead of the void around it, and the sheet stops feeling like a
diagram and starts feeling like a photograph — a crop of something
larger than the frame, the way the sky doesn't end at the edge of a
telescope's field of view.

The title is the real latitude of the real Arctic Circle — the line
where, at least once a year, the sun doesn't rise or doesn't set. Behind
this generator's name is a pun that isn't a pun: mathematicians call
this boundary the arctic circle because a random tiling really does
freeze at the pole and stay liquid at the equator, the way sea ice
does. I wanted a title with the same double life as the drawing — read
as coordinates by anyone who knows what 66°33′ marks, and read as a
plain, exact number by anyone who doesn't, which is exactly how the
generator itself works.

## Materials

- **Paper**: Stonehenge Black, 250gsm, 100% cotton rag, A3 (297 × 420mm),
  portrait.
- **Ink**: Sakura Gelly Roll White, 05 Fine tip (~0.4–0.5mm laydown) —
  opaque white pigment gel, sits well on black cotton rag without
  soaking or ghosting through. Hex approximation for the digital
  preview: `#f4f1e8` (gel-white ink has a warm, slightly ivory cast, not
  paper-white).
- **Mount**: black-core float mount, 10mm reveal, simple black or dark
  walnut box frame under UV-filtering glass (gel pigment is abrasion-
  prone; keep it glazed and don't stack anything against the face).

## Process

1. Cut (or have cut) the Stonehenge Black sheet to at least 310 × 430mm
   — a few mm of working margin beyond the finished A3, trimmed off
   after plotting so the plotter's hold-down never touches the visible
   sheet.
2. Mount square to the plotter's axes. Fit the **Gelly Roll White 05
   (Fine)** pen.
3. Plot `artwork.svg` in full — one pen, one pass, one file. There is no
   second layer: the drawing's only "bold" emphasis is the welded
   spines the algorithm itself produces where the tiling freezes, so a
   second offset pass would thread extra ink through a mass that reads
   as solid precisely because it already froze. Adding weight by hand
   would be lying about the maths.
4. Let the gel ink cure flat for at least 30 minutes before any
   handling — gel pigment sits on the surface of cotton rag rather than
   soaking in, and stays smearable longer than on smoother stock.
5. Trim to the finished 297 × 420mm along the sheet's working edge.
6. Float-mount and frame as above.

## Plot settings

- Paper: A3, 297 × 420mm, portrait
- Margin: **−40mm** (deliberate bleed — the fit box is pushed past all
  four sheet edges, so the diamond's true corners and the widest reach
  of the scattered dashes are cropped by the paper, not centred inside
  it)
- Pen: single 0.4–0.5mm white gel, one pass
- Resolution: 3 px/mm (repo reference density)
- Strokes: 3,465 paths (welded `N`-class spines inside AD(170), reordered
  — not chained — to cut pen-lift travel without fusing separate
  dominoes into one path; a fairly dense plot, budget accordingly)

## Reproduction

Built with `pnpm install && pnpm build` at the repo root. `arctic` has
no CLI command yet (core-only, per CLAUDE.md) — this is the exact
scratch script, run against the built core package:

```js
// node arctic-final.mjs   (run from the repo root after `pnpm build`)
import { writeFileSync } from 'node:fs';
const { generateArctic, toSVG, getPaperSize, pageMetrics } =
  await import('./packages/core/dist/index.js');

const paper = getPaperSize('a3');
const m = pageMetrics(paper, 'portrait', 3); // 3 px/mm, repo reference density

const res = generateArctic({
  width: m.widthPx,
  height: m.heightPx,
  margin: -40,        // deliberate bleed
  seed: 71,
  preset: 'dissolve',  // ink only the 'N' domino class
  order: 170,          // AD(170): 170*171 = 28,970 dominoes
  upright: false,      // diamond, apex up — the frozen corner lands at the top
  wobble: 0.35,        // default hand-drawn wobble
});

writeFileSync('artwork.svg', toSVG(res, {
  optimize: true,
  strokeColor: '#000000',
  strokeWidth: 0.45,
  physicalWidth: m.widthMm,
  physicalHeight: m.heightMm,
}));
```

`preview.png` was rendered from `artwork.svg` with:

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png \
  --width 1600 --background '#141210' --stroke '#f4f1e8'
```

(`#141210` approximates Stonehenge Black's warm-black cotton surface;
`#f4f1e8` approximates the Gelly Roll White laydown — see Materials.)

## Wishes

- `ArcticOptions` has no way to bias which corner freezes other than the
  `marks` class choice (`N`/`S`/`E`/`W`) plus the 45° `upright` flip —
  there's no continuous rotation. A `rotate` in degrees (with the fit
  box re-computed post-rotation, the way `upright` already is) would
  open compositions where the frozen corner sits off-axis rather than
  always dead-centre-top or dead-centre-side.
- No way to composite two mark strategies in one call (e.g. `dissolve`'s
  solid `N` corner plus a faint `outline` pass everywhere else, at low
  opacity/density, to hint at the liquid region's full tiling rather
  than just its `N`-class dashes). Currently that means two separate
  `generateArctic` calls merged by hand in a scratch script — doable,
  but a `secondaryMarks` option at reduced weld/weight would make
  "mostly one class, a whisper of the rest" a first-class look instead
  of a script-level hack.
