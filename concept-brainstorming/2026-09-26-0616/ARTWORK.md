# Floe Edge

## Artist statement

In the real Arctic, the *floe edge* is a named thing — the line where
fast ice locked to the shore gives way to open, moving water. Inuit
hunters travel to it specifically, because it's where the ice's stillness
meets the sea's disorder and the boundary between them concentrates
everything alive. It isn't a fixed latitude and it isn't drawn by anyone;
it's just wherever the ice happens to have stopped being solid.

This repo's brand-new `arctic` generator — added a few commits ago,
never yet used in this studio — draws something that sounds like the
same idea but is actually a much stranger and more exact one. It samples
a uniformly random domino tiling of an Aztec diamond (domino shuffling,
Elkies–Kuperberg–Larsen–Propp 1992: exact, no burn-in, no mixing
question — the tiling is genuinely uniform, not merely well-mixed). Four
corners of that diamond freeze into perfect brick order; the middle stays
disordered, every domino orientation a coin flip. Ink only one of the
four domino classes as long spines and the frozen corner welds into
solid ruled lines, the liquid middle stays broken dashes, and the
boundary between the two is the *arctic circle* (Jockusch–Propp–Shor,
1998) — the circle inscribed in the diamond, converged on exactly, in
the limit, with zero free parameters. Nothing in the sampling algorithm
mentions a circle. There is no shading anywhere in this drawing: the
tone you see — solid, thinning, scattered, paper — is long-range order
decaying into disorder, and that decay is a *theorem*, not a gradient
tool.

I rendered the `dissolve` preset (one domino class inked, the cleanest
single reading of the theorem) across a dozen seeds at diamond order
150 — order set high enough to resolve as fine linework at A3, low
enough to stay a reasonable plot. Every seed gives the same circle in
the same place, because the circle's position is the theorem, not the
seed; what changes seed to seed is only the jaggedness of the melt line
and the scatter of dashes beyond it. Seed 67 won because its transition
ridge breaks asymmetrically — a deep notch left of centre, a squared-off
shoulder to its right — reading as a real pressure ridge in shore-fast
ice rather than a smooth theoretical arc, while the scatter below still
thins out with the honesty of an aerial ice-reconnaissance photograph:
dense, then broken, then gone, never staged.

Orienting the page with the frozen mass at the top and the diamond's
other three corners (all but silent, since only one domino class is
inked) falling away below turns out to already be the correct
cartographic read: ice at the pole, retreating south into open water,
exactly how a sea-ice concentration chart is drawn. I didn't have to
choose that framing — the generator's own coordinate system handed it to
me. That's the thing I kept coming back to across every other candidate
this session: most generators here need staging to mean something. This
one already draws a diagram of a real phenomenon (a sharp, sourceless
phase boundary) using a completely unrelated piece of exact mathematics,
and the two readings — hydrographer's ice chart, combinatorialist's
phase diagram — sit on top of each other without either one lying.

## Materials

- **Paper**: GF Smith Colorplan, *Dark Blue*, 270gsm, A3 (297×420mm) —
  a deep, near-navy blue cover stock, smooth enough for gel ink to sit
  crisp rather than feather.
- **Ink**: Sakura Gelly Roll *Moonlight*, White (08 bold, ~0.8mm nib) —
  the line in `Reproduction Process` below is plotted at an effective
  0.6mm, since a light, consistent plotter stroke lays down narrower
  than a hand-pressed one. Gelly Roll Moonlight is formulated
  specifically to read opaque on dark stock, which matters here (see
  step 3).
- **Mounting**: acid-free dry-mount board + a float frame with
  UV-filtering glass, ~15mm reveal on all sides so the sheet's cut edge
  shows against its mount.

## Process

1. Cut the Colorplan Dark Blue sheet to A3 if not already trimmed.
   Secure to the plotter bed with low-tack tape, taping only outside the
   20mm margin the file already reserves.
2. Load the Gelly Roll Moonlight White (08) into the pen holder. Set a
   light-to-medium down-force (~20g) — gel ink floods and blobs under
   heavy pressure, especially on the dense welded lines near the frozen
   apex.
3. Home the plotter, zero the origin at the sheet's top-left margin
   corner, and load `artwork.svg`. Plot it once at a moderate speed
   (25–35mm/s). A single gel pass over navy cardstock dries slightly
   translucent — more chalk than paint — which is expected, not a
   mistake.
4. Let the first pass air-dry ~5 minutes (gel skins fast; don't touch it
   sooner).
5. **Without moving the paper**, re-home to the identical origin and
   plot `artwork.svg` a second time. Because the plotter's registration
   is exact, the second pass lands precisely on the first stroke for
   stroke, building the ink to full, opaque white without thickening or
   doubling any line — the standard fix among plotter artists for
   gel-on-dark-stock opacity, and the reason this is still a *single
   pen, single width* piece by the repo's own rule: it's one layer
   plotted twice, not two layers.
6. Cure flat and uncovered for 24 hours — gel ink stays smudgeable
   longer than a pigment fineliner would.
7. Dry-mount to the backing board and float-frame under UV-filtering
   glass.

## Plot settings

- Paper: A3, portrait, 297×420mm
- Margin: 20mm
- Pen width: 0.6mm (physical), plotted **twice** from the same file, same
  registration, same pen
- Diamond order: 150 · preset: `dissolve` · seed: 67
- Pen-down length: ~13.7m per pass (~27.4m total ink laid across both
  passes); `orderPlot` reordering (on by default) keeps pen-up travel
  low without fusing the separate welded runs into one path — fusing
  would round-cap the joins and soften exactly the crisp lattice
  geometry the piece depends on.

## Reproduction

No CLI command exists yet for `arctic` (core + web only — see Wishes).
Regenerate `artwork.svg` byte-for-byte with this script against the
built core package:

```sh
pnpm install && pnpm --filter @flow-lines/core build
node reproduce.mjs   # save the script below as reproduce.mjs at repo root
```

```js
import { writeFileSync } from 'node:fs';
const { generateArctic, toSVG, getPaperSize, pageMetrics, BASE_PX_PER_MM } =
  await import('./packages/core/dist/index.js');

const paper = pageMetrics(getPaperSize('a3'), 'portrait', BASE_PX_PER_MM);
const marginMm = 20;
const penWidthMm = 0.6;

const res = generateArctic({
  width: paper.widthPx,
  height: paper.heightPx,
  margin: marginMm * BASE_PX_PER_MM,
  preset: 'dissolve',
  seed: 67,
  order: 150,
});

const svg = toSVG(res, {
  strokeWidth: penWidthMm * BASE_PX_PER_MM,
  physicalWidth: paper.widthMm,
  physicalHeight: paper.heightMm,
});

writeFileSync('artwork.svg', svg);
```

`preview.png` was rasterized from `artwork.svg` with:

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png \
  --width 1600 --background '#152238' --stroke '#f7f6f2'
```

## Wishes

- A `flow-lines arctic` CLI command, mirroring the other generators —
  right now `arctic` only exists as a core function and a web project,
  so reproducing this piece needs a scratch script instead of a single
  CLI invocation like every other piece in this folder.
- `ArcticOptions` has no bold-emphasis pass by design (documented
  in-code: the frozen mass's weight already comes from welding, and a
  second offset pass would thread new lines through a region that's
  solid precisely *because* the tiling froze). Worth double-checking
  that reasoning holds at very high orders (200+), where the welded
  rules get long enough that a plotter's own pen-width variance might
  start reading as thin rather than solid.
