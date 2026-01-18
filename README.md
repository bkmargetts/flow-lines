# Flow Lines

A generative art toolbox for creating beautiful SVG artwork for pen plotters.

## Features

- **Flow Lines Generator**: Create beautiful flow field art based on Perlin/Simplex noise
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
```

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
