# Sett

## Artist statement

A *sett* is the technical name, in tartan and plaid weaving, for the
complete repeating sequence of coloured threads — the recipe that,
crossed warp over weft, produces the check. This piece is a sett with
no weaver and no loom: it comes from `arctic`, a generator built a few
sessions ago and never yet used for a piece, which samples a uniformly
random domino tiling of the Aztec diamond by exact domino shuffling
(Elkies–Kuperberg–Larsen–Propp — no Markov chain, no burn-in, so the
drawing is exactly reproducible per seed) and then exploits the arctic
circle theorem: as the diamond grows, a random tiling *freezes* into
four brick-regular corners — one per domino orientation — while staying
completely disordered inside a circle inscribed in the diamond, with a
razor-sharp boundary between the two. Nothing in the algorithm mentions
a circle, or a weave. Both are theorems, not decoration.

The generator's `weave` preset inks all four domino classes as welded
spines and, turned upright, lands the four frozen corners on the four
corners of a square sheet. The moment I saw that render the textile
reading was unavoidable: four thread colours, each owning a corner
outright — solid, regular, like a selvage where the loom hasn't
started interlacing yet — dissolving toward the centre into a woven
plaid check that is disordered at the level of any one crossing but
statistically inevitable in aggregate, because the theorem guarantees
the boundary's shape. I rendered thirteen seeds at three diamond orders
before keeping this one. Order 110 was the deciding factor over both
neighbours: at 80 the weave reads as coarse basketry and the corner
boundary is too smooth to trust; at 140 the four colours start to
optically fuse into a single grey-brown haze at arm's length, which
throws away the one thing worth having — that you can still see four
distinct threads interlacing. Seed 31 earned the keep over the other
finite-size fluctuations on offer because of the doubled arc near the
upper-right corner: a faint second ring just inside the main boundary,
a real echo of the freezing process rather than an added flourish, that
reads uncannily like a growth ring or a tide mark on a stone.

What I'm drawn to is the same thing that made `arctic`'s existing
gallery preview strong before anyone had used it for a plate: this is
combinatorics that produces genuine textile structure — warp, weft,
selvage, a woven check — without a single line of the code knowing
what weaving is. The dye names below aren't set dressing; four
distinct, identifiable natural-dye colours are what make the corners
read as *thread*, not just as four arbitrary inks, and the sett's
whole claim on the eye depends on being able to follow one colour from
its solid corner into the disordered weave and lose it there.

## Materials

- **Paper** — a 280 × 280 mm square, trimmed from a full A3 sheet of
  Hahnemühle Ingres, colour *Naturale* (warm oatmeal), 100 gsm laid
  (chain-line) mould-made paper. The laid finish's faint parallel
  ribbing is a coincidence worth keeping face-up: at close range it
  reads as the fine grain of a woven ground, under the plotted weave.
- **Inks** — four archival 0.3 mm fineliners/technical pens (e.g.
  Sakura Pigma Micron or Staedtler pigment liner in matching custom
  colours, or a refillable technical pen loaded with these inks),
  named for the natural dye sources historically used for each hue:
  - **Walnut** (domino-E) — `#5c4326`
  - **Madder** (domino-S) — `#7a2e2e`
  - **Indigo** (domino-N) — `#2a3d66`
  - **Iron-gall** (domino-W) — `#1a1a1a`
- **Mounting** — acid-free museum board, float-mounted with a ~5 mm
  reveal on all sides, in a deep box frame (glass held clear of the
  paper). No wash, no other media — the four passes of line are the
  whole piece.

## Process

1. Trim the A3 sheet to a true 280 × 280 mm square with a rotary
   cutter and a quilter's ruler (a fabric-cutting tool, deliberately,
   for a piece about weaving) rather than a standard paper guillotine.
2. Tape the square to the plotter bed and set the origin. The paper
   stays taped in place, untouched, through all four passes below —
   only the pen changes, so there is no registration step and no risk
   of misalignment between colours.
3. Load the **walnut** pen (0.3 mm) and plot `artwork-walnut.svg`
   (1,416 lines).
4. Swap to the **madder** pen and plot `artwork-madder.svg`
   (1,476 lines).
5. Swap to the **indigo** pen and plot `artwork-indigo.svg`
   (1,493 lines).
6. Swap to the **iron-gall** pen and plot `artwork-iron-gall.svg`
   (1,498 lines) — plotted last so the darkest, most graphic corner
   sits visually on top of the stack.
7. Optional: letter a small specimen label in walnut ink beneath the
   square, in the manner of a mill sample-book swatch card — e.g.
   "Sett No. 31 — AD(110), 12,210 dominoes" — then float-mount and
   frame as above.

## Plot settings

- Sheet: custom 280 × 280 mm square (`280x280`), portrait, cut down
  from A3 stock.
