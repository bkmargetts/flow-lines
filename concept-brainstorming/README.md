# Concept Brainstorming — the studio session brief

This folder is a studio. Each run of the concept-brainstorming routine is
an **independent creative session**: you (the session) experiment with the
repo's generators and configuration options as much as needed until one
piece emerges that you are *genuinely drawn to* — something you would
stand behind as an interesting, sellable artwork. The more creative the
better. This document is the whole brief; follow it start to finish.

The frequency of runs is decided by the studio owner (they trigger
sessions on whatever schedule they like), so every run stamps its output
with **date + time**, never assuming "one per day".

## Mission

- Explore widely before committing. Render many candidates across
  different generators, seeds, papers, and parameter extremes. Cheap
  iterations first (small resolution, quick seeds), then refine the
  short-list at full quality.
- Critique hard. The repo's quality bar is real pen-and-ink work —
  etchings, architectural sketches, illustrated landscapes — not other
  algorithmic renderers. Ask of each candidate: would this stop someone
  walking past a gallery wall? Would *you* pin it up?
- Discard freely. The first pleasing output is rarely the one. A session
  that throws away twenty renders to keep one is working correctly.
- Be led by an idea, not a knob. The strongest results come from a
  *concept* ("a machine drawn as if excavated", "a tide chart as woven
  ribbon", "one landscape plotted twice, misregistered, in two blues")
  and then bending the tools to serve it — not from sweeping sliders
  until something happens.

## Hard constraints (the machine)

- The plotter takes **A3 maximum**: one sheet is at most 297×420 mm
  (`--paper a3`). Smaller sheets are fine and often stronger.
- **One pen at one width per layer.** Plain stroked SVG paths only. Bold
  lines come from repeated offset passes, never stroke-width tricks —
  the generators already handle this; don't fight it.
- **Bigger than A3 is allowed** — as a multi-sheet work: use the tiling
  flags (`--tile`, `--tile-marks`, `--tile-assembly`) to slice a large
  virtual sheet into A3 panels the owner plots separately and assembles.
  A diptych/triptych or a 2×2 grid of A3 panels is a legitimate (and
  interesting) format.
- **Deterministic and reproducible.** Record the exact command and seed
  for every final SVG. If the piece can't be regenerated from ARTWORK.md
  alone, the run is incomplete.
- **Configuration only.** A brainstorming run never changes code. If you
  hit a capability you wish existed, note it in ARTWORK.md under "Wishes"
  — it becomes roadmap input, not a patch.

## The toolbox

Set up once per session:

```sh
pnpm install && pnpm build
```

**CLI** (`node packages/cli/dist/cli.js <command> --help` for every flag):

| Command | What it makes |
|---|---|
| `generate` / `grid` | Noise flow-field line drawings |
| `image` | Photo → pen-and-ink (use `test-images/` — rights-cleared, with `.labels.png` sidecars; `--style` presets: comic, dore, ballpoint, sumie…) |
| `botanical` | Procedural plants |
| `planet` | Pen-and-ink planets |
| `landscape` | Pen-and-ink landscapes |
| `conway` | Game-of-Life long-exposure stills |
| `gesture` | Gestural ink abstraction |
| `machine` | Page-sized mechanical contraptions |
| `fracture` | Crack-propagation networks (mud, crazing, shatter) |

Shared flags on all of them: `--paper a3` (or `a4`, `a5`, or `WxH` in mm),
`--orientation`, `--margin-mm`, `--pen-width-mm`, `--seed`, the
`--hand-sketch-*` family, and the `--tile` family. `--split-layers`
(where present) writes one SVG per pen layer — the door to multi-pen and
multi-colour pieces.

**Core-only generators** (no CLI command yet): city, ribbon-weave,
stickmen, sports-balls, complex-flow, reaction-diffusion, lenia,
physarum, color-field, overlapped-lines. Drive them from a scratch Node
script — the pattern is in `scripts/city-gallery.mjs`: import from
`packages/core/dist/index.js`, call the generator, hand the result to
`toSVG` with physical mm dimensions (`PAPER_SIZES` / `pageMetrics` give
you A3 numbers). Web pure modules (`packages/web/src/modules/*/render.ts`)
are also React-free and Node-runnable if a module has state the core API
doesn't expose.

**Combining:** nothing stops you compositing — render two generators to
the same sheet dimensions and merge their line sets (or their SVGs as
registered layers for different pens). `optimizePlot` and
`limitStrokeDensity` from core keep the result plottable.

**Preview:** `node scripts/svg-to-png.mjs in.svg out.png
[--width 1600] [--background '#fff'] [--stroke '#000']` rasterizes any
SVG. Use `--background`/`--stroke` to approximate the envisioned
materials (e.g. `--background '#1a1a2e' --stroke '#e8e4d8'` for
cream-ink-on-midnight-paper).

## The vision requirement

**The artwork is the finished physical piece, not the SVG.** The SVG is
an ingredient. A run that stops at "here is a nice render" has not
finished the job — the vision must say how the SVG is *used*, and the
owner is happy to get hands-on in the making. Think like a printmaker:

- Paper: colour, weight, texture (hot-press white, black card, kraft,
  toned tan, handmade cotton rag…).
- Inks/pens: specific colours (named gel/fineliner/acrylic-marker inks
  or hex equivalents), metallics, white ink on dark stock, pen widths
  per layer.
- Process around the plot: layered colour passes from `--split-layers`,
  deliberate misregistration between passes, plotting the same file
  twice rotated 180°, masking/resist before a wash, watercolour or tea
  wash over (or under) the plotted line, folding, multi-panel assembly,
  edge-to-edge bleeds via negative margins on a larger virtual sheet.
- Presentation: single sheet, tiled panel grid, concertina book, float
  mount — whatever the piece asks for.

The vision must be *specific enough to execute without you present*:
colours by name/hex, layer order, alignment method, drying time between
passes if inks interact.

## Deliverables

Create one folder per run, stamped with the session's date and time:

```
concept-brainstorming/YYYY-MM-DD-HHMM/
├── artwork.svg              # the final piece (single-pen case)
├── artwork-layer-1.svg      # …or one SVG per pen/colour layer
├── artwork-tile-*.svg       # …and per-panel SVGs if tiled
├── preview.png              # rasterized preview approximating the vision
└── ARTWORK.md               # the full vision (see below)
```

`ARTWORK.md` must contain:

1. **Title** and a short **artist statement** — what the piece is, why
   this one survived the cull, what you're drawn to in it.
2. **Materials** — paper (colour/weight/size), every pen/ink with colour
   name + hex, anything else (wash media, tape, mounting).
3. **Process** — numbered steps from blank sheet to finished piece:
   which SVG plots when, with which pen, at what width; registration and
   assembly; any hand steps. Complete enough that the owner can realise
   it exactly.
4. **Plot settings** — paper size/orientation, margin, pen width(s),
   estimated pen travel if notable.
5. **Reproduction** — the exact command(s) and seed(s) (or the scratch
   script, inlined in a code block) that regenerate every SVG in the
   folder, byte-for-byte.
6. **Wishes** (optional) — capabilities the session wanted but the repo
   lacks.

## Working practice

- All intermediates (candidate renders, scratch scripts, contact sheets)
  live in the session scratchpad, **never in the repo**. Commit only the
  run folder.
- Don't touch `cli-hash-baseline.json`, goldens, or anything outside
  `concept-brainstorming/`.
- Commit on the session's working branch with a message naming the piece,
  push, and open a PR against `main` titled
  `Concept: <title> (YYYY-MM-DD)` with the preview PNG and statement in
  the PR body. The owner reviews and merges at their leisure; branch
  cleanup on PR close is automatic.
