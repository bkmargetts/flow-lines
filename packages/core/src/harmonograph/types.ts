export type HarmonographMode = 'harmonograph' | 'spirograph' | 'rosette';

export type TrochoidKind = 'hypo' | 'epi';

export type RosetteEnvelope = 'flat' | 'bloom' | 'edge';

export type HarmonographPreset =
  | 'lissajous'
  | 'pendulum'
  | 'rotary'
  | 'spiro'
  | 'wheelwork'
  | 'rosette'
  | 'engine-turn';

export interface HarmonographOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: controls phase jitter, damping asymmetry, nest rotation */
  seed?: number;
  /** Named look preset (default 'pendulum') */
  preset?: HarmonographPreset;
  /** Drawing machine (default from preset) */
  mode?: HarmonographMode;

  // ---- Shared ----
  /** Figure size as a fraction of the inner min dimension (default 0.92) */
  scale?: number;
  /** Pens the passes/repeats/rings cycle through, 1..4 (default 1) */
  inkGroups?: number;
  /** Seeded drift of phases, damping asymmetry and ring waves, 0..1
   *  (default preset) — what keeps the machine from feeling too exact */
  jitter?: number;

  // ---- Harmonograph (damped pendulums) ----
  /** Frequency ratio numerator, y vs x pendulum (default preset) */
  ratioNum?: number;
  /** Frequency ratio denominator (default preset) */
  ratioDen?: number;
  /** Added to the ratio — the slow beat drift that opens the figure into a
   *  band instead of a closed curve (default preset) */
  detune?: number;
  /** Decay over the whole trace, 0..1 — 0 is a pure Lissajous figure
   *  (default preset) */
  damping?: number;
  /** Rotary-pendulum blend, 0..1 — the paper-rotation term (default preset) */
  rotary?: number;
  /** Phase offset between the two lateral pendulums in degrees (default 90) */
  phaseDeg?: number;
  /** Base-pendulum periods traced, 2..200 (default preset) */
  periods?: number;
  /** Repeated decayed traces, each phase-shifted and cycling the pens
   *  (default = inkGroups) */
  passes?: number;

  // ---- Spirograph (trochoids) ----
  /** Lobe count p of the reduced p/q wheel ratio (default preset) */
  lobes?: number;
  /** Wheel order q — the curve closes after q turns (default preset) */
  wheelOrder?: number;
  /** Pen distance from the wheel centre as a fraction of the wheel radius,
   *  0..1.5 — under 1 blunts the lobes, over 1 loops them (default preset) */
  penOffset?: number;
  /** Rolling inside ('hypo') or outside ('epi') the fixed ring (default preset) */
  trochoidKind?: TrochoidKind;
  /** Nested repeats of the closed curve, 1..24 (default preset) */
  nest?: number;
  /** Per-repeat shrink factor, 0.5..1 (default 0.88) */
  nestShrink?: number;
  /** Per-repeat rotation in degrees; 0 rolls a seeded step (default 0) */
  nestRotateDeg?: number;

  // ---- Rosette (guilloché / engine turning) ----
  /** Concentric rings, 1..120 (default preset) */
  rings?: number;
  /** Wave harmonic around each ring (default preset) */
  waves?: number;
  /** Wave depth as a fraction of the ring pitch, 0..1 (default preset) */
  waveAmp?: number;
  /** Per-ring phase advance in degrees — the engine-turn weave (default preset) */
  phaseAdvanceDeg?: number;
  /** Clear centre as a fraction of the figure radius, 0..0.9 (default preset) */
  innerHole?: number;
  /** Second wave harmonic, 0 disables (default preset) */
  waves2?: number;
  /** Second-harmonic depth as a fraction of the ring pitch, 0..1 (default preset) */
  wave2Amp?: number;
  /** Where the wave depth peaks across the band (default preset) */
  envelope?: RosetteEnvelope;

  // ---- Fidelity / plot ----
  /** Target chord length in px (default 1.2, min 0.4) */
  detail?: number;
  /** Total point cap across the whole figure (default 200000) */
  pointCap?: number;
  /** Hand-drawn wobble amplitude in px (default 0 — guilloché wants
   *  machine lines) */
  wobble?: number;
  /** Chain strokes and order them to cut pen travel (default true) */
  optimize?: boolean;
}

export interface HarmonographPresetSpec {
  mode: HarmonographMode;
  jitter: number;
  // harmonograph
  ratioNum?: number;
  ratioDen?: number;
  detune?: number;
  damping?: number;
  rotary?: number;
  phaseDeg?: number;
  periods?: number;
  // spirograph
  lobes?: number;
  wheelOrder?: number;
  penOffset?: number;
  trochoidKind?: TrochoidKind;
  nest?: number;
  nestShrink?: number;
  // rosette
  rings?: number;
  waves?: number;
  waveAmp?: number;
  phaseAdvanceDeg?: number;
  innerHole?: number;
  waves2?: number;
  wave2Amp?: number;
  envelope?: RosetteEnvelope;
}

/**
 * Look presets. `lissajous` is the undamped closed figure; `pendulum` the
 * classic decaying two-pendulum harmonograph; `rotary` adds the rotating
 * platen for the swirled nest-of-orbits look. `spiro` is a single toothed
 * wheel; `wheelwork` nests shrinking repeats into a mandala. `rosette` is a
 * bloom of woven rings; `engine-turn` the tight watch-dial barleycorn.
 */
export const HARMONOGRAPH_PRESETS: Record<HarmonographPreset, HarmonographPresetSpec> = {
  lissajous: { mode: 'harmonograph', jitter: 0, ratioNum: 3, ratioDen: 4, detune: 0, damping: 0, rotary: 0, phaseDeg: 90, periods: 4 },
  pendulum: { mode: 'harmonograph', jitter: 0.15, ratioNum: 3, ratioDen: 2, detune: 0.008, damping: 0.25, rotary: 0, phaseDeg: 90, periods: 40 },
  rotary: { mode: 'harmonograph', jitter: 0.15, ratioNum: 1, ratioDen: 1, detune: 0.005, damping: 0.45, rotary: 0.65, phaseDeg: 90, periods: 50 },
  spiro: { mode: 'spirograph', jitter: 0, lobes: 7, wheelOrder: 3, penOffset: 0.8, trochoidKind: 'hypo', nest: 1 },
  wheelwork: { mode: 'spirograph', jitter: 0.1, lobes: 12, wheelOrder: 5, penOffset: 0.65, trochoidKind: 'hypo', nest: 12, nestShrink: 0.92 },
  rosette: { mode: 'rosette', jitter: 0.1, rings: 24, waves: 8, waveAmp: 1, phaseAdvanceDeg: 22.5, innerHole: 0.35, waves2: 0, wave2Amp: 0.3, envelope: 'bloom' },
  'engine-turn': { mode: 'rosette', jitter: 0.05, rings: 40, waves: 24, waveAmp: 0.5, phaseAdvanceDeg: 7.5, innerHole: 0.14, waves2: 6, wave2Amp: 0.25, envelope: 'flat' },
};
