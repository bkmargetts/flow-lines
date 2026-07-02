import type { LeniaPreset, LeniaSeedPattern } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * Lenia ("Lifeforms") settings. The page frame (paper, orientation,
 * resolution, margin) lives in the shared FrameContext, not here. Simulation
 * params are unitless grid-space — they are NOT converted to px.
 */
export interface LeniaState {
  seed: number;
  /** Named rule + seed preset */
  preset: LeniaPreset;

  // ---- Simulation ----
  /** Simulation grid width in cells; rows derive from the page aspect */
  gridCols: number;
  /** Kernel radius in cells */
  kernelRadius: number;
  /** Growth centre μ */
  mu: number;
  /** Growth width σ */
  sigma: number;
  /** Time resolution T; the step is dt = 1/T */
  timeRes: number;
  /** Kernel ring peak weights β; length sets the ring count */
  beta: number[];
  /** How the initial state is placed */
  seedPattern: LeniaSeedPattern;
  /** Count of soup patches / gliders */
  seedSpots: number;
  /** Simulation iterations */
  steps: number;

  // ---- Long exposure ----
  /** Accumulate a comet-trail light field of where the creatures travelled */
  longExposure: boolean;
  /** Per-step exposure decay, 0..1 — higher = longer trails */
  decay: number;
  /** Perceptual lift on the trail before tracing; <1 brightens the ghosts */
  gamma: number;

  // ---- Render ----
  /** Render style for the field */
  style: 'contour' | 'hatch' | 'dual';
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

export const defaultLeniaState: LeniaState = {
  seed: randomSeed(),
  preset: 'orbium',

  gridCols: 96,
  kernelRadius: 13,
  mu: 0.15,
  sigma: 0.015,
  timeRes: 10,
  beta: [1],
  seedPattern: 'orbium',
  seedSpots: 5,
  steps: 280,

  longExposure: true,
  decay: 0.985,
  gamma: 0.5,

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
