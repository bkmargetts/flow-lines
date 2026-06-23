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
];

export function getVinePreset(id: string): VinePreset | undefined {
  return VINE_PRESETS.find((p) => p.id === id);
}
