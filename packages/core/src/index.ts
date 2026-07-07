// Noise generation
export { SimplexNoise, createNoise } from './noise.js';
export type { NoiseOptions } from './noise.js';

// Flow field
export { FlowField } from './flow-field.js';
export type { FlowFieldOptions, Vector2D } from './flow-field.js';

// Flow lines generation
export { generateFlowLines, generateFlowLinesGrid, generateFlowLinesEven } from './flow-lines.js';
export type { FlowLinesOptions, FlowLinesResult, FlowLine, Point, EvenFlowLinesOptions } from './flow-lines.js';

// Overlapped-line texture (interleaved multi-ink gratings)
export { generateOverlappedLines, bandLayerName, pointInMask } from './overlapped-lines.js';
export type { OverlappedLinesOptions, MaskShape } from './overlapped-lines.js';

// Colour-field texture (dense banded gradient lines + geometric accents)
export { generateColorField, accentLayerName } from './color-field.js';
export type { ColorFieldOptions, AccentSpec } from './color-field.js';

// Conway's Game of Life long-exposure still
export { generateConwayExposure } from './conway/index.js';
export type { ConwayExposureOptions } from './conway/index.js';

// Reaction–diffusion (Gray–Scott) Turing patterns
export { generateReactionDiffusion, stepReactionDiffusion, RD_PRESETS } from './reaction-diffusion.js';
export type { ReactionDiffusionOptions, RDPreset } from './reaction-diffusion.js';

// Lenia — continuous-domain cellular automaton (gliding lifeforms)
export {
  generateLenia,
  stepLenia,
  makeRingKernel,
  growthFn,
  LENIA_PRESETS,
  ORBIUM,
} from './lenia.js';
export type { LeniaOptions, LeniaPreset, LeniaSeedPattern, RingKernel } from './lenia.js';

// Physarum — slime-mold agent transport networks (Jones 2010)
export { generatePhysarum, stepPhysarum, PHYSARUM_PRESETS } from './physarum.js';
export type { PhysarumOptions, PhysarumPreset, PhysarumAgents, PhysarumStepParams } from './physarum.js';

// Complex-valued rational-function flow field (Savva-style poles & zeros)
export { generateComplexFlow } from './complex-flow.js';
export type {
  ComplexFlowOptions,
  SingularityLayout,
  SeedLayout,
  LayerBy,
} from './complex-flow.js';

// SVG export
export { toSVG, toSVGLayers, parseSVGOptions } from './svg.js';
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
export type { ImageFieldOptions, DirectionMap } from './image-field.js';

// Image to pen-and-ink rendering
export { imageToPenInk, PEN_INK_STYLES, resolvePenInkStyle } from './pen-ink/index.js';
export type { PenInkOptions, FocusOptions, PenInkStyle } from './pen-ink/index.js';

// Physical paper sizes (plotter output)
export {
  PAPER_SIZES,
  BASE_PX_PER_MM,
  getPaperSize,
  orientedDimsMm,
  pageMetrics,
  contentRect,
} from './paper-sizes.js';
export type {
  PaperSize,
  Orientation,
  PaperFit,
  PageMetrics,
  Rect,
} from './paper-sizes.js';

// Semantic region labels
export {
  SemanticMap,
  SEMANTIC_LABELS,
  ADE20K_TO_SEMANTIC,
  semanticId,
  normalizeAdeName,
  adeNameToSemantic,
  labelsFromAdeMasks,
} from './semantic-map.js';
export type { SemanticLabel, LabelImage, NamedMask } from './semantic-map.js';

// Hand-drawn styling
export { applyHandDrawnStyle } from './hand-drawn.js';
export type { HandDrawnOptions } from './hand-drawn.js';

// Unified hand-sketch finish (wobble + overdraw + overshoot + pen-lift breaks)
export { applySketch } from './sketch.js';
export type { SketchOptions } from './sketch.js';

// Vine generator (organic procedural vines)
export { generateVines } from './vines/index.js';
export type { VinesOptions, VineMode, VineSeeding, VineFill, LeafStyle, VineComposition, LeafType, StemShade, VineFlower, FillShape, SketchStyle, VineVessel, LeafArrangement, Phyllotaxis, Inflorescence, FruitType, VineSupport, StemTexture } from './vines/index.js';

// Planet generator (procedural pen-and-ink planets)
export { generatePlanet } from './planet/index.js';
export type { PlanetOptions, PlanetType } from './planet/index.js';

// Landscape generator (procedural pen-and-ink landscapes)
export { generateLandscape } from './landscape/index.js';
export type { LandscapeOptions, ForegroundSide, TreeStyle } from './landscape/index.js';

// City generator (abstract pen-and-ink cities, flowing → rigid)
export { generateCity, CITY_STYLES } from './city/index.js';
export type { CityOptions, CityLightSide, BuildingStyle, CityStyle } from './city/index.js';

export { generateStickmen, starRegion, heartRegion, diamondRegion, blobRegion } from './stickmen/index.js';
export type { StickmenOptions, FacingMode, PoseMode, StickmenRegion } from './stickmen/index.js';

// Portrait-aware rendering
export type { PortraitOptions } from './portrait.js';

// Contour extraction
export { traceContours } from './contours.js';
export type { ContourOptions } from './contours.js';

// Iso-contour tracing (tonal mass boundaries, e.g. cloud edges)
export { traceIsoContours } from './iso-contours.js';

// Plottable background texture (its own export layer, behind the drawing)
export { generateTexture } from './texture.js';
export type {
  TextureOptions,
  TextureStyle,
  TextureShapeOptions,
  GratingTextureOptions,
} from './texture.js';

// Plot optimization
export { optimizePlot, measurePenTravel, limitStrokeDensity } from './optimize.js';
export type {
  OptimizePlotOptions,
  DensityProtectOptions,
  DensityProtectResult,
} from './optimize.js';

// Universal page border (plottable overlay, its own export layer)
export { pageBorder } from './page-frame.js';
export type { PageBorderOptions } from './page-frame.js';
