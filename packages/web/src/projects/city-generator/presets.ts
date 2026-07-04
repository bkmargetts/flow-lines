import type { CityState } from './types';

/**
 * Style presets: each one is a point on the flow↔rigid axis plus the family
 * ceilings that suit it. They patch state — seed and frame survive a switch.
 */
export interface CityPreset {
  id: string;
  label: string;
  state: Partial<CityState>;
}

export const CITY_PRESETS: CityPreset[] = [
  {
    id: 'organic',
    label: 'Organic',
    state: {
      order: 0.08,
      density: 0.72,
      heightVariance: 0.85,
      lean: 0.9,
      tiers: 0.15,
      windows: 0.5,
      shadeStrength: 0.55,
      wobbleMm: 0.4,
      sketch: 0.35,
      sketchStyle: 'loose',
    },
  },
  {
    id: 'sketchy',
    label: 'Sketchy',
    state: {
      order: 0.35,
      density: 0.8,
      heightVariance: 0.7,
      lean: 0.6,
      tiers: 0.25,
      windows: 0.6,
      shadeStrength: 0.45,
      wobbleMm: 0.35,
      sketch: 0.55,
      sketchStyle: 'gestural',
    },
  },
  {
    id: 'metropolis',
    label: 'Metropolis',
    state: {
      order: 0.55,
      density: 0.85,
      heightVariance: 0.6,
      lean: 0.6,
      tiers: 0.4,
      downtown: 0.65,
      windows: 0.7,
      shadeStrength: 0.6,
      wobbleMm: 0.3,
      sketch: 0,
    },
  },
  {
    id: 'brutalist',
    label: 'Brutalist',
    state: {
      order: 0.78,
      density: 0.92,
      heightVariance: 0.4,
      lean: 0.4,
      tiers: 0.55,
      windows: 0.35,
      windowMm: 2,
      shadeStrength: 0.85,
      wobbleMm: 0.2,
      sketch: 0,
    },
  },
  {
    id: 'robotic',
    label: 'Robotic',
    state: {
      order: 1,
      density: 0.95,
      heightVariance: 0.25,
      lean: 0.3,
      tiers: 0.3,
      downtown: 0.4,
      windows: 0.9,
      shadeStrength: 0.5,
      wobbleMm: 0,
      sketch: 0,
    },
  },
];

export function getCityPreset(id: string): CityPreset | undefined {
  return CITY_PRESETS.find((p) => p.id === id);
}
