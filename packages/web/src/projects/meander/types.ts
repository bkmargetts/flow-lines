import type { MeanderPreset } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * Meander (river-migration cartography) settings. The page frame (paper,
 * orientation, resolution, margin) lives in the shared FrameContext, not here.
 * Simulation knobs are unitless (0..1 or fractions of the page); the channel
 * width is physical (mm) so the river keeps its scale across sheet sizes.
 */
export interface MeanderState {
  seed: number;
  /** Named look preset */
  preset: MeanderPreset;

  // ---- Simulation ----
  /** Migration steps — how long the river has lived */
  iterations: number;
  /** Migration rate, 0..1 — how fast bends grow and wander */
  migration: number;
  /** Emergent bend scale as a fraction of the min dimension */
  bendScale: number;
  /** Valley belt width as a fraction of the min dimension */
  valleyWidth: number;
  /** Flow axis angle in degrees, 0 = left→right */
  flowAngleDeg: number;
  /** Perpendicular bank noise, 0..1 */
  jitter: number;
  /** Channel width in millimetres */
  channelWidthMm: number;

  // ---- History ----
  /** Historical centerline traces kept */
  traces: number;
  /** How aggressively old traces fragment with age, 0..1 */
  fade: number;
  /** Keep the abandoned loops as oxbow lakes */
  oxbows: boolean;

  // ---- Render ----
  /** Broken interior flow lines inside the channel */
  flowLines: number;
  /** Offset passes on the channel banks */
  boldPasses: number;
  /** Hand-drawn wobble amplitude in px */
  wobble: number;

  // ---- Presentation / inks ----
  strokeColor: string;
  /** Pen width in millimetres (plotted line weight) */
  penWidthMm: number;
  /** Render preview & export in per-layer inks (channel/trace/oxbow) */
  multiInk: boolean;
  /** Ink for the present channel (banks + flow lines) */
  channelColor: string;
  /** Ink for the historical scroll-bar traces */
  traceColor: string;
  /** Ink for the abandoned oxbow lakes */
  oxbowColor: string;
}

export const defaultMeanderState: MeanderState = {
  seed: randomSeed(),
  preset: 'atlas',

  iterations: 320,
  migration: 0.6,
  bendScale: 0.09,
  valleyWidth: 0.6,
  flowAngleDeg: 12,
  jitter: 0.35,
  channelWidthMm: 4.5,

  traces: 18,
  fade: 0.55,
  oxbows: true,

  flowLines: 2,
  boldPasses: 3,
  wobble: 0.9,

  strokeColor: '#000000',
  penWidthMm: 0.3,
  multiInk: false,
  channelColor: '#1c2f4a',
  traceColor: '#7a6a55',
  oxbowColor: '#4a6a70',
};
