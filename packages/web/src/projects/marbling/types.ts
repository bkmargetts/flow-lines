import type { MarblingPattern } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * UI state for Marbling (mm / 0..1 units). `render.ts` converts it to the
 * core's `MarblingOptions` in px. The pattern preset picks the rake recipe;
 * drops fill the bath first, the combs shear it after — exactly the order a
 * marbler works in.
 */
export interface MarblingState {
  preset: MarblingPattern;
  seed: number;

  // Bath
  drops: number;
  dropSizeMm: number; // mean drop radius
  ringsPerDrop: number; // nested echo rings per drop
  dropJitter: number; // 0..1 per-drop radius variation

  // Rake
  combSpacingMm: number; // tooth pitch
  swirl: number; // 0..1 rake strength
  falloffMm: number; // shear falloff λ at the base pitch
  wavy: number; // 0..1 bouquet swing
  vortex: number; // 0..1 vortex twist

  // Fidelity
  detailMm: number; // max segment length after deformation

  // Pen / finishing
  penWidthMm: number;
  wobbleMm: number;

  // Ink
  inkGroups: number; // 1..4 pens (drop % group)
  strokeColor: string;
  ink2Color: string;
  ink3Color: string;
  ink4Color: string;
}

export const defaultMarblingState: MarblingState = {
  preset: 'nonpareil',
  seed: randomSeed(),

  drops: 85,
  dropSizeMm: 16,
  ringsPerDrop: 3,
  dropJitter: 0.35,

  combSpacingMm: 4.2,
  swirl: 0.55,
  falloffMm: 1.4,
  wavy: 0.5,
  vortex: 0.7,

  detailMm: 0.35,

  penWidthMm: 0.3,
  wobbleMm: 0,

  inkGroups: 1,
  strokeColor: '#1f3a5f',
  ink2Color: '#8a3324',
  ink3Color: '#2a2a26',
  ink4Color: '#9c2b52',
};
