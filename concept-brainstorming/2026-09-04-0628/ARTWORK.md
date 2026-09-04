# Piecework

## Artist statement

In 1998, Jockusch, Propp and Shor proved something strange about a very
simple question. Tile a diamond-shaped board — the "Aztec diamond" of
order *n*, built from 2×1 dominoes — completely at random, every legal
tiling equally likely. Look at the result. The four corners have frozen
solid: each one packed in perfectly regular brick courses of a single
domino orientation, as if someone had planned it. The middle is
disordered chaos, every orientation mixed at random. And the boundary
between the frozen order and the liquid disorder is, in the limit, an
*exact circle* — inscribed precisely in the diamond, no tuning, no
external rule forcing it. Nobody told the tiling to make a circle. It
falls out of pure counting. That boundary is called the Arctic Circle,
and this repo has a generator — `arctic`, built around the
Elkies–Kuperberg–Larsen–Propp shuffling algorithm that samples the exact
uniform tiling in O(n²) with no burn-in and no mixing question, so the
drawing is exactly reproducible from a seed rather than merely
plausible — that nobody had used for a piece before I opened it.

The four frozen corners aren't just "a texture": the tiling's own math
sorts every domino into one of four classes by orientation, called N, S,
E and W. Ink one class per pen and the classes fall into quadrant
triangles meeting at the centre — which is exactly the anatomy of a
*framed medallion quilt*: four pieced corner triangles in flat, confident
colour, holding a wild tangle at the centre the way a "crazy quilt"
holds its scraps. I did not design that resemblance. Two traditions that
have never met — 1990s enumerative combinatorics and nineteenth-century
American patchwork — arrive at the identical composition rule (order
pushed to the frame, chaos held in the centre) for entirely unrelated
reasons: one because a limit theorem says so, the other because a
quilter framing a scrap-bag centre in calm pieced borders is how you
make a wild thing presentable. The title is the sewing-room word for
exactly this kind of construction — hand-joining many small identical
units into one finished whole — and, older, the word for work paid by
the piece: repetitive, exact, uncredited labour. Both readings sit on
top of an algorithm that is, quite literally, thousands of identical
domino-shaped stitches sewn into four panels.

I threw out more than I kept before landing here. The single-class
`dissolve` preset alone — one solid corner fraying into an exact
circular scatter — is the purest one-sentence reading of the theorem and
I still think it's beautiful, but alone on a full A3 sheet it read as a
fragment, not a finished piece; a good study, not a keep. Inking both
horizontal classes (`horizon`) produced a startling fingerprint-like
sphere, but it read as a print effect — a "wow" that doesn't survive a
second look, no argument underneath it. The plain outline (`brick`)
proved the point the code's own comments make: even domino density
really does hide the whole theorem in a flat, textureless grey. What
earned the keep was the one version that actually used this generator's
one genuinely novel capability — per-class pen-layer tagging — for
something a single-pen drawing can't do: four real, separately-plotted
colour passes that happen to interlace into a woven tapestry precisely
because they were never one pass to begin with. Any one of the four
passes, inked alone, is still a complete quarter-circle dissolve in its
own right (I checked); together they weave. That's the piece.

## Materials

- **Paper**: Stonehenge, "Fawn" — 100% cotton rag printmaking paper,
  250gsm, A3 (297 × 420mm), portrait. A warm, matte, fabric-toned sheet
  (close to `#f2e9d8`) rather than hot-press white: the piece wants to
  read as cloth, not as a printed diagram on lab paper.
- **Inks — four passes, one domino class per pen**, all a fine
  refillable technical pen (e.g. 0.3mm Rotring Isograph) loaded with a
  lightfast dye- or pigment-based drawing ink. Hex is the source of
  truth; the named colour is a real historical American-quilting dye
  colour, given as a starting point for matching a bottled ink:

  | Quadrant | SVG file | Domino class | Named colour | Hex | Width |
  |---|---|---|---|---|---|
  | Top | `piecework-n.svg` | N | Turkey Red | `#8B2E2E` | 0.3mm |
  | Right | `piecework-e.svg` | E | Cheddar | `#B8842B` | 0.3mm |
  | Bottom | `piecework-s.svg` | S | Indigo | `#233A5E` | 0.3mm |
  | Left | `piecework-w.svg` | W | Bottle Green | `#3E5C3E` | 0.3mm |

  Turkey red and indigo are the two most colourfast, most documented
  quilting dyes of the 1800s; cheddar (a bright orange-yellow) and a
  deep bottle green fill out the classic four-colour "framed medallion"
  palette without reaching for a modern CMY or RGB set — this is meant
  to look like dyed cloth, not a colour proof.
