import type { MarblingPattern } from '@flow-lines/core';
import type { MarblingState } from './types';

/**
 * Pattern presets: each classical pattern with the bath density and rake
 * strength that suit it. They patch state — seed, pen, and inks survive a
 * switch.
 */
export interface MarblingWebPreset {
  id: MarblingPattern;
  label: string;
  state: Partial<MarblingState>;
}

export const MARBLING_WEB_PRESETS: MarblingWebPreset[] = [
  {
    id: 'stone',
    label: 'Stone',
    state: { preset: 'stone', drops: 70, swirl: 0, wavy: 0, vortex: 0 },
  },
  {
    id: 'nonpareil',
    label: 'Nonpareil',
    state: { preset: 'nonpareil', drops: 85, swirl: 0.55, wavy: 0, vortex: 0 },
  },
  {
    id: 'feather',
    label: 'Feather',
    state: { preset: 'feather', drops: 75, swirl: 0.6, wavy: 0, vortex: 0 },
  },
  {
    id: 'bouquet',
    label: 'Bouquet',
    state: { preset: 'bouquet', drops: 75, swirl: 0.55, wavy: 0.6, vortex: 0 },
  },
  {
    id: 'vortex',
    label: 'Vortex',
    state: { preset: 'vortex', drops: 60, swirl: 0, wavy: 0, vortex: 0.7 },
  },
];

export function getMarblingPreset(id: string): MarblingWebPreset | undefined {
  return MARBLING_WEB_PRESETS.find((p) => p.id === id);
}
