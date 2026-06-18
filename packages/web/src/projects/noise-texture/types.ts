/**
 * Noise Texture settings. A block of evenly-spaced straight lines is drawn in
 * one ink, then repeated for each further ink phase-shifted into the gaps
 * (interleaved). The inter-colour offset can be drifted along the lines,
 * across the block, and by noise so the inks weave between coincident and
 * evenly interleaved — that beating is the texture. Colours come from a
 * palette sampled into `colorCount` ink layers (one pen per layer).
 * The page frame (paper, orientation, margin) lives in the shared FrameContext.
 */
export interface NoiseTextureState {
  /** Line direction in degrees; 0 = vertical (lines run down the page). */
  angleDeg: number;
  /** Line length as a fraction of the usable page span, 0..1. */
  lineLengthPct: number;
  /** Gap between adjacent lines within one ink, mm. */
  spacingMm: number;
  /** Palette id (see lib/palette). */
  palette: string;
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
  /** Pen width in millimetres (plotted line weight). */
  penWidthMm: number;
  seed: number;
}

export const defaultNoiseTextureState: NoiseTextureState = {
  angleDeg: 0,
  lineLengthPct: 1,
  spacingMm: 2,
  palette: 'riso',
  colorCount: 2,
  phaseDriftAlongMm: 0,
  phaseDriftAcrossMm: 1.5,
  phaseNoiseAmpMm: 0.6,
  phaseNoiseScale: 0.01,
  jitterMm: 0.1,
  wobbleAmpMm: 0,
  wobbleWavelengthMm: 30,
  penWidthMm: 0.3,
  seed: Math.floor(Math.random() * 1000000),
};
