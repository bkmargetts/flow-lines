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
  polygons/polylines (`PortraitOptions`), semantic label rasters
  (`LabelImage`, taxonomy in `semantic-map.ts`). Shared internals live in
  `src/lib/` (`rng.ts` — the repo-standard LCG + `randomSeed`/`subSeed`;
  `polyline.ts` — trim/offset/smooth/clip/point-in-polygon; `math.ts`) and
  are **not** exported from the package barrel. The big generators are
  directories, one concern per file (`botanical/`, `pen-ink/`, `conway/`,
  `landscape/`, `planet/`), each with an `index.ts` the flat `src/index.ts`
  barrel re-exports — the public API is the barrel, never deep paths.
- **`packages/cli`** — `flow-lines image -i photo.jpg -o out.svg` plus
  flags for every core option; decodes PNG/JPEG via pngjs/jpeg-js, and
  accepts external `--depth-image` / `--normal-image` / `--mask` /
  `--label-image` rasters (`scripts/segment-labels.mjs` generates
  `photo.labels.png` sidecars with SegFormer-b0/ADE20K). One file per
  command in `src/commands/` (registered from a thin `cli.ts`), with
  image loading in `io.ts`, the shared paper/page block in `page.ts`, and
  palette/scene tables in `palettes.ts` — deliberately duplicated from
  the web app: **the CLI never imports `packages/web`**.
- **`packages/web`** — React app (GitHub Pages). Heavy work stays off the
  main thread: the whole layer stack composites in a dedicated worker
  (`composite-worker.ts`/`composite-client.ts`, latest-wins, with a
  synchronous fallback when `Worker` is unavailable) fed by
  `modules/render-registry.ts` — the worker-safe moduleId→render map that
  imports only each module's React-free `render.ts`; image-ink's own
  rendering runs in a persistent worker with a latest-wins
  queue (`render-worker.ts`/`render-client.ts`); depth estimation runs in
  a **persistent, reused** worker that loads the model once and keeps it
  resident across photos (`depth-worker.ts`/`depth-client.ts`). It used to
  be disposable (terminated per job), but re-creating the ONNX runtime each
  photo re-paid the ~250MB session-creation spike, and iOS WebKit doesn't
  reclaim a terminated worker's WASM memory promptly — the spikes stacked
  and OOM'd Safari after a few photos. One resident worker keeps memory
  flat; the heavy WASM inference still stays off the UI thread, and the one
  shared ONNX session is run serially (sessions aren't re-entrant).
  In-browser ML: MediaPipe interactive segmentation + face landmarks,
  Depth Anything V2 and SegFormer-b0 scene labels via transformers.js
  (auto-ML waits for the first render to finish, then labels, then
  depth — instantiating the ONNX runtime costs a ~250MB transient
  regardless of model size, so it must never share its peak with the
  render or another model; WASM-only sessions pin the plain ort build,
  as the asyncify build iOS would otherwise get doubles that spike) — WASM runtimes are copied from
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
  near-solid below `richBlacks` threshold); up to 5 cross-hatch layers at
  shallow offset angles (~30°, not perpendicular — a woven grid reads
  mechanical), deeper layers gated by low-frequency noise
  (`hatchPatchiness`) so shadows build up in hand-sized patches.
