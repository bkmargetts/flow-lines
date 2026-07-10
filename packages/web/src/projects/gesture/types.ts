import type { GesturePreset } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * UI state for Gestural Ink (mm / 0..1 units). `render.ts` converts it to the
 * core's `GestureOptions` in px. The archetype preset is the module's
 * identity — kline bars / sumi sweep / hartung whips / tangle knot — with
 * Energy, Ink weight, and Dryness as the three front-panel feels.
 */
export interface GestureState {
  seed: number;
  preset: GesturePreset;

  // The feel
  energy: number; // 0..1 — speed: curvature, flicks, S-reversals
  inkWeight: number; // 0..1 — how heavy the primary strokes are
  dryness: number; // 0..1 — dry-brush breakup

  // Marks
  gestures: number; // 0 = archetype decides
  whips: number; // -1 = archetype decides
  knots: number; // -1 = archetype decides
  spatter: number; // 0..1
  drips: number; // 0..1

  // Composition
  coverage: number; // 0..1 — ink budget
  balance: number; // 0..1 — deliberate lean off perfect balance
  negativeSpace: number; // 0..1 — guaranteed quiet paper

  // Pen
  penWidthMm: number;
  wobble: number; // px — low; the spines are already curved
  strokeColor: string;
}

export const defaultGestureState: GestureState = {
  seed: randomSeed(),
  preset: 'auto',

  energy: 0.6,
  inkWeight: 0.55,
  dryness: 0.5,

  gestures: 0,
  whips: -1,
  knots: -1,
  spatter: 0.4,
  drips: 0.15,

  coverage: 0.35,
  balance: 0.4,
  negativeSpace: 0.45,

  // Gestural work wants a fatter pen than the hatching modules.
  penWidthMm: 0.5,
  wobble: 0.5,
  strokeColor: '#1a1a1a',
};
