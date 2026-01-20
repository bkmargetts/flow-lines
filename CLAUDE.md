# Claude Code Context

This file provides context for Claude Code sessions working on this project.

## Project Overview

**Flow Lines** is a generative art toolbox for pen plotters. It provides multiple techniques for creating SVG artwork suitable for pen plotter output.

## Architecture

### Package Structure

```
packages/
  core/                           # Shared utilities
    src/
      noise.ts                    # Simplex/Perlin noise generation
      svg.ts                      # SVG export utilities
      flow-field.ts               # Vector field generation
      index.ts                    # Public exports

  techniques/                     # Technique-specific packages
    flow-lines/                   # Flow lines technique
      src/
        index.ts                  # All flow-lines algorithms
                                  # Includes: swarm mode, form hatching, fill mode

  web/                            # React web application
    src/
      App.tsx                     # Router setup (HashRouter for GitHub Pages)
      pages/
        techniques/
          index.tsx               # Techniques list page
          FlowLinesPage.tsx       # Flow lines technique UI
      components/                 # Shared UI components

  cli/                            # Command-line interface
```

### Key Design Decisions

1. **Technique-based packages**: Each generative art technique is a separate package under `packages/techniques/`. This allows independent versioning and easy addition of new techniques.

2. **Shared core**: Common utilities (noise, SVG export, flow field) are in `@flow-lines/core` and can be used by any technique.

3. **HashRouter**: The web app uses HashRouter (not BrowserRouter) for GitHub Pages compatibility. URLs look like `/#/techniques/flow-lines`.

4. **No collision detection in some modes**: Form hatching and swarm modes intentionally allow line overlap for organic appearance.

## Adding a New Technique

1. Create package: `packages/techniques/<technique-name>/`
2. Add `package.json` with dependency on `@flow-lines/core`
3. Implement technique in `src/index.ts`
4. Add route in `packages/web/src/App.tsx`
5. Add card in `packages/web/src/pages/techniques/index.tsx`
6. Create technique page in `packages/web/src/pages/techniques/<TechniqueName>Page.tsx`

## Flow Lines Technique Modes

The flow-lines technique has several generation modes:

- **Default**: Basic flow field line tracing
- **Fill mode**: Systematic space-filling with parallel lines
- **Swarm mode**: Particle/agent-based generation with clustering
- **Form hatching**: Contour-following lines that wrap around implied 3D forms

## Git Branching

Branch naming convention: `feature/techniques/<technique>/<feature>`

Example:
- `feature/techniques/flow-lines/swarm-improvements`
- `feature/techniques/stippling/initial`

## Build & Test

```bash
# Install dependencies
pnpm install

# Build all packages
npm run build

# Run tests
npm test

# Dev server for web app
pnpm --filter @flow-lines/web dev
```

## Important Files

- `packages/techniques/flow-lines/src/index.ts` - Main flow-lines algorithms
- `packages/web/src/pages/techniques/FlowLinesPage.tsx` - Flow lines UI
- `packages/core/src/noise.ts` - Noise generation (shared)
- `packages/core/src/svg.ts` - SVG export (shared)

## Constraints for Pen Plotters

When working on techniques, remember:
- **No opacity**: Pen plotters can't do transparency
- **Uniform line weight**: Line thickness is determined by the pen
- **Lines only**: No fills, gradients, or raster effects
- **SVG output**: All output must be valid SVG with `<path>` or `<polyline>` elements
