import type { MachineCodexState } from './types';

/**
 * Codex presets: each one is a page identity — how the plate is dressed and
 * how loose the hand is. They patch state — seed and frame survive a switch.
 */
export interface MachineCodexPreset {
  id: string;
  label: string;
  state: Partial<MachineCodexState>;
}

export const MACHINE_CODEX_PRESETS: MachineCodexPreset[] = [
  {
    id: 'codex',
    label: 'Codex',
    state: {
      style: 'codex',
      complexity: 0.65,
      mechanisms: 0.7,
      annotations: 0.6,
      marginalia: 0.6,
      detailInsets: 1,
      shading: 0.6,
      sketch: 0.3,
      sketchStyle: 'loose',
      wobbleMm: 0.35,
    },
  },
  {
    id: 'patent',
    label: 'Patent plate',
    state: {
      style: 'patent',
      complexity: 0.7,
      mechanisms: 0.7,
      annotations: 0.9,
      marginalia: 0.3,
      detailInsets: 1,
      shading: 0.5,
      sketch: 0,
      wobbleMm: 0.05,
    },
  },
  {
    id: 'sketchbook',
    label: 'Sketchbook',
    state: {
      style: 'codex',
      complexity: 0.4,
      mechanisms: 0.5,
      annotations: 0.35,
      marginalia: 0.9,
      detailInsets: 1,
      shading: 0.7,
      sketch: 0.45,
      sketchStyle: 'loose',
      wobbleMm: 0.4,
    },
  },
  {
    id: 'engine-room',
    label: 'Engine room',
    state: {
      style: 'codex',
      complexity: 1,
      mechanisms: 1,
      annotations: 0.75,
      marginalia: 0.35,
      detailInsets: 2,
      shading: 0.65,
      sketch: 0.2,
      sketchStyle: 'fine',
      wobbleMm: 0.25,
    },
  },
];

export function getMachineCodexPreset(id: string): MachineCodexPreset | undefined {
  return MACHINE_CODEX_PRESETS.find((p) => p.id === id);
}

const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];

/**
 * A coherent random contraption: style, train size, drive extras and page
 * dressing rolled together, biased to ranges that render well. Pen width and
 * ink stay fixed — physical pen choices, not aesthetics to gamble.
 */
export function randomCodexGenome(rng: () => number): Partial<MachineCodexState> {
  const style = rng() < 0.72 ? ('codex' as const) : ('patent' as const);
  const sketch = style === 'patent' ? 0 : rng() < 0.25 ? 0 : Number((0.15 + rng() * 0.35).toFixed(2));
  return {
    style,
    complexity: Number((0.25 + rng() * 0.75).toFixed(2)),
    gearSizeMm: Number((20 + rng() * 18).toFixed(1)),
    mechanisms: Number((0.3 + rng() * 0.7).toFixed(2)),
    hiddenLines: rng() < 0.8,
    cutaway: rng() < 0.7,
    annotations: Number((0.25 + rng() * 0.7).toFixed(2)),
    marginalia: rng() < 0.15 ? 0 : Number((0.3 + rng() * 0.7).toFixed(2)),
    detailInsets: rng() < 0.25 ? 0 : rng() < 0.75 ? 1 : 2,
    hatchMm: Number((0.7 + rng() * 0.8).toFixed(2)),
    shading: Number((0.3 + rng() * 0.6).toFixed(2)),
    sketch,
    sketchStyle: pick(rng, ['loose', 'fine', 'gestural'] as const),
    wobbleMm: style === 'patent' ? Number((rng() * 0.12).toFixed(2)) : Number((0.2 + rng() * 0.3).toFixed(2)),
  };
}
