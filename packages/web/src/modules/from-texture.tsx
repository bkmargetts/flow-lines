import { generateTexture } from '@flow-lines/core';
import type { TextureModule } from '../textures/types';
import { DEFAULT_PEN_WIDTH_MM, type ControlsProps, type PureModule } from './types';

/**
 * Adapt a legacy background-texture module into a unified `PureModule`. The
 * texture's pure `toTexture` becomes the module's `render` (now actually
 * generating the lines, holding off `env.avoid` natively), and its Controls are
 * wrapped so the `{ state, update }` layer API drives the texture's
 * `{ params, update }` props unchanged. Per-instance state is a fresh copy of
 * the texture's defaults, so two of the same texture layer are independent.
 */
export function fromTextureModule<P>(mod: TextureModule<P>): PureModule<P> {
  function Controls({ state, update }: ControlsProps<P>) {
    return <mod.Controls params={state} update={update} />;
  }
  Controls.displayName = `Texture(${mod.id})`;

  return {
    kind: 'pure',
    id: mod.id,
    label: mod.label,
    defaultState: () => ({ ...mod.defaultParams }),
    Controls,
    // Textures skip strokes inside the avoid set rather than overdrawing it, so
    // the compositor must not also trim them.
    consumesAvoid: true,
    render: (state, env) => {
      const built = mod.toTexture(state, env.page, env.marginPx);
      if (!built) return null;
      const lines = generateTexture({
        ...built.options,
        avoid: env.avoid,
        haloMm: env.haloPx != null ? env.haloPx / env.page.pxPerMm : undefined,
      });
      const firstColor = Object.values(built.layerColors)[0] ?? '#000000';
      return {
        lines,
        strokeColor: firstColor,
        strokeWidthPx: DEFAULT_PEN_WIDTH_MM * env.page.pxPerMm,
        layerColors: built.layerColors,
      };
    },
  };
}
