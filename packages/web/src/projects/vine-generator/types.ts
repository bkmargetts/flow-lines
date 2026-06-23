import { type Point } from '@flow-lines/core';
import type { VineMode, VineSeeding, VineFill, LeafStyle, VineComposition, LeafType } from '@flow-lines/core';

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
  mode: VineMode;
  composition: VineComposition;
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
  occlude: boolean;

  // decorations
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
  flowerProb: number;
  flowerSizeMm: number;

  wobbleMm: number;

  seed: number;
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
  mode: 'growth',
  composition: 'specimen',
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

  stemWidthMm: 3,
  taper: 0.85,
  vineFill: 'shaded',
  avoidOverlap: true,

  lightAngle: -130,
  shadeDensity: 0.55,
  occlude: true,

  leaves: true,
  leafStyle: 'shaded',
  leafType: 'ovate',
  veins: true,
  leafSizeMm: 11,
  leafWidthRatio: 0.55,
  leafSpacingMm: 11,
  tendrils: true,
  tendrilProb: 0.12,
  flowers: true,
  flowerProb: 0.18,
  flowerSizeMm: 4,

  wobbleMm: 0.35,

  seed: Math.floor(Math.random() * 1000000),
  strokeColor: '#2a2a26',
  leafColor: '#2a2a26',
  flowerColor: '#5a2238',
  penWidthMm: 0.3,

  drawMode: false,
  maskPath: [],
};