- **Mounting (optional)**: float-mount on cream board in a narrow wood
  or thin brass frame. The sheet's own quiet border (see Plot settings)
  is already the mat; don't crop it tighter.

## Process

1. Load the Stonehenge Fawn sheet into the plotter, A3 portrait, and
   secure it (low-tack tape at the four corners, or a pin-bar/jig if the
   plotter has one). **Do not remove the sheet from the bed until step
   5** — the four passes share one coordinate space by construction
   (they're split from a single generated tiling, not four separate
   generations), so they register exactly as long as the sheet doesn't
   shift between pen swaps. If the plotter's pen change is automatic,
   nothing else is needed; if pens must be swapped by hand with the
   sheet removed, pencil-mark the sheet's corners against the bed before
   lifting it and reseat to those marks.
2. Fit the Turkey Red pen (0.3mm). Plot `piecework-n.svg` — the top
   quadrant's pieced triangle and its share of the central weave.
3. Swap to the Cheddar pen (sheet untouched). Plot `piecework-e.svg` —
   the right quadrant.
4. Swap to the Indigo pen. Plot `piecework-s.svg` — the bottom quadrant.
5. Swap to the Bottle Green pen. Plot `piecework-w.svg` — the left
   quadrant. The medallion is complete when this pass lifts.
6. Let the final pass dry (5–10 minutes for a wet drawing ink) before
   handling. There is no wash, resist or wet-media step in this piece —
   it is finished at the fourth pen-lift.
7. If mounting: float-mount on cream board behind a narrow frame, glass
   optional. Don't trim the sheet's own margin — the extra paper below
   the medallion is a deliberate weighted mat (see below), not waste.

## Plot settings

- Paper: A3, portrait, 297 × 420mm.
- The medallion occupies a 235 × 235mm square, centred horizontally
  (31mm clear paper each side) and placed with a **weighted mat**
  vertically — 78mm above, 107mm below — so the piece sits slightly
  above true centre rather than looking like it's sinking toward the
  bottom edge.
- Pen width: 0.3mm, identical across all four passes.
- Seed 42, tiling order 190 (Aztec diamond AD(190), 190×191 = 36,290
  dominoes before splitting by class).
- Lines: 4,187 (N) + 4,170 (E) + 4,197 (S) + 4,179 (W) = **16,733 total**.
- Estimated pen-up travel: ~9,973mm (N) + 9,679mm (E) + 10,161mm (S) +
  9,937mm (W) ≈ **39,750mm (≈39.8m) across all four passes combined**,
  measured with `measurePenTravel` after independently reordering each
  colour's own pass with `orderPlot` (each pen only ever travels within
  its own single-colour pass, so it's optimized per-pass, not across
  the combined four-colour set).

## Reproduction

```sh
pnpm install && pnpm build
node piecework.mjs concept-brainstorming/2026-09-04-0628
```

