import type { PlanetState } from './types';

/**
 * Planet-type presets: a starting point per world kind, like the Vine
 * Generator's species. Each is a partial `PlanetState` merged over the current
 * state, so tweaks made afterwards survive. The 🎲 genome below crosses a fresh
 * type with randomised, type-appropriate toggles.
 */
export interface PlanetPreset {
  id: string;
  label: string;
  state: Partial<PlanetState>;
}

export const PLANET_PRESETS: PlanetPreset[] = [
  {
    id: 'terrestrial',
    label: 'Terrestrial (Earth-like)',
    state: {
      planetType: 'terrestrial',
      ocean: 0.6, terrainContrast: 1.5, coastlines: true, rivers: 4,
      iceCaps: true, capLatitude: 70, atmosphere: 1,
      lightElevation: 34, crossHatchLayers: 3, stipple: 0,
      bands: false, rings: false, craters: false,
      palette: 'astronomical',
    },
  },
  {
    id: 'gas-giant',
    label: 'Gas giant',
    state: {
      planetType: 'gas-giant',
      bands: true, bandCount: 11, bandTurbulence: 0.55, storms: 1, stormSize: 1.2,
      oblateness: 0.07, limbDarkening: 0.5, stipple: 0, crossHatchLayers: 2,
      coastlines: true, iceCaps: false, rings: false, craters: false,
      atmosphere: 0, palette: 'saturn',
    },
  },
  {
    id: 'ringed',
    label: 'Ringed gas giant',
    state: {
      planetType: 'ringed',
      bands: true, bandCount: 10, bandTurbulence: 0.5, storms: 1, stormSize: 1.2,
      oblateness: 0.07, limbDarkening: 0.45, crossHatchLayers: 2,
      rings: true, ringTilt: 22, ringYaw: 14, ringGap: 0.13, ringCount: 7, ringDensity: 4, ringShadow: true,
      iceCaps: false, craters: false, atmosphere: 0, palette: 'saturn',
    },
  },
  {
    id: 'moon',
    label: 'Cratered moon',
    state: {
      planetType: 'moon',
      mareAmount: 0.45, craters: true, craterCount: 90, craterDetail: true, stipple: 0.6,
      rilles: 2, featureLabels: true,
      atmosphere: 0, lightElevation: 18, crossHatchLayers: 3,
      bands: false, rings: false, iceCaps: false, coastlines: true,
      palette: 'lunar',
    },
  },
  {
    id: 'ice',
    label: 'Ice / frozen',
    state: {
      planetType: 'ice',
      iceCaps: true, capLatitude: 40, capRaggedness: 0.6, terrainContrast: 0.9,
      stipple: 0.2, atmosphere: 1, crossHatchLayers: 3,
      bands: false, rings: false, craters: false,
      palette: 'cyanotype',
    },
  },
  {
    id: 'lava',
    label: 'Lava / volcanic',
    state: {
      planetType: 'lava',
      terrainContrast: 2, terrainScale: 2.1, stipple: 0.5, atmosphere: 2,
      lavaFissureWidth: 0.14, lavaGlow: 0.5, lightElevation: 24,
      crossHatchLayers: 3, coastlines: true,
      bands: false, rings: false, craters: false, iceCaps: false,
      palette: 'mars',
    },
  },
  {
    id: 'star',
    label: 'Star / sun',
    state: {
      planetType: 'star',
      limbDarkening: 0.7, atmosphere: 2, lightElevation: 90, ambient: 0.9,
      stipple: 0.6, crossHatchLayers: 1, coastlines: false,
      bands: false, rings: false, craters: false, iceCaps: false,
      palette: 'mars',
    },
  },
  {
    id: 'barren',
    label: 'Barren rocky',
    state: {
      planetType: 'barren',
      mareAmount: 0.3, craters: true, craterCount: 50, craterMaxR: 0.1, craterDetail: true,
      stipple: 0.3, atmosphere: 0, crossHatchLayers: 4, terrainContrast: 1.2,
      bands: false, rings: false, iceCaps: false,
      palette: 'lunar',
    },
  },
  {
    id: 'asteroid',
    label: 'Asteroid',
    state: {
      planetType: 'asteroid',
      lumpiness: 0.16, craters: true, craterCount: 40, craterMaxR: 0.22, craterDetail: true,
      stipple: 0.5, lightElevation: 20, crossHatchLayers: 4,
      atmosphere: 0, bands: false, rings: false, iceCaps: false, coastlines: true,
      starfield: true, palette: 'lunar',
    },
  },
  {
    id: 'comet',
    label: 'Comet',
    state: {
      planetType: 'comet',
      radiusFrac: 0.2, lumpiness: 0.18, tailLength: 5, tailSpread: 28,
      craters: false, stipple: 0.4, crossHatchLayers: 4, lightElevation: 14,
      atmosphere: 0, bands: false, rings: false, iceCaps: false, coastlines: false,
      starfield: true, palette: 'astronomical',
    },
  },
  {
    id: 'eclipse',
    label: 'Eclipse plate',
    state: {
      planetType: 'terrestrial',
      ocean: 0.6, terrainContrast: 1.5, coastlines: true, iceCaps: true,
      moon: true, moonRadiusFrac: 0.3, moonAngle: -35, eclipse: true,
      starfield: true, plateFrame: true, plateTitle: 'ECLIPSIS',
      atmosphere: 1, crossHatchLayers: 3,
      bands: false, rings: false, craters: false,
      palette: 'astronomical',
    },
  },
  {
    id: 'aurora-world',
    label: 'Aurora world',
    state: {
      planetType: 'ice',
      iceCaps: true, capLatitude: 45, capRaggedness: 0.6, terrainContrast: 0.9,
      aurora: true, auroraLatitude: 68, auroraIntensity: 0.7,
      atmosphere: 2, atmosphereStyle: 'haze', stipple: 0.2, crossHatchLayers: 3,
      bands: false, rings: false, craters: false,
      palette: 'cyanotype',
    },
  },
];

