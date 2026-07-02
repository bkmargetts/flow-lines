import type { PlanetType, SketchStyle } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * UI state for the Planet Generator (mm / degrees / 0..1 units). `render.ts`
 * converts it to the core's `PlanetOptions` in px. Friendlier knobs than the
 * core (e.g. "ocean" 0..1 instead of a raw noise threshold) map across there.
 */
export interface PlanetState {
  planetType: PlanetType;
  seed: number;
  radiusFrac: number; // fraction of the usable half-frame
  zoom: number;

  // Light
  lightAngle: number; // degrees
  lightElevation: number; // degrees, 0 grazing .. 90 full face
  ambient: number; // 0..1
  limbDarkening: number; // 0..1

  // Surface
  terrainScale: number; // noise frequency
  terrainContrast: number; // sharpen coast/cracks
  terrainDetail: number; // octaves
  ocean: number; // 0..1 terrestrial sea fraction
  mareAmount: number; // 0..1 lunar dark-plain amount
  coastlines: boolean;
  lavaFissureWidth: number; // 0..1 width of the glowing cracks
  lavaGlow: number; // 0..1 ember-stipple density on the fissures

  // Gas giant
  bands: boolean;
  bandCount: number;
  bandTurbulence: number;
  storms: number;
  stormSize: number; // scale on the storm ovals

  // Ice caps
  iceCaps: boolean;
  capLatitude: number; // degrees
  capRaggedness: number;

  // Mark-making
  hatchSpacingMm: number;
  crossHatchLayers: number;
  stipple: number; // 0..1
  atmosphere: number; // 0..n rings (corona for stars)

  // Rings
  rings: boolean;
  ringInner: number; // disk radii
  ringOuter: number;
  ringTilt: number; // degrees
  ringYaw: number; // degrees
  ringGap: number; // 0..1
  ringCount: number;
  ringDensity: number; // strokes per band
  ringShadow: boolean;

  // Craters
  craters: boolean;
  craterCount: number;
  craterMinR: number; // fraction of disk radius
  craterMaxR: number;
  craterDetail: boolean;

  // Surface relief
  terminatorEmphasis: number; // 0..1
  mountains: boolean;
  clouds: boolean;

  // Engraved-plate annotation
  graticule: boolean;
  graticuleSpacingDeg: number;
  plateFrame: boolean;
  scaleBar: boolean;
  plateTitle: string;
  plateCaption: string;
  layout: 'single' | 'phases' | 'comparison' | 'orbital';
  layoutCount: number;

  // Scene extras
  starfield: boolean;
  starCount: number;
  moon: boolean;
  moonDist: number; // disk radii
  moonAngle: number; // degrees
  moonRadiusFrac: number;

  // Pen / finishing
  penWidthMm: number;
  wobbleMm: number;
  sketch: number; // 0..1 hand-drawn overdraw
  sketchStyle: SketchStyle;

  // Ink
  palette: string;
  limbColor: string;
  hatchColor: string;
  featureColor: string;
  accentColor: string; // rings / stars / atmosphere
}

export const defaultPlanetState: PlanetState = {
  planetType: 'terrestrial',
  seed: randomSeed(),
  radiusFrac: 0.62,
  zoom: 1,

  lightAngle: -35,
  lightElevation: 32,
  ambient: 0.12,
  limbDarkening: 0,

  terrainScale: 1.7,
  terrainContrast: 1.4,
  terrainDetail: 5,
  ocean: 0.58,
  mareAmount: 0.42,
  coastlines: true,
  lavaFissureWidth: 0.12,
  lavaGlow: 0.4,

  bands: false,
  bandCount: 9,
  bandTurbulence: 0.5,
  storms: 1,
  stormSize: 1,

  iceCaps: true,
  capLatitude: 68,
  capRaggedness: 0.5,

  hatchSpacingMm: 1.9,
  crossHatchLayers: 3,
  stipple: 0,
  atmosphere: 1,

  rings: false,
  ringInner: 1.35,
  ringOuter: 2.2,
  ringTilt: 22,
  ringYaw: 12,
  ringGap: 0.14,
  ringCount: 6,
  ringDensity: 3,
  ringShadow: true,

  craters: false,
  craterCount: 80,
  craterMinR: 0.02,
  craterMaxR: 0.14,
  craterDetail: false,

  terminatorEmphasis: 0,
  mountains: false,
  clouds: false,

  graticule: false,
  graticuleSpacingDeg: 30,
  plateFrame: false,
  scaleBar: false,
  plateTitle: '',
  plateCaption: '',
  layout: 'single',
  layoutCount: 5,

  // Default composition: a planet sitting in a field of stars.
  starfield: true,
  starCount: 140,
  moon: false,
  moonDist: 1.9,
  moonAngle: -35,
  moonRadiusFrac: 0.28,

  penWidthMm: 0.3,
  wobbleMm: 0.18,
  sketch: 0,
  sketchStyle: 'loose',

  palette: 'astronomical',
  limbColor: '#2a2a26',
  hatchColor: '#2a2a26',
  featureColor: '#2a2a26',
  accentColor: '#2a2a26',
};