```js
// piecework.mjs — "Piecework": a uniformly random domino tiling of the
// Aztec diamond (Elkies-Kuperberg-Larsen-Propp domino shuffling), sampled
// EXACTLY (no burn-in, no mixing question) and rendered as a four-colour
// pieced medallion. Each of the tiling's four domino classes (N/S/E/W) is
// welded into its own spine-line layer and plotted as a separate pen pass
// on ONE clamped sheet — the four passes share one coordinate space with
// pixel-exact registration by construction, no realignment needed if the
// sheet never leaves the bed between pen changes.
//
//   pnpm install && pnpm build
//   node piecework.mjs <outDir>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const coreDist = join(process.cwd(), 'packages', 'core', 'dist', 'index.js');
const outDir = process.argv[2] ?? '.';
mkdirSync(outDir, { recursive: true });

const {
  generateArctic,
  toSVG,
  getPaperSize,
  pageMetrics,
  BASE_PX_PER_MM,
  orderPlot,
  measurePenTravel,
} = await import(coreDist);

const SEED = 42;
const ORDER = 190;

const paper = getPaperSize('a3');
const metrics = pageMetrics(paper, 'portrait', BASE_PX_PER_MM);
const { widthPx: PW, heightPx: PH, pxPerMm } = metrics;

// The medallion sits in a square content box, off-centre vertically
// (a "weighted mat": more quiet paper below than above, the printmaker's
// convention against an image looking like it's sinking).
const CONTENT_MM = 235;
const TOP_MARGIN_MM = 78;
const contentPx = CONTENT_MM * pxPerMm;
const topPx = TOP_MARGIN_MM * pxPerMm;
const leftPx = (PW - contentPx) / 2;

const STROKE_WIDTH_PX = 0.9 * metrics.scale; // ~0.3mm at this page density

// Generate the shared tiling once, at the final page's coordinate density,
// then translate every point into the full A3 canvas.
const inner = generateArctic({
  width: contentPx,
  height: contentPx,
  margin: 3 * pxPerMm,
  seed: SEED,
  preset: 'weave',
  order: ORDER,
  // wobble left at the module default (0.35px) — see arctic/index.ts:
  // no bold-emphasis pass here, the tone is the tiling itself.
});

const placed = inner.lines.map((l) => ({
  ...l,
  points: l.points.map((p) => ({ x: p.x + leftPx, y: p.y + topPx })),
}));

const CLASSES = [
  { cls: 'domino-n', file: 'piecework-n.svg', name: 'Turkey Red', hex: '#8B2E2E' },
  { cls: 'domino-e', file: 'piecework-e.svg', name: 'Cheddar', hex: '#B8842B' },
  { cls: 'domino-s', file: 'piecework-s.svg', name: 'Indigo', hex: '#233A5E' },
  { cls: 'domino-w', file: 'piecework-w.svg', name: 'Bottle Green', hex: '#3E5C3E' },
];

const physicalWidth = `${paper.widthMm}mm`;
const physicalHeight = `${paper.heightMm}mm`;

let totalTravelMm = 0;
let totalLines = 0;
const layerResults = {};
for (const { cls, file } of CLASSES) {
  const subset = placed.filter((l) => l.layer === cls);
  const ordered = orderPlot({ lines: subset, width: PW, height: PH });
  layerResults[cls] = ordered;
  writeFileSync(
    join(outDir, file),
    toSVG(ordered, { strokeWidth: STROKE_WIDTH_PX, physicalWidth, physicalHeight })
  );
  const travelMm = measurePenTravel(ordered) / pxPerMm;
  totalTravelMm += travelMm;
  totalLines += ordered.lines.length;
  console.log(`${cls}: ${ordered.lines.length} lines -> ${file} (~${Math.round(travelMm)}mm travel)`);
}
console.log(`total lines: ${totalLines}`);
console.log(`total pen-up travel across 4 passes: ~${Math.round(totalTravelMm)}mm`);

// Combined colour preview (not a plot file — used only to rasterize preview.png).
const combined = {
  lines: CLASSES.flatMap(({ cls }) => layerResults[cls].lines),
  width: PW,
  height: PH,
};
writeFileSync(
  join(outDir, 'preview-combined.svg'),
  toSVG(combined, {
    strokeWidth: STROKE_WIDTH_PX,
    includeBackground: true,
    backgroundColor: '#f2e9d8',
    physicalWidth,
    physicalHeight,
    layerColors: Object.fromEntries(CLASSES.map((c) => [c.cls, c.hex])),
  })
);
console.log('wrote preview-combined.svg (scratch-only, not a deliverable)');
```

Then rasterize the preview from the scratch-only combined file (not a
plot file, and not committed alongside the four deliverables):

```sh
node scripts/svg-to-png.mjs /tmp/piecework/preview-combined.svg \
  concept-brainstorming/2026-09-04-0628/preview.png --width 1500 --background '#f2e9d8'
```

## Wishes

- `ArcticOptions.marks` only exposes four fixed groupings (`one` / `
  horizontals` / `all` / `outline`) rather than an arbitrary subset of
  the four domino classes. I wanted to try inking just two *adjacent*
  classes (say N+E) to see an asymmetric two-colour pinwheel half next
  to plain paper, instead of the fixed opposite-pair `horizontals`
  preset — that needs the internal `spineMarks`/`dominoClass`
  primitives from `arctic/marks.ts`, which the package barrel doesn't
  re-export.
- There's no shared "corner registration marks" helper independent of a
  specific generator's own accent system (`color-field`'s `accents`
  array is bespoke to that module). A small `registrationMarks(paper,
  style)` utility in core would save every future multi-pen piece from
  reinventing four corner crosses by hand.