export function getPlanetPreset(id: string): PlanetPreset | null {
  return PLANET_PRESETS.find((p) => p.id === id) ?? null;
}

const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];

/**
 * A coherent random planet: a fresh type plus randomised light, surface and
 * type-appropriate extras (rings for gas giants, craters for moons, a starfield
 * most of the time). Pen width and wobble stay fixed so output stays on-brand
 * and plottable.
 */
export function randomPlanetGenome(rng: () => number): Partial<PlanetState> {
  const types = ['terrestrial', 'gas-giant', 'ringed', 'moon', 'ice', 'lava', 'barren', 'asteroid'] as const;
  // Comets are a composition of their own, so they stay a rare roll.
  const type = rng() < 0.08 ? ('comet' as const) : pick(rng, [...types]);
  const base = getPlanetPreset(type)?.state ?? {};
  const isGas = type === 'gas-giant' || type === 'ringed';
  return {
    ...base,
    lightAngle: Math.round((rng() * 360 - 180)),
    lightElevation: Math.round(12 + rng() * 66),
    radiusFrac: type === 'comet' ? Number((0.16 + rng() * 0.1).toFixed(2)) : Number((0.52 + rng() * 0.26).toFixed(2)),
    lumpiness: type === 'asteroid' || type === 'comet' ? Number((0.1 + rng() * 0.12).toFixed(2)) : 0.14,
    terrainScale: Number((1.2 + rng() * 1.4).toFixed(2)),
    terrainContrast: Number((0.9 + rng() * 1.3).toFixed(2)),
    crossHatchLayers: 2 + Math.floor(rng() * 3),
    rings: type === 'ringed' || (isGas && rng() < 0.3),
    ringTilt: Math.round(8 + rng() * 34),
    oblateness: isGas ? Number((rng() * 0.1).toFixed(3)) : 0,
    iceCaps: type === 'ice' || (type === 'terrestrial' && rng() < 0.5),
    aurora: (type === 'ice' || type === 'terrestrial') && rng() < 0.2,
    rivers: type === 'terrestrial' ? Math.floor(rng() * 6) : 0,
    rilles: type === 'moon' || type === 'barren' ? Math.floor(rng() * 4) : 0,
    starfield: rng() < 0.75,
    moon: rng() < 0.25,
    moonAngle: Math.round(rng() * 360 - 180),
  };
}
