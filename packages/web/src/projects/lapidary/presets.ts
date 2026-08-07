import { LAPIDARY_PALETTES } from './palettes';
import type { LapidaryLook, LapidaryState, LapidaryTextureMix } from './types';

/**
 * Curated looks: each patches the full generator surface, so picking one
 * restores its reference artwork even after a randomise — only the seed, pen
 * width, wobble and any custom inks survive a switch. `specimen` is the
 * reference artwork (concentric bands, black + orange interleaved); the
 * others re-deal the same machinery.
 */
export interface LapidaryWebPreset {
  id: LapidaryLook;
  label: string;
  state: Partial<LapidaryState>;
}

/** The generator knobs every preset commits to (its reference values);
 *  presets spread overrides on top so none of them leaks a rolled value. */
const PRESET_BASE = {
  mode: 'agate',
  bands: 5,
  field: true,
  shapes: 'organic',
  textureMix: 'specimen',
  irregularity: 0.55,
  coverage: 0.9,
  centerX: 0,
  centerY: 0,
  faults: 0,
  veins: false,
  haloMm: 2.2,
  outlines: false,
  spacingMm: 1.3,
  angleDeg: 90,
  angleDriftDeg: 25,
  densityContrast: 0.6,
  waviness: 0.5,
  patchiness: 0.55,
  penAssignment: 'interleave',
} satisfies Partial<LapidaryState>;

export const LAPIDARY_WEB_PRESETS: LapidaryWebPreset[] = [
  {
    id: 'specimen',
    label: 'Specimen',
    state: {
      ...PRESET_BASE,
      preset: 'specimen',
      palette: 'specimen',
    },
  },
  {
    id: 'geode',
    label: 'Geode',
    state: {
      ...PRESET_BASE,
      preset: 'geode',
      bands: 7,
      textureMix: 'geode',
      coverage: 0.95,
      palette: 'graphite-rust-teal',
    },
  },
  {
    id: 'fortification',
    label: 'Fortification',
    state: {
      ...PRESET_BASE,
      preset: 'fortification',
      bands: 6,
      textureMix: 'fortification',
      coverage: 0.92,
      palette: 'specimen',
    },
  },
  {
    id: 'breccia',
    label: 'Breccia',
    state: {
      ...PRESET_BASE,
      preset: 'breccia',
      mode: 'breccia',
      bands: 8,
      textureMix: 'shuffle',
      penAssignment: 'per-region',
      palette: 'graphite-rust-teal',
    },
  },
  {
    id: 'terraces',
    label: 'Terraces',
    state: {
      ...PRESET_BASE,
      preset: 'terraces',
      mode: 'strata',
      bands: 6,
      textureMix: 'shuffle',
      faults: 1,
      angleDeg: 0,
      angleDriftDeg: 14,
      palette: 'specimen',
    },
  },
  {
    id: 'facet',
    label: 'Facet',
    state: {
      ...PRESET_BASE,
      preset: 'facet',
      field: false,
      shapes: 'angular',
      textureMix: 'facet',
      irregularity: 0.7,
      coverage: 0.95,
      angleDriftDeg: 30,
      palette: 'specimen',
    },
  },
  {
    id: 'mono',
    label: 'Mono',
    state: {
      ...PRESET_BASE,
      preset: 'mono',
      palette: 'mono',
    },
  },
];

export function getLapidaryPreset(id: string): LapidaryWebPreset | undefined {
  return LAPIDARY_WEB_PRESETS.find((p) => p.id === id);
}

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.min(values.length - 1, Math.floor(rng() * values.length))];
}

const MIXES: LapidaryTextureMix[] = [
  'specimen',
  'geode',
  'fortification',
  'facet',
  'linework',
  'tonal',
  'shuffle',
];

/**
 * Randomise-everything genome: a whole new arrangement within the sliders'
 * ranges. Rolls the mode and texture deal — the big levers of a surprise —
 * and, like the scene generators, a NAMED pen palette: this module's whole
 * identity is multi-pen interplay, so a surprise that always came back
 * black-and-orange wouldn't be one. The palette's hexes come from the
 * curated table (never generated colours) and its size sets `pens`; the
 * vein accent rides along the same way. Never touches the seed (the button
 * rolls it), pen width, or wobble.
 */
export function randomLapidaryGenome(rng: () => number): Partial<LapidaryState> {
  const mode = rng() < 0.5 ? 'agate' : rng() < 0.5 ? 'breccia' : 'strata';
  const pal = pick(rng, LAPIDARY_PALETTES);
  const inks = pal.inks;
  const shapesRoll = rng();
  return {
    preset: 'custom',
    mode,
    bands: 3 + Math.floor(rng() * 6),
    field: rng() < 0.75,
    shapes: shapesRoll < 0.45 ? 'organic' : shapesRoll < 0.7 ? 'angular' : 'mixed',
    irregularity: Number((0.3 + rng() * 0.55).toFixed(2)),
    coverage: Number((0.6 + rng() * 0.4).toFixed(2)),
    centerX: Number(((rng() - 0.5) * 0.4).toFixed(2)),
    centerY: Number(((rng() - 0.5) * 0.4).toFixed(2)),
    faults: mode === 'strata' ? Math.floor(rng() * 3) : 0,
    veins: mode === 'breccia' && rng() < 0.25,
    haloMm: Number((1.4 + rng() * 1.8).toFixed(1)),
    outlines: rng() < 0.2,
    textureMix: pick(rng, MIXES),
    spacingMm: Number((0.9 + rng() * 1.1).toFixed(1)),
    angleDeg: mode === 'strata' ? (rng() < 0.6 ? 0 : 90) : rng() < 0.6 ? 90 : Math.round(rng() * 180),
    angleDriftDeg: Math.round(5 + rng() * 35),
    densityContrast: Number((0.3 + rng() * 0.7).toFixed(2)),
    waviness: Number((0.3 + rng() * 0.7).toFixed(2)),
    patchiness: Number((0.25 + rng() * 0.6).toFixed(2)),
    penAssignment: rng() < 0.7 ? 'interleave' : 'per-region',
    palette: pal.id,
    pens: inks.length,
    strokeColor: inks[0],
    ink2Color: inks[1] ?? inks[0],
    ink3Color: inks[2] ?? inks[inks.length - 1],
    ink4Color: inks[3] ?? inks[inks.length - 1],
    veinColor: pal.vein,
  };
}
