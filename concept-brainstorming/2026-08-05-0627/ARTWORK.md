# Coincidence

## Artist statement

A harmonograph is a Victorian parlour instrument: two or three pendulums,
losing energy to friction, drive a pen between them and draw their own
decay — a physical record of a system running out of motion. This
repo's `harmonograph` generator reimplements that machine exactly (two
lateral pendulums plus a rotary platen term, each axis a damped sine),
and at the right settings its trace stops looking like a Spirograph toy
and starts looking like something else entirely: a small number of wide,
clean, elliptical passes at the outside, tightening and multiplying
toward a dense knot at the centre. That is also, coincidentally, the
shape of a chirp — the waveform of two orbiting masses spiralling
together, slow and wide at first, faster and tighter right up to the
merger. A 19th-century desk toy and a 21st-century gravitational-wave
detector draw the same picture for the same reason: something losing
energy, in a spiral, in ever less time.

The piece leans into the second reading without simulating it — I never
touched a physics engine, only `damping`, `rotary` and `ratioNum`/
`ratioDen` on the existing pendulum model until the decay read as orbital
rather than decorative. Then I used the generator's `passes`/`inkGroups`
feature, built for overprinted banknote guilloché, for something more
literal: two passes of the *same* decaying figure, each with its own
small seeded phase and damping asymmetry, plotted in two different inks.
That is how a real detection is confirmed — not one recording, but two
independent instruments catching the same brief event and agreeing, down
to a few milliseconds of arrival delay. Gold and pale ice-blue trace
almost the same spiral and almost the same knot; where they diverge is
the only evidence that there were ever two witnesses instead of one. The
small grey crosses in the corners are a plotter's registration marks,
plotted for real (so the second pen can find the first pen's page again)
— and left visible, because a data plate showing its own fiducials is
more honest than one that hides them.

Twenty-some seeds and a wide sweep of damping/rotary/ratio combinations
went into the bin before this one (seed 11, ratio 2:3, damping 0.4,
rotary 0.6) — most either stayed too polite and circular (pure
Spirograph) or over-decayed into an unreadable scribble with no outer
rings left to read as "orbit" at all. This one keeps four or five clean,
legible outer passes before it commits to the knot, which is what sells
the before/after of an inspiral rather than just a pretty rosette.

## Materials

- **Paper** — Stardream Metallic, colourway *Anthracite*, 285gsm, A3
  (297×420mm) portrait. A pearlescent, faintly shimmering dark cover
  stock (flat colour approximation `#1b1b1e`) — not a flat black but a
  sheet with its own quiet sparkle, so the metallic inks sit on a ground
  that already reads as night sky rather than a hole cut in the page.
- **Ink 1 — "witness A"**: Sakura Gelly Roll Metallic, **Gold** (08),
  hex approx. `#c9a24d`. Plotted first.
- **Ink 2 — "witness B"**: Sakura Gelly Roll Metallic, **Blue** (08),
  hex approx. `#9fb4d8` (a pale, cool ice-blue metallic — noticeably
  cooler than the gold so the two traces stay legible where they
  overlap). Plotted second, and also used for the four corner
  registration crosses.
- Both are pigment gel rollers rated for dark/black stock; no white
  ground layer or gesso needed underneath either ink.

## Process

1. Load the Stardream Anthracite A3 sheet, portrait, onto the plotter
   bed. Home the machine.
2. Fit the gold Gelly Roll pen. Plot `coincidence-gold.svg` — one
   continuous chained stroke, the first decaying pendulum trace.
3. Let the gold ink set (gel ink on coated/pearlescent stock is slow;
   give it a full 20 minutes before anything touches the sheet).
4. Swap to the blue Gelly Roll pen **without removing the paper from the
   bed** — the whole point of this piece is that the second trace lands
   in the same coordinate space as the first, the way a second
   observatory's timeline sits in the same reference frame as the
   first's. Plot `coincidence-blue.svg` (the second decaying trace) and
   then `coincidence-register.svg` (the four corner crosses) with the
   same blue pen, back to back, no pen change between them.
5. If the paper *does* have to come off the bed and go back on (a
   different plotter, a paused job resumed later), use the four corner
   crosses already plotted in gold-adjacent passes — align a straightedge
   to the previous pass's crosses before sending the blue job, rather
   than re-homing from the sheet edge.
6. Let the second pass cure fully (20 minutes) before handling, framing,
   or glazing. Float-mount or use spacers under the glazing — metallic
   gel sits slightly proud of the sheet and can transfer to glass under
   direct pressure.

No wash, no hand-sketch pass, no misregistration on purpose: the piece's
whole argument is that the two passes are trying to be identical and
almost succeed. Deliberately smudging that would undercut it.

## Plot settings

| | Value |
|---|---|
| Paper | A3, 297×420mm, portrait |
| Margin | 45mm |
| Pen width | 0.5mm (both inks) |
| Render resolution | 3 px/mm |
| Figure bounding box | ≈168mm wide × 160mm tall, centred |
| Pen-down travel | 1 continuous chained path per layer (optimizePlot on) |
| Hand-sketch / wobble | none — a harmonograph's whole character is that it is *not* hand-drawn |

## Reproduction

Built from a normal repo checkout (`pnpm install && pnpm build`), CLI
binary at `packages/cli/dist/cli.js`:

```sh
node packages/cli/dist/cli.js harmonograph \
  --paper a3 --orientation portrait --margin-mm 45 --pen-width-mm 0.5 \
  --resolution 3 \
  --seed 11 --mode harmonograph \
  --ratio-num 2 --ratio-den 3 --detune 0.006 \
  --damping 0.4 --rotary 0.6 --phase 90 --periods 60 \
  --jitter 0.15 --ink-groups 2 --passes 2 --scale 0.85 \
  --split-layers --crosses \
  -o coincidence.svg
```

This writes three files, renamed for the deliverable:

- `coincidence.ink-0.svg` → `coincidence-gold.svg`
- `coincidence.ink-1.svg` → `coincidence-blue.svg`
- `coincidence.register.svg` → `coincidence-register.svg`

Verified byte-identical across two independent runs of the command
above. `preview.png` was rendered by compositing the three layers with
their intended inks and rasterizing with `scripts/svg-to-png.mjs`
(background `#1b1b1e`, strokes recoloured `#c9a24d` / `#9fb4d8` /
`#6b6f7a` for gold / blue / register — the compositing is a small inline
script, not a repo script, since `svg-to-png.mjs` recolours a whole SVG
to one ink rather than per-layer).

## Wishes

- `svg-to-png.mjs` only supports a single `--stroke` override for the
  whole file. A `--layer-colors ink-0=#c9a24d,ink-1=#9fb4d8` mode (or
  reading per-layer colours straight out of a stack recipe) would make
  multi-ink previews a one-liner instead of a hand-rolled extraction
  script — this session's `--split-layers` output stores the ink as a
  plain `stroke="#000000"` on each `<path>`, so recolouring per layer
  currently means parsing that attribute out by hand.
