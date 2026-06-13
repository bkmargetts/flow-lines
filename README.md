# Flow Lines

A generative art toolbox for creating beautiful SVG artwork for pen plotters.

## Features

- **Flow Lines Generator**: Create beautiful flow field art based on Perlin/Simplex noise
- **Image → Pen & Ink**: Render photos as hand-drawn-style hatching and cross-hatching
- **CLI Tool**: Generate artwork from the command line
- **Web App**: Interactive browser-based interface for designing artwork
- **SVG Export**: All output is SVG, perfect for pen plotters

## Project Structure

This is a monorepo using pnpm workspaces:

```
packages/
  core/     # Shared algorithms and SVG generation
  cli/      # Command-line interface
  web/      # React-based web application
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Using the CLI

```bash
# Generate flow lines with default settings
pnpm --filter @flow-lines/cli start generate

# Generate with custom settings
pnpm --filter @flow-lines/cli start generate \
  --width 800 \
  --height 600 \
  --lines 200 \
  --seed 12345 \
  --output my-artwork.svg

# Generate from a grid of starting points
pnpm --filter @flow-lines/cli start grid \
  --grid-spacing 25 \
  --output grid-flow.svg

# Render an image as pen-and-ink hatching
pnpm --filter @flow-lines/cli start image \
  --input photo.jpg \
  --width 800 \
  --output portrait-ink.svg
```

### Image → Pen & Ink

The `image` command (and the "Image → Ink" mode in the web app) converts a
PNG or JPEG into plotter-ready strokes that mimic a pen-and-ink drawing:

- Strokes follow the contours of the image (via a smoothed structure tensor),
  wrapping around forms the way an artist shades them
- Local stroke spacing is driven by tone — tight hatching in shadows, open
  paper in highlights — and darker regions accumulate cross-hatched layers
- Strong edges are traced as outlines
- A subtle per-stroke wobble and misregistration makes the result feel
  hand-drawn rather than machine-perfect
- Subject isolation focuses ink where it matters: detailed regions keep
  tight hatching while flat backgrounds fade (`--detail`), rendering can
  fall off around one or more focal points (`--focus`, repeatable for
  multiple subjects), and a subject mask (`--mask`, or click-to-isolate
  AI segmentation in the web app) suppresses the background entirely —
  backgrounds dissolve into loose gestures the way an artist would treat
  them
- Portrait mode (web app): AI face detection lightens skin so paper does
  the work, keeps eyes/brows/lips crisply detailed, and draws clean
  feature lines from facial landmarks — handles multiple faces
- Bold contour lines: edges are linked into long, confident outline
  strokes (the lines an artist draws first), exported on a separate
  bold-pen SVG layer for multi-pen plotting
- Texture strokes (`--texture`): fur, foliage and fabric render as short
  directional tick marks instead of long streamlines
- The web app ships one-click style presets (Classic, Portrait, Pet,
  Landscape, Sketch, Etching) — upload a photo, tap your subject, download
- 3D form awareness: an in-browser monocular depth model (Depth Anything
  V2) makes strokes follow the actual surface geometry, stop cleanly at
  silhouettes, and fade distant backgrounds like atmospheric recession.
  The CLI accepts external depth maps via `--depth-image` (bright = near)
- Scene understanding: semantic region labels steer mark dispatch — calm
  water follows the water label at any horizon height, sky stipple
  auto-enables when a sky is in frame, foliage keeps leafy texture,
  building facets hatch plumb and level, and people never dissolve into
  background gesture. The CLI accepts a label raster via `--label-image`
  (taxonomy id in the red channel: 0 unknown, 1 sky, 2 water, 3 foliage,
  4 ground, 5 building, 6 person, 7 object);
  `node scripts/segment-labels.mjs` generates `photo.labels.png` sidecars
  with SegFormer (ADE20K) that the gallery script picks up automatically

Key options:

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --input` | Input image (PNG or JPEG) | required |
| `-w, --width` | Output width in pixels (height follows the image aspect) | 800 |
| `--layers` | Hatching layers; shadows get cross-hatched (1-4) | 3 |
| `--min-spacing` | Stroke spacing in the darkest areas (px) | 2.5 |
| `--max-spacing` | Stroke spacing in the lightest hatched areas (px) | 14 |
| `--white-cutoff` | Darkness below which paper stays blank (0-1) | 0.08 |
| `--hatch-angle` | Fallback hatch angle for flat regions (degrees) | -45 |
| `--no-follow-tone` | Hatch at fixed angles instead of following contours | off |
| `--no-outlines` | Skip the edge outline pass | off |
| `--wobble` | Hand-drawn wobble amplitude in px (0 = ruler-straight) | 0.8 |
| `--detail` | Emphasize detailed regions; flat areas fade (0-1) | 0.3 |
| `--focus` | Focal point `x,y` in output coordinates | none |
| `--focus-radius` | Radius of full detail around the focal point (px) | 25% of output |
| `--focus-strength` | How strongly detail fades outside the focus (0-1) | 0.85 |
| `--mask` | Subject mask image (bright = subject) | none |
| `--mask-strength` | How strongly the mask suppresses the background (0-1) | 1 |
| `-s, --seed` | Random seed for reproducibility | random |

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-w, --width` | Canvas width in pixels | 800 |
| `-h, --height` | Canvas height in pixels | 800 |
| `-l, --lines` | Number of flow lines | 100 |
| `-s, --seed` | Random seed for reproducibility | random |
| `--step-length` | Step length for line tracing | 2 |
| `--max-steps` | Maximum steps per line | 500 |
| `-m, --margin` | Margin from canvas edges | 20 |
| `--noise-scale` | Scale of the noise field | 0.005 |
| `--octaves` | Noise octaves for detail | 4 |
| `--stroke-color` | SVG stroke color | #000000 |
| `--stroke-width` | SVG stroke width | 1 |
| `-o, --output` | Output file path | flow-lines.svg |

### Running the Web App

```bash
# Start development server
pnpm --filter @flow-lines/web dev

# Build for production
pnpm --filter @flow-lines/web build
```

## Development

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm --filter @flow-lines/core test:watch
```

## License

MIT
