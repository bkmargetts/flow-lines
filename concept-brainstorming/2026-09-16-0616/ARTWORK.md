# Snow Line

## Artist statement

This studio has fourteen generators and I went looking through the ones
nobody had used yet. `arctic` — random domino tilings of the Aztec
diamond — turned out to be sitting there unopened, and it is not a
generative-art trick at all: it's an exact sampler for a real
combinatorics theorem, wearing ink as its only decoration.

A domino tiling of the Aztec diamond `AD(n)` is drawn *exactly*
uniformly by domino shuffling (Elkies–Kuperberg–Larsen–Propp) — no
Markov chain, no burn-in, no "did it mix" doubt, just an O(n²)
procedure that lands on one tiling out of the (huge) uniform set every
time. What makes that worth looking at is the **arctic circle theorem**
(Jockusch–Propp–Shor, 1998): as the diamond grows, the tiling *freezes*
into perfectly regular brick courses in its four corners and stays
genuinely disordered everywhere inside a circle inscribed in the
diamond — and the boundary between frozen and liquid becomes razor
sharp. Nothing in the sampling algorithm mentions a circle. It just
appears, every time, in the same place.

The repo's `dissolve` preset turns that straight into tone with no
shading anywhere: ink *one* of the four domino classes and its frozen
corner welds into a solid mass, its liquid interior scatters into short
broken dashes that thin out exactly at the theorem's boundary, and the
rest of the diamond — where that class never freezes — stays clean
paper. I rendered it at a dozen seeds before I'd even decided on a
concept, and the thing that stopped me was that I didn't need to
squint to see the theorem working: the ragged white seam between solid
and speckle sat at the same height, the same curve, almost every time,
while everything below the seam — which dash survives, which scatters,
which corner of paper stays bare — was completely different seed to
seed. That's not an artistic choice, it's the theorem visibly holding,
and it's a better argument for showing two plates than any composition
reason: the pairing *is* the finding. One plate would just be a nice
mountain. Two, side by side, same recipe, only the seed changed, is a
controlled experiment you can read off the wall — the boundary is
fate, the texture is chance.

I'd also read the shape as a snowbound peak — solid snowfield up top,
a broken snow line, scree dissolving into cloud below — before I knew
its name, and it turns out that's not me projecting: the arctic circle
theorem is named for exactly that resemblance, a temperate boundary
between a frozen pole and a liquid middle. "Snow Line" isn't a metaphor
I hung on the math; it's the theorem's own metaphor, followed one step
further into an actual mountain.

Two plates, one pen, one seed changed. Everything else about them —
paper, ink, order, preset, margin — is identical on purpose, so the
only thing that can explain what's different between them is the
number.

## Materials

- **Paper:** Strathmore 500 Series Bristol, smooth finish, 2-ply,
  270 gsm, bright white — 2× A3 sheets (297 × 420 mm, portrait). Smooth
  bristol rather than a toothy cotton rag: the frozen courses are ~0.7 mm
  dominoes at this order, and a textured surface would fur the fine
  brick-course lines exactly where the piece needs them crispest.
