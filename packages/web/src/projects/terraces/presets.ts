import { LAPIDARY_PALETTES, randomLapidaryPalette } from '../lapidary/palettes';
import type { TerracesLook, TerracesState, TerracesTextureMix } from './types';

/**
 * Curated looks: each patches the full generator surface, so picking one
 * restores its reference artwork even after a randomise — only the seed, pen
 * width, wobble and any custom inks survive a switch. `terraces` is the
 * reference artwork (fortification lamination shearing over two faults); the
 * others re-deal the same machinery.
 */
export interface TerracesWebPreset {
  id: TerracesLook;
  label: string;
  state: Partial<TerracesState>;
}

/** The generator knobs every preset commits to (its reference values);
 *  presets spread overrides on top so none of them leaks a rolled value. */
const PRESET_BASE = {
  bands: 6,
  irregularity: 0.55,
  steppiness: 0,
  faults: 2,
  faultThrow: 1,
  faultIncline: 0,
  haloMm: 2.2,
  outlines: false,
  outlineEmphasis: 2,
  textureMix: 'fortification',
  spacingMm: 1.3,
  angleDeg: 90,
  angleDriftDeg: 12,
  densityContrast: 0.6,
  waviness: 0.5,
  patchiness: 0.55,
  taper: 0.7,
  continuous: false,
  jitterDeg: 1.5,
  toneShape: 'seam',
  toneStrength: 0.35,
  lightAngleDeg: -120,
  sheetTone: 'none',
  sheetToneStrength: 0.35,
  penAssignment: 'interleave',
} satisfies Partial<TerracesState>;

export const TERRACES_WEB_PRESETS: TerracesWebPreset[] = [
  {
    id: 'terraces',
    label: 'Terraces',
    state: {
      ...PRESET_BASE,
      preset: 'terraces',
      palette: 'specimen',
    },
  },
  {
    id: 'benches',
    label: 'Benches',
    state: {
      ...PRESET_BASE,
      preset: 'benches',
      steppiness: 0.85,
      faults: 1,
      faultIncline: 0.3,
      palette: 'sepia',
    },
  },
  {
    id: 'rift',
    label: 'Rift',
    state: {
      ...PRESET_BASE,
      preset: 'rift',
      bands: 7,
      faults: 4,
      faultThrow: 1.6,
      faultIncline: 0.5,
      palette: 'graphite-rust-teal',
    },
  },
  {
    id: 'shale',
    label: 'Shale',
    state: {
      ...PRESET_BASE,
      preset: 'shale',
      bands: 8,
      faults: 0,
      textureMix: 'shuffle',
      angleDriftDeg: 20,
      palette: 'mono',
    },
  },
];

export function getTerracesPreset(id: string): TerracesWebPreset | undefined {
  return TERRACES_WEB_PRESETS.find((p) => p.id === id);
}

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.min(values.length - 1, Math.floor(rng() * values.length))];
}

/**
 * Randomise-everything genome: a whole new faulted stack within the sliders'
 * ranges. The fault deal (count, throw, incline) and the texture mix are the
 * big levers of a surprise; steppiness stays low on most rolls so the organic
 * reference look dominates. Like lapidary (and the scene generators), it
 * rolls the pen palette — the module's identity is multi-pen interplay —
 * mostly a NAMED palette from the curated table, about a third invented via
 * `randomLapidaryPalette`. Never touches the seed (the button rolls it), pen
 * width, or wobble.
 */
export function randomTerracesGenome(rng: () => number): Partial<TerracesState> {
  const pal = rng() < 0.65 ? pick(rng, LAPIDARY_PALETTES) : randomLapidaryPalette(rng);
  const inks = pal.inks;
  const steppinessRoll = rng();
  return {
    preset: 'custom',
    bands: 4 + Math.floor(rng() * 6),
    irregularity: Number((0.3 + rng() * 0.55).toFixed(2)),
    steppiness: Number(
      (steppinessRoll < 0.6 ? rng() * 0.3 : 0.3 + rng() * 0.7).toFixed(2)
    ),
    faults: Math.floor(rng() * 4),
    faultThrow: Number((0.4 + rng() * 1.4).toFixed(2)),
    faultIncline: Number(((rng() - 0.5) * 1.6).toFixed(2)),
    haloMm: Number((1.4 + rng() * 1.8).toFixed(1)),
    outlines: rng() < 0.2,
    outlineEmphasis: 1 + Math.floor(rng() * 3),
    // Weighted toward the reference deal — the contour lamination is what
    // bends across the faults, the whole point of the module.
    textureMix: ((r) =>
      r < 0.5 ? 'fortification' : r < 0.65 ? 'linework' : r < 0.8 ? 'tonal' : 'shuffle')(
      rng()
    ) as TerracesTextureMix,
    spacingMm: Number((0.9 + rng() * 1.1).toFixed(1)),
    angleDeg: ((r) => (r < 0.55 ? 90 : r < 0.75 ? 0 : Math.round(rng() * 180)))(rng()),
    angleDriftDeg: Math.round(5 + rng() * 30),
    densityContrast: Number((0.3 + rng() * 0.7).toFixed(2)),
    waviness: Number((0.3 + rng() * 0.7).toFixed(2)),
    patchiness: Number((0.25 + rng() * 0.6).toFixed(2)),
    taper: Number((0.45 + rng() * 0.5).toFixed(2)),
    // The broken hand-fed dashing is the module's signature, so unbroken
    // flowing lines land on a minority of rolls.
    continuous: rng() < 0.15,
    jitterDeg: Number((0.5 + rng() * 2).toFixed(1)),
    // Weighted toward the reference look: mostly seam (or flat), with the
    // showier shades on a minority of rolls.
    toneShape: ((r) =>
      r < 0.45 ? 'seam' : r < 0.65 ? 'none' : r < 0.8 ? 'light' : r < 0.9 ? 'core' : 'noise')(
      rng()
    ) as TerracesState['toneShape'],
    toneStrength: Number((rng() * 0.7).toFixed(2)),
    lightAngleDeg: Math.round(rng() * 360 - 180),
    // The sheet light is a big statement — off on most rolls, and the
    // vignette (the showier of the two) rarest.
    sheetTone: ((r) => (r < 0.6 ? 'none' : r < 0.85 ? 'light' : 'vignette'))(
      rng()
    ) as TerracesState['sheetTone'],
    sheetToneStrength: Number((0.25 + rng() * 0.5).toFixed(2)),
    penAssignment: rng() < 0.7 ? 'interleave' : 'per-region',
    palette: pal.id,
    pens: inks.length,
    strokeColor: inks[0],
    ink2Color: inks[1] ?? inks[0],
    ink3Color: inks[2] ?? inks[inks.length - 1],
    ink4Color: inks[3] ?? inks[inks.length - 1],
  };
}
