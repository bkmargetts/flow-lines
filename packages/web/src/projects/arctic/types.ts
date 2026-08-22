import type { ArcticMarks, ArcticPreset } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * Arctic (random domino tilings of the Aztec diamond) settings. The page frame
 * — paper, orientation, resolution, margin — lives in the shared FrameContext,
 * not here.
 */
export interface ArcticState {
  seed: number;
  /** Named look preset */
  preset: ArcticPreset;

  /** Diamond order n: AD(n) holds n(n+1) dominoes, so detail grows as n² */
  order: number;
  /** Which of the four domino classes get inked */
  marks: ArcticMarks;
  /** Turn the diamond 45° so the frozen regions sit at the page edges */
  upright: boolean;

  /** Hand-drawn wobble amplitude in px */
  wobble: number;

  // ---- Presentation / inks ----
  strokeColor: string;
  /** Pen width in millimetres (plotted line weight) */
  penWidthMm: number;
  /** Give each domino class its own ink (and its own pen on export) */
  multiInk: boolean;
  northColor: string;
  southColor: string;
  eastColor: string;
  westColor: string;
}

export const defaultArcticState: ArcticState = {
  seed: randomSeed(),
  preset: 'dissolve',

  order: 120,
  marks: 'one',
  upright: false,

  wobble: 0.35,

  strokeColor: '#000000',
  penWidthMm: 0.3,
  multiInk: false,
  northColor: '#1a1a1a',
  southColor: '#4a4a4a',
  eastColor: '#7a5c3a',
  westColor: '#3a5c7a',
};
