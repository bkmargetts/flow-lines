import type { TextureModule } from '../types';
import {
  defaultGratingParams,
  gratingTextureColors,
  parametricMaskShapes,
  type GratingParams,
} from './shared';
import { GratingTextureControls } from './Controls';

/** The interleaved multi-ink line grating (the Noise Texture project) as a
 * background texture. Emits one `texture-NN` pen layer per ink. */
export const gratingTexture: TextureModule<GratingParams> = {
  id: 'grating',
  label: 'Grating (multi-ink)',
  defaultParams: { ...defaultGratingParams, seed: 7 },
  Controls: GratingTextureControls,
  toTexture: (p, page, marginPx) => ({
    options: {
      width: page.widthPx,
      height: page.heightPx,
      margin: marginPx,
      pxPerMm: page.pxPerMm,
      style: 'grating',
      spacingMm: p.spacingMm,
      angleDeg: p.angleDeg,
      scale: 1,
      // Core's grating branch reads top-level `jitter` as a mm value.
      jitter: p.jitterMm,
      density: 0.5,
      crossHatch: false,
      seed: p.seed,
      grating: {
        colorCount: p.colorCount,
        lineLengthPct: p.lineLengthPct,
        phaseDriftAlongMm: p.phaseDriftAlongMm,
        phaseDriftAcrossMm: p.phaseDriftAcrossMm,
        phaseNoiseAmpMm: p.phaseNoiseAmpMm,
        phaseNoiseScale: p.phaseNoiseScale,
        wobbleAmpMm: p.wobbleAmpMm,
        wobbleWavelengthMm: p.wobbleWavelengthMm,
        edgeSmoothMm: p.edgeSmoothMm,
        maskShapes: parametricMaskShapes(p, page, marginPx),
      },
    },
    layerColors: gratingTextureColors(p),
  }),
};
