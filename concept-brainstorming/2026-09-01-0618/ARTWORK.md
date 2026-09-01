# Mélange

## Artist statement

`arctic` is one of this repo's most recent generators and, as far as this
studio's records go, has never been used here before. It doesn't draw a
picture of anything — it samples a uniformly random domino tiling of the
Aztec diamond AD(n) by domino shuffling (Elkies–Kuperberg–Larsen–Propp,
1992): O(n²), no Markov chain, no burn-in, no mixing question, so the
tiling is exact and exactly deterministic per seed. Every domino falls
into one of four classes by orientation and parity — the code names them
N, S, E, W — and as n grows, the tiling *freezes*: each class comes to
dominate one compass corner in perfect brick order, while a disordered
mix of all four classes survives only inside a boundary that converges,
provably, to the circle inscribed in the diamond. That's the Arctic
Circle Theorem (Jockusch–Propp–Shor, 1998), and it's where the generator
gets its name. Nothing in the sampling algorithm mentions a circle. It
falls out of pure combinatorics.

`marks: 'horizontals'` inks only the N and S classes — the two domino
families that freeze at the top and bottom corners — and leaves E and W
paper. That single choice is what turns the theorem into an image: two
solid, brick-ordered masses at the top and bottom of the sheet, each
dissolving, at the *same* radius, into a lens-shaped field where N and S
strokes appear at random and never weld into anything longer than a short
dash. In dimer-model theory this interior is literally called the
*liquid* region, against the *frozen* corners — a real term I didn't have
to invent, just point a pen at. I rendered it first as the raw domino
outline (`brick`), then as one frozen mass in a field of speckle
(`dissolve`), then as this two-pole lens (`horizon`), then as all four
classes woven into a dense textile (`weave`, upright). The lens won:
it's a complete, self-contained composition with no need to leave
three-quarters of the sheet blank the way `dissolve` does, and unlike
`weave` its texture stays legible as *two* things meeting rather than a
uniform weave.

Within `horizon` I rolled a dozen-odd seeds at order 130–150 before
seed 8 stopped me. Most seeds give a lumpy, slightly uneven boundary; at
seed 8 the frozen/liquid edge at the top carves a genuine three-peak
silhouette — like a mountain range or a calving ice front — in near-exact
mirror symmetry with the boundary at the bottom, because the theorem
guarantees both edges sit on the same circle. I didn't design that
silhouette. It's the one shape, out of many I looked at and discarded,
where the theorem's abstract "exact circle" reads immediately as
something with weather in it.

That reading is the whole piece: two glaciers advancing from opposite
shores of a fjord, their calved icebergs jamming together where the
fronts meet. Glaciologists have a real name for that jumbled middle
zone — *ice mélange* (Ilulissat Icefjord, at the mouth of Jakobshavn
Isbræ in Greenland, carries one of the most photographed examples on
Earth) — and it is, descriptively, exactly what the liquid region is:
not open water, not solid ice, but a bounded band where both sources are
locally present in no order at all, sitting between two things that are
each perfectly ordered on their own. The math didn't need the metaphor to
be true. It only needed a name, and glaciology already had one waiting.

## Materials

- **Paper** — one A3 sheet (297 × 420 mm), portrait, a heavyweight
  deep-navy card, `#0d1f2d`. GF Smith Colorplan "Dark Blue" 270 gsm is
  the closest catalogue match; Canson Mi-Teintes "Night Blue" 160 gsm is
  a lighter-weight substitute if that's what's on hand. Hex is the
  source of truth — anything close to a near-black midnight blue works;
  the point is a paper dark enough that the pale inks read as ice
  against night water, not as a print on blue card.
- **Ink 1 — "glacier"** (`artwork-glacier.svg`, the N class / top mass):
  a pale, faintly cool white, `#eef5f7`. Sakura Gelly Roll "Stardust"
  White (its fine metallic fleck reads as ice crystal under raking
  light) or a plain opaque white gel (Uni-ball Signo Broad UM-153) if
  the sparkle isn't wanted — either must be genuinely opaque on dark
  card, since this layer carries half the drawing. Nib ~0.3 mm.
- **Ink 2 — "fjord"** (`artwork-fjord.svg`, the S class / bottom mass):
  a saturated cool teal, `#4f8fa3` — noticeably more colour than the
  white, so the two masses read as distinct materials rather than two
  values of one ink. A dark-paper gel range formulated for opacity
  (Sakura Gelly Roll Moonlight's ocean/teal shade is the closest
  off-the-shelf match) or a bottled teal drawing ink decanted into a
  0.3 mm technical pen. Same nib size as Ink 1.
- **Register ink** — any spare fine pencil or used-up marker in a
  neutral grey, `#5c6b73` (`artwork-register.svg`): eight tiny strokes
  forming four corner crosses, alignment reference only, not meant to
  read once framed.
- **Mounting** — a slim black or dark-walnut frame, no mat, glass with
  an anti-reflective coating if available. The piece wants the dark
  ground to read as depth, not as a filled-in background — a glossy
  reflection across it flattens exactly the thing that makes it work.

## Process

1. Register the plotter for one A3 sheet of the dark-navy card, portrait,
   15 mm margin. Tape all four corners — the sheet gets swapped between
   pens twice, and any lift will throw off registration on a piece where
   two colours share the same central field.
2. Load the register pen (grey pencil or spare marker). Plot
   `artwork-register.svg` — four small corner crosses. These go down
   first and are the only thing every later pass re-aligns against.
3. Load Ink 2 ("fjord", teal), ~0.3 mm. Plot `artwork-fjord.svg` — the
   bottom mass and its share of the interleaved dashes through the
   lens. Let the gel set for a few minutes before the next pass.
