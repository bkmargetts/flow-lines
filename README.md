# Flow Lines

A generative-art toolbox that produces **plotter-ready pen-and-ink SVG** — from
photographs and from a library of procedural generators.

Everything it emits is plottable: plain stroked SVG paths, a single pen at a
single width, deterministic per seed. Bold lines are built from repeated offset
passes of the same pen, never from stroke-width tricks.

**Live app:** https://bkmargetts.github.io/flow-lines/

## Contents

- [Getting started](#getting-started)
- [The web app](#the-web-app)
- [The CLI](#the-cli)
  - [Image → Pen & Ink](#image--pen--ink)
  - [Common flags](#common-flags)
  - [Command reference](#command-reference)
- [Development](#development)
- [License](#license)

## Getting started

### Prerequisites

- Node.js 18+
- pnpm 9+

```bash
pnpm install
pnpm build
```

### Repository layout

pnpm monorepo:

```
packages/
  core/     # all algorithms — pure TypeScript, no DOM, no ML
  cli/      # the `flow-lines` command-line interface
  web/      # React app (deployed to GitHub Pages)
scripts/    # gallery contact sheets, label sidecars, hash baselines
test-images/# the photo bank used as an eyeball-regression suite
```

`packages/core` never imports ML or DOM code. Machine-learning results enter as
plain data — grayscale rasters, direction maps, normalized polygons, semantic
label rasters — acquired by the browser or the CLI and handed to core.

## The web app

```bash
pnpm --filter @flow-lines/web dev      # dev server
pnpm --filter @flow-lines/web build    # production build
```

The app is a shell over one flat registry of art modules. A plot is a **stack of
layer instances** composited bottom→top onto a single sheet, with a shared page
frame (paper size, orientation, margin, resolution) so every layer plots to the
same physical sheet.

The first principle is *effortless*: upload, tap your subject, download. Face
detection, depth estimation and subject isolation run automatically; every knob
lives in a collapsed Advanced group.

### Modules

| Module | Kind | What it draws |
|---|---|---|
| Image → Ink | live | Photographs as pen-and-ink hatching (see below) |
| Flow Field | pure | Noise-driven flow lines |
| Botanical Generator | pure | Grown, lit botanical illustrations |
| Planet Generator | pure | Shaded procedural planets, rings, comets |
| Landscape Generator | pure | Procedural landscapes |
| City Generator | pure | Isometric cities with an order/chaos slider |
| Stick Men | pure | Isometric stick figures with a pose library |
| Sports Balls | pure | Shaded polyhedral ball studies |
| Hearts | pure | Love hearts in four pen-and-ink styles |
| Ribbon Weave | pure | Celtic knotwork / woven lattices |
| Tangles | pure | Corrugated ducts or shoelaces worming over and under |
| Gestural Ink | pure | Kline/Hartung/sumi gestural abstractions |
| Machine | pure | Meshing gear trains, belts, ropes, weights |
| Conway Long Exposure | pure | Game of Life history as comet trails |
| Complex Flow | pure | Complex rational-function flow fields |
| Reaction–Diffusion | pure | Gray–Scott patterns as strokes |
| Lenia | pure | Continuous cellular automata |
| Physarum | pure | Slime-mould agent transport networks |
| Fracture | pure | Crack propagation — mud cracks, glaze crazing |
| Noise Texture | pure | Noise-modulated line fields |
| Colour Field | pure | Atmospheric multi-ink gradients |
| Ink Field | pure | Braided ribbons and colour-plane fields for crossing inks |
| Marbling | pure | Suminagashi / ebru paper marbling |
| Meander | pure | Fisk-style river-migration cartography |
| Coral | pure | Differential-growth organisms |
| Warp Grid | pure | Op-art gratings deformed by hidden relief |
| Harmonograph | pure | Decaying pendulum curves, spirograph wheels, engine-turned guilloché rosettes |
| Impact Grid | pure | A hand-ruled grid struck along a drawn path — displaced, torqued, shattered |
| Lapidary | pure | Agate bands, breccia fragments, strata or spirals — textured regions split by paper seams |
| Pattern | pure | Background hatch / grid / dot textures |
| Grating (multi-ink) | pure | Interleaved multi-pen gratings |
| Blank (template) | pure | Empty module, the template for new ones |

### Plotter output

- **Download SVG** — one combined file.
- **Download layers (.zip)** — one SVG per pen layer, for multi-pen plots.
- **Download sheets (.zip)** — multi-sheet tiling, one SVG per physical sheet
  (and one folder per sheet, one registered SVG per pen, for multi-pen plots).
- Registration crosses and trim marks get their own pen layers so paper can be
  re-registered between pen swaps.
- Density protection caps repeated passes so the pen does not shred the sheet.

Undo/redo (50 steps) and a per-module library of user-saved presets are built
in. Presets persist in `localStorage`; the layer stack itself is in-memory and
is not preserved across a refresh.

## The CLI

```bash
pnpm --filter @flow-lines/cli start <command> [options]
# or, after `pnpm build`:
node packages/cli/dist/cli.js <command> [options]
```

### Image → Pen & Ink

The `image` command converts a PNG or JPEG into plotter-ready strokes:

```bash
flow-lines image -i photo.jpg -o out.svg
```

- Strokes follow the contours of the image (luminance structure tensor,
  overridden by depth where present), wrapping around forms the way an artist
  shades them.
- Local stroke spacing is driven by tone — tight hatching in shadow, open paper
  in highlights — and darker regions accumulate cross-hatched layers.
- Strong edges are linked into long, confident outlines and emphasised with
  offset single-pen passes; they export on a separate bold-pen layer.
- A subtle per-stroke wobble and misregistration keeps it from reading as
  machine-perfect.
- Subject isolation focuses ink where it matters: `--detail` fades flat regions,
  `--focus` (repeatable) falls off around focal points, and `--mask` suppresses
  the background entirely.
- Depth maps (`--depth-image`, bright = near) make strokes follow real surface
  geometry, stop cleanly at silhouettes, and fade distant backgrounds.
- Semantic labels (`--label-image`) steer mark dispatch: calm water follows the
  water label at any horizon height, sky stipple auto-enables when a sky is in
  frame, foliage keeps leafy texture, and people never dissolve into background
  gesture.

Key `image` options:

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --input` | Input image (PNG or JPEG) | required |
| `-w, --width` | Output width in px (height follows aspect) | 800 |
| `--layers` | Hatching layers; shadows get cross-hatched (1-4) | 3 |
| `--min-spacing` | Stroke spacing in the darkest areas (px) | 2.5 |
| `--max-spacing` | Stroke spacing in the lightest hatched areas (px) | 14 |
| `--white-cutoff` | Darkness below which paper stays blank (0-1) | 0.08 |
| `--hatch-angle` | Fallback hatch angle for flat regions (degrees) | -45 |
| `--no-follow-tone` | Hatch at fixed angles instead of following contours | off |
| `--no-outlines` | Skip the edge outline pass | off |
| `--wobble` | Hand-drawn wobble amplitude in px (0 = ruler-straight) | 0.8 |
| `--detail` | Emphasize detailed regions; flat areas fade (0-1) | 0.3 |
| `--focus` | Focal point `x,y` in output coordinates (repeatable) | none |
| `--focus-radius` | Radius of full detail around the focal point (px) | 25% of output |
| `--focus-strength` | How strongly detail fades outside the focus (0-1) | 0.85 |
| `--mask` | Subject mask image (bright = subject) | none |
| `--mask-strength` | How strongly the mask suppresses the background (0-1) | 1 |
| `--depth-image` | External depth map (bright = near) | none |
| `--normal-image` | External normal map used as a direction field (R/G = X/Y) | none |
| `--label-image` | Semantic label raster (taxonomy id in the red channel) | none |
| `-s, --seed` | Random seed for reproducibility | random |

Label raster taxonomy: `0` unknown, `1` sky, `2` water, `3` foliage, `4` ground,
`5` building, `6` person, `7` object. `node scripts/segment-labels.mjs` writes
`photo.labels.png` sidecars with SegFormer (ADE20K); the gallery script picks
them up automatically.

### Common flags

Every command accepts `-w/--width`, `-h/--height`, `-s/--seed`, `-m/--margin`,
`--stroke-color`, `--stroke-width`, `--background`, `--background-color` and
`-o/--output`.

Most commands also accept:

- **Paper** — `--paper`, `--orientation`, `--margin-mm`, `--pen-width-mm`,
  `--resolution` for plotting to a physical sheet.
- **Tiling** — `--tile`, `--tile-orientation`, `--tile-overlap`, `--tile-marks`,
  `--tile-assembly` (`trim`/`stitch`/`fit`), `--crosses` for multi-sheet work
  beyond the plotter's A3 limit.
- **Hand-sketch finish** — `--hand-sketch`, `--hand-sketch-style`,
  `--hand-sketch-passes`, `--hand-sketch-overshoot`, `--hand-sketch-breaks`.
- `--split-layers` writes one SVG per pen layer for multi-pen plots.

Run `flow-lines <command> --help` for the full, authoritative flag list.

### Command reference

| Command | What it draws |
|---|---|
| `generate` | Flow lines from a noise field |
| `grid` | Flow lines from a grid of starting points |
| `image` | A photo as pen-and-ink hatching |
| `conway` | A long exposure of Conway's Game of Life |
| `botanical` | Procedural botanical illustrations |
| `planet` | Procedural pen-and-ink planets |
| `landscape` | Procedural pen-and-ink landscapes |
| `gesture` | Gestural ink abstractions |
| `machine` | Page-sized generative machines |
| `fracture` | Crack-propagation networks |
| `marbling` | Mathematical paper marbling |
| `lapidary` | Layered pattern artworks — agate bands, breccia, strata or a winding spiral ribbon, split by paper seams |
| `meander` | River-migration cartography |
| `coral` | Differential-growth organisms |
| `warp-grid` | Op-art gratings deformed by hidden relief |
| `tangles` | Corrugated ducts or shoelaces weaving over and under |
| `harmonograph` | Harmonograph, spirograph and guilloché curve machines |
| `stack` | A multi-layer composite described by a JSON recipe |

Several generators are currently reachable only from the web app's controls —
Reaction–Diffusion, Lenia, Physarum, Colour Field, City, Stick Men, Sports
Balls, Hearts, Ribbon Weave and Complex Flow have no dedicated CLI command —
but every one of them can be rendered as a `stack` layer.

### Layer stacks (`flow-lines stack`)

`stack` is the CLI counterpart of the web app's layer panel: a JSON recipe
lists layers bottom → top, each a core generator with its own options, ink and
pen, plus the layer-combination controls — clean-paper hold-off halos,
overprint, stencil clips (render a layer only inside or outside another
layer's shape), page-space transforms and echo copies, halo-gap outlines, and
halo exemption. Output supports `--split-layers` (one registered SVG per pen)
and the full tiling/crosses flag set.

```bash
flow-lines stack recipe.json -o out.svg --split-layers
```

```jsonc
{
  "version": 1,
  "page": { "paper": "a4", "orientation": "portrait", "resolution": 3, "marginMm": 12 },
  "border": { "insetMm": 0 },
  "layers": [
    {
      // Background hatch, held a clean sliver off everything above it,
      // and only drawn inside the coral mass's silhouette.
      "generator": "texture",
      "options": { "seed": 5, "style": "hatch", "spacingMm": 3.2, "angleDeg": 30 },
      "color": "#b34700",
      "holdOffMm": 1.5,
      "haloOutline": true,
      "clip": { "source": "organism", "mode": "inside", "growMm": 4, "featherMm": 1 }
    },
    {
      "id": "organism",
      "generator": "coral",
      "options": { "seed": 12, "preset": "reef" },
      "color": "#1c2f4a",
      "echo": { "copies": 2, "dxMm": 0.8, "dyMm": 0.6 }
    }
  ]
}
```

Recipe notes:

- `layers[].generator` names a core generator (`flow-lines stack` with an
  unknown name lists every valid one); `layers[].options` is that generator's
  own option object — `width`/`height` always come from the page, `margin`
  defaults to the page margin, and a missing `seed` defaults to a stable
  per-layer value so recipes reproduce byte-identically.
- `clip.source` is another layer's `id` (or 0-based index); `mode` keeps ink
  `inside` or `outside` that layer's silhouette, `growMm` sets how far apart
  strokes still merge into one mass, `expandMm` insets/outsets the shape and
  `featherMm` lets the cut edge wander organically.
- `transform` (`dxMm`/`dyMm`/`rotateDeg`/`scale`) moves a layer's finished
  lines about the page centre; `echo` repeats them with compounding per-copy
  deltas (misregistration, drop shadows, radial repeats).
- `holdOffMm` reserves clean paper around every layer stacked above (set
  `haloOutline` to trace the gap's edge as a light stroke); `overprint`
  crosses inks instead; `haloExempt` keeps lower layers from reserving paper
  around this layer without the overprint blend.
- Optional `border`, `sketch` (the hand-sketch finish) and `density`
  (stroke-density protection) blocks mirror the web app's frame controls.

## Development

```bash
pnpm build        # build every package
pnpm test         # vitest across core, cli and web
```

### Testing

- **Unit tests** run against *synthetic* images (tubes, disks, gradients,
  checkerboards) and assert geometric properties: stroke directions, densities,
  termination, determinism per seed.
- **Golden hashes** (`packages/core/src/goldens.test.ts`,
  `packages/web/src/module-goldens.test.ts`) hash every generator at fixed seeds
  against committed JSON, pinning output *across changes*. A mismatch means the
  drawing changed — if that was intentional, re-render the galleries, eyeball
  the diff, then regenerate with `UPDATE_GOLDENS=1 pnpm test`.
- **The gallery is the judge.** `node scripts/gallery.mjs` renders the whole
  photo bank through every preset into one HTML contact sheet. Judge any tuning
  change against the entire album, not a single image.

### Scripts

| Script | Purpose |
|---|---|
| `scripts/gallery.mjs` | Photo bank × every preset → HTML contact sheet |
| `scripts/botanical-gallery.mjs` | Botanical species × composition sheet |
| `scripts/planet-gallery.mjs` | Planet types × plates × layouts sheet |
| `scripts/city-gallery.mjs` | City styles × order × seed sheet |
| `scripts/ribbons-gallery.mjs` | Ribbon Weave presets sheet |
| `scripts/machine-gallery.mjs` | Machine presets sheet |
| `scripts/hash-baseline.mjs` | Byte-level CLI regression baseline (`write`/`compare`) |
| `scripts/segment-labels.mjs` | SegFormer label sidecars for `test-images/` |
| `scripts/svg-to-png.mjs` | Rasterize a plot, optionally recolouring paper/ink |

Contributor guidance — architecture, conventions and the module contract — lives
in [CONTRIBUTING.md](CONTRIBUTING.md) and [CLAUDE.md](CLAUDE.md).

## License

MIT — see [LICENSE](LICENSE).
