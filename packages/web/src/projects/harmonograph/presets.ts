import type { HarmonographPreset } from '@flow-lines/core';
import type { HarmonographState } from './types';

/**
 * Look presets: each mirrors a core recipe (drawing machine + the knob
 * values that suit it). They patch state — seed, pen, and inks survive a
 * switch. Every patch pins `mode`, because the UI state always overrides
 * the core preset's mode.
 */
export interface HarmonographWebPreset {
  id: HarmonographPreset;
  label: string;
  state: Partial<HarmonographState>;
}

export const HARMONOGRAPH_WEB_PRESETS: HarmonographWebPreset[] = [
  {
    id: 'pendulum',
    label: 'Pendulum',
    state: { preset: 'pendulum', mode: 'harmonograph', ratioNum: 3, ratioDen: 2, detune: 0.008, damping: 0.25, rotary: 0, phaseDeg: 90, periods: 40, jitter: 0.15 },
  },
  {
    id: 'lissajous',
    label: 'Lissajous',
    state: { preset: 'lissajous', mode: 'harmonograph', ratioNum: 3, ratioDen: 4, detune: 0, damping: 0, rotary: 0, phaseDeg: 90, periods: 4, jitter: 0 },
  },
  {
    id: 'rotary',
    label: 'Rotary',
    state: { preset: 'rotary', mode: 'harmonograph', ratioNum: 1, ratioDen: 1, detune: 0.005, damping: 0.45, rotary: 0.65, phaseDeg: 90, periods: 50, jitter: 0.15 },
  },
  {
    id: 'spiro',
    label: 'Spiro',
    state: { preset: 'spiro', mode: 'spirograph', lobes: 7, wheelOrder: 3, penOffset: 0.8, trochoidKind: 'hypo', nest: 1, jitter: 0 },
  },
  {
    id: 'wheelwork',
    label: 'Wheelwork',
    state: { preset: 'wheelwork', mode: 'spirograph', lobes: 12, wheelOrder: 5, penOffset: 0.65, trochoidKind: 'hypo', nest: 12, nestShrink: 0.92, jitter: 0.1 },
  },
  {
    id: 'rosette',
    label: 'Rosette',
    state: { preset: 'rosette', mode: 'rosette', rings: 24, waves: 8, waveAmp: 1, phaseAdvanceDeg: 22.5, innerHole: 0.35, waves2: 0, envelope: 'bloom', jitter: 0.1 },
  },
  {
    id: 'engine-turn',
    label: 'Engine turn',
    state: { preset: 'engine-turn', mode: 'rosette', rings: 40, waves: 24, waveAmp: 0.5, phaseAdvanceDeg: 7.5, innerHole: 0.14, waves2: 6, wave2Amp: 0.25, envelope: 'flat', jitter: 0.05 },
  },
];

export function getHarmonographPreset(id: string): HarmonographWebPreset | undefined {
  return HARMONOGRAPH_WEB_PRESETS.find((p) => p.id === id);
}

const PRESETS: HarmonographPreset[] = [
  'pendulum',
  'lissajous',
  'rotary',
  'spiro',
  'wheelwork',
  'rosette',
  'engine-turn',
];

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.min(values.length - 1, Math.floor(rng() * values.length))];
}

/**
 * Randomise-everything genome: a whole new machine within the sliders'
 * ranges. Rolls the preset (the big lever), then jitters the knobs that
 * matter for its mode — small integer ratios stay small so the figures stay
 * figures. Never touches the seed (the button rolls it separately), detail
 * (a fidelity pref), or pen/ink aesthetics.
 */
export function randomHarmonographGenome(rng: () => number): Partial<HarmonographState> {
  const preset = pick(rng, PRESETS);
  const patch = getHarmonographPreset(preset)!.state;
  const out: Partial<HarmonographState> = {
    ...patch,
    preset,
    scale: Number((0.7 + rng() * 0.28).toFixed(2)),
  };
  if (out.mode === 'harmonograph') {
    out.ratioNum = 1 + Math.floor(rng() * 7);
    out.ratioDen = 1 + Math.floor(rng() * 5);
    out.detune = preset === 'lissajous' ? 0 : Number((0.002 + rng() * 0.02).toFixed(4));
    out.damping = preset === 'lissajous' ? 0 : Number((0.1 + rng() * 0.6).toFixed(2));
    out.rotary = preset === 'rotary' ? Number((0.35 + rng() * 0.55).toFixed(2)) : (patch.rotary ?? 0);
    out.phaseDeg = Math.round(rng() * 180);
    // A pure Lissajous closes after ratioDen turns — tracing further only
    // re-inks the same curve.
    out.periods =
      preset === 'lissajous' ? Math.max(2, out.ratioDen ?? 4) : Math.round(20 + rng() * 60);
  } else if (out.mode === 'spirograph') {
    out.lobes = 3 + Math.floor(rng() * 19);
    out.wheelOrder = 1 + Math.floor(rng() * 11);
    out.penOffset = Number((0.35 + rng() * 1.05).toFixed(2));
    out.trochoidKind = rng() < 0.7 ? 'hypo' : 'epi';
    out.nest = preset === 'wheelwork' ? 4 + Math.floor(rng() * 15) : 1 + Math.floor(rng() * 4);
    out.nestShrink = Number((0.82 + rng() * 0.15).toFixed(2));
  } else {
    out.rings = Math.round(12 + rng() * 48);
    out.waves = Math.round(5 + rng() * 27);
    out.waveAmp = Number((0.3 + rng() * 0.7).toFixed(2));
    // Half a wave period is the classic crest-to-trough weave; drift around it.
    out.phaseAdvanceDeg = Number(
      Math.min(45, (180 / (out.waves ?? 8)) * (0.5 + rng())).toFixed(1)
    );
    out.innerHole = Number((0.1 + rng() * 0.4).toFixed(2));
    out.waves2 = rng() < 0.4 ? 3 + Math.floor(rng() * 8) : 0;
    out.wave2Amp = Number((0.15 + rng() * 0.35).toFixed(2));
    out.envelope = pick(rng, ['flat', 'bloom', 'edge'] as const);
  }
  return out;
}
