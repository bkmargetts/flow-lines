# Landfast

## Artist statement

There's a real result in combinatorics called the arctic circle theorem
(Jockusch–Propp–Shor, 1998). Take the Aztec diamond — a diamond-shaped
checkerboard region — and tile it completely with dominoes, chosen
uniformly at random from every possible tiling, no bias anywhere. Do
this at large enough scale and something nobody programmed into the
sampler appears: the tiling freezes into perfectly regular brick courses
in the four corners, and stays genuinely disordered everywhere else, and
the boundary between frozen and disordered is, to the limit, an exact
circle inscribed in the diamond. The algorithm that generates the tiling
(domino shuffling, Elkies–Kuperberg–Larsen–Propp) never mentions a
circle. It's just what happens when you sample fairly at scale — order
and a hard geometric law, purely as a consequence of randomness having
nowhere else to go.

This repo's `arctic` module sorts every domino into one of four classes
by orientation and quadrant, and inks a single one of them as welded
spines: where that class is frozen, neighbouring dominoes are collinear
and weld into long unbroken rules — solid tone. Where it's disordered,
the spines stay short and broken. I ran the sampler across two dozen
seeds at a few different orders (the diamond's size — more order, finer
grain, more dominoes) before this one — seed 24, order 190 — stopped me:
the frozen/disordered boundary happened to fall as a genuinely
mountainous, double-peaked ridgeline, not just a fuzzy gradient. Every
seed produces *a* boundary; this one produced a boundary that reads as
a specific place.

What it reads as, once I sat with it, is an ice front: a solid glacial
mass above a jagged calving line, dissolving downward through scattered
brash ice into open water, bounded by a circle that is not a coastline
anyone surveyed — it's a mathematical inevitability wearing a
coastline's clothes. Sea-ice terminology already has the word for the
frozen part: *fast ice*, or *landfast ice* — ice anchored to the shore
or seabed, distinguished from pack ice precisely by not moving. That the
correct oceanographic term for "the part that's fixed and unmoving" and
the correct combinatorial term for "the part that's deterministic
regardless of the coin flips" turn out to be the same idea, named
independently by people doing completely unrelated work, is the whole
reason this piece exists.

I deliberately did not add anything to the boundary — no hand-inked
shoreline, no reinforcing pass along the ridge, no wash to fake depth.
The generator's own code is explicit that bold emphasis doesn't belong
here: the tone is already the weld density, and doubling any of it would
just fatten a mass that is solid *because* the tiling froze, not because
a pen went over it twice. Adding a human mark over the boundary would
have been a small betrayal of the only thing worth saying: nothing drew
this line on purpose.

## Materials

- **Paper** — Stardream Onyx, 285gsm pearlescent black cardstock, A3
  (297×420mm), portrait.
- **Ink** — one pen only: white gel, Sakura Gelly Roll 05 White (or
  equivalent 0.5mm-nib white gel), laying a line of approximately
  0.4mm on this stock.
- **Mounting** — float-mounted on black-core mount board, sized ~20mm
  larger than the sheet on all sides so the card appears to hover with
  no visible mat; framed behind low-reflectance/UV glazing.

## Process

1. Build the repo (`pnpm install && pnpm --filter @flow-lines/core
   build`) and run the reproduction script below to produce
   `artwork.svg`. The `arctic` generator has no CLI command yet — see
   Wishes — so this is a direct core-package call, matching the
   `scripts/city-gallery.mjs` pattern this repo already uses for other
   CLI-less generators.
2. Let the Stardream Onyx sheet acclimate in the studio for ~30 minutes
   before plotting — heavy pearlescent stock cockles with humidity
   swings more than plain paper does.
3. Tape the sheet to the plotter bed at all four corners with low-tack
   tape. A stiff A3 pearlescent sheet can lift at the corners mid-plot
   otherwise, and this piece has no registration to a second pass to
   forgive it.
4. Load the single white gel pen at 0.4mm and burn off the first few
   centimetres of ink on a scrap offcut of the same stock until the
   line stops skipping — gel balls need priming, especially on coated
   card, and the piece's palest area (the scattered brash-ice dashes)
   is exactly where a skipping pen would be most visible.
5. Plot `artwork.svg` in one pass, one pen, one width, start to
   finish. No second pass, no bold-emphasis offset — see the artist
   statement for why that would undo the point.
6. Leave the sheet lying flat and undisturbed for at least 15 minutes
   after the plot finishes. Gel ink stays visibly wet longer on
   pearlescent-coated stock than on uncoated paper, and the piece is
   dense enough in the upper third that an early touch will smear it.
7. Float-mount and frame as described under Materials once fully cured
   (give it a full day before framing under glass).

## Plot settings

- Paper: A3, portrait, 297×420mm.
- Margin: 25mm on all sides.
- Pen: one, 0.4mm, white gel.
- Strokes: 4,209 (single layer — the piece inks only the domino class
  `N`).
- Estimated pen travel: ~17.2m pen-down, ~11.0m pen-up (~28m total).
  The generator reorders strokes internally (`orderPlot`, not
  `optimizePlot` — chaining would fuse separate dominoes into one path
  and round-cap the joins, softening the crisp lattice the drawing is
  about) so this travel figure already reflects that optimization.

## Reproduction

Exact seed and parameters: `preset: 'dissolve'` (inks domino class
`N` only), `order: 190`, `seed: 24`, `upright: false`, `wobble: 0.35`
(default), A3 portrait at the repo's base 3px/mm, 25mm margin.

```sh
pnpm install
pnpm --filter @flow-lines/core build
node render-final.mjs   # script below, run from the repo root
```

`render-final.mjs`:

```js
import { writeFileSync } from 'node:fs';
const { generateArctic, toSVG, PAPER_SIZES, pageMetrics } = await import(
  './packages/core/dist/index.js'
);

const a3 = PAPER_SIZES.find((p) => p.id === 'a3');
const pm = pageMetrics(a3, 'portrait'); // 891x1260 px at 3 px/mm
const marginMm = 25;
const marginPx = marginMm * pm.pxPerMm;

const result = generateArctic({
  width: pm.widthPx,
  height: pm.heightPx,
  margin: marginPx,
  seed: 24,
  preset: 'dissolve',
  order: 190,
  upright: false,
  wobble: 0.35,
});

const svg = toSVG(result, {
  strokeColor: '#000000',
  strokeWidth: 1.2,
  includeBackground: false,
  physicalWidth: `${a3.widthMm}mm`,
  physicalHeight: `${a3.heightMm}mm`,
});
writeFileSync('artwork.svg', svg);
```

`preview.png` (this folder) was rendered from `artwork.svg` with:

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png \
  --width 1600 --background '#050a12' --stroke '#f3f5f8'
```

`--background`/`--stroke` approximate Stardream Onyx and the white gel
ink respectively; the plotted piece is black ink-side-up on the actual
pearlescent stock, not this flat raster.

## Wishes

- No CLI command for `arctic` yet (core + web module only). A
  `flow-lines arctic` command mirroring the others — `--preset`,
  `--order`, `--marks`, `--upright`, `--multi-ink` for the four-class
  per-pen split — would save the next session the scratch script.
- `ArcticOptions` has no page-fit control beyond the auto-fit-to-box
  behaviour used here. A piece that wanted to crop into the frozen mass
  rather than showing the whole dissolve (deliberately cutting off the
  point of the triangle, closer to a photographic crop) would need to
  post-process the line set by hand; an explicit crop/zoom option would
  make that a first-class choice instead of a workaround.
