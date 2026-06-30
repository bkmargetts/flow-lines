import type { LandscapeState } from './types';

/**
 * Scene presets: a starting point per landscape archetype, like the Planet
 * Generator's world types. Each is a partial `LandscapeState` merged over the
 * current state, so tweaks made afterwards survive. The 🎲 genome below crosses
 * a fresh scene with randomised, scene-appropriate knobs.
 */
export interface LandscapePreset {
  id: string;
  label: string;
  state: Partial<LandscapeState>;
}

export const LANDSCAPE_PRESETS: LandscapePreset[] = [
  {
    id: 'coastal-sunset',
    label: 'Coastal sunset',
    state: {
      hasWater: true, waterFrac: 0.6, horizonFrac: 0.44, horizonWobbleMm: 2,
      sun: true, sunRadiusMm: 13, sunYFrac: 0.32, sunRays: true, reflection: true, moonRim: false,
      formFollow: true, ridgeHatchAngle: 80, slopeFollow: false, crossHatch: 1,
      headlands: 3, foreground: 0.5, foregroundSide: 'left',
      clouds: 0.35, birds: 5, rocks: 3,
      palette: 'sunset',
    },
  },
  {
    id: 'misty-ranges',
    label: 'Misty layered ranges',
    state: {
      hasWater: false, horizonFrac: 0.3, sun: false,
      ridgeCount: 6, ridgeAmpMm: 16, ridgeFreq: 2.6, ridgePersistence: 0.45,
      ridgeHatchSpacingMm: 1.6, formFollow: true, slopeFollow: false,
      toneContrast: 0.6, crossHatch: 1, clouds: 0, birds: 3, headlands: 0, foreground: 0,
      palette: 'graphite',
    },
  },
  {
    id: 'rolling-hills',
    label: 'Rolling hills',
    state: {
      hasWater: false, horizonFrac: 0.4, sun: true, sunRadiusMm: 11, sunYFrac: 0.28,
      ridgeCount: 4, ridgeAmpMm: 11, ridgeFreq: 1.6, ridgePersistence: 0.5,
      formFollow: true, slopeFollow: false, crossHatch: 1,
      clouds: 0.32, trees: 6, headlands: 0, foreground: 0,
      palette: 'ink',
    },
  },
  {
    id: 'desert-dunes',
    label: 'Desert dunes',
    state: {
      hasWater: false, horizonFrac: 0.36, sun: true, sunRadiusMm: 13, sunYFrac: 0.24,
      ridgeCount: 5, ridgeAmpMm: 9, ridgeFreq: 1.1, ridgePersistence: 0.6,
      formFollow: true, slopeFollow: true, crossHatch: 0, toneContrast: 0.55,
      clouds: 0, trees: 0, headlands: 0, foreground: 0,
      palette: 'sanguine',
    },
  },
  {
    id: 'alpine-lake',
    label: 'Alpine lake',
    state: {
      hasWater: true, waterFrac: 0.5, horizonFrac: 0.5, horizonWobbleMm: 9, horizonFreq: 3.2,
      sun: true, sunRadiusMm: 11, sunYFrac: 0.3, reflection: true,
      formFollow: true, ridgeHatchAngle: 78, crossHatch: 1,
      headlands: 3, foreground: 0.35, foregroundSide: 'right', clouds: 0.35, rocks: 2,
      palette: 'cyanotype',
    },
  },
];

export function getLandscapePreset(id: string): LandscapePreset | null {
  return LANDSCAPE_PRESETS.find((p) => p.id === id) ?? null;
}

const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];

/**
 * A coherent random landscape: a fresh scene plus randomised horizon, light and
 * scene-appropriate terrain. Pen width and wobble stay fixed so output stays
 * on-brand and plottable.
 */
export function randomLandscapeGenome(rng: () => number): Partial<LandscapeState> {
  const scene = pick(rng, LANDSCAPE_PRESETS);
  const base = scene.state;
  const hasWater = base.hasWater ?? rng() < 0.4;
  return {
    ...base,
    scene: scene.id,
    horizonFrac: Number((0.3 + rng() * 0.28).toFixed(2)),
    horizonWobbleMm: Number((1 + rng() * 8).toFixed(1)),
    sun: rng() < 0.8,
    sunXFrac: Number((0.3 + rng() * 0.4).toFixed(2)),
    sunYFrac: Number((0.2 + rng() * 0.2).toFixed(2)),
    sunRadiusMm: Number((9 + rng() * 9).toFixed(1)),
    sunRays: rng() < 0.4,
    reflection: hasWater,
    ridgeCount: 3 + Math.floor(rng() * 4),
    ridgeAmpMm: Number((8 + rng() * 12).toFixed(1)),
    ridgeHatchAngle: Math.round(16 + rng() * 70),
    formFollow: rng() < 0.7,
    slopeFollow: rng() < 0.5,
    toneContrast: Number((0.35 + rng() * 0.4).toFixed(2)),
    crossHatch: Math.floor(rng() * 3),
    headlands: hasWater ? 2 + Math.floor(rng() * 3) : 0,
    foreground: hasWater && rng() < 0.6 ? Number((0.3 + rng() * 0.3).toFixed(2)) : 0,
    foregroundSide: rng() < 0.5 ? 'left' : 'right',
    clouds: rng() < 0.6 ? Number((0.2 + rng() * 0.3).toFixed(2)) : 0,
    trees: !hasWater && rng() < 0.4 ? 3 + Math.floor(rng() * 5) : 0,
    birds: rng() < 0.5 ? Math.floor(rng() * 6) : 0,
    rocks: hasWater ? Math.floor(rng() * 5) : 0,
  };
}
