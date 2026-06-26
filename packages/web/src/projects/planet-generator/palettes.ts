/**
 * Curated ink palettes for the Planet Generator. Each maps the module's pen
 * layers (limb / hatch / feature / stipple / ring / star / atmosphere) to an
 * ink so a plot uses one pen per layer — multi-pen but still plottable.
 * `custom` defers to the per-layer colour pickers in the Controls.
 */
export interface PlanetPalette {
  id: string;
  label: string;
  limb: string;
  hatch: string;
  feature: string;
  stipple: string;
  ring: string;
  star: string;
  atmosphere: string;
}

export const CUSTOM_PALETTE = 'custom';

export const PLANET_PALETTES: PlanetPalette[] = [
  {
    id: 'ink',
    label: 'Ink (mono)',
    limb: '#2a2a26', hatch: '#2a2a26', feature: '#2a2a26', stipple: '#2a2a26', ring: '#2a2a26', star: '#2a2a26', atmosphere: '#2a2a26',
  },
  {
    id: 'astronomical',
    label: 'Astronomical plate',
    limb: '#3a2f25', hatch: '#3b3a36', feature: '#4a3320', stipple: '#3b3a36', ring: '#5b4636', star: '#2b3a55', atmosphere: '#566b86',
  },
  {
    id: 'saturn',
    label: 'Saturn brass',
    limb: '#4a3a23', hatch: '#5a4a32', feature: '#6e5326', stipple: '#5a4a32', ring: '#8a6a36', star: '#6b5a44', atmosphere: '#b89a5a',
  },
  {
    id: 'lunar',
    label: 'Lunar graphite',
    limb: '#2c2c2c', hatch: '#3c3c3c', feature: '#222222', stipple: '#3c3c3c', ring: '#3c3c3c', star: '#4a4a4a', atmosphere: '#6a6a6a',
  },
  {
    id: 'mars',
    label: 'Mars sanguine',
    limb: '#6e2f1f', hatch: '#8a3b2e', feature: '#5a2418', stipple: '#8a3b2e', ring: '#8a3b2e', star: '#7a5a4a', atmosphere: '#b5715a',
  },
  {
    id: 'cyanotype',
    label: 'Cyanotype',
    limb: '#13385e', hatch: '#1f4d78', feature: '#0e2a47', stipple: '#1f4d78', ring: '#1f4d78', star: '#3a6fa0', atmosphere: '#5a8fc0',
  },
];

export function getPlanetPalette(id: string): PlanetPalette | null {
  if (id === CUSTOM_PALETTE) return null;
  return PLANET_PALETTES.find((p) => p.id === id) ?? PLANET_PALETTES[0];
}
