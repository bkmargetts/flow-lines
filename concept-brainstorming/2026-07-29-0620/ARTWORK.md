# Suminagashi — Three Castings

## Artist statement

Suminagashi (墨流し, "floating ink") is usually named the oldest marbling
technique on record — older than Turkish ebru, older than European
marbling — and Japanese tradition traces it to Echizen province, a
historic papermaking region, where it is said to have been kept for
generations as a closely-held family craft. Its oldest use wasn't
decoration for its own sake: since the Heian court, sheets carrying its
rings were the paper waka poetry was written on, cut into the narrow
vertical strips called *tanzaku* or the small squares called *shikishi*.
The pattern came first; the poem was trusted to sit on top of it.

The method is almost embarrassingly simple and this repo's marbling
module (`packages/core/src/marbling`) implements the real physics of
it, not a lookalike: ink dropped onto still water spreads into rings by
surface tension alone, a breath or a fan pushes those rings into soft
waves, and a sheet of paper laid on the surface lifts the pattern off
whole. `generateMarbling`'s doc comment calls its rake and drop
operations "exact closed-form plane maps" — the same claim a marbler
would make about the water. And because a marbler can pull more than
one sheet from the same disturbed bath — each lift a fainter, more
dispersed echo of the one before — this piece is three tanzaku panels,
not one: three notional castings from a single bath, calm to turbulent
to dispersing, plotted as three separate strips meant to hang together.

The other decision was to refuse colour entirely. Real suminagashi is a
solid-ink pattern; a plotter can only give you its outline. Rather than
fight that, this piece leans all the way into it: every ring is drawn as
a bare contour, nothing filled, which reads less like marbled paper and
more like the *keyblock* of one — the black-only line impression a
Japanese woodblock printer pulls first, before any colour block touches
it (*sumizuri-e*). What survives is the water's structure with none of
its stain: concentric rings, a few soft turbulent knots where two drops
collided, and — deliberately, because it's the same restraint real
suminagashi sheets need to still read as calm water rather than scribble
— long stretches of untouched paper. Panel one keeps almost all of it,
observing its own quiet opening the way a hung scroll holds blank space
above the image (*ma*, 間). Panel three spends most of its length
letting the ink's turbulence run itself out into nothing. That's the
piece: not a marbled sheet, but the diagram of what one is.

## Materials

- **Paper** — Hahnemühle Bamboo 290 gsm, natural (unbleached bamboo/cream
  tone, ~`#efe4d0`); a heavier, plotter-safe stand-in for washi with the
  right warm, slightly toothy cast for this. Cut to three strips at
  **60 mm × 360 mm** each — the traditional tanzaku ratio (roughly 1:6,
  a narrow hanging poem-strip), well inside the A3 machine limit.
- **Ink** — Sailor Kiwa-Guro nano-pigment black (waterproof, archival
  pigment sumi-black, hex ~`#141414`), loaded in a 0.3 mm technical
  pen. A Sakura Pigma Micron 005 is an equivalent off-the-shelf
  substitute if Kiwa-Guro cartridges aren't on hand.
- **Mounting** — three brass curtain rings or a length of thin washi
  tape per panel, a plain wooden dowel (~400 mm) to hang the set from,
  and a strip of wheat-starch paste paper (or acid-free washi tape) for
  the hinge.

## Process

1. Build the repo (`pnpm install && pnpm build`) and run the
   reproduction script below to generate the three panel SVGs.