- **Value plan** (`valueBands`) — tone is blurred and posterized into a
  few discrete value bands spread paper-to-black before spacing is
  computed: big committed value shapes (the artist's tonal abstraction)
  instead of continuous photographic gradation. Off for portraits, on
  everywhere else. The lightest band is held as clean paper (no marks at
  all) so big light shapes read as a decision, not a veil of stray strokes.
- **Composition-aware massing** (`massing`, `value-plan.ts`) — before the
  plan is banded, tone is *redistributed by compositional role* rather than
  reproduced from photographic luminance (the open frontier `valueBands`
  couldn't reach). Ground that sits near a subject — but isn't the subject —
  swells darker, feathered over a large radius, so the subject pops off a
  swell of background tone even where the photo's background is light (the
  one-sided `counterchange` boost can't invent that). Values are committed
  apart from the mid so scenes with no single subject still read as a few
  decisive shapes, and confident skies are never darkened. Subject-ness
  comes from the subject mask, focal points, and person/object labels;
  installed via `ImageField.setMassPlan` so spacing, the band-0 paper
  restraint, and counterchange all see the composed plan. Needs
  `valueBands >= 2`; on for the value-band presets, inert (so faithful) for
  portraits.
- **Importance map** (0..1) — composed multiplicatively from auto detail,
  focal points, subject masks, and depth bands; low importance lightens
  tone, widens spacing, suppresses outlines, increases wobble. This is
  how backgrounds dissolve into loose gestures.
- **Per-stroke dispatch** (`paramsFor`) — the illustrator decision, made
  at each seed: directional ticks / stipple dots / scribble for texture,
  capped cross-contour marks wrapping curved 3D forms (`autoStyle` +
  form confidence), sky stipple for smooth light regions, flowing hatch
  otherwise. Near-black regions defer tick texture to ordered cross-hatch
  (richBlacks finishes the job — tick noise in a black mass reads as
  mud), and weak-to-moderate midtone texture commits to hand-sized
  patches with plain hatch between (lone scattered ticks read as noise).
  New mark strategies belong here.
- **Semantic labels** (`labelMap` / `SemanticMap`) — an 8-label taxonomy
  (sky, water, foliage, ground, building, person, object, unknown) enters
  core as a Uint8 raster; majority-downsampled with blurred per-label
  confidence planes (~1% of frame feathering — a 512px model isn't
  pixel-accurate). Confident labels replace the geometric heuristics:
  calm water follows the water label at any horizon height, sky stipple
  follows the sky label (both auto-enable when unset and the material is
  in frame), cross-hatch skips labeled sky, foliage floors texture and
  scribbles in deep shadow, building facets snap plumb/level, person
  floors importance (gently — a hard floor hatches smooth clothing into
  flat masses). No labels = heuristics exactly as before; labels
  promote marks, never demote them.
- **Faceted hatching** (`facetHatch`) — toned masses without strong
  texture or 3D form are hatched as facets: flow orientation snapped to
  30° quanta plus a per-patch twist over a noise-jittered cell lattice;
  every stroke in a facet is straight at the facet's angle and
  terminates at its border. Smoothly curving streamlines are the
  strongest remaining "computer" tell; rocks, walls, and shadow masses
  in real ink work are hatched patch by patch. On for landscape/etching
  presets.
- **Sky treatment** (`skyStipple`) — stipple density carries sky tone on
  its own curve (far tighter than hatch spacing) with a
  zenith-to-horizon falloff; cloud shapes are carved as negative space
  by tracing the blurred mass-tone boundary (marching squares,
  `iso-contours.ts`) and inking it as a light outline — the edge
  detector misses soft tonal transitions entirely. Sky tone is judged on
  **raw tone, never the banded value plan** (quantization rounds grey
  skies to paper or a hatch band — both kill the stipple), and folds in
  the **absolute pre-normalization tone** (`getAbsoluteDarkness`): an
  overcast sky is usually the brightest region in the frame, so contrast
  stretching maps it to paper, but "this sky is grey, not white" must
  not depend on the rest of the photo. Importance only *widens* dot
  spacing, never blanks the sky — smooth skies always score low on
  auto-detail and sit at the far end of depth maps, but the sky is a
  feature, not a background to dissolve.
- **Calm water** (`calmWater`) — labeled water regions (fallback: smooth
  formless regions in the lower frame half) render as long broken
  horizontal strokes whose spacing carries the tone; cross-hatch layers
  skip water (hatch over water reads as land), and the break noise is
  stretched along x so the pen lifts and resumes in runs. On for the
  landscape preset, auto elsewhere when labels report water.
- **Contours** — Canny-style edge linking (NMS + hysteresis + chaining)
  produces long confident outlines; emphasized via offset single-pen
  passes with tapered ends; suppressed inside detected faces. Busy
  regions scale the contour length floor by local detail (no outline
  confetti where tone should do the work) and only long contours earn
  the multi-pass bold emphasis. A **sharpness gate** drops chains whose
  tonal step is spread out (tone change within ±2px vs ±6px of the
  line): soft mass boundaries and water reflections must not trace as
  wiggly blob outlines — the strongest "computer" tell. Depth
  silhouettes are exempt (real but tonally soft).
- **Silhouette halos** (`contourHalo`) — hatch and stipple stop a sliver
  short of long contours instead of crashing into them: reserved paper
  around a silhouette, the way ink artists hold background tone off a
  subject. One-sided and contrast-gated — tone is probed beyond the
  edge's gradient skirt on both sides, and only a real tonal step stamps
  a halo, on the darker side, and only when the lighter side is
  genuinely light — dark-vs-darker edges inside a black mass must not
  carve reserved-paper veins through it. Edges inside an evenly-toned
  mass (architectural detail, fur) leave no halo, so dark masses keep
  their tone instead of going coloring-book.
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
- **Golden hashes** — `packages/core/src/goldens.test.ts` +
  `packages/web/src/module-goldens.test.ts` hash every generator / pure
  module (and one composited stack) at fixed seeds against committed
  JSON. Unlike the determinism tests (which compare two runs of the same
  build), these pin output **across changes**: any refactor or tuning
  that moves a single float fails them. A mismatch means the drawing
  changed — if intentional, re-render the galleries, eyeball-diff, and
  only then regenerate with `UPDATE_GOLDENS=1 pnpm test`. The hashes are
  the guardrail; the album is the judge.
- **`scripts/hash-baseline.mjs`** — byte-level regression tool for the
  CLI surface: renders a 47-case command × preset matrix through the
  built binary and records per-SVG sha256s (`write`), then diffs
  (`compare`). The flag→options mapping has no other coverage; run it
  around any CLI change. The manifest is a working artifact — don't
  commit it.
- **`test-images/` + `node scripts/gallery.mjs`** — the eyeball
  regression suite: renders the photo bank through every preset into one
  HTML contact sheet. Judge any tuning change against the whole album.
  `photo.depth.png` / `photo.normal.png` / `photo.labels.png` sidecars
  are applied automatically. `node scripts/segment-labels.mjs` generates
  the label sidecars — it needs huggingface.co, which the sandbox blocks,
  but the `Label Sidecars` workflow (`.github/workflows/labels.yml`) runs
  it on every push that touches the photo bank or the script and commits
  the results, so new test images get labeled by pushing them.
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
- GitHub Pages deploys `packages/web/dist` from pushes to `main`, any
  `claude/**` branch, **and** any `art/**` branch — last push wins, so the
  live site may serve a feature branch.
- **Modules & the layer stack** (`packages/web/src/modules/`,
  `projects/`, `textures/`) — the web app is a shell over one flat
  registry of art modules (`modules/registry.ts`); a plot is a *stack* of
  layer instances composited bottom→top onto one sheet (`LayerStore.tsx`,
  `lib/composite.ts`: top→bottom hold-off, per-slot pen-layer
  namespacing, page border, density protection). A module is `pure`
  (React-free `render.ts`: `state + env → lines`, run in the composite
  worker — new pure modules must also be added to
  `modules/render-registry.ts`; a parity test enforces it) or `live`
  (owns its workers/ML and publishes lines — image-ink). Each module dir
  has `types.ts` (state + defaults), `render.ts`, `Controls.tsx`, and an
  `index` exporting the `Module`. Controls are built from the shared
  atoms in `components/controls/` (`Slider`, `Toggle`, `SeedControl`,
  `AdvancedSection`/`AdvGroup`, `PresetPicker`) — don't hand-roll those
  rows. The page frame (paper, orientation, resolution, margin, fit)
  lives in a shared `FrameContext` (`FrameControls`) so every layer plots
  to the same physical sheet. New modules are developed on
  `art/<project>/<feature>` branches; merging adds them to the registry.
  PR close (merged or abandoned) auto-deletes the branch via
  `delete-branch.yml`.
- The web UI's first principle: **effortless** — upload, tap subject,
  download. Automation (face detect, depth when WebGPU, isolation on tap)
  runs without being asked; every knob lives in collapsed Advanced groups.
- **Every slider's value is click-to-type** — any `<input type="range">`
  config control must render its value badge through the shared
  `EditableValue` component (`packages/web/src/components/EditableValue.tsx`),
  so the number can be clicked (or focused + Enter/Space) and typed exactly;
  it commits clamped + step-snapped on Enter/blur. This is non-optional and
  applies to every new slider going forward. The
  guardrail test `packages/web/src/editable-sliders.test.ts` fails if any
  `.tsx` has a range slider without a matching `EditableValue`, so a forgotten
  one is caught by `pnpm test` / CI rather than relying on memory. Pass the
  same `min`/`max`/`step` as the slider; for a percentage display (slider
  bound to a 0–1 fraction, badge showing `%`) edit in percent units
  (`value={Math.round(x * 100)}` … `onChange={(v) => set(v / 100)}`); mirror a
  slider's `disabled` onto the `EditableValue`.

## Where the frontier is

Implemented: everything above. The honest open gaps, in rough order of
value: more stroke textures (bricks, grass), light-direction awareness,
richer use of the semantic labels (per-label spacing/tone curves,
material-specific marks — the plumbing is in, dispatch only scratches
the surface). Value structure now goes beyond posterization:
`valueBands` commits photographic tone to bands, and `massing`
(composition-aware redistribution — figure/ground swell + value commit)
invents the structure that isn't in the photo. The next step there is
massing that reasons about the whole frame (deliberate notan / negative-
space composition), not just subject proximity. The research review that
drove the roadmap lives in the conversation history of the original build;
its remaining items are deliberate skips (CLIPasso-family, raster neural
line drawing, SAM 2).
