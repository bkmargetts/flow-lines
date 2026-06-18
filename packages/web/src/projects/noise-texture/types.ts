/**
 * Noise Texture settings. Straight line "swatches" are laid across the page
 * and each is plotted as overlapped, slightly-offset passes whose thickness
 * swells and thins — the build-up of strokes carries the texture. Colours come
 * from a palette sampled into `colorCount` ink layers (one pen per layer).
 * The page frame (paper, orientation, margin) lives in the shared FrameContext.
 */
export interface NoiseTextureState {
  /** Number of straight swatch lines across the page. */
  lineCount: number;
  /** Angle of the swatch lines, degrees (0 = horizontal). */
  angleDeg: number;
  /** Swatch length as a fraction of the usable page span, 0..1. */
  lineLengthPct: number;
  /** Widest band thickness, mm. */
  maxThicknessMm: number;
  /** Narrowest band thickness, mm. */
  minThicknessMm: number;
  /** Perpendicular gap between neighbouring offset passes, mm. */
  passSpacingMm: number;
  /** Spatial frequency of the thickness noise. */
  thicknessNoiseScale: number;
  /** Palette id (see lib/palette). */
  palette: string;
  /** Number of ink layers (colours) sampled from the palette. */
  colorCount: number;
  /** Spatial frequency of the colour-patch noise. */
  colorNoiseScale: number;
  /** Random per-point shake, mm. */
  jitterMm: number;
  /** Low-frequency wobble of each pass, mm. */
  wobbleAmpMm: number;
  /** Wobble wavelength along the pass, mm. */
  wobbleWavelengthMm: number;
  /** Pen width in millimetres (plotted line weight). */
  penWidthMm: number;
  seed: number;
}

export const defaultNoiseTextureState: NoiseTextureState = {
  lineCount: 7,
  angleDeg: 0,
  lineLengthPct: 0.9,
  maxThicknessMm: 8,
  minThicknessMm: 1,
  passSpacingMm: 0.4,
  thicknessNoiseScale: 0.01,
  palette: 'riso',
  colorCount: 2,
  colorNoiseScale: 0.015,
  jitterMm: 0.15,
  wobbleAmpMm: 0.4,
  wobbleWavelengthMm: 24,
  penWidthMm: 0.3,
  seed: Math.floor(Math.random() * 1000000),
};
