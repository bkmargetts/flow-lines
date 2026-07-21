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

const PATTERNS: MarblingPattern[] = ['stone', 'nonpareil', 'feather', 'bouquet', 'vortex'];

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.min(values.length - 1, Math.floor(rng() * values.length))];
}

/**
 * Randomise-everything genome: a whole new bath within the sliders' ranges.
 * Rolls the pattern too — that's the big lever of a surprise. Never touches
 * the seed (the button rolls it separately), detail (a fidelity pref), or
 * pen/ink aesthetics.
 */
export function randomMarblingGenome(rng: () => number): Partial<MarblingState> {
  return {
    preset: pick(rng, PATTERNS),
    drops: Math.round(30 + rng() * 90),
    dropSizeMm: Number((9 + rng() * 18).toFixed(1)),
    ringsPerDrop: 1 + Math.floor(rng() * 5),
    dropJitter: Number((0.15 + rng() * 0.6).toFixed(2)),
    combSpacingMm: Number((2.5 + rng() * 6).toFixed(1)),
    // Floors keep raked/vortex patterns actually raking when they land.
    swirl: Number((0.3 + rng() * 0.7).toFixed(2)),
    falloffMm: Number((0.6 + rng() * 2.4).toFixed(1)),
    wavy: Number((rng() * 1).toFixed(2)),
    vortex: Number((0.3 + rng() * 0.7).toFixed(2)),
  };
}
