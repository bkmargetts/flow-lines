/**
 * Curated ink palettes for the Landscape Generator. Each maps the module's pen
 * layers (sky / water / ridge / contour / rock) to an ink so a plot uses one
 * pen per layer — multi-pen but still plottable. `custom` defers to the
 * per-layer colour pickers in the Controls.
 */
export interface LandscapePalette {
  id: string;
  label: string;
  sky: string;
  water: string;
  ridge: string;
  contour: string;
  rock: string;
}

export const CUSTOM_PALETTE = 'custom';

export const LANDSCAPE_PALETTES: LandscapePalette[] = [
  {
    id: 'ink',
    label: 'Ink (mono)',
    sky: '#2a2a26', water: '#2a2a26', ridge: '#2a2a26', contour: '#2a2a26', rock: '#2a2a26',
  },
  {
    id: 'sunset',
    label: 'Coastal sunset',
    sky: '#9a6a4a', water: '#3a6076', ridge: '#4a4636', contour: '#2e2820', rock: '#3a342a',
  },
  {
    id: 'graphite',
    label: 'Graphite haze',
    sky: '#6a6a6a', water: '#525a60', ridge: '#3a3a3a', contour: '#222222', rock: '#2c2c2c',
  },
  {
    id: 'sanguine',
    label: 'Desert sanguine',
    sky: '#a86a4a', water: '#8a6a4a', ridge: '#7a3b2a', contour: '#5a2418', rock: '#6e2f1f',
  },
  {
    id: 'cyanotype',
    label: 'Cyanotype',
    sky: '#3a6fa0', water: '#13385e', ridge: '#1f4d78', contour: '#0e2a47', rock: '#0e2a47',
  },
];

export function getLandscapePalette(id: string): LandscapePalette | null {
  if (id === CUSTOM_PALETTE) return null;
  return LANDSCAPE_PALETTES.find((p) => p.id === id) ?? LANDSCAPE_PALETTES[0];
}
