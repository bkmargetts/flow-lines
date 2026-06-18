import type { TextureModule } from '../types';

/**
 * The blank template texture — a documented starting point. Copy this folder
 * to build a new texture module: give it params + Controls, and a `toTexture`
 * that maps them to core texture options. It renders nothing on its own.
 */
export type BlankParams = Record<string, never>;

export const blankTexture: TextureModule<BlankParams> = {
  id: 'blank',
  label: 'Blank (template)',
  defaultParams: {},
  Controls: () => (
    <p className="paint-hint">
      A blank texture — nothing is drawn. This is the template module: copy{' '}
      <code>src/textures/blank</code> to build a new background texture (params +
      Controls + a <code>toTexture</code> that returns core texture options).
    </p>
  ),
  toTexture: () => null,
};
