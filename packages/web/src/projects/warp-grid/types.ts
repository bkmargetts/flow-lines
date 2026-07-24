import type { WarpBasePattern, WarpGridPreset } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * UI state for Warp Grid (mm / 0..1 units). `render.ts` converts it to the
 * core's `WarpGridOptions` in px. The preset picks the base grating and the
 * hidden-form recipe; the knobs on top reshape it.
 */
export interface WarpGridState {
  preset: WarpGridPreset;
  seed: number;

  // Base grating
  pattern: WarpBasePattern;
  spacingMm: number; // line pitch
  angle: number; // deg, lines/waves
  waveAmp: number; // 0..1 of pitch, waves only
  wavelengthMm: number; // waves base + ridge trains

  // Hidden forms
  deformers: number; // 0..8
  strength: number; // 0..1 per-form strength
  relief: number; // 0..1 normal-shift scale
  scale: number; // form radius as a fraction of the sheet
  noiseScale: number; // noise feature size fraction

  // 3D read
  dropFloor: number; // 0..1 compression pen-lift floor
  occlude: boolean; // hidden-line landscape
  edgeCalm: number; // 0..1 flat band at the margin

  // Fidelity
  detailMm: number; // sample step along lines

  // Pen / finishing
  penWidthMm: number;
  wobbleMm: number;

  // Ink
  strokeColor: string;
}

export const defaultWarpGridState: WarpGridState = {
  preset: 'dome',
  seed: randomSeed(),

  pattern: 'lines',
  spacingMm: 3.4,
  angle: 25,
  waveAmp: 0.5,
  wavelengthMm: 30,

  deformers: 3,
  strength: 0.9,
  relief: 0.6,
  scale: 0.28,
  noiseScale: 0.35,

  dropFloor: 0.35,
  occlude: false,
  edgeCalm: 0.35,

  detailMm: 0.5,

  penWidthMm: 0.35,
  wobbleMm: 0,

  strokeColor: '#1a1a2e',
};
