import type { ForegroundSide, SketchStyle, TreeStyle } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * UI state for the Landscape Generator (mm / 0..1 / degree units). `render.ts`
 * converts it to the core's `LandscapeOptions` in px. Friendlier knobs than the
 * core (fractions for position, mm for everything physical) map across there.
 */
export interface LandscapeState {
  scene: string; // preset id
  seed: number;
  zoom: number;

  // Composition
  horizonFrac: number; // 0..1 vertical position of the horizon
  horizonWobbleMm: number;
  horizonFreq: number;
  hasWater: boolean;
  waterFrac: number; // 0..1 of the below-horizon space given to water

  // Sky
  skyHatchSpacingMm: number;
  skyToneTop: number; // 0..1
  skyToneHorizon: number; // 0..1

  // Sun / moon
  sun: boolean;
  sunXFrac: number; // 0..1 across the usable frame
  sunYFrac: number; // 0..1 down the usable frame
  sunRadiusMm: number;
  sunHalo: number; // 0..1
  moonRim: boolean;
  sunRays: boolean;
  reflection: boolean;
  reflectionWidthMm: number;

  // Water
  waterHatchSpacingMm: number;
  waterDashMm: number;
  waterGapMm: number;

  // Ridges / hills
  ridgeCount: number;
  ridgeAmpMm: number;
  ridgeFreq: number;
  ridgeOctaves: number;
  ridgePersistence: number;
  ridgeHatchSpacingMm: number;
  ridgeHatchAngle: number; // degrees from horizontal
  slopeFollow: boolean;
  formFollow: boolean;
  ridgeSharpness: number; // 0..1 rolling swell → peaked, skewed summits
  atmosphere: number; // 0..1 depth haze / mist fade

  // Compositional depth
  headlands: number; // overlapping receding land fingers near the horizon
  foreground: number; // 0..1 size of a dark foreground landform (0 = off)
  foregroundSide: ForegroundSide;
  focus: number; // 0..1 focal hierarchy strength

  // Hatch craft
  toneContrast: number; // 0..1
  crossHatch: number; // 0..2 extra shadow layers
  hatchPatchiness: number; // 0..1
  taper: number; // 0..1

  // Detail marks
  clouds: number; // 0..1 carved-cloud coverage
  trees: number; // count
  treeStyle: TreeStyle; // mixed | round | conifer | scrub
  birds: number; // count

  // Rocks / islands
  rocks: number;
  rockMaxSizeMm: number;
  rockHatchSpacingMm: number;

  // Pen / finishing
  penWidthMm: number;
  wobbleMm: number;
  sketch: number; // 0..1
  sketchStyle: SketchStyle;

  // Ink
  palette: string;
  skyColor: string;
  waterColor: string;
  ridgeColor: string;
  contourColor: string;
  rockColor: string;
}

export const defaultLandscapeState: LandscapeState = {
  scene: 'coastal-sunset',
  seed: randomSeed(),
  zoom: 1,

  horizonFrac: 0.46,
  horizonWobbleMm: 2,
  horizonFreq: 2.2,
  hasWater: true,
  waterFrac: 0.6,

  skyHatchSpacingMm: 2,
  skyToneTop: 0.42,
  skyToneHorizon: 0.68,

  sun: true,
  sunXFrac: 0.52,
  sunYFrac: 0.34,
  sunRadiusMm: 14,
  sunHalo: 0.7,
  moonRim: false,
  sunRays: false,
  reflection: true,
  reflectionWidthMm: 9,

  waterHatchSpacingMm: 1.9,
  waterDashMm: 11,
  waterGapMm: 3,

  ridgeCount: 3,
  ridgeAmpMm: 12,
  ridgeFreq: 2.4,
  ridgeOctaves: 4,
  ridgePersistence: 0.5,
  ridgeHatchSpacingMm: 1.6,
  ridgeHatchAngle: 80,
  slopeFollow: false,
  formFollow: true,
  ridgeSharpness: 0.3,
  atmosphere: 0.4,

  headlands: 0,
  foreground: 0,
  foregroundSide: 'left',
  focus: 0.35,

  toneContrast: 0.5,
  crossHatch: 1,
  hatchPatchiness: 0.5,
  taper: 0.5,

  clouds: 0,
  trees: 0,
  treeStyle: 'mixed',
  birds: 0,

  rocks: 3,
  rockMaxSizeMm: 16,
  rockHatchSpacingMm: 1.4,

  penWidthMm: 0.45,
  wobbleMm: 0.22,
  sketch: 0,
  sketchStyle: 'loose',

  palette: 'ink',
  skyColor: '#2a2a26',
  waterColor: '#2a2a26',
  ridgeColor: '#2a2a26',
  contourColor: '#2a2a26',
  rockColor: '#2a2a26',
};