2. Cut three strips of Hahnemühle Bamboo 290 gsm to at least
   70 mm × 370 mm (5 mm of holding margin on each edge for the
   plotter's bed clips/tape), then trim to the finished 60 mm × 360 mm
   after plotting.
3. Load the plotter with the 0.3 mm Kiwa-Guro pen. Plot
   `panel-1-first-casting.svg` at true size (60 mm × 360 mm, portrait,
   no added margin — the pattern is already drawn to the sheet edge).
4. Swap to a fresh strip; plot `panel-2-second-casting.svg`, same pen,
   same settings.
5. Swap to a fresh strip; plot `panel-3-third-casting.svg`, same pen,
   same settings.
6. Let each strip cure at least 30 minutes before handling, 24 hours
   before mounting (Kiwa-Guro is touch-dry in minutes but wants the
   full cure before anything touches the line work).
7. Trim each strip to the finished 60 mm × 360 mm tanzaku size.
8. Hinge-mount: adhere a 10 mm strip of washi tape (or a wheat-starch
   paste hinge) across the back of the top edge only of each panel —
   traditional tanzaku mounting hinges the top edge alone so the strip
   hangs free and can move. Attach the hinge to the dowel with the
   brass rings, in order first → second → third casting, left to
   right, spaced 15 mm apart.
9. Hang the dowel on a plain wall. The strips are meant to hang loose,
   not sit flat behind glass — let them carry a slight, real
   ripple.

## Plot settings

- Custom sheet: **60 mm × 360 mm** per panel, portrait, no margin
  parameter (the geometry itself carries a 1.5 mm bleed inset — see
  reproduction script).
- Single pen, single ink, single width: **0.3 mm**.
- One SVG per panel (`inkGroups: 1`, no `--split-layers` needed — this
  is a one-pen piece).
- Line count is modest: 35, 39, and 41 strokes for panels one through
  three respectively (concentric rings, not dense hatching) — light
  pen travel, well under an hour per strip on a typical desktop
  plotter.

## Reproduction

There is no CLI command for `marbling` yet (a core-only generator), so
this calls the core API directly. Build the repo
(`pnpm install && pnpm build`), save the following as
`generate.mjs` in the repo root, and run `node generate.mjs`:

```js
// Suminagashi — three tanzaku panels, three successive castings of the same
// notional ink bath (calm -> disturbed -> dispersing). Core-only generator
// (no CLI command), so this drives packages/core/dist/index.js directly.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { generateMarbling, toSVG } = await import(join(here, 'packages/core/dist/index.js'));

const PX_PER_MM = 3; // BASE_PX_PER_MM
const WIDTH_MM = 60;
const HEIGHT_MM = 360;
const W = WIDTH_MM * PX_PER_MM;
const H = HEIGHT_MM * PX_PER_MM;
const PEN_WIDTH_MM = 0.3;
const STROKE_PX = PEN_WIDTH_MM * PX_PER_MM;
const MARGIN_PX = 1.5 * PX_PER_MM;

const PANELS = [
  {
    name: 'panel-1-first-casting',
    seed: 23,
    drops: 7,
    ringsPerDrop: 5,
    dropRadius: 26 * PX_PER_MM,
    combStrength: 0.05,
    wavy: 0.25,
    vortexStrength: 0,
  },
  {
    name: 'panel-2-second-casting',
    seed: 59,
    drops: 8,
    ringsPerDrop: 5,
    dropRadius: 25 * PX_PER_MM,
    combStrength: 0.12,
    wavy: 0.35,
    vortexStrength: 0.03,
  },
  {
    name: 'panel-3-third-casting',
    seed: 67,
    drops: 9,
    ringsPerDrop: 4,
    dropRadius: 24 * PX_PER_MM,
    combStrength: 0.22,
    wavy: 0.5,
    vortexStrength: 0.08,
  },
];

for (const p of PANELS) {
  const result = generateMarbling({
    width: W,
    height: H,
    margin: MARGIN_PX,
    pattern: 'stone',
    seed: p.seed,
    drops: p.drops,
    ringsPerDrop: p.ringsPerDrop,
    dropRadius: p.dropRadius,
    dropRadiusJitter: 0.3,
    inkGroups: 1,
    combStrength: p.combStrength,
    wavy: p.wavy,
    vortexStrength: p.vortexStrength,
    detail: 0.9,
    wobble: 0,
  });
  const svg = toSVG(result, {
    strokeColor: '#141414',
    strokeWidth: STROKE_PX,
    physicalWidth: `${WIDTH_MM}mm`,
    physicalHeight: `${HEIGHT_MM}mm`,
  });
  writeFileSync(join(here, `${p.name}.svg`), svg);
  console.log(`wrote ${p.name}.svg (${result.lines.length} lines, seed ${p.seed})`);
}
```

`preview.png` was rendered from the three SVGs with
`scripts/svg-to-png.mjs`, recoloured to the envisioned ink/paper
(`--stroke '#141414'`, paper `#efe4d0`) and composited into one image
with a neutral warm-grey mat (`#d9d3c4`) standing in for the mounting
wall — the compositing step (embedding each recoloured panel SVG as a
data-URI `<image>` inside one wrapper SVG, then rasterizing once with
`@resvg/resvg-js`) was a scratch step and isn't required to reproduce
the panels themselves.

## Wishes

`generateMarbling` (like the other bath/field generators) only takes a
single uniform `margin`, inset equally on all four sides. A per-edge
margin — even just a `marginTop` override — would let a suminagashi
piece reserve a clean band at the head of the sheet for calligraphy
(the historically accurate move: poems were brushed directly onto the
marbled tanzaku afterward) without hand-translating point coordinates
in a scratch script.
