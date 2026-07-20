# Plate VII — A World Without a Name

## Artist statement

An invented planet, catalogued but never named, plotted as if it were a
plate torn from a nineteenth-century astronomical atlas: a graduated
neatline, an engraved title, a divided scale bar along the foot, a
scatter of unlabelled stars behind — the full apparatus of scientific
authority pointed at a world that doesn't exist.

The planet generator turns out to have this whole "engraved plate"
register built in — plate frames, titles, captions, scale bars, orbit
diagrams — clearly built for the regression gallery rather than any
finished piece, and unused by either prior session in this folder (both
of which went to the fracture generator for a very different, organic,
black-and-gold kintsugi register). Nobody had pointed it at a single
subject and asked it to hold a wall. That felt like the open door.

I tried the generator's other multi-body compositions first —
`--layout orbital` ("THE SYSTEM": six worlds and an asteroid belt) piled
its planets into a clump with feature labels stacked illegibly on top of
each other, and `--layout phases` rendered seven identical fully-lit
moons in a row with no visible waxing/waning at all (the phase shading
isn't wired up, or isn't wired up the way I expected — noted below under
Wishes). Neither survived a second look. A single ringed world, alone on
the sheet with one small companion, was the only composition of the
half-dozen I tried that had any quiet to it — full plate-frame
apparatus around a huge amount of bare paper, which is exactly the
restraint this project's whole aesthetic asks for.

The detail I didn't plan for is the reason this one made the cut over
four other ringed-world seeds. `--aurora` traces dashed, wobbled ovals
around the spin poles of *every* body in the scene, not just the
primary — so the little companion moon gets its own faint corona too,
in the same pale ink as the giant's. I went looking for a bug (an
`--eclipse` flag that visibly does nothing at any moon distance/angle
combination I tried — also under Wishes) and found this instead: two
unrelated bodies, tens of millions of invented kilometres apart, marked
with the same quiet detail at the same latitude. I didn't design that
kinship in; the generator's option space produced it as a side effect of
treating "aurora" as a property of *any* rotating body rather than a
scene-level flourish. Once I saw it I couldn't un-see it, so the whole
piece is now built around it: everything else in walnut-sepia, and this
one shared, barely-there feature in its own ink, findable rather than
announced — the same restraint this repo's other engraved and etched
presets already trade in, applied to a subject the toolbox hadn't tried
yet.

Seed 8 out of the five ringed-world seeds I rendered at full quality
(3, 8, 11, 14, 22, 34, 47 across two rounds) is the one where the
cloud-band hatch breaks into the widest tonal range — a near-black
band low on the disk, a long pale run above it — so the sphere reads as
lit form rather than an evenly-toned circle before the eye even gets to
the rings.

## Materials

- **Paper**: Hahnemühle Ingres Antique, Ivory, 100gsm, laid finish, A3
  (297×420mm). The laid texture (faint parallel ribbing from the mould)
  is the point — it's what real antique atlas plates were printed on,
  and it will pick up both inks slightly unevenly the way aged paper
  does, without me having to fake that in the render.
- **Pen 1 — the plate** (frame, title, caption, scale bar, both bodies'
  form-hatch, rings, starfield — everything except the aurora):
  Rotring Isograph technical pen, 0.3mm nib, filled with Noodler's
  Walnut fountain-pen ink. Warm sepia-brown, archival, waterproof once
  cured. Hex approximation for the digital preview: `#4a3320`.
- **Pen 2 — the aurora** (the dashed polar ovals and curtain rays on
  both the planet and its moon, nothing else): Rotring Isograph, 0.2mm
  nib (one size finer — this pass is a whisper, not a line), filled
  with J. Herbin "Émeraude de Chivor". A pale, slightly grey-green
  fountain-pen ink — recessive on ivory paper, closer to a stain than a
  mark. Hex approximation: `#3f7a68`.
- Nothing else: no wash, no mounting adhesive beyond a standard float
  mount when framed.

## Process

1. Mount the Hahnemühle Ingres sheet on the plotter bed, registered
   square to the axes. Fit the **0.3mm Isograph loaded with Noodler's
   Walnut**.
2. Plot `artwork-plate.svg` — the full plate apparatus: neatline,
   "PLATE VII" title, the ringed world and its moon (form-hatch, cross-
   hatch, ring bands, limb), starfield, "A WORLD WITHOUT A NAME"
   caption, and the divided scale bar. ~84.5m of ink, single pass, no
   pen-width tricks (the generator's own offset-pass bold emphasis
   handles the ring outlines and disk limb).
3. Let the ink cure — fountain-pen ink on laid cotton-blend paper sets
   in a few minutes, but give it a clear 15 before touching the sheet.
4. Without moving or re-registering the paper, swap to the **0.2mm
   Isograph loaded with Émeraude de Chivor**.
