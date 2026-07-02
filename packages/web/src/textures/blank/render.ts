import type { LayerOutput, RenderEnv } from '../../modules/types';

/** The blank template has no params. */
export type BlankParams = Record<string, never>;

/** The blank template draws nothing — its render is the "no output" branch
 * every module may take. */
export function renderBlankTexture(_state: BlankParams, _env: RenderEnv): LayerOutput | null {
  return null;
}
