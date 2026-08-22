import type { PenAssignment } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/** Curated look ids ('custom' = the picker's label after a randomise). */
export type LifeTerracesLook = 'exposure' | 'agate' | 'ember' | 'drift' | 'custom';

/**
 * UI state for Life Terraces (mm / degrees / 0..1 units). `render.ts` converts
 * it to the core's `LifeTerracesOptions` in px. The named palette carries the
 * pen count; 'custom' hands both the count and the hexes to the fields below.
 */
export interface LifeTerracesState {
  preset: LifeTerracesLook;
  seed: number;

  // Simulation
  seedCount: number; // 1..8 R-pentominoes detonated (physical: scales with sheet area)
  cellSizeMm: number; // 1..4 grid resolution
  generations: number; // 100..800
  decay: number; // 0.8..0.99 exposure memory (higher = longer trails)
  gamma: number; // 0.25..0.9 perceptual lift on the trails
  offCenter: number; // 0..1 rule-of-thirds bias for a single detonation

  // Terraces
  levels: number; // 2..8 terrace levels
  faintThreshold: number; // 0.04..0.2 tone below this leaves paper
  seamMm: number; // 0.3..3 reserved-paper seam at level boundaries
  outlines: boolean; // ink the level boundaries as bold broken dashes
  outlineEmphasis: number; // 1..3 offset passes per outline dash

  // Agents
  spacing: number; // 0.4..2 lamina separation in grid cells
  densityContrast: number; // 0..1 dense bright levels vs sparse faint ones
  strokeLength: number; // 6..80 max lamina length in cells
  waviness: number; // 0..1 cross-lamina undulation
  taper: number; // 0..1 dash end trims
  continuous: boolean; // unbroken flowing laminae instead of hand-fed dashes

  // Present
  massCore: boolean; // trace the turbulent core as one hatched mass
  hatchAngle: number; // -90..90 core hatch angle
  crossHatchAmount: number; // 0..1 cross-hatch coverage of the core
  residueMaxCells: number; // 2..14 residue-vs-core cluster cutoff
  haloMm: number; // 0.3..3 reserved paper around the present

  // Pens
  penAssignment: PenAssignment;
  pens: number; // 1..4 — only consulted when palette === 'custom'

  // Pen / finishing
  penWidthMm: number;
  wobbleMm: number;

  // Ink
  palette: string; // named LAPIDARY_PALETTES id, or 'custom'
  strokeColor: string;
  ink2Color: string;
  ink3Color: string;
  ink4Color: string;
}

export const defaultLifeTerracesState: LifeTerracesState = {
  preset: 'exposure',
  seed: randomSeed(),

  seedCount: 1,
  cellSizeMm: 1.8,
  generations: 300,
  decay: 0.96,
  gamma: 0.45,
  offCenter: 0.6,

  levels: 5,
  faintThreshold: 0.08,
  seamMm: 0.9,
  outlines: false,
  outlineEmphasis: 2,

  spacing: 0.6,
  densityContrast: 0.6,
  strokeLength: 40,
  waviness: 0.3,
  taper: 0.7,
  continuous: false,

  massCore: true,
  hatchAngle: -32,
  crossHatchAmount: 0.5,
  residueMaxCells: 6,
  haloMm: 1.2,

  penAssignment: 'per-region',
  pens: 2,

  penWidthMm: 0.3,
  wobbleMm: 0.3,

  palette: 'specimen',
  strokeColor: '#1f1f1d',
  ink2Color: '#d4551a',
  ink3Color: '#1f3a5f',
  ink4Color: '#9c2b52',
};