5. Plot `artwork-aurora.svg` — the polar ovals and curtain rays on both
   bodies, nothing else. ~2.7m of ink. Because both files come from one
   render pass split after the fact (see Reproduction), they share
   exact coordinates; the only registration requirement is "don't nudge
   the sheet between passes."
6. Let both inks cure flat for at least an hour before handling.
7. Float-mount on a warm white or ivory board, glazed, in a slim pale
   or natural-wood frame — nothing that competes with the plate's own
   engraved border. No mat needed; the neatline is already doing a
   mat's job.

No hand-drawn wash, no colouring, no additional media. The piece is
entirely two pens on one sheet, exactly as plotted.

## Plot settings

- Paper: A3, portrait, 297×420mm
- Margin: 16mm clear border all sides
- Render density: 3px/mm
- Pen width (base, before the generator's own offset-pass emphasis on
  bold elements like the limb and ring edges): 0.32mm
- Seed: 8
- Two plots, same registration, no offset between them
- Estimated ink: ~84.5m (plate pass), ~2.7m (aurora pass)

## Reproduction

Both SVGs come from one deterministic CLI render (`--palette
astronomical` is used only so the aurora strokes carry a distinct hex
to split on — nothing in the final files is coloured; every path in
both is plain `stroke="#000000"`, coloured only by the physical pen
loaded for that pass):

```sh
node packages/cli/dist/cli.js planet -o master.svg \
  --paper a3 --orientation portrait --margin-mm 16 --pen-width-mm 0.32 \
  --resolution 3 --seed 8 \
  --type ringed --radius-frac 0.42 --bands --band-count 8 \
  --band-turbulence 0.3 \
  --rings --ring-tilt 30 --ring-yaw 10 --ring-count 8 --ring-density 3 \
  --ring-gap 0.14 \
  --moon --moon-dist 2.1 --moon-angle -140 --moon-radius-frac 0.22 \
  --aurora --aurora-latitude 58 --aurora-intensity 0.9 \
  --starfield --star-count 150 \
  --plate-frame --scale-bar --title "PLATE VII" \
  --caption "A WORLD WITHOUT A NAME" \
  --palette astronomical --light-elevation 40 --light-angle -40 \
  --hatch-spacing 2.1
```

Then split `master.svg` into the two pen-layer files (a one-off scratch
script, not part of the deliverable — it just tags the aurora-coloured
paths, the same "split a multi-colour render into single-pen files by
stroke colour" move the kintsugi pieces did with `--split-layers`,
adapted here because `planet` doesn't expose that flag itself):

```js
// split-layers.mjs — separate the aurora role (#4a7a6a in the
// astronomical palette) from everything else; blacken both, since the
// physical colour comes from the pen loaded, not the file.
import { readFileSync, writeFileSync } from 'node:fs';
const AURORA = '#4a7a6a';
const svg = readFileSync('master.svg', 'utf8');
const header = svg.match(/^<\?xml[^]*?<svg[^>]*>/)[0];
const paths = [...svg.matchAll(/<path[^>]*\/>/g)].map((m) => m[0]);
const main = [], accent = [];
for (const p of paths) {
  const isAurora = p.includes(`stroke="${AURORA}"`);
  const blackened = p.replace(/stroke="#[0-9a-fA-F]+"/, 'stroke="#000000"');
  (isAurora ? accent : main).push(blackened);
}
writeFileSync('artwork-plate.svg', `${header}\n${main.join('\n')}\n</svg>\n`);
writeFileSync('artwork-aurora.svg', `${header}\n${accent.join('\n')}\n</svg>\n`);
```

`preview.png` was composited from the two split files with a one-off
scratch script (not part of the deliverable) that recoloured
`artwork-plate.svg`'s strokes to `#4a3320`, `artwork-aurora.svg`'s to
`#3f7a68`, layered plate under aurora on an `#f6f0e2` ground, then
rasterized with `scripts/svg-to-png.mjs`.

## Wishes

- `--eclipse` ("Companion moon casts its shadow on the planet") produced
  byte-identical output to the same render with the flag omitted, across
  every `--moon-dist`/`--moon-angle` combination I tried. Either it needs
  the moon positioned in near-exact alignment with `--light-angle` (undocumented,
  and I couldn't find the right combination by hand) or the shadow-casting
  isn't wired up yet. Worth a documented worked example, or a genuine
  fix, if the eclipse phenomenon gets revisited.
- `--layout phases` renders every body in the sequence fully lit with no
  visible terminator/crescent progression — the phase concept (the
  whole reason for the layout) doesn't currently read. `--layout
  orbital`'s auto-placement clumps bodies together and overlaps their
  `--orbit-labels` into an illegible stack rather than spacing them
  around distinct orbits. Both layouts want real layout-fixing work
  before they're gallery-ready; I'd love to revisit "the phases of an
  invented moon" as its own piece once `phases` actually shows phases.
- No way to scope `--aurora` to one body only (primary vs. companion) —
  in this piece that turned out to be a feature, but a future piece
  might want the reverse: an aurora on the moon and *not* the planet, or
  vice versa.
