# CLAUDE.md

## What this project is

Flow Lines is a generative-art toolbox that turns **photos into
plotter-ready pen-and-ink SVG drawings**. The goal is not "image filter"
output but work that reads as *drawn by a person*: confident contour
lines, hatching that follows 3D form, different marks for different
materials, deliberate restraint (paper does most of the work), and a
hand-drawn wobble. The quality bar is real pen-and-ink illustration
(architectural sketches, etchings, illustrated landscapes) — when
judging output, compare against human ink work, not against other
algorithmic renderers.

Everything must remain **plottable**: plain stroked SVG paths, a single
pen at a single width, deterministic per seed. Bold lines are built from
repeated offset passes of the same pen (with tapered ends), never from
stroke-width tricks.

## Architecture

pnpm monorepo:

- **`packages/core`** — all algorithms. Pure TypeScript, runs in Node and
  browser, **never imports ML or DOM**. ML results enter as plain data:
  grayscale rasters (`GrayscaleImage`), direction maps, normalized
  polygons/polylines (`PortraitOptions`).
- **`packages/cli`** — `flow-lines image -i photo.jpg -o out.svg` plus
  flags for every core option; decodes PNG/JPEG via pngjs/jpeg-js, and
  accepts external `--depth-image` / `--normal-image` / `--mask` rasters.
- **`packages/web`** — React app (GitHub Pages). Heavy work stays off the
  main thread: rendering runs in a persistent worker with a latest-wins
  queue (`render-worker.ts`/`render-client.ts`); depth estimation runs in
  a **disposable** worker terminated after each job to release model
  memory (phones kill tabs over blocked main threads or resident models).
  In-browser ML: MediaPipe interactive segmentation + face landmarks,
  Depth Anything V2 via transformers.js — WASM runtimes are copied from
  node_modules into the build (`scripts/copy-mediapipe-wasm.mjs`) and
  served from our origin; model weights come from Google/HF CDNs at
  runtime with graceful fallback chains (WebGPU→WASM, fp16→q8).

## The rendering pipeline (core concepts)

- **`ImageField`** — per-location tone, stroke orientation, edge strength,
  texture detail. Orientation = luminance structure tensor, overridden by
  depth where present: depth-gradient tangent + **principal-curvature
  frame** (depth-Hessian eigenvectors — stable on crests where gradients
  vanish; depth *steps* are cut at a median-relative scale so silhouettes
  can't poison the frame), optionally overridden by an external flow map.
- **Streamline hatching** — Jobard–Lefer evenly-spaced streamlines; local
  spacing is tone (tight in shadow, blank above the white cutoff,
  near-solid below `richBlacks` threshold); up to 4 cross-hatch layers at
  offset angles.
- **Importance map** (0..1) — composed multiplicatively from auto detail,
  focal points, subject masks, and depth bands; low importance lightens
  tone, widens spacing, suppresses outlines, increases wobble. This is
  how backgrounds dissolve into loose gestures.
- **Per-stroke dispatch** (`paramsFor`) — the illustrator decision, made
  at each seed: directional ticks / stipple dots / scribble for texture,
  capped cross-contour marks wrapping curved 3D forms (`autoStyle` +
  form confidence), sky stipple for smooth light regions, flowing hatch
  otherwise. New mark strategies belong here.
- **Contours** — Canny-style edge linking (NMS + hysteresis + chaining)
  produces long confident outlines; emphasized via offset single-pen
  passes with tapered ends; suppressed inside detected faces.
- **Portrait geometry** — face landmarks become skin-lightening ovals,
  protected feature regions, and sparse artist-style feature strokes
  (upper lid + iris dot, single brow line, inner lip line only).
- **Humanisation** — low-frequency simplex wobble per stroke (bold lines
  wobble less), misregistration offsets.
- **`optimizePlot`** — endpoint chaining + nearest-neighbour ordering;
  fewer pen lifts, big plot-time wins. On by default.

## Testing & tuning

- `pnpm test` — vitest against **synthetic images** (tubes, disks,
  gradients, checkerboards) asserting geometric properties: stroke
  directions, densities, termination, determinism per seed.
- **`test-images/` + `node scripts/gallery.mjs`** — the eyeball
  regression suite: renders the photo bank through every preset into one
  HTML contact sheet. Judge any tuning change against the whole album.
  `photo.depth.png` / `photo.normal.png` sidecars are applied
  automatically.
- Web flows are verified with headless Chromium (preinstalled at
  `/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell`;
  launch with `--ignore-certificate-errors` in the sandbox).

### Sandbox network notes (Claude remote sessions)

npm registry and `storage.googleapis.com` are reachable;
huggingface.co, jsdelivr, Wikimedia are **blocked** — so transformers.js
model downloads cannot run here. Test ML browser flows by intercepting
model URLs with Playwright `page.route` and serving locally downloaded
weights, or verify the graceful error path. The photo bank itself was
sourced from Google's public `cloud-samples-data` bucket for this reason.

## Conventions

- Keep `packages/core` ML-free and DOM-free; new capabilities follow the
  pattern "browser/CLI acquires data → core consumes plain rasters".
- Defaults are seeded-deterministic and judged against the gallery.
- The repo squash-merges; stacked PRs must be rebased onto `main` after
  each parent lands (`git rebase --onto origin/main <oldParentTip> <child>`).
- GitHub Pages deploys `packages/web/dist` from pushes to `main` **and**
  any `claude/**` branch — last push wins, so the live site may serve a
  feature branch.
- The web UI's first principle: **effortless** — upload, tap subject,
  download. Automation (face detect, depth when WebGPU, isolation on tap)
  runs without being asked; every knob lives in collapsed Advanced groups.

## Where the frontier is

Implemented: everything above. The honest open gaps, in rough order of
value: semantic region labels for dispatch (no good in-browser model
yet), tonal abstraction/composition (artists invent value structure that
isn't in the photo), more stroke textures (bricks, grass), light-direction
awareness. The research review that drove the roadmap lives in the
conversation history of the original build; its remaining items are
deliberate skips (CLIPasso-family, raster neural line drawing, SAM 2).
