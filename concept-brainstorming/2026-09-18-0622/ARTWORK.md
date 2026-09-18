# Minimum Extent

## Artist statement

Nobody in this studio's runs had touched the repo's `arctic` generator
before. It has no CLI command, no preset gallery entry visited yet, and its
own docstring undersells it: "a uniformly random domino tiling of the Aztec
diamond, drawn in ink." What that sentence hides is the arctic circle
theorem (Jockusch–Propp–Shor, 1998) — as the diamond grows, a perfect
random tiling doesn't stay random everywhere. It freezes into brick-regular
corners and stays disordered only inside a circle inscribed in the diamond,
with the boundary between frozen and molten becoming razor-sharp as the
order grows. Nothing in the code draws that circle. It's a consequence of
combinatorics that the sampler doesn't know exists, and inking a single
domino class (of four) turns the theorem directly into tone: solid welded
rule-work where that class is frozen, blank paper where the other three
classes are frozen instead, and a scattered, never-quite-welding speckle
inside the circle, thinning to nothing at its edge.

I inked one class, at high enough order that the domino cells sit right at
the edge of what a fine nib can resolve, and the result is a drawing that
needs no photograph, no depth map, no semantic labels — it just *looks
like* a satellite crop of the Arctic ice pack in September: a solid frozen
mass in one corner, a crisp, genuinely circular ice edge, and a marginal
zone of broken floes and open leads dissolving into clear water. I didn't
design that reading in; the theorem produced it, and I recognised it. The
piece is composed to make that recognition explicit rather than coincidental:
the frozen corner is pushed hard into the top-right of the sheet, bleeding
past both edges, so the pack visibly continues beyond the frame — this
reads as a *crop*, not a diagram centred for inspection, the way a satellite
frame is always an arbitrary window onto something larger.

What earned this candidate its spot over the other renders I discarded this
session — the three- and four-class variants, which read as dense woven
tapestry rather than ice; the diamond left in its native rotation, which
reads as a mountain or a moth rather than a coastline; a dozen seeds that
gave a rounder, blander, more symmetric edge than this one's — is a single
seed (99) that happens to throw one long, dark meltwater channel down from
the pack toward the lower-left, breaking the piece's near-circular symmetry
with something that reads like *geography* rather than *statistics*. That
channel is not drawn, hinted, or hand-placed. It is one more consequence of
which of ~190² unit dominoes a uniformly random sample happened to assign to
one class, at one seed, and it is the reason this render survived and
twenty-some others didn't.

The small hand-plotted line at the foot of the sheet — the tiling's own
coordinates, `AD(190) · SEED 99 · ARCTIC CIRCLE THEOREM` — is there because
this is a proof before it's a picture, and the finished piece should say so
plainly, the way a herbarium sheet or a chart plate carries its own field
data. It runs today, by coincidence of the schedule rather than by design:
mid-September is when the real Arctic sea ice reaches its annual minimum
extent. The title is that coincidence, kept.

## Materials

- **Paper:** A3 (297×420mm) portrait, bright cool-white cold-press
  printmaking paper, ~250gsm (e.g. Fabriano Artistico Extra White, or
  Bristol smooth). Cool white, not cream or cream-toned — the piece needs a
  neutral, slightly clinical ground so the ink reads as chart/specimen
  paper, not warm illustration stock.
- **Ink — the only pass:** a single refillable technical pen (e.g. a
  Rotring Isograph or equivalent 0.25–0.3mm technical nib) loaded with
  **Noodler's Polar Blue-Black** bottled fountain-pen ink — approx.
  `#17244a` on paper. It's a real, ordinary drawing ink; it just happens to
  be a formulation sold for not freezing in the field, which made it the
  obvious (and only) choice once the subject declared itself. No other
  colour, wash, or pass touches this sheet.

## Process

1. Mount the A3 sheet on the plotter bed, square to the axes, and home the
   machine. The piece is a single pass in a single pen — there is no
   registration step.
2. Load the technical pen with Noodler's Polar Blue-Black and set the pen
   force for a consistent ~0.3mm line. Confirm on scrap that the fine
   speckle marks (many are single short strokes a few tenths of a
   millimetre long) actually deposit ink — technical pens can skip on very
   short, fast moves; slow the plot speed if they do.
3. Plot `artwork.svg` (4,317 strokes; ≈18.7m of drawn ink, ≈12.4m of
   pen-up travel — roughly 45–70 minutes depending on the plotter's
   acceleration settings). The drawing bleeds to the sheet's top and right
   edges by design — if the plotter can't safely reach within a few
   millimetres of the physical paper edge, mount the sheet on oversized
   backing stock and trim to true A3 after plotting rather than shrinking
   the margins in the file.
4. Let the ink cure fully (Noodler's inks are slow-drying compared to
   pigment fineliners — give it at least an hour flat before handling).
5. Float-mount on white board with a wide mat (at least 60mm), so the
   bled top-right corner reads as touching the mount's edge if you choose
   a mat cut flush there, or sits inside a uniform reveal if you prefer a
   conventional mat — either is faithful to the piece; the wide lower
   field is the composition's own margin and doesn't need a matching mat
   underneath it. Frame under glass or acrylic; no other finishing.

## Plot settings

- Paper: A3, portrait, 297×420mm.
- Effective margins after composition: top ≈0mm (bleed), right ≈0mm
  (bleed), left ≈40mm, bottom ≈34mm to the caption baseline, generous
  clear paper below.
