import type { CoralPreset, CoralSeedShape } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * Coral (differential growth) settings. The page frame (paper, orientation,
 * resolution, margin) lives in the shared FrameContext, not here. Every knob
 * is page-relative (0..1, counts, or a divisor of the min dimension) so the
 * composition — folds across the sheet — holds at any sheet size at constant
 * cost.
 */
export interface CoralState {
  seed: number;
  /** Named look preset */
  preset: CoralPreset;

  // ---- Simulation ----
  /** Growth steps — how long the organism has lived */
  iterations: number;
  /** Insertion rate, 0..1 — how eagerly the curve grows */
  growth: number;
  /** Fold wavelength as a divisor of the min dimension — smaller is chunkier */
  foldDiv: number;
  /** Approximate node cap — growth stops here */
  maxNodes: number;
  /** Growth-gate patch size as a fraction of the min dimension */
  noiseScale: number;
  /** How hard noise gates growth into patches, 0..1 */
  patchiness: number;
  /** Growth preference for outward tips, 0..1 — lobes ramify */
  curvatureBias: number;
  /** Random per-node nudge, 0..1 */
  jitter: number;
  /** Initial geometry */
  seedShape: CoralSeedShape;
  /** Colony count for the 'blobs' seed */
  blobs: number;

  // ---- History ----
  /** Onion-skin history rings kept, 0 = final silhouette only */
  rings: number;
  /** How aggressively old rings fragment with age, 0..1 */
  fade: number;

  // ---- Render ----
  /** Offset passes on the final silhouette */
  boldPasses: number;
  /** Hand-drawn wobble amplitude in px */
  wobble: number;

  // ---- Presentation / inks ----
  strokeColor: string;
  /** Pen width in millimetres (plotted line weight) */
  penWidthMm: number;
  /** Render preview & export in per-layer inks (edge/ring/relic) */
  multiInk: boolean;
  /** Ink for the final silhouette */
  edgeColor: string;
  /** Ink for the recent history rings */
  ringColor: string;
  /** Ink for the oldest, most fragmented rings */
  relicColor: string;
}

export const defaultCoralState: CoralState = {
  seed: randomSeed(),
  preset: 'reef',

  iterations: 420,
  growth: 0.6,
  foldDiv: 26,
  maxNodes: 3000,
  noiseScale: 0.18,
  patchiness: 0.45,
  curvatureBias: 0.5,
  jitter: 0.25,
  seedShape: 'circle',
  blobs: 4,

  rings: 14,
  fade: 0.5,

  boldPasses: 3,
  wobble: 0.7,

  strokeColor: '#000000',
  penWidthMm: 0.3,
  multiInk: false,
  edgeColor: '#1c2b33',
  ringColor: '#4a6a70',
  relicColor: '#9a8f7a',
};
