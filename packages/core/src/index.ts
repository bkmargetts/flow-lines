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
export { generateInkField } from './ink-field.js';
export type { InkFieldOptions, InkFieldStyle } from './ink-field.js';

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

// Fracture — crack-propagation networks (mud cracks, glaze crazing)
export { generateFracture, simulateFracture, FRACTURE_PRESETS } from './fracture/index.js';
export type {
  FractureOptions,
  FracturePreset,
  FractureSimParams,
  FractureCrack,
  FractureJunction,
  FractureSimResult,
} from './fracture/index.js';

// Meander — river-migration cartography (Fisk-map channel history)
export { generateMeander, simulateMeander, MEANDER_PRESETS } from './meander/index.js';
export type {
  MeanderOptions,
  MeanderPreset,
  MeanderSimParams,
  MeanderSimResult,
  MeanderTrace,
  MeanderOxbow,
} from './meander/index.js';

// Coral — differential growth (self-repelling loops that buckle into folds)
export { generateCoral, simulateCoral, CORAL_PRESETS } from './coral/index.js';
export type {
  CoralOptions,
  CoralPreset,
  CoralSeedShape,
  CoralSimParams,
  CoralSimResult,
  CoralRing,
} from './coral/index.js';

// Warp grid — op-art gratings deformed by hidden relief (Riley Current/Blaze)
export { generateWarpGrid, WARP_GRID_PRESETS } from './warp-grid/index.js';
export type {
  WarpGridOptions,
  WarpGridPreset,
  WarpBasePattern,
  WarpDeformerKind,
} from './warp-grid/index.js';

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
  CUSTOM_PAPER_ID,
  getPaperSize,
  resolvePaperSize,
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

// Multi-sheet tiling (split one plot across a grid of smaller sheets)
export {
  computeTiling,
  sliceResultIntoTiles,
  tileLabel,
  registrationCrosses,
  TILE_MARKS_LAYER,
  REGISTRATION_LAYER,
} from './tiling.js';
export type {
  TilingOptions,
  TileSpec,
  TilingLayout,
  TileResult,
} from './tiling.js';

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

// Botanical generator (organic procedural plants)
export { generateBotanical } from './botanical/index.js';
export type { BotanicalOptions, BotanicalMode, BotanicalSeeding, BotanicalFill, LeafStyle, BotanicalComposition, LeafType, StemShade, BotanicalFlower, FillShape, SketchStyle, BotanicalVessel, LeafArrangement, Phyllotaxis, Inflorescence, FruitType, BotanicalSupport, StemTexture } from './botanical/index.js';

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

// Sports balls (a pile of footballs / tennis balls / … as projected spheres)
export { generateSportsBalls } from './sports-balls/index.js';
export type { SportsBallsOptions, BallType, SportsBallsRegion } from './sports-balls/index.js';

// Hearts (a page full of love hearts — outlined, solid, hatched, broken)
export { generateHearts } from './hearts/index.js';
export type { HeartsOptions, HeartStyle, HeartsRegion } from './hearts/index.js';

// Impact grid (a hand-ruled grid of squares struck by a drawn impact path)
export { generateImpactGrid } from './impact-grid/index.js';
export type { ImpactGridOptions } from './impact-grid/index.js';

// Ribbon weave / knotwork (interlaced bands, tangle → Celtic lattice)
export { generateRibbonWeave } from './ribbons/index.js';
export type { RibbonWeaveOptions, RibbonEdgeMode, RibbonStyle } from './ribbons/index.js';

// Tangles (corrugated ducts or shoelaces worming across the page, weaving over/under)
export { generateTangles } from './tangles/index.js';
export type { TanglesOptions, TangleMaterial } from './tangles/index.js';

// Gestural ink abstraction (Kline / Hartung / sumi — swept strokes, dry brush)
export { generateGesture } from './gesture/index.js';
export type { GestureOptions, GesturePreset } from './gesture/index.js';

// Machine (page-sized, hugely complex generative machines)
export { generateMachine } from './machine/index.js';
export type { MachineOptions } from './machine/index.js';

// Marbling (mathematical paper marbling — suminagashi / ebru)
export { generateMarbling, inkLayerName, MARBLING_PRESETS } from './marbling/index.js';
export type { MarblingOptions, MarblingPattern } from './marbling/index.js';

// Lapidary (layered pattern artworks — textured regions split by paper seams)
export { generateLapidary, LAPIDARY_PRESETS, VEIN_LAYER } from './lapidary/index.js';
export type {
  LapidaryOptions,
  LapidaryMode,
  LapidaryTexture,
  LapidaryShape,
  LapidaryShapes,
  BandTexture,
  PenAssignment,
  SpiralForm,
  SpiralDirection,
  SpiralJoin,
} from './lapidary/index.js';

// Harmonograph / guilloché (damped pendulums, spirograph wheels, engine turning)
export {
  generateHarmonograph,
  harmonographLayerName,
  HARMONOGRAPH_PRESETS,
} from './harmonograph/index.js';
export type {
  HarmonographOptions,
  HarmonographMode,
  HarmonographPreset,
  TrochoidKind,
  RosetteEnvelope,
} from './harmonograph/index.js';

// Portrait-aware rendering
export type { PortraitOptions } from './portrait.js';

// Contour extraction
export { traceContours } from './contours.js';
export type { ContourOptions } from './contours.js';

// Iso-contour tracing (tonal mass boundaries, e.g. cloud edges)
export { traceIsoContours } from './iso-contours.js';

// Plottable background texture (its own export layer, behind the drawing)
export { generateTexture, DASH_DEFAULTS, SCRIBBLE_DEFAULTS } from './texture.js';
export type {
  TextureOptions,
  TextureStyle,
  TextureShapeOptions,
  DashTextureOptions,
  ScribbleTextureOptions,
  GratingTextureOptions,
} from './texture.js';
export type { TextureRegionOptions } from './texture-region.js';

// Plot optimization
export { optimizePlot, orderPlot, measurePenTravel, limitStrokeDensity } from './optimize.js';
export type {
  OptimizePlotOptions,
  PlotOrderOptions,
  DensityProtectOptions,
  DensityProtectResult,
} from './optimize.js';

// Universal page border (plottable overlay, its own export layer)
export { pageBorder } from './page-frame.js';
export type { PageBorderOptions } from './page-frame.js';

// Layer compositing geometry (hold-off halos, stencil masks, transforms) —
// shared by the web layer stack and the CLI `stack` command
export {
  holdOffLines,
  buildCoverageMask,
  morphMask,
  clipLinesToMask,
  traceMaskOutline,
  transformLines,
  echoLines,
} from './compose/index.js';
export type {
  CoverageMask,
  CoverageMaskOptions,
  MaskClipOptions,
  MaskOutlineOptions,
  LineTransformOptions,
  EchoOptions,
} from './compose/index.js';
