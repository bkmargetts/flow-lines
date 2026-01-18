# Flow Lines - Future Features

## Interactive Painting Modes

### 1. Paint Seed Points (In Progress)
Tap or drag to place starting points for flow lines. Lines flow from where you paint, giving direct control over composition while using noise-based flow.

### 2. Paint Attractors/Repellers
Draw areas that attract or repel flow lines, creating organic compositions. Could use:
- Positive brush: lines curve toward painted areas
- Negative brush: lines curve away from painted areas
- Adjustable influence radius and strength

### 3. Paint Direction Override
Drag to manually override the noise field direction in specific areas. The direction follows your brush stroke, allowing you to guide flow in specific regions while keeping noise-based flow elsewhere.

### 4. Paint Density
Brush that increases or decreases line density in painted areas:
- Dense brush: more lines spawn/pass through painted regions
- Sparse brush: fewer lines in painted regions
- Could combine with seed points for fine control

## Other Ideas

- [ ] Multiple noise layers with blending
- [ ] Animated flow lines (for screen display, not plotter)
- [ ] Import image as density/direction map
- [ ] Undo/redo for painting actions
- [ ] Save/load painting sessions
- [ ] Export painting data alongside SVG
