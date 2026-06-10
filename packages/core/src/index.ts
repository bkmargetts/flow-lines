// Noise generation
export { SimplexNoise, createNoise } from './noise.js';
export type { NoiseOptions } from './noise.js';

// Flow field
export { FlowField } from './flow-field.js';
export type { FlowFieldOptions, Vector2D } from './flow-field.js';

// Flow lines generation
export { generateFlowLines, generateFlowLinesGrid } from './flow-lines.js';
export type { FlowLinesOptions, FlowLinesResult, FlowLine, Point } from './flow-lines.js';

// SVG export
export { toSVG, parseSVGOptions } from './svg.js';
export type { SVGOptions } from './svg.js';

// Image utilities
export {
  grayscaleFromRGBA,
  sampleBilinear,
  resizeGrayscale,
  gaussianBlur,
  normalizeLevels,
} from './image.js';
export type { GrayscaleImage } from './image.js';

// Image-derived direction field
export { ImageField } from './image-field.js';
export type { ImageFieldOptions } from './image-field.js';

// Image to pen-and-ink rendering
export { imageToPenInk } from './pen-ink.js';
export type { PenInkOptions, FocusOptions } from './pen-ink.js';

// Hand-drawn styling
export { applyHandDrawnStyle } from './hand-drawn.js';
export type { HandDrawnOptions } from './hand-drawn.js';

// Portrait-aware rendering
export type { PortraitOptions } from './portrait.js';

// Contour extraction
export { traceContours } from './contours.js';
export type { ContourOptions } from './contours.js';

// Plot optimization
export { optimizePlot, measurePenTravel } from './optimize.js';
export type { OptimizePlotOptions } from './optimize.js';
