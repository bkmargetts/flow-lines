import type { FracturePreset } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * Fracture (crack-propagation networks) settings. The page frame (paper,
 * orientation, resolution, margin) lives in the shared FrameContext, not here.
 * Simulation params are unitless (0..1 knobs); px-scaled details (capture
 * radius, hatch spacing) default from the page size in core.
 */
export interface FractureState {
  seed: number;
  /** Named look preset */
  preset: FracturePreset;

  // ---- Simulation ----
  /** Crack generations — hierarchy depth */
  generations: number;
  /** Nucleation density, 0..1 */
  crackDensity: number;
  /** Stress-noise feature size as a fraction of the min dimension */
  stressScale: number;
  /** Tip inertia, 0..1 — high = straight confident primaries */
  straightness: number;
  /** Per-step heading jitter, 0..1 */
  jitter: number;
  /** Alignment of crack directions to one axis, 0..1 */
  anisotropy: number;
  /** The preferred crack axis, degrees */
  anisotropyAngleDeg: number;
  /** Stress below this arrests a tip, 0..1 */
  arrestThreshold: number;
  /** Fraction of primary cracks seeded on the border growing inward, 0..1 */
  edgeNucleation: number;

  // ---- Render ----
  /** Offset passes on primary cracks */
  boldPasses: number;
  /** Facet-hatch the plates between cracks */
  plateHatch: boolean;
  /** Fraction of plates that get hatched, 0..1 */
  hatchCoverage: number;
  /** Base plate hatch angle, degrees */
  hatchAngleDeg: number;
  /** Tighter hatch band along crack edges — curled-plate shadow, 0..1 */
  edgeCurl: number;
  /** Hand-drawn wobble amplitude in px */
  wobble: number;

  // ---- Presentation / inks ----
  strokeColor: string;
  /** Pen width in millimetres (plotted line weight) */
  penWidthMm: number;
  /** Render preview & export in per-layer inks (primary/fine/plate) */
  multiInk: boolean;
  /** Ink for the bold primary cracks */
  primaryColor: string;
  /** Ink for the fine crack web */
  fineColor: string;
  /** Ink for the plate facet hatching */
  plateColor: string;
}

export const defaultFractureState: FractureState = {
  seed: randomSeed(),
  preset: 'mud',

  generations: 3,
  crackDensity: 0.45,
  stressScale: 0.35,
  straightness: 0.75,
  jitter: 0.5,
  anisotropy: 0,
  anisotropyAngleDeg: 90,
  arrestThreshold: 0.25,
  edgeNucleation: 0,

  boldPasses: 3,
  plateHatch: true,
  hatchCoverage: 0.35,
  hatchAngleDeg: -28,
  edgeCurl: 0.5,
  wobble: 0.5,

  strokeColor: '#000000',
  penWidthMm: 0.3,
  multiInk: false,
  primaryColor: '#1a1a1a',
  fineColor: '#3b3b3b',
  plateColor: '#7a6a55',
};
