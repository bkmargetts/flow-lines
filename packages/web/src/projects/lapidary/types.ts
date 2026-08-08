import type {
  LapidaryMode,
  LapidaryShapes,
  LapidaryValueRhythm,
  PenAssignment,
  SpiralDirection,
  SpiralForm,
  SpiralJoin,
} from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/** Which curated band-texture sequence the sheet deals outer→inner.
 *  'shuffle' hands the deal to the core's seeded pick. */
export type LapidaryTextureMix =
  | 'specimen'
  | 'geode'
  | 'fortification'
  | 'facet'
  | 'ammonite'
  | 'linework'
  | 'tonal'
  | 'shuffle';

/** Curated look ids ('custom' = the picker's label after a randomise). */
export type LapidaryLook =
  | 'specimen'
  | 'geode'
  | 'fortification'
  | 'breccia'
  | 'terraces'
  | 'facet'
  | 'ammonite'
  | 'labyrinth'
  | 'coil'
  | 'slab'
  | 'mono'
  | 'custom';

/**
 * UI state for Lapidary (mm / degrees / 0..1 units). `render.ts` converts it
 * to the core's `LapidaryOptions` in px. The named palette carries the pen
 * count; 'custom' hands both the count and the hexes to the fields below.
 */
export interface LapidaryState {
  preset: LapidaryLook;
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
  faults: number; // 0..4 vertical fault planes (strata only)
  veins: boolean; // trace fragment seams on the vein accent pen (breccia only)
  spiralForm: SpiralForm; // round vs squared-off coil (spiral only)
  spiralDirection: SpiralDirection; // winds to the centre vs unwinds from it
  spiralJoin: SpiralJoin; // carved cell seams vs seamless pattern morphing
  spiralWidth: number; // 0.15..1 of the local winding pitch (1 = windings close up)
  spiralTaper: number; // -1..1 signed taper toward the leading end
  spiralPulse: number; // 0..1 organic width modulation along the arc

  // Value — the sheet's tonal composition, committed before anything is drawn
  valueStructure: number; // 0..1 how hard the value ladder is composed
  valueRhythm: LapidaryValueRhythm; // which way the darks run across the stack
  paperBand: boolean; // let the plan hold its lightest band as bare paper
  gradation: number; // 0..1 how far a band graduates across its own width
  fieldEdge: number; // 0..1 how far the background field trails off the page edge

  // Seams
  haloMm: number; // reserved-paper seam width
  outlines: boolean;
  outlineWeight: number; // 0..1 built-up weight on the anchor band's keyline

  // Textures
  textureMix: LapidaryTextureMix;
  spacingMm: number; // base line pitch
  angleDeg: number; // base stroke direction (90 = vertical)
  angleDriftDeg: number; // per-band seeded drift
  angleQuantumDeg: number; // snap that drift to multiples of this (0 = free)
  densityContrast: number; // 0..1 dense-vs-sparse spread
  waviness: number; // 0..1
  patchiness: number; // 0..1

  // Pens
  penAssignment: PenAssignment;
  pens: number; // 1..4 — only consulted when palette === 'custom'

  // Pen / finishing
  penWidthMm: number;
  wobbleMm: number;
  misregistration: number; // 0..1 how far each later pen lands off the first

  // Ink
  palette: string; // named LAPIDARY_PALETTES id, or 'custom'
  strokeColor: string;
  ink2Color: string;
  ink3Color: string;
  ink4Color: string;
  veinColor: string; // the kintsugi accent pen — only drawn when veins are on
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
  faults: 0,
  veins: false,
  spiralForm: 'circular',
  spiralDirection: 'inward',
  spiralJoin: 'cells',
  spiralWidth: 0.55,
  spiralTaper: 0.35,
  spiralPulse: 0.35,

  valueStructure: 0.65,
  valueRhythm: 'auto',
  paperBand: true,
  gradation: 0.45,
  fieldEdge: 0.35,

  haloMm: 2.2,
  outlines: false,
  outlineWeight: 0.5,

  textureMix: 'specimen',
  spacingMm: 1.3,
  angleDeg: 90,
  angleDriftDeg: 25,
  angleQuantumDeg: 15,
  densityContrast: 0.6,
  waviness: 0.5,
  patchiness: 0.55,

  penAssignment: 'interleave',
  pens: 2,

  penWidthMm: 0.35,
  wobbleMm: 0.35,
  misregistration: 0.5,

  palette: 'specimen',
  strokeColor: '#1f1f1d',
  ink2Color: '#d4551a',
  ink3Color: '#1f3a5f',
  ink4Color: '#9c2b52',
  veinColor: '#b8860b',
};
