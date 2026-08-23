import { LAPIDARY_PALETTES, randomLapidaryPalette } from '../lapidary/palettes';
import type { LifeTerracesLook, LifeTerracesState } from './types';

/**
 * Curated looks: each patches the full generator surface, so picking one
 * restores its reference artwork even after a randomise — only the seed, pen
 * width, wobble and any custom inks survive a switch. `exposure` is the
 * reference artwork (dashed laminae over a five-level exposure terrain); the
 * others re-deal the same machinery.
 */
export interface LifeTerracesWebPreset {
  id: LifeTerracesLook;
  label: string;
  state: Partial<LifeTerracesState>;
}

/** The generator knobs every preset commits to (its reference values);
 *  presets spread overrides on top so none of them leaks a rolled value. */
const PRESET_BASE = {
  seedCount: 1,
  cellSizeMm: 1.8,
  generations: 300,
  decay: 0.96,
  gamma: 0.45,
  offCenter: 0.6,
  terrain: 'exposure',
  levels: 5,
  faintThreshold: 0.08,
  seamMm: 0.9,
  faults: 2,
  faultThrow: 1,
  outlines: false,
  outlineEmphasis: 2,
  section: false,
  sectionHeight: 0.2,
  spacing: 0.6,
  densityContrast: 0.6,
  strokeLength: 40,
  waviness: 0.3,
  taper: 0.7,
  continuous: false,
  massCore: true,
  hatchAngle: -32,
  crossHatchAmount: 0.5,
  residueMaxCells: 6,
  haloMm: 1.2,
  penAssignment: 'per-region',
} satisfies Partial<LifeTerracesState>;

export const LIFE_TERRACES_WEB_PRESETS: LifeTerracesWebPreset[] = [
  {
    id: 'exposure',
    label: 'Exposure',
    state: {
      ...PRESET_BASE,
      preset: 'exposure',
      palette: 'specimen',
    },
  },
  {
    id: 'agate',
    label: 'Agate',
    state: {
      ...PRESET_BASE,
      preset: 'agate',
      levels: 7,
      outlines: true,
      spacing: 0.5,
      densityContrast: 0.4,
      continuous: true,
      palette: 'graphite-rust-teal',
    },
  },
  {
    id: 'ember',
    label: 'Ember',
    state: {
      ...PRESET_BASE,
      preset: 'ember',
      decay: 0.92,
      levels: 3,
      densityContrast: 0.9,
      strokeLength: 14,
      taper: 0.9,
      palette: 'ember',
    },
  },
  {
    id: 'drift',
    label: 'Drift',
    state: {
      ...PRESET_BASE,
      preset: 'drift',
      seedCount: 3,
      waviness: 0.6,
      levels: 4,
      penAssignment: 'interleave',
      palette: 'glacier',
    },
  },
  {
    id: 'survey',
    label: 'Survey',
    state: {
      ...PRESET_BASE,
      preset: 'survey',
      terrain: 'epochs',
      section: true,
      outlines: true,
      palette: 'sepia',
    },
  },
];

export function getLifeTerracesPreset(id: string): LifeTerracesWebPreset | undefined {
  return LIFE_TERRACES_WEB_PRESETS.find((p) => p.id === id);
}

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.min(values.length - 1, Math.floor(rng() * values.length))];
}

/**
 * Randomise-everything genome: a whole new exposure terrain within the
 * sliders' ranges. The sim deal (detonations, memory, generations) reshapes
 * the terrain; the terrace deal (levels, seams, outlines) and the agent marks
 * (spacing, flow, taper) restyle it. Like terraces/lapidary it rolls the pen
 * palette — the per-level pen alternation is the module's identity — mostly a
 * NAMED palette from the curated table, about a third invented via
 * `randomLapidaryPalette`. Never touches the seed (the button rolls it), pen
 * width, or wobble.
 */
export function randomLifeTerracesGenome(rng: () => number): Partial<LifeTerracesState> {
  const pal = rng() < 0.65 ? pick(rng, LAPIDARY_PALETTES) : randomLapidaryPalette(rng);
  const inks = pal.inks;
  return {
    preset: 'custom',
    // Mostly a single composed detonation; colliding colonies on a minority.
    seedCount: rng() < 0.6 ? 1 : 2 + Math.floor(rng() * 3),
    cellSizeMm: Number((1.4 + rng() * 1.2).toFixed(1)),
    generations: 150 + Math.round(rng() * 45) * 10,
    decay: Number((0.9 + rng() * 0.08).toFixed(2)),
    gamma: Number((0.35 + rng() * 0.3).toFixed(2)),
    offCenter: Number((rng() * 0.8).toFixed(2)),
    levels: 3 + Math.floor(rng() * 6),
    faintThreshold: Number((0.05 + rng() * 0.1).toFixed(2)),
    seamMm: Number((0.5 + rng() * 1.5).toFixed(1)),
    // The fault deal is the module's biggest structural lever: usually one
    // or two shears, occasionally none or a rift.
    faults: ((r) => (r < 0.2 ? 0 : r < 0.55 ? 1 : r < 0.85 ? 2 : 3))(rng()),
    faultThrow: Number((0.5 + rng() * 1.1).toFixed(2)),
    outlines: rng() < 0.3,
    outlineEmphasis: 1 + Math.floor(rng() * 3),
    // Epoch terrain and the section plate are the survey identity — both
    // land often enough that random artwork keeps surfacing them.
    terrain: rng() < 0.45 ? 'epochs' : 'exposure',
    section: rng() < 0.3,
    sectionHeight: Number((0.15 + rng() * 0.15).toFixed(2)),
    spacing: Number((0.45 + rng() * 0.75).toFixed(2)),
    densityContrast: Number((0.3 + rng() * 0.7).toFixed(2)),
    strokeLength: Math.round(14 + rng() * 50),
    waviness: Number((rng() * 0.7).toFixed(2)),
    taper: Number((0.4 + rng() * 0.55).toFixed(2)),
    // The hand-fed dashing is the reference look; flowing laminae (the agate
    // face) land on a strong minority of rolls.
    continuous: rng() < 0.35,
    massCore: rng() < 0.85,
    hatchAngle: Math.round(rng() * 120 - 60),
    crossHatchAmount: Number((0.2 + rng() * 0.7).toFixed(2)),
    residueMaxCells: 3 + Math.floor(rng() * 8),
    haloMm: Number((0.6 + rng() * 1.6).toFixed(1)),
    penAssignment: rng() < 0.6 ? 'per-region' : 'interleave',
    palette: pal.id,
    pens: inks.length,
    strokeColor: inks[0],
    ink2Color: inks[1] ?? inks[0],
    ink3Color: inks[2] ?? inks[inks.length - 1],
    ink4Color: inks[3] ?? inks[inks.length - 1],
  };
}
