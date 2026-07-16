import { type Point } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';
import type { BotanicalMode, BotanicalSeeding, BotanicalFill, LeafStyle, BotanicalComposition, LeafType, StemShade, BotanicalFlower, FillShape, SketchStyle, BotanicalVessel, LeafArrangement, Phyllotaxis, Inflorescence, FruitType, BotanicalSupport, StemTexture } from '@flow-lines/core';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * Botanical Generator settings. Lengths are in millimetres (converted to px at the
 * page density on render); curl/gravitropism/probabilities are unitless 0..1.
 * The page frame lives in the shared FrameContext, not here.
 *
 * Painting reuses the canvas's generic duck-typed interface (`drawMode` +
 * `maskPath`, the same the grating/noise-texture modules use): when seeding is
 * 'painted', the drawn points become roots.
 */
export interface BotanicalState {
  /** Selected species preset id, or 'custom'. */
  species: string;
  mode: BotanicalMode;
  composition: BotanicalComposition;
  fillShape: FillShape;
  seeding: BotanicalSeeding;
  seedCount: number;

  // page composition
  /** A drawn container the stems rise out of (bouquet/specimen). */
  vessel: BotanicalVessel;
  /** A drawn support the climbers wrap (trellis composition). */
  support: BotanicalSupport;
  /** Draw a hand-drawn ground line under the arrangement. */
  groundLine: boolean;
  /** 0..1 deliberate negative space (notan): hold a region clear, swell the mass. */
  negativeSpace: number;
  /** 0..1 light-driven tonal massing: foliage gathers and hatches heavier on the
   *  shadow side (away from the light), opening the lit side — a committed value
   *  structure instead of an even fill. 0 = off. */
  tonalMassing: number;
  /** Posterize the tonal-massing field into this many value bands (>= 2) for a
   *  few decisive masses; 0 = smooth. */
  valueBands: number;

  // growth model
  stepLengthMm: number;
  maxLengthMm: number;
  curl: number;
  noiseScale: number;
  gravitropism: number;
  branchProb: number;
  maxDepth: number;

  // space colonization
  attractorCount: number;
  attractorRadiusMm: number;
  killRadiusMm: number;

  // stem body
  stemWidthMm: number;
  taper: number;
  stemFill: BotanicalFill;
  avoidOverlap: boolean;

  // form shading & depth
  lightAngle: number;
  shadeDensity: number;
  stemShade: StemShade;
  /** Woody-stem surface texture. */
  stemTexture: StemTexture;
  occlude: boolean;
  sketch: number;
  sketchStyle: SketchStyle;
  /** How zoomed in/out the plot is (1 = fit; >1 magnifies, <1 shrinks). */
  zoom: number;
  castShadow: number;

  // season (foliage only; palette stays manual)
  season: Season;
  seasonStrength: number;

  // decorations
  density: number;
  leaves: boolean;
  leafStyle: LeafStyle;
  leafType: LeafType;
  veins: boolean;
  leafSizeMm: number;
  leafWidthRatio: number;
  leafSpacingMm: number;
  /** Compound-leaf arrangement; 'simple' = one blade per site. */
  leafArrangement: LeafArrangement;
  leafletCount: number;
  /** How successive leaves are inserted along a stem. */
  phyllotaxis: Phyllotaxis;
  whorlCount: number;
  tendrils: boolean;
  tendrilProb: number;
  flowers: boolean;
  flowerType: BotanicalFlower;
  flowerProb: number;
  flowerSizeMm: number;
  /** Multi-flower structure at the stem tips; 'none' = single bloom. */
  inflorescence: Inflorescence;
  floretCount: number;
  /** Bear thorns along the stems. */
  thorns: boolean;
  thornProb: number;
  /** Fruiting bodies; 'none' = off. */
  fruitType: FruitType;
  fruitProb: number;
  /** Scatter dewdrop highlights on the foliage. */
  dewdrops: boolean;
  dewdropProb: number;

  wobbleMm: number;

  seed: number;
  /** Curated palette id, or 'custom' to use the per-element inks below. */
  palette: string;
  strokeColor: string;
  /** Optional per-element inks; absent falls back to `strokeColor`. */
  leafColor: string;
  flowerColor: string;
  penWidthMm: number;

  /** Canvas painting (generic `DrawableState` interface). */
  drawMode: boolean;
  maskPath: Point[];
}

export const defaultBotanicalState: BotanicalState = {
  species: 'wild-rose',
  mode: 'growth',
  composition: 'specimen',
  fillShape: 'heart',
  seeding: 'scatter',
  seedCount: 6,

  vessel: 'none',
  support: 'none',
  groundLine: false,
  negativeSpace: 0,
  tonalMassing: 0,
  valueBands: 0,

  stepLengthMm: 2.2,
  maxLengthMm: 90,
  curl: 0.5,
  noiseScale: 0.005,
  gravitropism: 0.4,
  branchProb: 0.05,
  maxDepth: 5,

  attractorCount: 600,
  attractorRadiusMm: 30,
  killRadiusMm: 5,

  stemWidthMm: 4,
  taper: 0.85,
  stemFill: 'shaded',
  avoidOverlap: true,

  lightAngle: -130,
  shadeDensity: 0.55,
  stemShade: 'along',
  stemTexture: 'none',
  occlude: true,
  sketch: 0,
  sketchStyle: 'loose',
  zoom: 1,
  castShadow: 0.35,

  season: 'summer',
  seasonStrength: 0,

  density: 0.45,
  leaves: true,
  leafStyle: 'shaded',
  leafType: 'ovate',
  veins: true,
  leafSizeMm: 12,
  leafWidthRatio: 0.55,
  leafSpacingMm: 12,
  leafArrangement: 'simple',
  leafletCount: 5,
  phyllotaxis: 'alternate',
  whorlCount: 3,
  tendrils: true,
  tendrilProb: 0.1,
  flowers: true,
  flowerType: 'rose',
  flowerProb: 0.3,
  flowerSizeMm: 7,
  inflorescence: 'none',
  floretCount: 8,
  thorns: false,
  thornProb: 0.15,
  fruitType: 'none',
  fruitProb: 0.2,
  dewdrops: false,
  dewdropProb: 0.15,

  wobbleMm: 0.2,

  seed: randomSeed(),
  palette: 'ink',
  strokeColor: '#2a2a26',
  leafColor: '#2a2a26',
  flowerColor: '#5a2238',
  penWidthMm: 0.3,

  drawMode: false,
  maskPath: [],
};
