import type { PhysarumPreset, SketchStyle } from '@flow-lines/core';

/**
 * Physarum (slime-mold transport networks) settings. The page frame (paper,
 * orientation, resolution, margin) lives in the shared FrameContext, not here.
 * Simulation params are unitless grid-space — they are NOT converted to px.
 */
export interface PhysarumState {
  seed: number;
  /** Named behaviour preset */
  preset: PhysarumPreset;

  // ---- Simulation ----
  /** Simulation grid width in cells; rows derive from the page aspect */
  gridCols: number;
  /** Number of agents crawling the grid */
  agentCount: number;
  /** Angle between the centre sensor and each side sensor, degrees */
  sensorAngleDeg: number;
  /** How many cells ahead the sensors look */
  sensorDistance: number;
  /** How far an agent turns toward the strongest sensor each step, degrees */
  rotationAngleDeg: number;
  /** Cells advanced per step */
  stepSize: number;
  /** Trail laid per agent per step */
  depositAmount: number;
  /** Fraction of trail lost per step, 0..1 */
  decay: number;
  /** 3×3 box-blur mix factor applied to the trail each step, 0..1 */
  diffuseRate: number;
  /** Simulation iterations */
  steps: number;
  /** How the agent cloud is seeded */
  startLayout: 'scatter' | 'center' | 'ring';

  // ---- Render ----
  /** Render style */
  style: 'paths' | 'contour' | 'hatch' | 'dual';
  /** 'paths': record an agent position every N steps */
  sampleEvery: number;
  /** 'paths': drop trajectory runs shorter than this, in cells */
  minPathLength: number;
  /** 'paths': fraction of agents whose trajectory is traced, 0..1 */
  pathFraction: number;
  /** Nested iso levels for the contour/dual styles */
  contourLevels: number;
  /** Pre-trace blur on the field, in cells */
  blurSigma: number;
  /** Lowest iso level as a fraction of the field range, 0..1 */
  isoLow: number;
  /** Highest iso level as a fraction of the field range, 0..1 */
  isoHigh: number;
  /** Field threshold (normalized) that becomes inked region for hatch/dual */
  fillThreshold: number;

  // ---- Art style ----
  /** Master switch for the hand-drawn art treatment */
  artStyle: boolean;
  /** Base interior hatch angle for the filled region, degrees */
  hatchAngle: number;
  /** Fraction of the filled region that gets the cross-hatch layer, 0..1 */
  crossHatchAmount: number;
  /** Low-frequency jitter on hatch spacing/phase, 0..1 */
  hatchJitter: number;
  /** Committed value bands for the field; 0 = continuous */
  valueBands: number;
  /** Hold faint marks off the frame corners, 0..1 */
  vignette: number;
  /** Hand-drawn wobble amplitude in px */
  wobble: number;
  /** Opt-in hand-drawn sketch overdraw intensity, 0..1 (0 = off). */
  sketch: number;
  /** Character of the sketch overdraw. */
  sketchStyle: SketchStyle;

  // ---- Presentation / inks ----
  strokeColor: string;
  /** Pen width in millimetres (plotted line weight) */
  penWidthMm: number;
  /** Render preview & export in per-layer inks (core/mid/rim) */
  multiInk: boolean;
  /** Ink for the busy shared veins */
  coreColor: string;
  /** Ink for the mid network */
  midColor: string;
  /** Ink for the faint explorer trails */
  rimColor: string;
}

export const defaultPhysarumState: PhysarumState = {
  seed: Math.floor(Math.random() * 1000000),
  preset: 'network',

  gridCols: 200,
  agentCount: 12000,
  sensorAngleDeg: 18,
  sensorDistance: 6,
  rotationAngleDeg: 55,
  stepSize: 1,
  depositAmount: 4,
  decay: 0.15,
  diffuseRate: 0.5,
  steps: 400,
  startLayout: 'scatter',

  style: 'contour',
  sampleEvery: 2,
  minPathLength: 8,
  pathFraction: 0.05,
  contourLevels: 6,
  blurSigma: 1.0,
  isoLow: 0.2,
  isoHigh: 0.9,
  fillThreshold: 0.4,

  artStyle: true,
  hatchAngle: -32,
  crossHatchAmount: 0.5,
  hatchJitter: 0.5,
  valueBands: 5,
  vignette: 0.35,
  wobble: 0.8,
  sketch: 0,
  sketchStyle: 'loose',

  strokeColor: '#000000',
  penWidthMm: 0.3,
  multiInk: false,
  coreColor: '#1a1a1a',
  midColor: '#3b5566',
  rimColor: '#9a6a3c',
};
