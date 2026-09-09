# Talus

## Artist statement

There is a theorem, not an image, at the bottom of this drawing. Sample a
uniformly random domino tiling of a large Aztec diamond — no artistic
choice involved, just an exact combinatorial shuffle — and the four
corners freeze into perfect brick order while the middle stays
disordered. As the diamond grows, the boundary between frozen and liquid
converges to a circle inscribed in the diamond. Nothing in the algorithm
mentions a circle; the circle is a consequence of counting. This is the
arctic circle theorem (Jockusch–Propp–Shor, 1998), and `packages/core`'s
`arctic` generator already draws it — inking one of the four domino
classes as welded spines, so a frozen corner reads as solid tone, the
liquid region reads as scattered dashes, and the boundary between them is
the theorem made visible. I found it undocumented in a `README` table and
un-plotted in thirty-five prior sessions of this routine.

Inked as a single class at the top of the diamond, the shape stops being
a diagram. It becomes a slope: a solid ridge at the summit, in perfect
courses like sedimentary rock or hard-packed snow, breaking apart with
distance from the peak into looser and looser scatter — exactly the
grading of a talus cone, the fan of broken rock a cliff sheds at its
base, coarse and stable near the wall and fine and scattered toward its
outer edge. A geological process and a random-tiling theorem produce the
same shape for unrelated reasons — one is gravity sorting rubble by how
far it can bounce, the other is a two-colouring counting argument — and I
kept staring at the coincidence rather than moving on to the next
candidate. That's the whole case for this piece: a real proof, not a
noise field pretending to be one, drawn so plainly it reads as a
mountainside before it reads as mathematics. I tried it as a woven
four-colour diamond (`weave`) and as a lens-shaped double horizon
(`horizon`) first — both are in the toolbox and both are handsome — but
neither commits to one idea as hard as a single dissolving slope does.
Restraint won.

At full A3 order (170) the drawn tone is dense enough to read as true
grey at arm's length and resolve into individual courses up close — the
two ways real scree reads, from a ridge and from underfoot.

## Materials

- **Paper** — GF Smith Colorplan "Ebony Black", 270gsm, smooth finish, A3
  (297×420mm), portrait.
- **Ink** — one pen: a bone-white opaque gel ink (Uni-ball Signo Broad
  UM-153 White, or equivalent archival opaque white gel), hex
  approximation `#eef0ea`, run at an effective 0.35mm line.
- **Mounting** — float-mounted in a black-core frame with a deep (6–8mm)
  reveal, no visible mat window edge against the black sheet — the paper
  should read as depth, not as a bordered print.

## Process

1. Tape the Colorplan Ebony Black sheet to the plotter bed, portrait,
   registration corner top-left.
2. Load the white gel pen. Gel ink pools more than a fineliner's, so run
   the plotter at reduced speed (≈40% of the fineliner default) and let
   the pen lift cleanly between the many short dashes in the outer
   (liquid) region — a rushed lift is what turns a dash into a comma.
3. Plot `artwork.svg` in one pass — a single pen, single class of line,
   already reordered for pen travel (`orderPlot`, not the chaining
   `optimizePlot` — see Reproduction). No second pass, no wash, no
   registration to get right: the restraint is the point.
4. Let the gel ink cure flat and uncovered for at least 24 hours before
   handling — opaque white gel stays tacky far longer than dye ink,
   especially where the frozen-corner courses run dense and close.
5. Frame as above once fully cured.

## Plot settings

- Paper: A3, portrait, 297×420mm.
- Margin: 15mm.
- Pen: one, 0.35mm effective width, bone-white opaque gel ink.
- Seed: 14 (diamond order 170, `dissolve` preset, class `one`/N,
  wobble 0.35 — see Reproduction for the full option set).
- Lines: 3,408 welded/dashed spine segments.
- Estimated ink drawn: ≈16.4m. Estimated pen-up travel after `orderPlot`:
  ≈10.3m (≈39% of total pen movement pen-up — reordering alone, no
  chaining, per the generator's own doc comment on why dominoes must stay
  discrete strokes).

