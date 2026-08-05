/**
 * Conway long-exposure settings. The page frame (paper, orientation,
 * resolution, margin) lives in the shared FrameContext, not here.
 */
import { randomSeed } from '../../lib/random';
export interface ConwayState {
  seed: number;
  /** How many R-pentominoes to detonate at the start */
  seedCount: number;
  /** Cell size in millimetres — sets the simulation's grid resolution */
  cellSize: number;
  /** Generations to simulate from the R-pentomino */
  generations: number;
  /** Per-generation exposure decay (0-1); higher = longer comet trails */
  decay: number;
  /** Perceptual lift on faint trails (<1 brightens the ghosts) */
  gamma: number;
  faintThreshold: number;
  mediumThreshold: number;
  solidThreshold: number;
  /** Final clusters this size or smaller draw as crisp outlines, not solid */
  residueMaxCells: number;
  /** Hand-drawn wobble amplitude in px */
  wobble: number;
  /** History render style */
  style: 'marks' | 'contour' | 'streaks' | 'slipstream' | 'embers' | 'weave';
  /** Reserved-paper sliver around the present, in mm */
  haloMm: number;
  /** Nested iso levels for the contour style */
  contourLevels: number;
  /** Slipstream: base streamline separation in grid cells (tone tightens it) */
  slipstreamSpacing: number;
  /** Embers: stipple dots per cell at full tone */
  stippleDensity: number;

  // ---- Weave (calm multi-ink grating disturbed by the trails) ----
  /** Weave: inks in the grating (1..4), each on its own band-NN pen layer */
  weaveInks: number;
  /** Weave: palette id for the grating inks */
  weavePalette: string;
  /** Weave: custom ink ramp when weavePalette is 'custom' */
  weaveCustomRamp: string[];
  /** Weave: multiply-blend the band inks in the preview (overprint look) */
  weaveBlend: boolean;
  /** Weave: ruling spacing within one ink, mm */
  weavePitchMm: number;
  /** Weave: grating direction in degrees (0 = vertical) */
  weaveAngle: number;
  /** Weave: per-ink split at full exposure, fraction of pitch per ink step */
  weaveSeparation: number;
  /** Weave: per-ink pitch differential at full exposure (vernier beat) */
  weaveVernier: number;
  /** Weave: ruling swing toward the trail motion at full exposure, 0..1 */
  weaveBend: number;
  /** Weave: signed density swell; >0 tightens spacing on trails */
  weavePitchSwell: number;
  /** Weave: wobble amplitude at full exposure, mm */
  weaveWobbleMm: number;
  /** Weave: fraction of the calm ruling drawn (0..1); lower breathes */
  weaveCoverage: number;
  /** Weave: disturbance form — bent rulings or ripple rings */
  weaveForm: 'grating' | 'rings';
  strokeColor: string;
  /** Pen width in millimetres (plotted line weight) */
  penWidthMm: number;

  // ---- Art style ----
  /** Master switch for the hand-drawn art treatment */
  artStyle: boolean;
  /** Draw the present-core as one hatched mass instead of grid boxes */
  massCore: boolean;
  /** Base interior hatch angle for the core mass, degrees */
  hatchAngle: number;
  /** Fraction of the core mass that gets the cross-hatch layer, 0..1 */
  crossHatchAmount: number;
  /** Low-frequency jitter on hatch spacing/phase, 0..1 */
  hatchJitter: number;
  /** Committed value bands for the trails; 0 = continuous */
  valueBands: number;
  /** Bias a single detonation toward a rule-of-thirds point, 0..1 */
  offCenter: number;
  /** Hold faint marks off the frame corners, 0..1 */
  vignette: number;

  // ---- Presentation / inks ----
  /** Render preview & export in per-layer inks (present/ghost/trail) */
  multiInk: boolean;
  /** Ink for the crisp present (and plate border) */
  presentColor: string;
  /** Ink for the mid-tone ghosts */
  ghostColor: string;
  /** Ink for the faint trails */
  trailColor: string;
}

export const defaultConwayState: ConwayState = {
  seed: randomSeed(),
  seedCount: 1,
  cellSize: 1.8,
  generations: 400,
  decay: 0.92,
  gamma: 0.45,
  faintThreshold: 0.1,
  mediumThreshold: 0.32,
  solidThreshold: 0.62,
  residueMaxCells: 6,
  wobble: 0.8,
  style: 'marks',
  haloMm: 1.2,
  contourLevels: 5,
  slipstreamSpacing: 0.9,
  stippleDensity: 7,

  weaveInks: 3,
  weavePalette: 'primaries',
  weaveCustomRamp: ['#1d3fc0', '#111111', '#d0341c'],
  weaveBlend: true,
  weavePitchMm: 1.4,
  weaveAngle: 0,
  weaveSeparation: 0.4,
  weaveVernier: 0.01,
  weaveBend: 0.7,
  weavePitchSwell: 0.5,
  weaveWobbleMm: 0.25,
  weaveCoverage: 0.4,
  weaveForm: 'rings',
  strokeColor: '#000000',
  penWidthMm: 0.3,

  artStyle: true,
  massCore: true,
  hatchAngle: -32,
  crossHatchAmount: 0.5,
  hatchJitter: 0.5,
  valueBands: 4,
  offCenter: 0.6,
  vignette: 0.4,

  multiInk: false,
  presentColor: '#1a1a1a',
  ghostColor: '#5b6e7a',
  trailColor: '#b06a3c',
};
