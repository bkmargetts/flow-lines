import type { LapidaryMode, LapidaryShapes, PenAssignment } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/** Which curated band-texture sequence the sheet deals outer→inner.
 *  'shuffle' hands the deal to the core's seeded pick. */
export type LapidaryTextureMix = 'specimen' | 'geode' | 'facet' | 'linework' | 'tonal' | 'shuffle';

/**
 * UI state for Lapidary (mm / degrees / 0..1 units). `render.ts` converts it
 * to the core's `LapidaryOptions` in px. The named palette carries the pen
 * count; 'custom' hands both the count and the hexes to the fields below.
 */
export interface LapidaryState {
  preset: string;
  seed: number;

  // Arrangement
  mode: LapidaryMode;
  bands: number;
  field: boolean; // draw the full-frame background band (agate/breccia)
  shapes: LapidaryShapes; // organic blobs | angular facets | mixed deal
  irregularity: number; // 0..1 silhouette wobble
  coverage: number; // 0.4..1 outer silhouette ÷ frame
  centerX: number; // -0.5..0.5 of the half-extents
  centerY: number;

  // Seams
  haloMm: number; // reserved-paper seam width
  outlines: boolean;

  // Textures
  textureMix: LapidaryTextureMix;
  spacingMm: number; // base line pitch
  angleDeg: number; // base stroke direction (90 = vertical)
  angleDriftDeg: number; // per-band seeded drift
  densityContrast: number; // 0..1 dense-vs-sparse spread
  waviness: number; // 0..1
  patchiness: number; // 0..1

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

export const defaultLapidaryState: LapidaryState = {
  preset: 'specimen',
  seed: randomSeed(),

  mode: 'agate',
  bands: 5,
  field: true,
  shapes: 'organic',
  irregularity: 0.55,
  coverage: 0.9,
  centerX: 0,
  centerY: 0,

  haloMm: 2.2,
  outlines: false,

  textureMix: 'specimen',
  spacingMm: 1.3,
  angleDeg: 90,
  angleDriftDeg: 25,
  densityContrast: 0.6,
  waviness: 0.5,
  patchiness: 0.55,

  penAssignment: 'interleave',
  pens: 2,

  penWidthMm: 0.35,
  wobbleMm: 0.35,

  palette: 'specimen',
  strokeColor: '#1f1f1d',
  ink2Color: '#d4551a',
  ink3Color: '#1f3a5f',
  ink4Color: '#9c2b52',
};