## Reproduction

Built with `packages/core`'s `arctic` generator (domino tiling of the
Aztec diamond, `packages/core/src/arctic`) — no CLI command exists for it
yet (see Wishes), so this is a scratch Node script against the built core
package, run from the repo root after `pnpm build`:

```js
// talus.mjs — "Talus": arctic-circle domino tiling as a scree cone.
// Usage: node talus.mjs <outDir>
import { writeFileSync, mkdirSync } from 'node:fs';
import { generateArctic } from './packages/core/dist/arctic/index.js';
import { toSVG } from './packages/core/dist/svg.js';

const outDir = process.argv[2] || '.';
mkdirSync(outDir, { recursive: true });

const SEED = 14;

// Physical A3 portrait @ 3px/mm, 15mm margin, 0.35mm pen — matches the
// repo's standard BASE_PX_PER_MM density.
const WIDTH = 891, HEIGHT = 1260, MARGIN = 45;
const PEN_MM = 0.35;
const INK = '#eef0ea'; // bone-white gel ink

const result = generateArctic({
  width: WIDTH,
  height: HEIGHT,
  margin: MARGIN,
  seed: SEED,
  preset: 'dissolve', // one class (N) inked: solid mass -> circular dissolve
  order: 170,          // AD(170): fine enough for the weld/dash contrast at
                        // A3, still above the ~0.3mm floor a 0.35mm nib needs
  marks: 'one',
  upright: false,
  wobble: 0.35,
  // optimize: true (default) — orderPlot, not optimizePlot: chaining would
  // fuse separate dominoes into one path and round-cap the joins, softening
  // the crisp lattice the drawing is about (see arctic/index.ts's own note).
});

const svg = toSVG(result, {
  strokeWidth: PEN_MM * 3, // px at 3px/mm
  strokeColor: INK,
  physicalWidth: '297mm',
  physicalHeight: '420mm',
});

writeFileSync(`${outDir}/artwork.svg`, svg);
console.log('lines:', result.lines.length, 'seed:', result.seed);
```

Run:

```sh
pnpm install && pnpm build
node talus.mjs concept-brainstorming/2026-09-09-0618
```

This writes `artwork.svg` byte-for-byte identical to the committed file
(verified: run twice, diffed, identical — the sampler is exactly
deterministic per seed, no burn-in, no Markov mixing).

`preview.png` rasterizes it against the paper colour:

```sh
node scripts/svg-to-png.mjs concept-brainstorming/2026-09-09-0618/artwork.svg \
  concept-brainstorming/2026-09-09-0618/preview.png \
  --width 1800 --background '#0a0d12'
```

(`artwork.svg` already carries the bone-white ink hex as its stroke
colour, so the preview needs only `--background` to approximate the
black Colorplan sheet — no `--stroke` override.)

## Wishes

- `arctic` has no CLI command (`flow-lines arctic ...`) despite being a
  fully-built, tested, web-exposed generator with its own module,
  controls and genome (`packages/web/src/projects/arctic`) — every other
  generator at this level of polish has one. This session had to fall
  back to a scratch script for what should be a one-line CLI call; it's
  the same gap the `terraces` and `tangles` sessions hit before.
- The public `ArcticOptions.marks` is a strategy name (`'one' |
  'horizontals' | 'all' | 'outline'`), not a domino class, so there's no
  way to ask for the `S`/`E`/`W` corner directly — only `N` via `'one'`.
  I got the summit-down composition anyway by flipping the whole result
  vertically after generation (trivial, since the four corners are
  symmetric under rotation), but a `marks: ['S']`-style class list would
  make "which corner freezes where" a direct choice instead of a
  post-hoc flip.
- No way to bias *where in the liquid region* the mass concentrates —
  composition is entirely the diamond's own geometry plus a random seed
  that also drives the hand-drawn wobble. That's fine for this piece
  (the point is that the shape needs no artistic intervention) but would
  matter for a second piece built on the same generator.
