import type { TextureModule } from './types';
import { blankTexture } from './blank';
import { classicTexture } from './classic';
import { gratingTexture } from './grating';

/**
 * Every background-texture module, in panel order — the texture-side mirror of
 * the project registry. `blank` is the build-out template; `classic` wraps the
 * original single-pen styles; `grating` is the multi-ink interleaved grating.
 */
// `any` params at the registry boundary: each module is internally typed, but
// the heterogeneous array + dynamic Controls rendering need a common element
// type (React component props are invariant, so `unknown` won't unify).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TEXTURE_MODULES: TextureModule<any>[] = [classicTexture, gratingTexture, blankTexture];

const BY_ID = new Map(TEXTURE_MODULES.map((m) => [m.id, m]));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTextureModule(id: string): TextureModule<any> {
  return BY_ID.get(id) ?? TEXTURE_MODULES[0];
}

/** The active module's params, merged over its defaults (partial state is fine). */
export function textureParamsFor(id: string, stored: Record<string, unknown>): Record<string, unknown> {
  const mod = getTextureModule(id);
  const saved = (stored[id] as Record<string, unknown>) ?? {};
  return { ...(mod.defaultParams as Record<string, unknown>), ...saved };
}
