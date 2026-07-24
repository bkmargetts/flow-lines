import { generateTexture } from '@flow-lines/core';
import { DEFAULT_PEN_WIDTH_MM, type LayerOutput, type RenderEnv } from '../../modules/types';
import type { ClassicParams } from './types';

/**
 * Pure render for the classic texture: params → core texture options → lines.
 * Holds off `env.avoid` natively (`generateTexture` skips strokes inside it and
 * reserves the halo), so the module sets `consumesAvoid`.
 */
export function renderClassicTexture(state: ClassicParams, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const lines = generateTexture({
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    pxPerMm: page.pxPerMm,
    style: state.style,
    spacingMm: state.spacingMm,
    angleDeg: state.angleDeg,
    scale: state.scale,
    jitter: state.jitter,
    density: state.density,
    crossHatch: state.crossHatch,
    seed: state.seed,
    shapes: state.shapes,
    dashes: state.dashes,
    scribble: state.scribble,
    // Layer states persisted before the region feature lack the field; core
    // treats undefined as the legacy full rect.
    region: state.region,
    avoid: env.avoid,
    haloMm: env.haloPx != null ? env.haloPx / page.pxPerMm : undefined,
  });
  const layerColors = { texture: state.color };
  return {
    lines,
    strokeColor: Object.values(layerColors)[0] ?? '#000000',
    strokeWidthPx: DEFAULT_PEN_WIDTH_MM * page.pxPerMm,
    layerColors,
  };
}
