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
  // Each scene commits to a tonal plan (mirrored in the CLI's LANDSCAPE_SCENES,
  // converted to mm/fraction units here).
  {
    id: 'coastal-sunset',
    label: 'Coastal sunset',
    // Paper = sun + mid-water; dark = foreground repoussoir; the focal
    // glitter column hangs under the sun.
    state: {
      hasWater: true, waterFrac: 0.6, horizonFrac: 0.44, horizonWobbleMm: 2,
      sun: true, sunRadiusMm: 13, sunYFrac: 0.32, sunRays: true, reflection: true, moonRim: false,
      formFollow: true, ridgeHatchAngle: 80, slopeFollow: false, crossHatch: 1,
      headlands: 3, foreground: 0.45, foregroundSide: 'left', focus: 0.55,
      skyToneTop: 0.18, skyToneHorizon: 0.6, atmosphere: 0.45,
      clouds: 0.28, birds: 3, rocks: 2,
      palette: 'sunset',
    },
  },
  {
    id: 'misty-ranges',
    label: 'Misty layered ranges',
    // Paper = sky + mist gaps; far ridges whisper; dark = the nearest crest.
    state: {
      hasWater: false, horizonFrac: 0.3, sun: false,
      ridgeCount: 5, ridgeAmpMm: 16, ridgeFreq: 2.6, ridgePersistence: 0.45,
      ridgeHatchSpacingMm: 1.6, formFollow: true, slopeFollow: false, ridgeSharpness: 0.55,
      toneContrast: 0.6, crossHatch: 1, atmosphere: 0.85, focus: 0.3,
      skyToneTop: 0.08, skyToneHorizon: 0.28,
      clouds: 0, trees: 5, treeStyle: 'conifer', birds: 2, headlands: 0, foreground: 0,
      palette: 'graphite',
    },
  },
  {
    id: 'rolling-hills',
    label: 'Rolling hills',
    // Dark = tree clusters + near shadow flanks under big paper cloud masses.
    state: {
      hasWater: false, horizonFrac: 0.4, sun: true, sunRadiusMm: 11, sunYFrac: 0.28,
      ridgeCount: 3, ridgeAmpMm: 13, ridgeFreq: 1.6, ridgePersistence: 0.5, ridgeSharpness: 0.15,
      formFollow: true, slopeFollow: false, crossHatch: 1, atmosphere: 0.35, focus: 0.45,
      skyToneTop: 0.2, skyToneHorizon: 0.42,
      clouds: 0.3, trees: 8, treeStyle: 'mixed', headlands: 0, foreground: 0,
      palette: 'ink',
    },
  },
  {
    id: 'desert-dunes',
    label: 'Desert dunes',
    // Slope shading carries everything — lit faces open to paper, slip-faces
    // darken; near-paper sky with a clean sun. Low-angle strata hatch.
    state: {
      hasWater: false, horizonFrac: 0.36, sun: true, sunRadiusMm: 13, sunYFrac: 0.24, sunHalo: 0.9,
      ridgeCount: 5, ridgeAmpMm: 9, ridgeFreq: 1.1, ridgePersistence: 0.6, ridgeSharpness: 0.1,
      formFollow: false, ridgeHatchAngle: 8, slopeFollow: true, crossHatch: 0, toneContrast: 0.7,
      atmosphere: 0.3, focus: 0.4, skyToneTop: 0.12, skyToneHorizon: 0.4,
      clouds: 0, trees: 2, treeStyle: 'scrub', headlands: 0, foreground: 0,
      palette: 'sanguine',
    },
  },
  {
    id: 'alpine-lake',
    label: 'Alpine lake',
    // Jagged peaks over open mid-lake paper; dark = foreground + shore conifers.
    state: {
      hasWater: true, waterFrac: 0.5, horizonFrac: 0.5, horizonWobbleMm: 9, horizonFreq: 3.2,
      sun: true, sunRadiusMm: 11, sunYFrac: 0.3, reflection: true,
      formFollow: true, ridgeHatchAngle: 78, crossHatch: 1, ridgeSharpness: 0.7,
      atmosphere: 0.55, focus: 0.45, skyToneTop: 0.3, skyToneHorizon: 0.5,
      headlands: 3, foreground: 0.35, foregroundSide: 'right', clouds: 0.3,
      rocks: 2, trees: 6, treeStyle: 'conifer',
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
    ridgeSharpness: Number((rng() * 0.75).toFixed(2)),
    atmosphere: Number((0.2 + rng() * 0.6).toFixed(2)),
    toneContrast: Number((0.35 + rng() * 0.4).toFixed(2)),
    crossHatch: Math.floor(rng() * 3),
    headlands: hasWater ? 2 + Math.floor(rng() * 3) : 0,
    foreground: hasWater && rng() < 0.6 ? Number((0.3 + rng() * 0.3).toFixed(2)) : 0,
    foregroundSide: rng() < 0.5 ? 'left' : 'right',
    focus: Number((0.25 + rng() * 0.4).toFixed(2)),
    clouds: rng() < 0.6 ? Number((0.2 + rng() * 0.3).toFixed(2)) : 0,
    trees: rng() < 0.5 ? 3 + Math.floor(rng() * 6) : 0,
    treeStyle: pick(rng, ['mixed', 'round', 'conifer', 'scrub'] as const),
    birds: rng() < 0.5 ? Math.floor(rng() * 6) : 0,
    rocks: hasWater ? Math.floor(rng() * 5) : 0,
  };
}