4. Swap to Ink 1 ("glacier", white), same tip size. Re-register against
   the corner crosses if the sheet moved. Plot `artwork-glacier.svg` —
   the top mass and its share of the interleaved dashes. Because no two
   dominoes ever occupy the same cell, the glacier and fjord strokes
   never physically overlap even in the liquid region — pass order
   between steps 3 and 4 doesn't affect the result, only which ink is
   loaded first.
5. Let the full sheet cure flat at least 30 minutes before handling —
   gel ink on card stays workable longer than fineliner ink on paper.
6. Frame under glass, no mat, in a slim dark frame.

## Plot settings

- Paper: A3 (297 × 420 mm), portrait, 15 mm margin.
- Pen width: 0.3 mm for both ink layers; 0.25 mm for the register pass.
- Pens: 2 ink layers (glacier, fjord) plus 1 register pass, 3 pens total.
- Resolution: 3 px/mm (`BASE_PX_PER_MM`, the CLI/web default).
- Strokes: 2,707 (glacier) + 2,657 (fjord) + 8 (register) = 5,372 plotted
  paths, already reorder-optimized (`orderPlot`, not `optimizePlot` —
  chaining would fuse separate welded dominoes and round-cap the joins,
  softening the lattice edges the drawing depends on).

## Reproduction

Deterministic from one seed. `arctic` is core-only (no CLI command yet —
see Wishes), so this calls `generateArctic`, `toSVGLayers`, `toSVG` and
`registrationCrosses` directly against the built core package. Build the
repo, save this as `melange.mjs` **in the repo root** (it imports
`packages/core/dist` by relative-from-root path), then run:

```sh
pnpm install && pnpm build
node melange.mjs concept-brainstorming/2026-09-01-0618
```

```js
// melange.mjs — "Mélange": the arctic circle theorem's Aztec-diamond
// domino tiling, N+S classes only, read as two glaciers' calving fronts
// meeting in an ice mélange. One seed, exact and deterministic.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const coreDist = join(process.cwd(), 'packages', 'core', 'dist', 'index.js');
const outDir = process.argv[2] ?? '.';
mkdirSync(outDir, { recursive: true });

const { generateArctic, toSVG, toSVGLayers, pageMetrics, getPaperSize, registrationCrosses } =
  await import(coreDist);

const PXPMM = 3; // BASE_PX_PER_MM
const MARGIN_MM = 15;
const PEN_MM = 0.3;

const a3 = getPaperSize('a3');
const pm = pageMetrics(a3, 'portrait', PXPMM);
const marginPx = Math.round(MARGIN_MM * pm.pxPerMm);

const result = generateArctic({
  width: pm.widthPx,
  height: pm.heightPx,
  margin: marginPx,
  seed: 8,
  preset: 'horizon', // inks the N + S domino classes only
  order: 150,
  wobble: 0.3,
});

// Registration crosses, own pen, so the two ink passes can be re-aligned.
const crosses = registrationCrosses(pm.widthPx, pm.heightPx, marginPx, 5 * pm.pxPerMm, pm.pxPerMm);
const withCrosses = { ...result, lines: [...result.lines, ...crosses] };

const COLORS = {
  'domino-n': '#eef5f7', // "glacier" — polar white
  'domino-s': '#4f8fa3', // "fjord" — meltwater teal
  register: '#5c6b73',
};
const WIDTHS = {
  'domino-n': PEN_MM * pm.pxPerMm,
  'domino-s': PEN_MM * pm.pxPerMm,
  register: 0.25 * pm.pxPerMm,
};

const layers = toSVGLayers(withCrosses, {
  physicalWidth: `${pm.widthMm}mm`,
  physicalHeight: `${pm.heightMm}mm`,
  layerColors: COLORS,
  layerWidths: WIDTHS,
});

const NAMES = { 'domino-n': 'glacier', 'domino-s': 'fjord', register: 'register' };
for (const layer of layers) {
  const name = NAMES[layer.layer] ?? layer.layer;
  writeFileSync(join(outDir, `artwork-${name}.svg`), layer.svg);
}

// --- Combined colour preview (not a deliverable file; feeds svg-to-png).
const previewSvg = toSVG(withCrosses, {
  physicalWidth: `${pm.widthMm}mm`,
  physicalHeight: `${pm.heightMm}mm`,
  includeBackground: true,
  backgroundColor: '#0d1f2d',
  layerColors: COLORS,
  layerWidths: WIDTHS,
});
writeFileSync(join(outDir, 'preview-source.svg'), previewSvg);
```

```sh
node scripts/svg-to-png.mjs concept-brainstorming/2026-09-01-0618/preview-source.svg \
  concept-brainstorming/2026-09-01-0618/preview.png --width 2000
```

(`preview-source.svg` is not committed, since the three layer SVGs it
merges already are — `artwork-glacier.svg`, `artwork-fjord.svg` and
`artwork-register.svg` are byte-identical to what the script above
produces.)

## Wishes

- `arctic` has no CLI command yet — like `terraces` before it, everything
  here goes straight at `packages/core/dist/index.js`. Its option surface
  (`--preset`, `--order`, `--marks`, `--upright`) would transfer cleanly.
- `registrationCrosses` (in `packages/core/src/tiling.ts`, re-exported
  from the barrel) is exactly the helper a hand-rolled multi-pen
  core-only script needs for pass alignment, and it's what the CLI's
  `--crosses` flag calls internally — but a core-only generator has no
  CLI to reach that flag through, so a session has to know the function
  exists and import it directly. It isn't mentioned anywhere in this
  README's core-only-generator guidance; a one-line pointer there would
  save the next session from re-deriving "does this repo have a register
  mark helper" from source.
