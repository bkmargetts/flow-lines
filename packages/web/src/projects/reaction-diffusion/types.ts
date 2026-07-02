import type { RDPreset } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * Reaction–Diffusion (Gray–Scott) settings. The page frame (paper,
 * orientation, resolution, margin) lives in the shared FrameContext, not here.
 * Simulation params are unitless grid-space — they are NOT converted to px.
 */
export interface RDState {
  seed: number;
  /** Named feed/kill preset */
  preset: RDPreset;
  /** Simulation grid width in cells; rows derive from the page aspect */
  gridCols: number;
  /** Simulation iterations */
  steps: number;
  /** Feed rate f (advanced override of the preset) */
  feed: number;
  /** Kill rate k (advanced override of the preset) */
  kill: number;
  /** U diffusion rate */
  du: number;
  /** V diffusion rate */
  dv: number;
  /** Count of V seed blobs */
  seedSpots: number;
  /** How the initial V perturbation is placed */
  seedLayout: 'scatter' | 'center' | 'grid';

  // ---- Render ----
  /** Render style for the field */
  style: 'contour' | 'hatch' | 'dual';
  /** Nested iso levels for the contour/dual styles */
  contourLevels: number;
  /** Pre-trace blur on the V field, in cells */
  blurSigma: number;
  /** Lowest iso level as a fraction of the field range, 0..1 */
  isoLow: number;
  /** Highest iso level as a fraction of the field range, 0..1 */
  isoHigh: number;
  /** V threshold (normalized) that becomes inked region for hatch/dual */
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
  /** Hold faint contours off the frame corners, 0..1 */
  vignette: number;
  /** Hand-drawn wobble amplitude in px */
  wobble: number;

  // ---- Presentation / inks ----
  strokeColor: string;
  /** Pen width in millimetres (plotted line weight) */
  penWidthMm: number;
  /** Render preview & export in per-layer inks (core/mid/rim) */
  multiInk: boolean;
  /** Ink for the dense core */
  coreColor: string;
  /** Ink for the mid field */
  midColor: string;
  /** Ink for the faint rim contours */
  rimColor: string;
}

export const defaultRDState: RDState = {
  seed: randomSeed(),
  preset: 'coral',
  gridCols: 180,
  steps: 4000,
  feed: 0.0545,
  kill: 0.062,
  du: 1.0,
  dv: 0.5,
  seedSpots: 12,
  seedLayout: 'scatter',

  style: 'contour',
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

  strokeColor: '#000000',
  penWidthMm: 0.3,
  multiInk: false,
  coreColor: '#1a1a1a',
  midColor: '#3b5566',
  rimColor: '#9a6a3c',
};