- Pen width: 0.32mm (single pen, single width — no bold passes; the
  drawing's tone comes entirely from stroke density and welding, per the
  generator's own design).
- Strokes: 4,317. Drawn ink: ≈18.7m. Pen-up travel: ≈12.4m (already
  reorder-optimised — `orderPlot`, not `optimizePlot`, so individual
  dominoes stay distinct strokes rather than fusing into chained paths
  with rounded joins, which would soften the lattice's crisp geometry).
- Deterministic: seed 99, tiling order (Aztec diamond `AD(190)`).

## Reproduction

No CLI command wraps `arctic` yet (see Wishes), so this is a scratch script
against the built core package, matching the pattern in
`scripts/city-gallery.mjs`.

```sh
pnpm install && pnpm build   # builds packages/core/dist
node render-final.mjs concept-brainstorming/2026-09-18-0622
```

`render-final.mjs`:

```js
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const coreDist = new URL('./packages/core/dist/index.js', import.meta.url);
const {
  generateArctic, toSVG, pageMetrics, PAPER_SIZES,
  applyHandDrawnStyle, orderPlot,
} = await import(coreDist);
const { clipPolylineToRect } = await import(
  new URL('./packages/core/dist/lib/polyline.js', import.meta.url)
);
const { textToStrokes } = await import(
  new URL('./packages/core/dist/stroke-font.js', import.meta.url)
);

const outDir = process.argv[2] || '.';
mkdirSync(outDir, { recursive: true });

// Page: A3 portrait at 3 px/mm (the repo's base density).
const a3 = PAPER_SIZES.find((p) => p.id === 'a3');
const pm = pageMetrics(a3, 'portrait', 3);
const mm = pm.pxPerMm;
const PAGE_W = pm.widthPx;
const PAGE_H = pm.heightPx;

// The tiling: AD(190), seed 99, one domino class inked ('one' = the
// "dissolve" reading). upright=true turns the diamond into a square so
// the frozen corner sits at a page corner rather than an edge midpoint.
const SEED = 99;
const ORDER = 190;

const raw = generateArctic({
  width: PAGE_W,
  height: PAGE_H,
  margin: 15 * mm,
  seed: SEED,
  marks: 'one',
  order: ORDER,
  upright: true,
  wobble: 0,
  optimize: false,
});

// Composition: push the fitted diamond up and right so its frozen corner
// bleeds past the sheet's top and right edges, and the dissolve trails
// down into a wide clear field for open water + a specimen caption.
const dx = 25 * mm;
const dy = -15 * mm;
const placed = raw.lines.map((l) => ({
  ...l,
  points: l.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
}));

const rect = { x: 0, y: 0, width: PAGE_W, height: PAGE_H };
let lines = [];
for (const l of placed) {
  for (const seg of clipPolylineToRect(l.points, rect)) {
    lines.push({ points: seg, layer: l.layer });
  }
}

let result = { lines, width: PAGE_W, height: PAGE_H, seed: SEED };
result = applyHandDrawnStyle(result, { amplitude: 0.9, wavelength: 90, jitter: 0.27, seed: SEED });
result.lines = result.lines.flatMap((l) =>
  clipPolylineToRect(l.points, rect).map((pts) => ({ points: pts, layer: l.layer }))
);
result = orderPlot(result);

// Specimen caption, same pen, bottom-left margin.
const capSize = 3.4 * mm;
const capText = `AD(${ORDER}) · SEED ${SEED} · ARCTIC CIRCLE THEOREM`;
const capX = 34 * mm;
const capY = PAGE_H - 34 * mm;
const capStrokes = textToStrokes(capText, capX, capY, capSize).map((pts) => ({
  points: pts,
  layer: 'caption',
}));
result.lines.push(...capStrokes);

writeFileSync(
  join(outDir, 'artwork.svg'),
  toSVG(result, {
    optimize: false,
    strokeWidth: 0.32 * mm,
    physicalWidth: `${pm.widthMm}mm`,
    physicalHeight: `${pm.heightMm}mm`,
  })
);
```

Preview render (`preview.png`), same reproducibility:

```sh
node scripts/svg-to-png.mjs concept-brainstorming/2026-09-18-0622/artwork.svg \
  concept-brainstorming/2026-09-18-0622/preview.png \
  --width 1600 --background '#f8fafb' --stroke '#17244a'
```

## Wishes

- `arctic` has no `flow-lines arctic` CLI command, unlike every other
  page-scale generator in the table — this session had to hand-roll a
  scratch script (and reach past the public barrel for `clipPolylineToRect`
  and `stroke-font`'s `textToStrokes`, both internal, to compose the
  asymmetric bleed and the caption) where every other generator would have
  taken a couple of flags. A CLI wrapper exposing `preset`/`marks`/`order`/
  `upright`/`seed` would make this generator as approachable as the rest of
  the toolbox.
- Composing an off-centre, edge-bleeding crop of a generator's output — as
  opposed to the generator's own centred, margin-fitted default — currently
  means reimplementing translate+clip by hand against internal utilities.
  A small shared helper (page-space translate + rect-clip a finished
  `FlowLinesResult`, independent of the multi-sheet `tiling.ts` machinery)
  would generalise a technique this session found worth reaching for.
