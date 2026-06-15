import {
  generateTexture,
  type FlowLine,
  type PageMetrics,
  type TextureOptions,
} from '@flow-lines/core';
import type { FrameSettings } from '../FrameContext';

/**
 * Build the shared background texture for a page, holding it a configurable
 * halo off the drawing's strokes. Returns null when texture is disabled, so
 * callers leave their output (and layerColors) untouched. The texture lines are
 * tagged layer:'texture' and should be prepended to the drawing so they render
 * behind it.
 */
/** Texture options for a page (sans `avoid`), or null when texture is off. */
export function textureOptionsFor(
  frame: FrameSettings,
  page: PageMetrics
): Omit<TextureOptions, 'avoid'> | null {
  if (!frame.textureEnabled) return null;
  return {
    width: page.widthPx,
    height: page.heightPx,
    margin: frame.marginMm * page.pxPerMm,
    pxPerMm: page.pxPerMm,
    style: frame.textureStyle,
    spacingMm: frame.textureSpacingMm,
    angleDeg: frame.textureAngleDeg,
    scale: frame.textureScale,
    jitter: frame.textureJitter,
    density: frame.textureDensity,
    crossHatch: frame.textureCrossHatch,
    seed: frame.textureSeed,
    shapes: frame.textureShapes,
    haloMm: frame.textureHaloMm,
  };
}

/** Synchronous build (conway/flow-field): texture lines held a halo off the drawing. */
export function buildTexture(
  frame: FrameSettings,
  page: PageMetrics,
  drawingLines: FlowLine[]
): { lines: FlowLine[]; color: string } | null {
  const options = textureOptionsFor(frame, page);
  if (!options) return null;
  return { lines: generateTexture({ ...options, avoid: drawingLines }), color: frame.textureColor };
}
