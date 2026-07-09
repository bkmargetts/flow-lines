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
      style: 'band',
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
      style: 'band',
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
      style: 'band',
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
      style: 'band',
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
    id: 'silk',
    label: 'Silk ribbon',
    state: {
      style: 'silk',
      order: 0.55,
      breaks: 0.35,
      edge: 'closed',
      cellMm: 20,
      bandMm: 6,
      rungs: 0.5,
      shading: 0.65,
      shadowHatch: 0.7,
      twists: 0.3,
      sketch: 0.15,
      sketchStyle: 'loose',
      wobbleMm: 0.35,
    },
  },
  {
    id: 'ink-ribbons',
    label: 'Ink ribbons',
    state: {
      style: 'band',
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

const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];

/**
 * A coherent random weave: style, point on the tangle↔knot axis, structure
 * and mark treatment all rolled together, biased to ranges that render well.
 * Pen width, crossing gap, ink groups and colors stay fixed — those are
 * physical pen choices, not aesthetics to gamble (the planet genome's rule).
 */
export function randomRibbonGenome(rng: () => number): Partial<RibbonWeaveState> {
  const style = rng() < 0.5 ? ('band' as const) : ('silk' as const);
  const cellMm = Number((10 + rng() * 18).toFixed(1));
  return {
    style,
    order: Number((0.08 + rng() * 0.9).toFixed(2)),
    edge: rng() < 0.7 ? ('closed' as const) : ('bleed' as const),
    breaks: rng() < 0.15 ? 0 : Number((0.1 + rng() * 0.5).toFixed(2)),
    cellMm,
    bandMm: Number(Math.min(9, Math.max(2, cellMm * (0.2 + rng() * 0.2))).toFixed(1)),
    meander: Number((0.6 + rng() * 0.4).toFixed(2)),
    rungs: Number((0.25 + rng() * 0.65).toFixed(2)),
    rungCurve: Number((0.3 + rng() * 0.6).toFixed(2)),
    shading: Number((0.15 + rng() * 0.75).toFixed(2)),
    shadowHatch: Number((0.4 + rng() * 0.6).toFixed(2)),
    lightAngleDeg: Math.round(rng() * 360 - 180),
    twists: rng() < 0.4 ? 0 : Number((rng() * 0.6).toFixed(2)),
    sketch: rng() < 0.5 ? 0 : Number((rng() * 0.45).toFixed(2)),
    sketchStyle: pick(rng, ['loose', 'fine', 'gestural'] as const),
    wobbleMm: Number((0.1 + rng() * 0.4).toFixed(2)),
  };
}
