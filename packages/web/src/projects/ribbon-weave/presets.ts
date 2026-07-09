import type { RibbonWeaveState } from './types';

/**
 * Weave presets: each one is a point on the tangle↔knot axis plus the mark
 * treatment that suits it. They patch state — seed and frame survive a
 * switch.
 */
export interface RibbonWeavePreset {
  id: string;
  label: string;
  state: Partial<RibbonWeaveState>;
}

export const RIBBON_WEAVE_PRESETS: RibbonWeavePreset[] = [
  {
    id: 'knot-garden',
    label: 'Knot garden',
    state: {
      order: 0.78,
      breaks: 0.4,
      edge: 'closed',
      cellMm: 16,
      bandMm: 4.6,
      rungs: 0.5,
      shading: 0.6,
      shadowHatch: 0.7,
      twists: 0,
      sketch: 0,
      wobbleMm: 0.3,
    },
  },
  {
    id: 'plait',
    label: 'Plait',
    state: {
      order: 0.95,
      breaks: 0,
      edge: 'closed',
      cellMm: 14,
      bandMm: 4.2,
      rungs: 0.55,
      shading: 0.5,
      shadowHatch: 0.6,
      twists: 0,
      sketch: 0,
      wobbleMm: 0.15,
    },
  },
  {
    id: 'tangle',
    label: 'Tangle',
    state: {
      order: 0.1,
      breaks: 0.15,
      edge: 'bleed',
      cellMm: 18,
      bandMm: 5,
      rungs: 0.35,
      shading: 0.55,
      shadowHatch: 0.8,
      twists: 0.15,
      sketch: 0.2,
      sketchStyle: 'loose',
      wobbleMm: 0.35,
    },
  },
  {
    id: 'op-art',
    label: 'Op art',
    state: {
      order: 0.6,
      breaks: 0.1,
      edge: 'bleed',
      cellMm: 20,
      bandMm: 7,
      rungs: 0.95,
      rungCurve: 0.75,
      shading: 0.15,
      shadowHatch: 0.5,
      twists: 0,
      sketch: 0,
      wobbleMm: 0.2,
    },
  },
  {
    id: 'ink-ribbons',
    label: 'Ink ribbons',
    state: {
      order: 0.35,
      breaks: 0.3,
      edge: 'closed',
      cellMm: 22,
      bandMm: 6.5,
      rungs: 0.4,
      shading: 0.85,
      shadowHatch: 1,
      twists: 0.35,
      sketch: 0.3,
      sketchStyle: 'loose',
      wobbleMm: 0.4,
    },
  },
];

export function getRibbonWeavePreset(id: string): RibbonWeavePreset | undefined {
  return RIBBON_WEAVE_PRESETS.find((p) => p.id === id);
}
