import type { Vec3 } from './vec3.js';
import type { PlanetOptions, PlanetType } from './index.js';

export const DEFAULTS: Required<Omit<PlanetOptions, 'width' | 'height' | 'margin' | 'seed'>> = {
  radiusFrac: 0.7,
  planetType: 'terrestrial',
  lightAngle: -35,
  lightElevation: 35,
  ambient: 0.12,
  limbDarkening: 0,
  noiseScale: 1.7,
  octaves: 5,
  persistence: 0.5,
  contrast: 1.4,
  seaLevel: 0,
  mareLevel: -0.12,
  coastlines: true,
  lavaFissureWidth: 0.12,
  lavaGlow: 0.4,
  bands: false,
  bandCount: 9,
  bandTurbulence: 0.5,
  storms: 0,
  stormSize: 1,
  iceCaps: false,
  capLatitude: 68,
  capRaggedness: 0.5,
  hatchSpacing: 6,
  crossHatchLayers: 3,
  lightWeight: 0.85,
  albedoWeight: 0.7,
  stipple: 0,
  atmosphere: 0,
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
  title: '',
  caption: '',
  layout: 'single',
  layoutCount: 5,
  starfield: false,
  starCount: 120,
  moon: false,
  moonDist: 1.9,
  moonAngle: -35,
  moonRadiusFrac: 0.28,
  penWidth: 1,
  wobble: 0.6,
  sketch: 0,
  sketchStyle: 'loose',
};

export interface BodyParams {
  cx: number;
  cy: number;
  R: number;
  bodyType: PlanetType;
  bodySeed: number;
  craters: boolean;
  /** Disks that hide any sample falling inside them (the primary for a moon; the
   *  star + nearer bodies for the orbital diagram). */
  occluders?: { cx: number; cy: number; R: number }[];
  /** Per-body light direction; falls back to the scene light when absent (only
   *  phase strips need a different light per body). */
  light?: Vec3;
}
