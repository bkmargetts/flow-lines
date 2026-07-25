# Contributing to Flow Lines

## The quality bar

Flow Lines turns photos and procedural systems into **plotter-ready pen-and-ink
drawings**. The goal is not "image filter" output but work that reads as *drawn
by a person*: confident contour lines, hatching that follows 3D form, different
marks for different materials, deliberate restraint, and a hand-drawn wobble.

When judging output, compare it against real pen-and-ink illustration —
architectural sketches, etchings, illustrated landscapes — not against other
algorithmic renderers.

## Non-negotiables

1. **Everything stays plottable.** Plain stroked SVG paths, a single pen at a
   single width, deterministic per seed. Bold lines come from repeated offset
   passes of the same pen with tapered ends, never from stroke-width tricks.
2. **`packages/core` stays ML-free and DOM-free.** New capabilities follow the
   pattern "browser/CLI acquires data → core consumes plain rasters".
3. **The CLI never imports `packages/web`.** Palette and preset tables are
   deliberately duplicated.
4. **Defaults are seeded-deterministic** and judged against the gallery.
5. **The public API is the `packages/core` barrel**, never a deep path.

## Setup

```bash
pnpm install
pnpm build
pnpm test
```

## Before you open a PR

```bash
pnpm build      # core and cli are `tsc`; web is `tsc && vite build`
pnpm test       # unit tests + golden hashes
```

If you touched the CLI surface, also run the byte-level baseline — the
flag→options mapping has no other coverage:

```bash
node scripts/hash-baseline.mjs write     # before your change
# ...make your change, rebuild...
node scripts/hash-baseline.mjs compare   # after
```

The manifest it writes is a working artifact; it is gitignored, not committed.

If you changed rendering defaults or tuning, re-render the gallery and judge the
**whole album**, not one image:

```bash
node scripts/gallery.mjs        # -> gallery/index.html
```

### Golden hashes will fail on any output change

`packages/core/src/goldens.test.ts` and `packages/web/src/module-goldens.test.ts`
pin every generator's output at fixed seeds. Any refactor or tuning that moves a
single float fails them — that is the point. A mismatch means the drawing
changed. If the change was intentional, re-render the galleries, eyeball-diff
the result, and only then regenerate:

```bash
UPDATE_GOLDENS=1 pnpm test
```

## Adding a web module

Modules live in `packages/web/src/modules/` (registry), `projects/` (generative
modules) and `textures/` (backgrounds). Copy `textures/blank/` as a starting
point.

A module is either:

- **`pure`** — a React-free `render.ts` of the shape `state + env → lines`, run
  inside the composite worker. Pure modules **must** also be registered in
  `modules/render-registry.ts`; a parity test enforces it.
- **`live`** — owns its own workers/ML and publishes lines (only `image-ink`).

Each module directory carries `types.ts` (state + defaults), `render.ts`,
`Controls.tsx`, and an `index` exporting the `Module`. Register it in
`modules/registry.ts`.

### Checklist for a new module

- [ ] Registered in `modules/registry.ts`
- [ ] Pure modules registered in `modules/render-registry.ts`
- [ ] Controls built from the shared atoms in `components/controls/` — `Slider`,
      `Toggle`, `SeedControl`, `AdvancedSection`/`AdvGroup`, `PresetPicker`.
      Don't hand-roll those rows.
- [ ] Controls open with the shared `RandomiseButton` ("surprise me"), wired to a
      `random<X>Genome(rng)` that patches state within the sliders' ranges and
      rolls a fresh seed. **This one gets forgotten.**
- [ ] The genome is registered in the spec table in `modules/genomes.test.ts`
- [ ] Every slider's value badge renders through `EditableValue` so the number
      is click-to-type. Pass the same `min`/`max`/`step` as the slider, and
      mirror the slider's `disabled`.

### Genome rules

A `random<X>Genome` patches state **within the sliders' own ranges** and rolls a
fresh seed. It must never touch:

- the seed field itself (the caller rolls it),
- pen/ink aesthetics (palette, stroke colour),
- quality/fidelity preferences,
- user data (painted points, masks, uploaded photos).

`modules/genomes.test.ts` enforces exactly those rules for every registered
genome.

### Slider rule

Every `<input type="range">` config control renders its value badge through
`EditableValue` (`components/EditableValue.tsx`), so the number can be clicked
(or focused + Enter/Space) and typed exactly. It commits clamped and
step-snapped on Enter/blur. For a percentage display (slider bound to a 0–1
fraction, badge showing `%`), edit in percent units:
`value={Math.round(x * 100)}` … `onChange={(v) => set(v / 100)}`.

`packages/web/src/editable-sliders.test.ts` fails if any `.tsx` has a range
slider without a matching `EditableValue`.

## Branches and merges

- New modules are developed on `art/<project>/<feature>` branches.
- The repo **squash-merges**. Stacked PRs must be rebased onto `main` after each
  parent lands: `git rebase --onto origin/main <oldParentTip> <child>`.
- GitHub Pages deploys `packages/web/dist` from `main`, any `claude/**` branch
  and any `art/**` branch — **last push wins**, so the live site may be serving
  a feature branch.
- Closing a PR (merged or abandoned) auto-deletes its branch.

## Architecture

`CLAUDE.md` is the detailed engineering handbook — the rendering pipeline, the
mark-dispatch model, the semantic-label taxonomy, and where the open frontier
is. Read it before changing anything in `packages/core/src/pen-ink/`.
