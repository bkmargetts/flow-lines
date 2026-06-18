import type { ComponentType } from 'react';
import type { PageMetrics, TextureOptions } from '@flow-lines/core';

/** A texture's generated options (sans halo/avoid, added by the pipeline) plus
 * the per-pen-layer colours it wants (single 'texture' or multi 'texture-NN'). */
export interface TextureBuild {
  options: Omit<TextureOptions, 'avoid' | 'haloMm'>;
  layerColors: Record<string, string>;
}

/**
 * A pluggable background-texture module — the texture-side mirror of a
 * ProjectModule. Each owns its params + Controls and maps them to core texture
 * options. Only the main thread imports the registry, so modules may bundle
 * React Controls; the pure `toTexture` bridges to the (worker-safe) core.
 */
export interface TextureModule<P = unknown> {
  id: string;
  label: string;
  defaultParams: P;
  Controls: ComponentType<{ params: P; update: (updates: Partial<P>) => void }>;
  /** Pure: params → texture options + layer colours, or null for no texture. */
  toTexture: (params: P, page: PageMetrics, marginPx: number) => TextureBuild | null;
}
