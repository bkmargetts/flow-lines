import type { LandscapeOptions } from '@flow-lines/core';

// A few curated multi-pen palettes, duplicated here rather than imported from
// the web app (the CLI must not depend on packages/web — the same convention
// scripts/gallery.mjs follows by mirroring the web style presets as flags).
export const BOTANICAL_PALETTES: Record<string, Record<string, string>> = {
  ink: { stem: '#2a2a26', tendril: '#2a2a26', leaf: '#2a2a26', vein: '#2a2a26', flower: '#2a2a26', shadow: '#2a2a26' },
  botanical: { stem: '#5b4636', tendril: '#5b4636', leaf: '#3f6b3a', vein: '#34602f', flower: '#9c2b52', shadow: '#8a7a60' },
  rose: { stem: '#4a5d3a', tendril: '#4a5d3a', leaf: '#3f6b3a', vein: '#34602f', flower: '#c0306a', shadow: '#9aa07e' },
  autumn: { stem: '#6e4326', tendril: '#6e4326', leaf: '#a8662a', vein: '#7d4a1f', flower: '#b23b2e', shadow: '#9b7b53' },
};

// Multi-pen pen sets for the lapidary command (matches the web app's
// packages/web/src/projects/lapidary/palettes.ts — keep the two tables in
// sync). Unlike the landscape's semantic roles, pens are indexed
// ink-0..ink-3 and every pen draws every texture; each set carries its own
// pen count. `vein` colours the kintsugi accent layer when --veins is on.
export const LAPIDARY_PALETTES: Record<string, { inks: string[]; vein: string }> = {
  specimen: { inks: ['#1f1f1d', '#d4551a'], vein: '#b8860b' },
  'indigo-vermilion': { inks: ['#1f3a5f', '#c3401f'], vein: '#b8860b' },
  'graphite-rust-teal': { inks: ['#2a2a26', '#8a3324', '#1f6f6a'], vein: '#b8860b' },
  garden: { inks: ['#3d5a28', '#c3401f', '#5a4a7f'], vein: '#b8860b' },
  'midnight-gold': { inks: ['#20243f', '#b8860b'], vein: '#b8860b' },
  sepia: { inks: ['#3a2a1a', '#8a6a3a'], vein: '#b87333' },
  'bordeaux-slate': { inks: ['#6e1f33', '#3a4a5c'], vein: '#b8860b' },
  'verdigris-rust': { inks: ['#1f6f5e', '#8a3324'], vein: '#b87333' },
  glacier: { inks: ['#20243f', '#3a6fa0'], vein: '#8a8a92' },
  ember: { inks: ['#2a2a26', '#8a2a1f', '#d4551a'], vein: '#b8860b' },
  'olive-plum': { inks: ['#55601f', '#5a2a4a', '#a8642a'], vein: '#b8860b' },
  quartet: { inks: ['#1f1f1d', '#c3401f', '#1f6f6a', '#b8860b'], vein: '#b87333' },
  mono: { inks: ['#1f1f1d'], vein: '#b8860b' },
};