- **Ink:** Winsor & Newton Black Indian Drawing Ink (dense matte black,
  `#0D0D0D` as plotted — not a flat digital `#000000`, which reads dead
  next to real ink on white bristol), loaded in a 0.3 mm technical pen
  (Rotring Isograph 0.30 or a Sakura Pigma Micron 03 if refillable
  technical pens aren't available). One pen, one width, both plates —
  the recipe is the same on purpose.
- **Mounting:** two identical simple box frames, black-anodised
  aluminium or matte-black oak, each sheet float-mounted on white
  4 mm board so the deckle-free bristol edge shows a small ink-free
  margin all round. Hang as a pair with a fixed 120–150 mm gap between
  frames (not touching, not far enough apart to read as unrelated) —
  the gap is doing the diptych's job, so keep it consistent left-right
  and don't add a divider, caption card, or anything else between them.

## Process

1. Build the repo (`pnpm install && pnpm build`) and run the
   reproduction script below to generate the two plate SVGs.
2. Tape each Bristol sheet to the plotter bed in turn, A3 portrait,
   registered to the bed's home corner.
3. Plot `artwork-plate-1-seed11.svg` with the 0.3 mm pen loaded with
   Winsor & Newton Black Indian ink. Let it dry fully before handling
   (Indian ink on smooth bristol is touch-dry in minutes but stays
   smudge-prone for longer).
4. Repeat step 3 for `artwork-plate-2-seed77.svg` — same pen, same ink,
   same width, same margin. Don't refill or swap pens between the two;
   any material drift between plates would undercut the point that only
   the seed differs.
5. No wash, no hand-finishing, no captions on the sheets — the piece is
   complete off the plotter. If you want an identifier, pencil the seed
   lightly on the back of each mount board, never the face.
6. Float-mount and hang the pair as described above.

## Plot settings

- Paper: A3 portrait, 297 × 420 mm, two independent sheets (not tiled —
  each plate is a complete, self-contained plot within the A3 limit)
- Margin: 24 mm on all sides
- Diamond order: `n = 150` (`AD(150)` holds 150 × 151 = 22,650
  dominoes; only the ~2,650 belonging to the inked class are drawn)
- Pen width: 0.3 mm, single pen, single ink, both plates
- Render density: 4 px/mm (1188 × 1680 px working canvas per plate)
- Hand-drawn wobble: 0.35 px amplitude (generator default) — enough to
  read as drawn, not enough to blur the frozen courses' straightness
- Per-plate stroke count / estimated travel (already `orderPlot`-reordered,
  not chained — chaining would fuse separate dominoes into one path and
  round-cap the joins, softening the brick lattice the piece is about):
  - Plate I (seed 11): 2,649 strokes, ≈14.1 m pen-down + ≈9.2 m pen-up
    ≈ 23.3 m total
  - Plate II (seed 77): 2,674 strokes, ≈13.7 m pen-down + ≈9.0 m pen-up
    ≈ 22.7 m total
  - Both plates comfortably a single unattended plotter session each

## Reproduction

Deterministic from two integer seeds and one shared recipe (order,
preset, margin, paper — everything else is `generateArctic`'s default).
There is no CLI command for `arctic` yet (core-only, see Wishes), so
this calls `generateArctic` / `toSVG` directly against the built core
package. Save as `snow-line.mjs` **in the repo root** (it imports
`packages/core/dist` by relative-from-root path), then:

```sh
pnpm install && pnpm build
node snow-line.mjs concept-brainstorming/2026-09-16-0616
```

```js
// snow-line.mjs — "Snow Line": two A3-portrait plates, same
// generateArctic recipe, different seeds. No manual compositing — each
// plate is the generator's own output at true A3 mm dimensions.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] ?? '.';
mkdirSync(outDir, { recursive: true });

const { generateArctic, toSVG, getPaperSize, pageMetrics } = await import(
  join(process.cwd(), 'packages/core/dist/index.js')
);

const PX_PER_MM = 4;
const MARGIN_MM = 24;
const page = pageMetrics(getPaperSize('a3'), 'portrait', PX_PER_MM);
const marginPx = Math.round(MARGIN_MM * page.pxPerMm);

const PLATES = [
  { id: 'plate-1', seed: 11 },
  { id: 'plate-2', seed: 77 },
];

const INK = '#0d0d0d';
const PEN_MM = 0.3;

for (const plate of PLATES) {
  const res = generateArctic({
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: plate.seed,
    preset: 'dissolve',
    order: 150,
    upright: false,
  });
  const svg = toSVG(res, {
    strokeColor: INK,
    strokeWidth: PEN_MM * page.pxPerMm,
    physicalWidth: `${page.widthMm}mm`,
    physicalHeight: `${page.heightMm}mm`,
  });
  writeFileSync(join(outDir, `artwork-${plate.id}-seed${plate.seed}.svg`), svg);
}
```

Preview (not a deliverable — recolours nothing, just rasterizes each
plate and stitches them with a frame rule and a wall-tone gap to
approximate the hung pair):

```sh
node scripts/svg-to-png.mjs concept-brainstorming/2026-09-16-0616/artwork-plate-1-seed11.svg /tmp/p1.png --width 700
node scripts/svg-to-png.mjs concept-brainstorming/2026-09-16-0616/artwork-plate-2-seed77.svg /tmp/p2.png --width 700
# then compose /tmp/p1.png and /tmp/p2.png side by side with a gap
```

## Wishes

- `arctic` has no CLI command yet (core-only, like several recent
  additions) — everything here goes straight at
  `packages/core/dist/index.js`. Given how directly it maps to a named
  theorem with a small, legible option surface (`preset`, `order`,
  `marks`, `upright`), it's an easy candidate for one: `flow-lines
  arctic --preset dissolve --order 150 --seed 11`.
- There's no shared "N independent plates, same recipe, seed sweep"
  helper — this piece and "Three Earths" before it both hand-rolled a
  small loop over seeds. Unlike "Three Earths" (one hand-composited
  sheet), this one didn't need panel-offset math at all, because two
  *separate* full-size sheets turned out to be the more honest form for
  a controlled comparison — but a `renderSeeds(generator, options,
  seeds)` convenience that just returns N results/SVGs would still save
  the boilerplate.
- `ArcticOptions.marks` is a closed union (`'one' | 'horizontals' |
  'all' | 'outline'`) rather than an explicit class list — reasonable
  as a curated preset surface, but there's no way to ink, say, two
  *opposite* corners (N+S already covered by `horizontals`, but not
  N+E, the two adjacent ones) without editing `MARK_CLASSES` in core.
  Worth an escape hatch (`marks: DominoClass[]`) if a future piece wants
  to choose the pair.