- Margin: 25 mm on all sides.
- Pen width: 0.3 mm, all four layers.
- Render resolution: 4 px/mm (1120 × 1120 px working canvas).
- Diamond order: AD(110) — 12,210 dominoes.
- Total pen-up travel across the four passes: ≈ 58,860 mm (~58.9 m).
- Strokes are reordered (not chained) to cut pen travel — chaining
  would fuse separate dominoes into one path and round-cap the joins,
  softening the crisp lattice the drawing depends on. `generateArctic`
  does this internally by default.

## Reproduction

Seed 31, order 110, exactly reproduces this drawing byte-for-byte.

```sh
pnpm install && pnpm build
node sett.mjs concept-brainstorming/2026-08-30-0619
```

```js
// sett.mjs — "Sett": a random domino tiling of the Aztec diamond AD(110),
// rendered in `weave` mode (all four domino classes inked as spines) and
// turned upright so the four frozen corners land on the four corners of a
// square sheet. Each class becomes its own single-pen layer, assigned a
// natural-dye ink colour, so the plotted object reads as a four-thread
// woven swatch. Run from the repo root after `pnpm build`.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const coreDist = join(process.cwd(), 'packages', 'core', 'dist', 'index.js');
const outDir = process.argv[2] ?? '.';
mkdirSync(outDir, { recursive: true });

const {
  generateArctic,
  toSVG,
  arcticLayerName,
  resolvePaperSize,
  pageMetrics,
  measurePenTravel,
} = await import(coreDist);

const SEED = 31;
const ORDER = 110;

const paper = resolvePaperSize('280x280'); // square, trimmed from an A3 sheet
const metrics = pageMetrics(paper, 'portrait', 4); // 4 px/mm -> 1120 x 1120 px
const { widthPx: W, heightPx: H, pxPerMm } = metrics;
const marginMm = 25;
const penWidthMm = 0.3;

const result = generateArctic({
  width: W,
  height: H,
  margin: marginMm * pxPerMm,
  seed: SEED,
  order: ORDER,
  marks: 'all',
  upright: true,
  wobble: 0.35 * (pxPerMm / 3), // amplitude was tuned at the app's 3px/mm reference scale
  optimize: true, // orderPlot internally -- chaining would fuse separate dominoes
});

const physicalWidth = `${paper.widthMm}mm`;
const physicalHeight = `${paper.heightMm}mm`;
const strokeWidth = penWidthMm * pxPerMm;

// Ink assignment: natural-dye colour names, one per domino class / pen layer.
const INK = {
  [arcticLayerName('E')]: { name: 'walnut', hex: '#5c4326' },
  [arcticLayerName('S')]: { name: 'madder', hex: '#7a2e2e' },
  [arcticLayerName('N')]: { name: 'indigo', hex: '#2a3d66' },
  [arcticLayerName('W')]: { name: 'iron-gall', hex: '#1a1a1a' },
};

let totalTravelMm = 0;
for (const [layer, ink] of Object.entries(INK)) {
  const lines = result.lines.filter((l) => l.layer === layer);
  const layerResult = { lines, width: W, height: H, seed: result.seed };
  writeFileSync(
    join(outDir, `artwork-${ink.name}.svg`),
    toSVG(layerResult, { strokeWidth, strokeColor: ink.hex, physicalWidth, physicalHeight })
  );
  totalTravelMm += measurePenTravel(layerResult) / pxPerMm;
  console.log(`${ink.name} (${layer}): ${lines.length} lines -> artwork-${ink.name}.svg`);
}
console.log(`dominoes: ${ORDER * (ORDER + 1)}`);
console.log(`total pen-up travel across 4 passes: ~${Math.round(totalTravelMm)} mm`);

// Combined colour reference -- not a plot file, used only to rasterize preview.png.
const layerColors = Object.fromEntries(Object.entries(INK).map(([k, v]) => [k, v.hex]));
writeFileSync(
  join(outDir, 'preview-combined.svg'),
  toSVG(result, {
    strokeWidth,
    layerColors,
    includeBackground: true,
    backgroundColor: '#efe6d3',
    physicalWidth,
    physicalHeight,
  })
);
```

Then rasterize the preview:

```sh
node scripts/svg-to-png.mjs concept-brainstorming/2026-08-30-0619/preview-combined.svg \
  concept-brainstorming/2026-08-30-0619/preview.png --width 1600
```

(`preview-combined.svg` is a working file for the raster preview only —
it is not one of the four plotted layers and isn't part of this
folder's committed deliverables.)

## Wishes

- The plotted lines carry no fill, so on real cotton/laid paper the
  four inks stay optically separate rather than actually interleaving
  the way dyed threads would in a physical weave — the piece trades on
  that tension rather than hiding it, but a future "thread" stroke
  style (a subtle over/under gap where two colours' spines cross,
  mimicking real interlacement) would push the textile reading further
  without leaving single-pen-per-layer plotting.
- `arctic` has no CLI command yet (unlike every other generator in the
  toolbox table) — this run drove it entirely through a scratch script
  against `packages/core/dist`. A `flow-lines arctic` command mirroring
  the other generators' `--paper`/`--preset`/`--seed` flags would save
  the next session this setup.
