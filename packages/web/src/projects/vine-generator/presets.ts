/**
 * Species presets: coherent bundles of vine settings that evoke a recognizable
 * plant. Selecting one batches its values into the module state (the Lenia
 * pattern); sliders still fine-tune from there. Each is a partial state — only
 * the fields that define the species' character are set.
 */
import type { VineState } from './types';

export interface VinePreset {
  id: string;
  label: string;
  state: Partial<VineState>;
}

export const VINE_PRESETS: VinePreset[] = [
  {
    id: 'wild-rose',
    label: 'Wild rose',
    state: {
      composition: 'specimen', mode: 'growth', leafType: 'serrate', leafStyle: 'shaded', veins: true,
      leafArrangement: 'pinnate', leafletCount: 5, thorns: true, thornProb: 0.18,
      flowers: true, flowerType: 'rose', flowerProb: 0.4, flowerSizeMm: 6, tendrils: true, tendrilProb: 0.12,
      density: 0.55, curl: 0.55, gravitropism: 0.4, branchProb: 0.06, stemWidthMm: 4, palette: 'rose',
    },
  },
  {
    id: 'ivy',
    label: 'Ivy',
    state: {
      composition: 'trellis', mode: 'growth', leafType: 'lobed', leafStyle: 'shaded', veins: true,
      flowers: false, tendrils: true, tendrilProb: 0.06, density: 0.7, curl: 0.6, gravitropism: 0.5,
      branchProb: 0.06, stemWidthMm: 3, leafSizeMm: 13, seedCount: 4, palette: 'botanical',
    },
  },
  {
    id: 'fern',
    label: 'Fern frond',
    state: {
      composition: 'specimen', mode: 'growth', leafType: 'lance', leafStyle: 'veined', veins: true,
      leafArrangement: 'bipinnate', leafletCount: 9,
      flowers: false, tendrils: false, density: 0.5, leafSizeMm: 8, leafWidthRatio: 0.4, leafSpacingMm: 9,
      curl: 0.35, gravitropism: 0.55, branchProb: 0.06, stemWidthMm: 2.6, palette: 'botanical',
    },
  },
  {
    id: 'wisteria',
    label: 'Wisteria',
    state: {
      composition: 'bouquet', mode: 'growth', leafType: 'ovate', leafStyle: 'shaded', veins: true,
      leafArrangement: 'pinnate', leafletCount: 9, inflorescence: 'raceme', floretCount: 12,
      flowers: true, flowerType: 'bell', flowerProb: 0.7, flowerSizeMm: 6, tendrils: false,
      density: 0.45, curl: 0.5, gravitropism: 0.2, branchProb: 0.05, stemWidthMm: 3.5, seedCount: 5, palette: 'indigo',
      vessel: 'urn', groundLine: true,
    },
  },
  {
    id: 'eucalyptus',
    label: 'Eucalyptus',
    state: {
      composition: 'specimen', mode: 'growth', leafType: 'cordate', leafStyle: 'shaded', veins: true,
      phyllotaxis: 'opposite',
      flowers: false, tendrils: false, density: 0.5, leafSizeMm: 11, leafWidthRatio: 0.85, leafSpacingMm: 13,
      curl: 0.4, gravitropism: 0.45, branchProb: 0.05, stemWidthMm: 3, palette: 'sepia',
    },
  },
  {
    id: 'grapevine',
    label: 'Grapevine',
    state: {
      composition: 'trellis', mode: 'growth', leafType: 'lobed', leafStyle: 'shaded', veins: true,
      fruitType: 'grape', fruitProb: 0.4,
      flowers: false, tendrils: true, tendrilProb: 0.28,
      density: 0.55, curl: 0.6, gravitropism: 0.4, branchProb: 0.06, stemWidthMm: 4, seedCount: 4, palette: 'autumn',
    },
  },
  {
    id: 'clematis',
    label: 'Clematis',
    state: {
      composition: 'trellis', mode: 'growth', support: 'lattice', leafType: 'ovate', leafArrangement: 'trifoliate',
      leafStyle: 'shaded', veins: true, flowers: true, flowerType: 'daisy', flowerProb: 0.5, flowerSizeMm: 9,
      tendrils: true, tendrilProb: 0.18, density: 0.5, curl: 0.55, gravitropism: 0.45, branchProb: 0.06,
      stemWidthMm: 3, seedCount: 4, palette: 'indigo',
    },
  },
  {
    id: 'jasmine',
    label: 'Jasmine',
    state: {
      composition: 'specimen', mode: 'growth', leafType: 'ovate', leafArrangement: 'pinnate', leafletCount: 5,
      leafStyle: 'shaded', veins: true, flowers: true, flowerType: 'daisy', flowerProb: 0.5, flowerSizeMm: 5,
      inflorescence: 'corymb', floretCount: 6, tendrils: false, density: 0.45, curl: 0.5, gravitropism: 0.35,
      branchProb: 0.06, stemWidthMm: 2.8, palette: 'botanical',
    },
  },
  {
    id: 'morning-glory',
    label: 'Morning glory',
    state: {
      composition: 'trellis', mode: 'growth', support: 'obelisk', leafType: 'cordate', phyllotaxis: 'spiral',
      leafStyle: 'shaded', veins: true, flowers: true, flowerType: 'bell', flowerProb: 0.45, flowerSizeMm: 11,
      tendrils: true, tendrilProb: 0.2, density: 0.5, curl: 0.7, gravitropism: 0.5, branchProb: 0.05,
      stemWidthMm: 2.6, seedCount: 3, palette: 'indigo',
    },
  },
  {
    id: 'holly',
    label: 'Holly',
    state: {
      composition: 'specimen', mode: 'growth', leafType: 'serrate', phyllotaxis: 'alternate',
      leafStyle: 'shaded', veins: true, flowers: false, fruitType: 'berry', fruitProb: 0.4,
      tendrils: false, density: 0.6, leafSizeMm: 12, curl: 0.4, gravitropism: 0.5, branchProb: 0.06,
      stemWidthMm: 3.5, palette: 'rose',
    },
  },
  {
    id: 'bramble',
    label: 'Bramble',
    state: {
      composition: 'specimen', mode: 'growth', leafType: 'serrate', leafArrangement: 'palmate', leafletCount: 5,
      leafStyle: 'shaded', veins: true, thorns: true, thornProb: 0.25, fruitType: 'berry', fruitProb: 0.35,
      flowers: true, flowerType: 'rose', flowerProb: 0.2, flowerSizeMm: 5, tendrils: false,
      density: 0.55, curl: 0.65, gravitropism: 0.3, branchProb: 0.07, stemWidthMm: 3.5, palette: 'autumn',
    },
  },
  {
    id: 'honeysuckle',
    label: 'Honeysuckle',
    state: {
      composition: 'bouquet', mode: 'growth', leafType: 'ovate', phyllotaxis: 'opposite',
      leafStyle: 'shaded', veins: true, flowers: true, flowerType: 'bell', flowerProb: 0.6, flowerSizeMm: 7,
      inflorescence: 'umbel', floretCount: 6, tendrils: false, density: 0.45, curl: 0.55, gravitropism: 0.35,
      branchProb: 0.05, stemWidthMm: 3, seedCount: 4, palette: 'sepia',
    },
  },
  {
    id: 'oak',
    label: 'Oak branch',
    state: {
      composition: 'specimen', mode: 'growth', leafType: 'lobed', phyllotaxis: 'spiral',
      leafStyle: 'shaded', veins: true, flowers: false, fruitType: 'catkin', fruitProb: 0.25,
      tendrils: false, density: 0.55, leafSizeMm: 16, curl: 0.45, gravitropism: 0.5, branchProb: 0.07,
      stemWidthMm: 6, stemTexture: 'bark', palette: 'sepia',
    },
  },
  {
    id: 'maple',
    label: 'Maple',
    state: {
      composition: 'specimen', mode: 'growth', leafType: 'lobed', leafArrangement: 'palmate', leafletCount: 5,
      phyllotaxis: 'opposite', leafStyle: 'shaded', veins: true, flowers: false, fruitType: 'pod', fruitProb: 0.3,
      tendrils: false, density: 0.45, leafSizeMm: 16, curl: 0.4, gravitropism: 0.5, branchProb: 0.06,
      stemWidthMm: 5, stemTexture: 'bark', palette: 'autumn',
    },
  },
];

export function getVinePreset(id: string): VinePreset | undefined {
  return VINE_PRESETS.find((p) => p.id === id);
}

/**
 * Cross two species into a coherent hybrid "genome": the first parent's habit
 * (composition, growth, stem) is kept as the base, and a handful of foliage,
 * flowering and accessory traits are pulled at random from either parent. The
 * result reads as a plausible new plant rather than noise — the breeder behind
 * the "surprise" button.
 */
const CROSS_TRAITS: (keyof VineState)[] = [
  'leafType', 'leafArrangement', 'leafletCount', 'phyllotaxis',
  'flowers', 'flowerType', 'inflorescence', 'fruitType', 'thorns', 'palette',
];

export function crossVinePresets(a: VinePreset, b: VinePreset, rnd: () => number): Partial<VineState> {
  const out: Partial<VineState> = { ...a.state };
  for (const k of CROSS_TRAITS) {
    const v = rnd() < 0.5 ? b.state[k] : a.state[k];
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
