import type { LandscapeOptions } from '@flow-lines/core';

// A few curated multi-pen palettes, duplicated here rather than imported from
// the web app (the CLI must not depend on packages/web — the same convention
// scripts/gallery.mjs follows by mirroring the web style presets as flags).
export const VINE_PALETTES: Record<string, Record<string, string>> = {
  ink: { stem: '#2a2a26', tendril: '#2a2a26', leaf: '#2a2a26', vein: '#2a2a26', flower: '#2a2a26', shadow: '#2a2a26' },
  botanical: { stem: '#5b4636', tendril: '#5b4636', leaf: '#3f6b3a', vein: '#34602f', flower: '#9c2b52', shadow: '#8a7a60' },
  rose: { stem: '#4a5d3a', tendril: '#4a5d3a', leaf: '#3f6b3a', vein: '#34602f', flower: '#c0306a', shadow: '#9aa07e' },
  autumn: { stem: '#6e4326', tendril: '#6e4326', leaf: '#a8662a', vein: '#7d4a1f', flower: '#b23b2e', shadow: '#9b7b53' },
};

// Multi-pen ink palettes for the planet command (subset of the web app's).
export const PLANET_PALETTES: Record<string, Record<string, string>> = {
  ink: { limb: '#2a2a26', hatch: '#2a2a26', feature: '#2a2a26', stipple: '#2a2a26', ring: '#2a2a26', star: '#2a2a26', atmosphere: '#2a2a26', graticule: '#2a2a26', annotation: '#2a2a26', label: '#2a2a26', orbit: '#2a2a26', relief: '#2a2a26', cloud: '#2a2a26' },
  astronomical: { limb: '#3a2f25', hatch: '#3b3a36', feature: '#4a3320', stipple: '#3b3a36', ring: '#5b4636', star: '#2b3a55', atmosphere: '#566b86', graticule: '#6b5e7a', annotation: '#4a3320', label: '#3a2f25', orbit: '#6b5e7a', relief: '#4a3320', cloud: '#6b5e7a' },
  saturn: { limb: '#4a3a23', hatch: '#5a4a32', feature: '#6e5326', stipple: '#5a4a32', ring: '#8a6a36', star: '#6b5a44', atmosphere: '#b89a5a', graticule: '#8a7a52', annotation: '#6e5326', label: '#4a3a23', orbit: '#8a7a52', relief: '#6e5326', cloud: '#8a7a52' },
  lunar: { limb: '#2c2c2c', hatch: '#3c3c3c', feature: '#222222', stipple: '#3c3c3c', ring: '#3c3c3c', star: '#4a4a4a', atmosphere: '#6a6a6a', graticule: '#5a5a5a', annotation: '#222222', label: '#2c2c2c', orbit: '#5a5a5a', relief: '#222222', cloud: '#5a5a5a' },
  mars: { limb: '#6e2f1f', hatch: '#8a3b2e', feature: '#5a2418', stipple: '#8a3b2e', ring: '#8a3b2e', star: '#7a5a4a', atmosphere: '#b5715a', graticule: '#a86a55', annotation: '#5a2418', label: '#6e2f1f', orbit: '#a86a55', relief: '#5a2418', cloud: '#a86a55' },
  cyanotype: { limb: '#13385e', hatch: '#1f4d78', feature: '#0e2a47', stipple: '#1f4d78', ring: '#1f4d78', star: '#3a6fa0', atmosphere: '#5a8fc0', graticule: '#3a6fa0', annotation: '#0e2a47', label: '#13385e', orbit: '#3a6fa0', relief: '#0e2a47', cloud: '#3a6fa0' },
};

// Multi-pen ink palettes for the landscape command (matches the web app's).
// Layers map to a few ink roles: sky/water/ridge/contour/rock; headland=ridge,
// foreground/horizon/bird/sun=contour, cloud=sky, tree=ridge.
export const lsPalette = (sky: string, water: string, ridge: string, contour: string, rock: string): Record<string, string> => ({
  sky, water, reflection: water, ridge, headland: ridge, foreground: contour, contour, horizon: contour, rock, cloud: sky, tree: ridge, bird: contour, sun: contour,
});
export const LANDSCAPE_PALETTES: Record<string, Record<string, string>> = {
  ink: lsPalette('#2a2a26', '#2a2a26', '#2a2a26', '#2a2a26', '#2a2a26'),
  sunset: lsPalette('#9a6a4a', '#3a6076', '#4a4636', '#2e2820', '#3a342a'),
  graphite: lsPalette('#6a6a6a', '#525a60', '#3a3a3a', '#222222', '#2c2c2c'),
  sanguine: lsPalette('#a86a4a', '#8a6a4a', '#7a3b2a', '#5a2418', '#6e2f1f'),
  cyanotype: lsPalette('#3a6fa0', '#13385e', '#1f4d78', '#0e2a47', '#0e2a47'),
};

// Scene presets for the landscape command (a subset of each preset's character).
export const LANDSCAPE_SCENES: Record<string, Partial<LandscapeOptions> & { palette?: string }> = {
  'coastal-sunset': { hasWater: true, waterFrac: 0.6, horizonFrac: 0.44, sun: true, sunRays: true, reflection: true, formFollow: true, headlands: 3, foreground: 0.5, foregroundSide: 'left', clouds: 0.35, birds: 5, rocks: 3, palette: 'sunset' },
  'misty-ranges': { hasWater: false, horizonFrac: 0.3, sun: false, ridgeCount: 6, ridgeAmp: 46, ridgePersistence: 0.45, formFollow: true, toneContrast: 0.6, crossHatch: 1, birds: 3, palette: 'graphite' },
  'rolling-hills': { hasWater: false, horizonFrac: 0.4, sun: true, ridgeCount: 4, ridgeAmp: 32, ridgeFreq: 1.6, formFollow: true, clouds: 0.32, trees: 6, palette: 'ink' },
  'desert-dunes': { hasWater: false, horizonFrac: 0.36, sun: true, ridgeCount: 5, ridgeAmp: 26, ridgeFreq: 1.1, ridgePersistence: 0.6, formFollow: true, slopeFollow: true, crossHatch: 0, toneContrast: 0.55, palette: 'sanguine' },
  'alpine-lake': { hasWater: true, waterFrac: 0.5, horizonFrac: 0.5, horizonWobble: 22, horizonFreq: 3.2, sun: true, reflection: true, formFollow: true, headlands: 3, foreground: 0.35, foregroundSide: 'right', clouds: 0.35, rocks: 2, palette: 'cyanotype' },
};
