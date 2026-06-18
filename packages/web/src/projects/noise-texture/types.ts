/**
 * Noise Texture settings. A block of evenly-spaced straight lines is drawn in
 * one ink, then repeated for each further ink phase-shifted into the gaps
 * (interleaved). The inter-colour offset can be drifted along the lines,
 * across the block, and by noise so the inks weave between coincident and
 * evenly interleaved — that beating is the texture. Colours come from a
 * palette sampled into `colorCount` ink layers (one pen per layer).
 * The page frame (paper, orientation, margin) lives in the shared FrameContext.
 */
import { type Point } from '@flow-lines/core';

/** Which shape, if any, the pattern is clipped to. */
export type MaskMode = 'none' | 'strips' | 'band' | 'rect' | 'ellipse';

export interface NoiseTextureState {
  /** Line direction in degrees; 0 = vertical (lines run down the page). */
  angleDeg: number;
  /** Line length as a fraction of the usable page span, 0..1. */
  lineLengthPct: number;
  /** Gap between adjacent lines within one ink, mm. */
  spacingMm: number;
  /** Palette id (see lib/palette). */
  palette: string;
  /** Per-ink colours used when `palette === 'custom'`. */
  customRamp: string[];
  /** Number of inks / interleaved gratings. */
  colorCount: number;
  /** Inter-colour offset built up along the lines (down the page), mm. */
  phaseDriftAlongMm: number;
  /** Inter-colour offset built up across the block, mm. */
  phaseDriftAcrossMm: number;
  /** Noise-driven inter-colour offset amplitude, mm. */
  phaseNoiseAmpMm: number;
  /** Spatial frequency of the phase noise. */
  phaseNoiseScale: number;
  /** Random per-point shake, mm. */
  jitterMm: number;
  /** Low-frequency wobble of each line, mm. */
  wobbleAmpMm: number;
  /** Wobble wavelength along the line, mm. */
  wobbleWavelengthMm: number;
  /**
   * Width of the edge envelope over which the offset relaxes to the clean
   * even interleave, mm — smooths the ragged block silhouette. 0 = off.
   */
  edgeSmoothMm: number;

  // Mask — the pattern shows only inside the chosen shape.
  maskMode: MaskMode;
  /** Diagonal-strip mask: stripe angle, on-width and gap, mm. */
  stripAngleDeg: number;
  stripWidthMm: number;
  stripGapMm: number;
  /** Drawn-line band mask: width either side of the path, mm. */
  bandWidthMm: number;
  /** The user-drawn band centreline, in canvas px. */
  maskPath: Point[];
  /** Whether tapping/dragging the canvas adds to the band path. */
  drawMode: boolean;
  /** Rect / ellipse mask size as a fraction of the usable area, 0..1. */
  maskWidthPct: number;
  maskHeightPct: number;

  /** Pen width in millimetres (plotted line weight). */
  penWidthMm: number;
  seed: number;
}

export const defaultNoiseTextureState: NoiseTextureState = {
  angleDeg: 0,
  lineLengthPct: 1,
  spacingMm: 2,
  palette: 'riso',
  customRamp: ['#111111', '#e2231a'],
  colorCount: 2,
  phaseDriftAlongMm: 0,
  phaseDriftAcrossMm: 1.5,
  phaseNoiseAmpMm: 0.6,
  phaseNoiseScale: 0.01,
  jitterMm: 0.1,
  wobbleAmpMm: 0,
  wobbleWavelengthMm: 30,
  edgeSmoothMm: 0,
  maskMode: 'none',
  stripAngleDeg: 45,
  stripWidthMm: 12,
  stripGapMm: 12,
  bandWidthMm: 15,
  maskPath: [],
  drawMode: false,
  maskWidthPct: 0.6,
  maskHeightPct: 0.6,
  penWidthMm: 0.3,
  seed: Math.floor(Math.random() * 1000000),
};
