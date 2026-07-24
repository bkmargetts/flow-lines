import type { WarpGridPreset } from '@flow-lines/core';
import type { WarpGridState } from './types';

/**
 * Look presets: each mirrors a core recipe (base grating + hidden-form
 * kinds) with the knob values that suit it. They patch state — seed, pen,
 * and ink survive a switch; the un-exposed form kinds ride `preset` into
 * the core.
 */
export interface WarpGridWebPreset {
  id: WarpGridPreset;
  label: string;
  state: Partial<WarpGridState>;
}

export const WARP_GRID_WEB_PRESETS: WarpGridWebPreset[] = [
  {
    id: 'dome',
    label: 'Dome',
    state: { preset: 'dome', pattern: 'lines', deformers: 3, strength: 0.9, relief: 0.6, angle: 25, occlude: false, scale: 0.28 },
  },
  {
    id: 'current',
    label: 'Current',
    state: { preset: 'current', pattern: 'waves', deformers: 2, strength: 0.6, relief: 0.16, angle: 90, occlude: false, scale: 0.28 },
  },
  {
    id: 'vortex',
    label: 'Vortex',
    state: { preset: 'vortex', pattern: 'lines', deformers: 3, strength: 0.65, relief: 0.18, angle: 0, occlude: false, scale: 0.28 },
  },
  {
    id: 'relief',
    label: 'Relief',
    state: { preset: 'relief', pattern: 'lines', deformers: 1, strength: 0.9, relief: 0.85, angle: 0, occlude: true, scale: 0.28, noiseScale: 0.22 },
  },
  {
    id: 'pinch',
    label: 'Pinch',
    state: { preset: 'pinch', pattern: 'circles', deformers: 3, strength: 0.9, relief: 0.5, occlude: false, scale: 0.45 },
  },
  {
    id: 'blaze',
    label: 'Blaze',
    state: { preset: 'blaze', pattern: 'rays', deformers: 2, strength: 0.6, relief: 0.2, occlude: false, scale: 0.28 },
  },
];

export function getWarpGridPreset(id: string): WarpGridWebPreset | undefined {
  return WARP_GRID_WEB_PRESETS.find((p) => p.id === id);
}

const PRESETS: WarpGridPreset[] = ['dome', 'current', 'vortex', 'relief', 'pinch', 'blaze'];

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.min(values.length - 1, Math.floor(rng() * values.length))];
}

/**
 * Randomise-everything genome: a whole new hidden-form scene within the
 * sliders' ranges. Rolls the preset (the big lever), then jitters the knobs
 * around it — relief scales off the preset's own value so the occluded
 * landscape stays a landscape and the shimmer stays a shimmer. Never touches
 * the seed (the button rolls it separately), detail (a fidelity pref), or
 * pen/ink aesthetics.
 */
export function randomWarpGridGenome(rng: () => number): Partial<WarpGridState> {
  const preset = pick(rng, PRESETS);
  const patch = getWarpGridPreset(preset)!.state;
  const baseRelief = patch.relief ?? 0.4;
  const baseDeformers = patch.deformers ?? 2;
  return {
    ...patch,
    preset,
    spacingMm: Number((2 + rng() * 3.5).toFixed(1)),
    angle: Math.round(rng() * 180),
    strength: Number((0.4 + rng() * 0.6).toFixed(2)),
    relief: Number(Math.min(1, baseRelief * (0.7 + rng() * 0.6)).toFixed(2)),
    deformers: Math.max(1, Math.min(8, baseDeformers + Math.floor(rng() * 3) - 1)),
    scale: Number((0.15 + rng() * 0.35).toFixed(2)),
    noiseScale: Number((0.15 + rng() * 0.35).toFixed(2)),
    waveAmp: Number((0.2 + rng() * 0.8).toFixed(2)),
    wavelengthMm: Number((18 + rng() * 30).toFixed(0)),
    dropFloor: Number((0.2 + rng() * 0.4).toFixed(2)),
    edgeCalm: Number((0.2 + rng() * 0.6).toFixed(2)),
  };
}
