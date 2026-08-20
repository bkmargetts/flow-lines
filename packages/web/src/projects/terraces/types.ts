import type { LapidarySheetTone, LapidaryToneShape, PenAssignment } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/** Which curated bed-texture sequence the sheet deals top→bottom.
 *  'shuffle' hands the deal to the core's seeded pick. */
export type TerracesTextureMix = 'fortification' | 'linework' | 'tonal' | 'shuffle';

/** How the beds' marks break: 'broken' is the hand-fed dashing (the module's
 *  signature), 'flowing' plots every row/lamina as one unbroken stroke, and
 *  'mixed' deals each bed its own seeded coin — some flow, some stay dashed. */
export type TerracesLineFlow = 'broken' | 'flowing' | 'mixed';

/** Curated look ids ('custom' = the picker's label after a randomise). */
export type TerracesLook = 'terraces' | 'benches' | 'rift' | 'shale' | 'custom';

/**
 * UI state for Terraces (mm / degrees / 0..1 units). `render.ts` converts it
 * to the core's `TerracesOptions` in px. The named palette carries the pen
 * count; 'custom' hands both the count and the hexes to the fields below.
 */
export interface TerracesState {
  preset: TerracesLook;
  seed: number;

  // Beds
  bands: number; // 2..10 bed count
  irregularity: number; // 0..1 bed-boundary wander
  steppiness: number; // 0..1 blend toward piecewise-flat terrace treads

  // Faults
  faults: number; // 0..6 fault planes thrown across the stack
  faultThrow: number; // 0..2 multiplier on each fault's seeded displacement
  faultIncline: number; // -1..1 committed fault-plane tilt (0 = seeded jitter)

  // Seams
  haloMm: number; // reserved-paper seam width
  outlines: boolean;
  outlineEmphasis: number; // 1..3 offset passes each outline dash builds from

  // Textures
  textureMix: TerracesTextureMix;
  spacingMm: number; // base line pitch
  angleDeg: number; // base stroke direction (90 = vertical)
  angleDriftDeg: number; // per-bed seeded drift
  densityContrast: number; // 0..1 dense-vs-sparse spread
  waviness: number; // 0..1
  patchiness: number; // 0..1
  taper: number; // 0..1 stroke end-taper (trims + occasional mid-stroke lifts)
  lineFlow: TerracesLineFlow; // broken dashes / unbroken flowing lines / per-bed deal
  jitterDeg: number; // 0..3° per-stroke angle jitter (ruled lines exempt)
  toneShape: LapidaryToneShape; // within-bed tone idea (seam/core/light/noise)
  toneStrength: number; // 0..1 — 0 pins every bed flat
  lightAngleDeg: number; // -180..180, 'light' tone shape + sheet light
  sheetTone: LapidarySheetTone; // page-wide light over every bed (none/light/vignette)
  sheetToneStrength: number; // 0..1 — inert while sheetTone is 'none'

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

export const defaultTerracesState: TerracesState = {
  preset: 'terraces',
  seed: randomSeed(),

  bands: 6,
  irregularity: 0.55,
  steppiness: 0,

  faults: 2,
  faultThrow: 1,
  faultIncline: 0,

  haloMm: 2.2,
  outlines: false,
  outlineEmphasis: 2,

  textureMix: 'fortification',
  spacingMm: 1.3,
  angleDeg: 90,
  angleDriftDeg: 12,
  densityContrast: 0.6,
  waviness: 0.5,
  patchiness: 0.55,
  taper: 0.7,
  lineFlow: 'broken',
  jitterDeg: 1.5,
  toneShape: 'seam',
  toneStrength: 0.35,
  lightAngleDeg: -120,
  sheetTone: 'none',
  sheetToneStrength: 0.35,

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
