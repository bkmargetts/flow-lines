import type { ModuleCategory } from './types';

/** Display order of the picker's category sections. */
export const CATEGORY_ORDER: ModuleCategory[] = [
  'image',
  'scenes',
  'flow',
  'simulations',
  'textures',
];

export const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  image: 'Image',
  scenes: 'Scenes & Objects',
  flow: 'Flow & Fields',
  simulations: 'Simulations',
  textures: 'Textures & Patterns',
};
