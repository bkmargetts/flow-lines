import { type Point } from '@flow-lines/core';
import type { VineMode, VineSeeding, VineFill, LeafStyle, VineComposition, LeafType, StemShade, VineFlower, FillShape, SketchStyle } from '@flow-lines/core';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * Vine Generator settings. Lengths are in millimetres (converted to px at the
 * page density on render); curl/gravitropism/probabilities are unitless 0..1.
 * The page frame lives in the shared FrameContext, not here.
 *
 * Painting reuses the canvas's generic duck-typed interface (`drawMode` +
 * `maskPath`, the same the grating/noise-texture modules use): when seeding is
 * 'painted', the drawn points become vine roots.
 */
export interface VineState {
  /** Selected species preset id, or 'custom'. */
  species: string;
  mode: VineMode;
  composition: VineComposition;
  fillShape: FillShape;
  seeding: VineSeeding;
  seedCount: number;

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

  // vine body
  stemWidthMm: number;
  taper: number;
  vineFill: VineFill;
  avoidOverlap: boolean;

  // form shading & depth
  lightAngle: number;
  shadeDensity: number;
  stemShade: StemShade;
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
  tendrils: boolean;
  tendrilProb: number;
  flowers: boolean;
  flowerType: VineFlower;
  flowerProb: number;
  flowerSizeMm: number;

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

export const defaultVineState: VineState = {
  species: 'wild-rose',
  mode: 'growth',
  composition: 'specimen',
  fillShape: 'heart',
  seeding: 'scatter',
  seedCount: 6,

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
  vineFill: 'shaded',
  avoidOverlap: true,

  lightAngle: -130,
  shadeDensity: 0.55,
  stemShade: 'along',
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
  tendrils: true,
  tendrilProb: 0.1,
  flowers: true,
  flowerType: 'rose',
  flowerProb: 0.3,
  flowerSizeMm: 5,

  wobbleMm: 0.2,

  seed: Math.floor(Math.random() * 1000000),
  palette: 'ink',
  strokeColor: '#2a2a26',
  leafColor: '#2a2a26',
  flowerColor: '#5a2238',
  penWidthMm: 0.3,

  drawMode: false,
  maskPath: [],
};
