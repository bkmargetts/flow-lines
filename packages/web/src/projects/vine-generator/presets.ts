/**
 * Species presets: coherent bundles of vine settings that evoke a recognizable
 * plant. Selecting one batches its values into the module state (the Lenia
 * pattern); sliders still fine-tune from there. Each is a partial state — only
 * the fields that define the species' character are set.
 */
import type { VineState } from './types';
import { VINE_PALETTES } from './palettes';

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
 * Cross two species into a *coherent, restrained* hybrid "genome": the first
 * parent's habit (composition, growth, stem) is the base; light traits (leaf
 * type, phyllotaxis, flower type, palette) mix freely; but only **one** of the
 * second parent's "showy" structural features (compound leaves, an
 * inflorescence, fruit, or thorns) crosses over — stacking all of them at once
 * is what made randomised plants an overcrowded, angular mess. Density is kept
 * tasteful and dialled down further when the foliage or flowering is already
 * busy, so the page never overcrowds. The breeder behind the "surprise" button.
 */
export function crossVinePresets(a: VinePreset, b: VinePreset, rnd: () => number): Partial<VineState> {
  const out: Partial<VineState> = { ...a.state };
  const maybe = <K extends keyof VineState>(k: K) => {
    const v = b.state[k];
    if (v !== undefined && rnd() < 0.5) (out as Record<string, unknown>)[k] = v;
  };
  // Light, always-compatible traits mix freely.
  (['leafType', 'leafStyle', 'phyllotaxis', 'flowerType', 'palette'] as (keyof VineState)[]).forEach(maybe);

  // At most one of parent B's showy features crosses over.
  const showy: (() => void)[] = [];
  if (b.state.leafArrangement && b.state.leafArrangement !== 'simple') {
    showy.push(() => {
      out.leafArrangement = b.state.leafArrangement;
      if (b.state.leafletCount) out.leafletCount = b.state.leafletCount;
    });
  }
  if (b.state.inflorescence && b.state.inflorescence !== 'none') {
    showy.push(() => {
      out.inflorescence = b.state.inflorescence;
      out.flowers = true;
      if (b.state.flowerType) out.flowerType = b.state.flowerType;
    });
  }
  if (b.state.fruitType && b.state.fruitType !== 'none') showy.push(() => { out.fruitType = b.state.fruitType; });
  if (b.state.thorns) showy.push(() => { out.thorns = true; });
  if (showy.length > 0) showy[Math.floor(rnd() * showy.length)]();

  // Tasteful density — capped, and lighter still when the plant is already
  // structurally busy (compound leaves alone multiply blade count ~5×), so a
  // random hybrid lands calm and legible rather than a wall of foliage.
  const compound = out.leafArrangement && out.leafArrangement !== 'simple';
  const busy = compound || (out.inflorescence && out.inflorescence !== 'none');
  out.density = Math.min(a.state.density ?? 0.45, 0.5) * (compound ? 0.5 : busy ? 0.65 : 1);
  // Keep blooms sane — a hybrid shouldn't scale flowers into big angular masses.
  out.flowerSizeMm = Math.min(a.state.flowerSizeMm ?? 5, 7);
  // Never drop a bare garden scaffold (lattice / arch / obelisk) into a random
  // sprig — a support is a deliberate choice, not a trait to inherit by chance.
  out.support = 'none';
  return out;
}

/** Every drawn vessel the arrangement can stand in. */
const RANDOM_VESSELS: VineState['vessel'][] = ['vase', 'urn', 'amphora', 'bud-vase', 'pot', 'jar', 'mason-jar', 'bowl'];

/**
 * A fully random — but still coherent — genome for the "surprise" button. It
 * crosses two species (crossVinePresets) and then rolls the *page* elements the
 * cross can't reach: the ink palette (any curated set), and, for arrangements
 * that stand on a surface, a random vessel + ground line. So every press varies
 * the pot, the colours and the stem count, not just the foliage.
 */
export function randomVineGenome(rnd: () => number): Partial<VineState> {
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
  const a = pick(VINE_PRESETS);
  const b = pick(VINE_PRESETS);
  const genome: Partial<VineState> = a.id === b.id ? { ...a.state } : crossVinePresets(a, b, rnd);

  // Colour: any curated palette, for real variety beyond the two parents'.
  genome.palette = pick(VINE_PALETTES).id;

  // Vessel + ground: only compositions that actually render a container get one
  // (a random type, or none); everything else stays free-standing.
  const comp = genome.composition ?? 'specimen';
  if (comp === 'bouquet' || comp === 'specimen') {
    if (rnd() < 0.55) {
      genome.vessel = pick(RANDOM_VESSELS);
      genome.groundLine = true;
    } else {
      genome.vessel = 'none';
    }
  } else {
    genome.vessel = 'none';
  }

  // A little stem-count variety for the multi-stem arrangements.
  if (comp === 'bouquet' || comp === 'trellis' || comp === 'wreath') {
    genome.seedCount = 3 + Math.floor(rnd() * 5);
  }

  return genome;
}
