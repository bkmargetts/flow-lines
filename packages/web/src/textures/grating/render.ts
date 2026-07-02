import { generateTexture } from '@flow-lines/core';
import { DEFAULT_PEN_WIDTH_MM, type LayerOutput, type RenderEnv } from '../../modules/types';
import { gratingMaskShapes, gratingTextureColors, type GratingParams } from './shared';

/**
 * Pure render for the grating texture: params → core's grating branch → lines.
 * Holds off `env.avoid` natively (`generateTexture` skips strokes inside it and
 * reserves the halo), so the module sets `consumesAvoid`. Multi-ink: the
 * `texture-NN` palette rides in `layerColors`, `strokeColor` is just the first
 * ink as a fallback for any unkeyed line.
 */
export function renderGratingTexture(state: GratingParams, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const lines = generateTexture({
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    pxPerMm: page.pxPerMm,
    style: 'grating',
    spacingMm: state.spacingMm,
    angleDeg: state.angleDeg,
    scale: 1,
    // Core's grating branch reads top-level `jitter` as a mm value.
    jitter: state.jitterMm,
    density: 0.5,
    crossHatch: false,
    seed: state.seed,
    grating: {
      colorCount: state.colorCount,
      lineLengthPct: state.lineLengthPct,
      phaseDriftAlongMm: state.phaseDriftAlongMm,
      phaseDriftAcrossMm: state.phaseDriftAcrossMm,
      phaseNoiseAmpMm: state.phaseNoiseAmpMm,
      phaseNoiseScale: state.phaseNoiseScale,
      wobbleAmpMm: state.wobbleAmpMm,
      wobbleWavelengthMm: state.wobbleWavelengthMm,
      edgeSmoothMm: state.edgeSmoothMm,
      maskShapes: gratingMaskShapes(state, page, marginPx),
    },
    avoid: env.avoid,
    haloMm: env.haloPx != null ? env.haloPx / page.pxPerMm : undefined,
  });
  const layerColors = gratingTextureColors(state);
  return {
    lines,
    strokeColor: Object.values(layerColors)[0] ?? '#000000',
    strokeWidthPx: DEFAULT_PEN_WIDTH_MM * page.pxPerMm,
    layerColors,
  };
}
