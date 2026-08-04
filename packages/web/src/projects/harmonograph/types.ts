import type {
  HarmonographMode,
  HarmonographPreset,
  RosetteEnvelope,
  TrochoidKind,
} from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * UI state for Harmonograph (mm / 0..1 units). `render.ts` converts it to the
 * core's `HarmonographOptions` in px. The preset picks the drawing machine —
 * damped pendulums, spirograph wheels, or a guilloché rose engine — and the
 * knobs on top retune it.
 */
export interface HarmonographState {
  preset: HarmonographPreset;
  seed: number;
  mode: HarmonographMode;

  // Figure
  scale: number; // 0..1 of the inner sheet
  jitter: number; // 0..1 seeded drift

  // Pendulums
  ratioNum: number; // frequency ratio y:x
  ratioDen: number;
  detune: number; // 0..0.05 beat drift
  damping: number; // 0..1 decay over the trace
  rotary: number; // 0..1 platen swing
  phaseDeg: number; // lateral phase offset
  periods: number; // base-pendulum periods
  passes: number; // repeated decayed traces

  // Wheels
  lobes: number; // p of the p/q wheel ratio
  wheelOrder: number; // q — closure turns
  penOffset: number; // 0..1.5 of the wheel radius
  trochoidKind: TrochoidKind;
  nest: number; // nested repeats
  nestShrink: number; // per-repeat shrink
  nestRotateDeg: number; // per-repeat rotation, 0 = seeded

  // Rosette
  rings: number;
  waves: number;
  waveAmp: number; // 0..1 of the ring pitch
  phaseAdvanceDeg: number; // per-ring weave advance
  innerHole: number; // 0..0.9 clear centre
  waves2: number; // second harmonic, 0 = off
  wave2Amp: number; // 0..1
  envelope: RosetteEnvelope;

  // Fidelity
  detailMm: number; // target chord length

  // Pen / finishing
  penWidthMm: number;
  wobbleMm: number;

  // Ink
  inkGroups: number; // 1..4 pens (pass/repeat/ring % group)
  strokeColor: string;
  ink2Color: string;
  ink3Color: string;
  ink4Color: string;
}

export const defaultHarmonographState: HarmonographState = {
  preset: 'pendulum',
  seed: randomSeed(),
  mode: 'harmonograph',

  scale: 0.92,
  jitter: 0.15,

  ratioNum: 3,
  ratioDen: 2,
  detune: 0.008,
  damping: 0.25,
  rotary: 0,
  phaseDeg: 90,
  periods: 40,
  passes: 1,

  lobes: 7,
  wheelOrder: 3,
  penOffset: 0.8,
  trochoidKind: 'hypo',
  nest: 1,
  nestShrink: 0.88,
  nestRotateDeg: 0,

  rings: 24,
  waves: 8,
  waveAmp: 1,
  phaseAdvanceDeg: 22.5,
  innerHole: 0.35,
  waves2: 0,
  wave2Amp: 0.3,
  envelope: 'bloom',

  detailMm: 0.4,

  penWidthMm: 0.3,
  wobbleMm: 0,

  inkGroups: 1,
  strokeColor: '#1a1a2e',
  ink2Color: '#8a3324',
  ink3Color: '#1f3a5f',
  ink4Color: '#9c2b52',
};
