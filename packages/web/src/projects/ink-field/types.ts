/**
 * Ink Field settings — material-forward multi-ink fields (ribbon braids,
 * colour-plane lattices, stripe drifts) where regular linework is a substrate
 * for how the physical inks cross, misregister and wear. Distances are in mm
 * (mapped to px in `render.ts`); palette / seed / pen-width follow the other
 * generative modules.
 */
import { randomSeed } from '../../lib/random';

export type InkFieldStyle = 'ribbon' | 'lattice' | 'stripes';
export type WearOrder = 'none' | 'sweep' | 'centerOut' | 'centerIn';

export interface InkFieldState {
  style: InkFieldStyle;
  /** Number of inks = pen layers. */
  colorCount: number;
  palette: string;
  customRamp: string[];

  /** Gap between adjacent lines within one ink, mm. */
  pitchMm: number;
  /** Stroke direction for lattice/stripes; 0 = vertical. */
  angleDeg: number;
  /** Lateral offset between successive inks, fraction of the pitch. */
  inkPhase: number;
  /** Vernier pitch differential between inks (the ribbon braid), fraction. */
  inkPitchDelta: number;
  /** Per-ink lateral drift over the band length, in pitch units. */
  phaseDrift: number;
  /** Whole-ink misregistration amplitude, mm. */
  misregisterMm: number;
  /** Peak low-frequency wobble of each line, mm. */
  wobbleAmpMm: number;
  /** Wobble wavelength along the line, mm. */
  wobbleWavelengthMm: number;
  /** Random per-point shake, mm. */
  jitterMm: number;

  /** Ribbon: full band width, mm. */
  bandWidthMm: number;
  /** Ribbon: drafted skeleton segments. */
  ribbonSegments: number;

  /** Lattice: large colour planes. */
  planeCount: number;
  /** Lattice: light inset rectangle patches. */
  insetPatches: number;
  /** Lattice: background field coverage, 0..1. */
  baseDensity: number;
  /** Lattice: dominant-ink coverage inside a plane, 0..1. */
  planeDensity: number;

  /** Stripes: bands along the stroke direction. */
  stripeCount: number;
  /** Stripes: band-edge overlap, 0..1. */
  stripeSoftness: number;
  /** Stripes: quantise into ruled dark/light blocks. */
  stripeBlocks: boolean;
  /** Stripes: dark-block fraction, 0..1. */
  blockDuty: number;

  /** One small proof dot per ink inside the margin (off by default). */
  penTests: boolean;
  /** Multiply-blend the band inks in the preview (physical overprint). */
  blendInks: boolean;
  /** Plot order as a wear gradient (pen wear follows stroke order). */
  wearOrder: WearOrder;
  wearAngleDeg: number;

  /** Drop emitted polylines shorter than this, mm. */
  minSegmentLengthMm: number;
  penWidthMm: number;
  seed: number;
}

export const defaultInkFieldState: InkFieldState = {
  style: 'ribbon',
  colorCount: 3,
  palette: 'primaries',
  customRamp: ['#1d3fc0', '#111111', '#d0341c'],

  pitchMm: 0.8,
  angleDeg: 0,
  inkPhase: 0.35,
  inkPitchDelta: 0.03,
  phaseDrift: 1.2,
  misregisterMm: 0.3,
  wobbleAmpMm: 0,
  wobbleWavelengthMm: 40,
  jitterMm: 0,

  bandWidthMm: 30,
  ribbonSegments: 5,

  planeCount: 3,
  insetPatches: 1,
  baseDensity: 0.45,
  planeDensity: 0.9,

  stripeCount: 9,
  stripeSoftness: 0.45,
  stripeBlocks: false,
  blockDuty: 0.5,

  penTests: false,
  blendInks: true,
  wearOrder: 'none',
  wearAngleDeg: 0,

  minSegmentLengthMm: 1,
  penWidthMm: 0.35,
  seed: randomSeed(),
};
