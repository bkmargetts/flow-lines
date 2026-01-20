// Noise generation
export { SimplexNoise, createNoise } from './noise.js';
export type { NoiseOptions } from './noise.js';

// Flow field (shared utility for vector field generation)
export { FlowField } from './flow-field.js';
export type { FlowFieldOptions, Vector2D, Attractor, FieldMode } from './flow-field.js';

// SVG export
export { toSVG, parseSVGOptions } from './svg.js';
export type { SVGOptions } from './svg.js';

// Note: Flow lines generation has moved to @flow-lines/technique-flow-lines
