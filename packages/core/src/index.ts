// Noise generation
export { SimplexNoise, createNoise } from './noise.js';
export type { NoiseOptions } from './noise.js';

// Flow field
export { FlowField } from './flow-field.js';
export type { FlowFieldOptions, Vector2D, Attractor, FieldMode } from './flow-field.js';

// Flow lines generation
export { generateFlowLines, generateFlowLinesGrid } from './flow-lines.js';
export type { FlowLinesOptions, FlowLinesResult, FlowLine, Point } from './flow-lines.js';

// SVG export
export { toSVG, parseSVGOptions } from './svg.js';
export type { SVGOptions } from './svg.js';