// Multi-pen ink palettes for the planet command (subset of the web app's).
export const PLANET_PALETTES: Record<string, Record<string, string>> = {
  ink: { limb: '#2a2a26', hatch: '#2a2a26', feature: '#2a2a26', stipple: '#2a2a26', ring: '#2a2a26', star: '#2a2a26', atmosphere: '#2a2a26', aurora: '#2a2a26', tail: '#2a2a26', graticule: '#2a2a26', annotation: '#2a2a26', label: '#2a2a26', orbit: '#2a2a26', relief: '#2a2a26', cloud: '#2a2a26', callout: '#2a2a26' },
  astronomical: { limb: '#3a2f25', hatch: '#3b3a36', feature: '#4a3320', stipple: '#3b3a36', ring: '#5b4636', star: '#2b3a55', atmosphere: '#566b86', aurora: '#4a7a6a', tail: '#566b86', graticule: '#6b5e7a', annotation: '#4a3320', label: '#3a2f25', orbit: '#6b5e7a', relief: '#4a3320', cloud: '#6b5e7a', callout: '#3a2f25' },
  saturn: { limb: '#4a3a23', hatch: '#5a4a32', feature: '#6e5326', stipple: '#5a4a32', ring: '#8a6a36', star: '#6b5a44', atmosphere: '#b89a5a', aurora: '#7a8a5a', tail: '#b89a5a', graticule: '#8a7a52', annotation: '#6e5326', label: '#4a3a23', orbit: '#8a7a52', relief: '#6e5326', cloud: '#8a7a52', callout: '#4a3a23' },
  lunar: { limb: '#2c2c2c', hatch: '#3c3c3c', feature: '#222222', stipple: '#3c3c3c', ring: '#3c3c3c', star: '#4a4a4a', atmosphere: '#6a6a6a', aurora: '#5a6a5a', tail: '#6a6a6a', graticule: '#5a5a5a', annotation: '#222222', label: '#2c2c2c', orbit: '#5a5a5a', relief: '#222222', cloud: '#5a5a5a', callout: '#2c2c2c' },
  mars: { limb: '#6e2f1f', hatch: '#8a3b2e', feature: '#5a2418', stipple: '#8a3b2e', ring: '#8a3b2e', star: '#7a5a4a', atmosphere: '#b5715a', aurora: '#7a6a4a', tail: '#b5715a', graticule: '#a86a55', annotation: '#5a2418', label: '#6e2f1f', orbit: '#a86a55', relief: '#5a2418', cloud: '#a86a55', callout: '#6e2f1f' },
  cyanotype: { limb: '#13385e', hatch: '#1f4d78', feature: '#0e2a47', stipple: '#1f4d78', ring: '#1f4d78', star: '#3a6fa0', atmosphere: '#5a8fc0', aurora: '#4a8f90', tail: '#5a8fc0', graticule: '#3a6fa0', annotation: '#0e2a47', label: '#13385e', orbit: '#3a6fa0', relief: '#0e2a47', cloud: '#3a6fa0', callout: '#13385e' },
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
  // Each scene commits to a tonal plan: what stays paper, what goes dark,
  // where the eye lands.
  // coastal-sunset: paper = sun + mid-water; dark = foreground repoussoir;
  // the focal glitter column hangs under the sun.
  'coastal-sunset': { hasWater: true, waterFrac: 0.6, horizonFrac: 0.44, sun: true, sunRays: true, reflection: true, formFollow: true, headlands: 3, foreground: 0.45, foregroundSide: 'left', focus: 0.55, clouds: 0.28, birds: 3, rocks: 2, skyToneTop: 0.3, skyToneHorizon: 0.72, atmosphere: 0.45, palette: 'sunset' },
  // misty-ranges: paper = sky + mist gaps; far ridges whisper; dark = the
  // nearest crest zone.
  'misty-ranges': { hasWater: false, horizonFrac: 0.3, sun: false, ridgeCount: 5, ridgeAmp: 46, ridgePersistence: 0.45, ridgeSharpness: 0.55, formFollow: true, toneContrast: 0.6, crossHatch: 1, atmosphere: 0.8, focus: 0.3, trees: 5, treeStyle: 'conifer', birds: 2, skyToneTop: 0.2, skyToneHorizon: 0.46, palette: 'graphite' },
  // rolling-hills: dark = tree clusters + near shadow flanks under big paper
  // cloud masses.
  'rolling-hills': { hasWater: false, horizonFrac: 0.4, sun: true, ridgeCount: 3, ridgeAmp: 36, ridgeFreq: 1.6, ridgeSharpness: 0.15, formFollow: true, clouds: 0.3, trees: 8, treeStyle: 'mixed', atmosphere: 0.35, focus: 0.45, toneContrast: 0.65, skyToneTop: 0.22, skyToneHorizon: 0.46, palette: 'ink' },
  // desert-dunes: slope shading carries everything — lit faces open to paper,
  // slip-faces darken; near-paper sky with a clean sun. Straight low-angle
  // strata hatch instead of the vertical comb.
  'desert-dunes': { hasWater: false, horizonFrac: 0.36, sun: true, sunHalo: 0.9, ridgeCount: 5, ridgeAmp: 26, ridgeFreq: 1.1, ridgePersistence: 0.6, ridgeSharpness: 0.1, formFollow: false, ridgeHatchAngle: 8, slopeFollow: true, crossHatch: 0, toneContrast: 0.7, atmosphere: 0.3, focus: 0.4, trees: 2, treeStyle: 'scrub', skyToneTop: 0.22, skyToneHorizon: 0.6, palette: 'sanguine' },
  // alpine-lake: jagged peaks over open mid-lake paper; dark = foreground +
  // shore conifers.
  'alpine-lake': { hasWater: true, waterFrac: 0.5, horizonFrac: 0.5, horizonWobble: 22, horizonFreq: 3.2, sun: true, reflection: true, formFollow: true, headlands: 3, foreground: 0.35, foregroundSide: 'right', focus: 0.45, clouds: 0.3, rocks: 2, trees: 6, treeStyle: 'conifer', ridgeSharpness: 0.7, atmosphere: 0.55, skyToneTop: 0.4, skyToneHorizon: 0.62, palette: 'cyanotype' },
};
