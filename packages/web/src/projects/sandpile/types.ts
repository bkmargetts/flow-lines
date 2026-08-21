import type { SandpileDomain, SandpilePlacement, SandpilePreset } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * Sandpile (tropical curves from abelian relaxation) settings. The page frame —
 * paper, orientation, resolution, margin — lives in the shared FrameContext,
 * not here.
 */
export interface SandpileState {
  seed: number;
  /** Named look preset */
  preset: SandpilePreset;

  // ---- Simulation ----
  /** Lattice sites across the page; cost grows ~cubically */
  resolution: number;
  /** Grains dropped into the maximal stable state — the network's fineness */
  points: number;
  /** Domain the sand relaxes inside */
  domain: SandpileDomain;
  /** Side count for the polygon domain */
  sides: number;
  /** Rotation of the polygon domain, degrees */
  rotationDeg: number;
  /** Where the grains land */
  placement: SandpilePlacement;
  /** Radius of the ring placement as a fraction of the domain */
  ringRadius: number;

  // ---- Extraction ----
  /** Collinearity tolerance in lattice units */
  straightness: number;
  /** Shortest run kept, in lattice units */
  minSegment: number;

  // ---- Render ----
  /** Hand-drawn wobble amplitude in px */
  wobble: number;

  // ---- Presentation / inks ----
  strokeColor: string;
  /** Pen width in millimetres (plotted line weight) */
  penWidthMm: number;
}

export const defaultSandpileState: SandpileState = {
  seed: randomSeed(),
  preset: 'facet',

  resolution: 420,
  points: 34,
  domain: 'polygon',
  sides: 6,
  rotationDeg: 12,
  placement: 'scatter',
  ringRadius: 0.6,

  straightness: 2,
  minSegment: 10,

  wobble: 0.4,

  strokeColor: '#000000',
  penWidthMm: 0.3,
};
