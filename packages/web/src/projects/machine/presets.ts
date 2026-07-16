import type { MachineState } from './types';

/**
 * Machine presets: points on the complexity × connectivity plane plus the
 * hand that suits them. They patch state — seed and frame survive a switch.
 */
export interface MachinePreset {
  id: string;
  label: string;
  state: Partial<MachineState>;
}

export const MACHINE_PRESETS: MachinePreset[] = [
  {
    id: 'mega',
    label: 'Mega-machine',
    state: {
      complexity: 1,
      connectivity: 1,
      scaleVariety: 0.6,
      mechanisms: 0.8,
      frameDensity: 0.7,
      cutaways: 2,
      shading: 0.6,
      sketch: 0.25,
      sketchStyle: 'loose',
      wobbleMm: 0.3,
    },
  },
  {
    id: 'engine-wall',
    label: 'Engine-room wall',
    state: {
      complexity: 1,
      connectivity: 0,
      scaleVariety: 0.8,
      mechanisms: 0.7,
      frameDensity: 0.5,
      cutaways: 2,
      shading: 0.75,
      sketch: 0.2,
      sketchStyle: 'fine',
      wobbleMm: 0.25,
    },
  },
  {
    id: 'workshop',
    label: 'Workshop',
    state: {
      complexity: 0.55,
      connectivity: 0.6,
      scaleVariety: 0.5,
      mechanisms: 0.6,
      frameDensity: 0.7,
      cutaways: 1,
      shading: 0.6,
      sketch: 0.35,
      sketchStyle: 'loose',
      wobbleMm: 0.35,
    },
  },
  {
    id: 'ruled',
    label: 'Ruled plate',
    state: {
      complexity: 0.85,
      connectivity: 0.9,
      scaleVariety: 0.55,
      mechanisms: 0.7,
      frameDensity: 0.75,
      cutaways: 2,
      shading: 0.5,
      sketch: 0,
      wobbleMm: 0.05,
    },
  },
];

export function getMachinePreset(id: string): MachinePreset | undefined {
  return MACHINE_PRESETS.find((p) => p.id === id);
}

const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];

/**
 * A coherent random machine: a point on the complexity × connectivity plane
 * plus train scale, drive extras and hand, biased to ranges that render
 * well. Pen width and ink stay fixed — physical pen choices, not aesthetics
 * to gamble.
 */
export function randomMachineGenome(rng: () => number): Partial<MachineState> {
  const sketch = rng() < 0.25 ? 0 : Number((0.1 + rng() * 0.35).toFixed(2));
  return {
    complexity: Number((0.35 + rng() * 0.65).toFixed(2)),
    connectivity: Number((rng() * rng() < 0.15 ? rng() * 0.3 : 0.4 + rng() * 0.6).toFixed(2)),
    gearSizeMm: Number((18 + rng() * 16).toFixed(1)),
    scaleVariety: Number((0.2 + rng() * 0.8).toFixed(2)),
    mechanisms: Number((0.3 + rng() * 0.7).toFixed(2)),
    frameDensity: Number((0.3 + rng() * 0.7).toFixed(2)),
    cutaways: rng() < 0.25 ? 0 : 1 + Math.floor(rng() * 3),
    hiddenLines: rng() < 0.85,
    hatchMm: Number((0.7 + rng() * 0.8).toFixed(2)),
    shading: Number((0.3 + rng() * 0.6).toFixed(2)),
    sketch,
    sketchStyle: pick(rng, ['loose', 'fine', 'gestural'] as const),
    wobbleMm: sketch > 0 ? Number((0.2 + rng() * 0.3).toFixed(2)) : Number((rng() * 0.35).toFixed(2)),
  };
}
