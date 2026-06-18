import { generateTexture, type FlowLine, type PageMetrics, type TextureOptions } from '@flow-lines/core';
import type { FrameSettings } from '../FrameContext';
import { getTextureModule, textureParamsFor } from '../textures/registry';

/**
 * Resolve the active background-texture module to core texture options (sans
 * `avoid`/`haloMm`, added at build time) plus the per-pen-layer colours it
 * wants. Returns null when texture is disabled or the module draws nothing, so
 * callers leave their output (and layerColors) untouched. Texture lines are
 * tagged `texture` (single pen) or `texture-NN` (multi-ink) and should be
 * prepended to the drawing so they render behind it.
 */
export function textureBuildFor(
  frame: FrameSettings,
  page: PageMetrics
): { options: Omit<TextureOptions, 'avoid'>; layerColors: Record<string, string> } | null {
  if (!frame.textureEnabled) return null;
  const mod = getTextureModule(frame.textureModuleId);
  const params = textureParamsFor(frame.textureModuleId, frame.textureParams);
  const built = mod.toTexture(params, page, frame.marginMm * page.pxPerMm);
  if (!built) return null;
  return {
    options: { ...built.options, haloMm: frame.textureHaloMm },
    layerColors: built.layerColors,
  };
}

/** Synchronous build (conway/flow-field/…): texture lines held a halo off the art. */
export function buildTexture(
  frame: FrameSettings,
  page: PageMetrics,
  drawingLines: FlowLine[]
): { lines: FlowLine[]; layerColors: Record<string, string> } | null {
  const built = textureBuildFor(frame, page);
  if (!built) return null;
  return {
    lines: generateTexture({ ...built.options, avoid: drawingLines }),
    layerColors: built.layerColors,
  };
}
