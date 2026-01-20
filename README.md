# Flow Lines

A generative art toolbox for creating beautiful SVG artwork for pen plotters.

## Features

- **Multiple Techniques**: Modular architecture supporting different generative art techniques
- **Flow Lines**: Create flow field art with multiple modes (swarm, form hatching, fill)
- **CLI Tool**: Generate artwork from the command line
- **Web App**: Interactive browser-based interface for designing artwork
- **SVG Export**: All output is SVG, perfect for pen plotters

## Project Structure

This is a monorepo using pnpm workspaces:

```
packages/
  core/                 # Shared utilities (noise, SVG export, flow field)
  techniques/
    flow-lines/         # Flow lines generative technique
  cli/                  # Command-line interface
  web/                  # React-based web application
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
npm run build
```

### Running the Web App

```bash
# Start development server
pnpm --filter @flow-lines/web dev

# Build for production
pnpm --filter @flow-lines/web build
```

The web app is available at `http://localhost:5173` and provides:
- `/techniques` - List of available generative techniques
- `/techniques/flow-lines` - Interactive flow lines generator

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

## Flow Lines Modes

The flow-lines technique includes several generation modes:

- **Default**: Basic flow field line tracing from random or specified seed points
- **Fill Mode**: Systematic space-filling with evenly-spaced parallel lines
- **Swarm Mode**: Particle/agent-based generation with organic clustering behavior
- **Form Hatching**: Contour-following lines that wrap around implied 3D forms

## Adding New Techniques

To add a new generative art technique:

1. Create a new package under `packages/techniques/<technique-name>/`
2. Add dependency on `@flow-lines/core` for shared utilities
3. Add a route and page in the web app
4. Add a card to the techniques list

See `CLAUDE.md` for detailed architecture documentation.

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
pnpm --filter @flow-lines/core test:watch

# Lint
pnpm lint
```

## Deployment

The web app is configured for GitHub Pages deployment:
- Uses HashRouter for client-side routing compatibility
- Base path configured as `/flow-lines/`

## License

MIT
