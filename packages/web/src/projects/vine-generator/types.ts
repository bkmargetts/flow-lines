import { type Point } from '@flow-lines/core';
import type { VineMode, VineSeeding } from '@flow-lines/core';

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

  // decorations
  leaves: boolean;
  leafSizeMm: number;
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
  seeding: 'scatter',
  seedCount: 6,

  stepLengthMm: 2,
  maxLengthMm: 110,
  curl: 0.5,
  noiseScale: 0.004,
  gravitropism: 0.4,
  branchProb: 0.04,
  maxDepth: 4,

  attractorCount: 600,
  attractorRadiusMm: 30,
  killRadiusMm: 5,

  leaves: true,
  leafSizeMm: 5,
  leafSpacingMm: 9,
  tendrils: true,
  tendrilProb: 0.25,
  flowers: true,
  flowerProb: 0.4,
  flowerSizeMm: 4.5,

  wobbleMm: 0.4,

  seed: Math.floor(Math.random() * 1000000),
  strokeColor: '#1f3d1f',
  leafColor: '#1f3d1f',
  flowerColor: '#7a2046',
  penWidthMm: 0.3,

  drawMode: false,
  maskPath: [],
};
