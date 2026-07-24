export type WarpBasePattern = 'lines' | 'waves' | 'circles' | 'rays';

export type WarpDeformerKind = 'dome' | 'ridge' | 'noise' | 'vortex' | 'lens';

export type WarpGridPreset = 'dome' | 'current' | 'vortex' | 'relief' | 'pinch' | 'blaze';

export interface WarpGridOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: controls deformer placement, sizes, strengths, signs */
  seed?: number;
  /** Named look preset (default 'dome') */
  preset?: WarpGridPreset;

  // ---- Base grating ----
  /** Base line pattern (default preset) */
  basePattern?: WarpBasePattern;
  /** Line pitch in px (default minDim/55) */
  spacing?: number;
  /** Base line direction in degrees, 'lines'/'waves' only (default preset) */
  angle?: number;
  /** Built-in transverse sine amplitude, 0..1 of pitch — 'waves' only (default 0.5) */
  waveAmp?: number;
  /** Sine wavelength in px — 'waves' base and ridge deformers (default minDim/6) */
  wavelength?: number;

  // ---- Deformers ----
  /** Hidden-form count, 0..8 (default preset) */
  deformers?: number;
  /** Allowed deformer kinds (default preset) */
  kinds?: WarpDeformerKind[];
  /** Per-deformer strength, 0..1 (default preset) */
  strength?: number;
  /** Relief shift scale, 0..1 — how far the heightfield pushes lines (default preset) */
  relief?: number;
  /** Deformer radius as a fraction of the min dimension (default 0.28) */
  scale?: number;
  /** Noise-relief feature size as a fraction of the min dimension (default 0.35) */
  noiseScale?: number;

  // ---- 3D read ----
  /** Break lines where compression squeezes the gap under this fraction of
   *  the pitch, 0 disables (default 0.35) — crisp bands instead of pooling */
  dropFloor?: number;
  /** Hidden-line removal, 'lines'/'waves' only — nearer relief occludes the
   *  lines behind it (default preset) */
  occlude?: boolean;
  /** How wide a band inside the margin returns to a flat grating, 0..1
   *  (default 0.35) — forms read as emerging from the calm sheet edge */
  edgeCalm?: number;

  // ---- Fidelity / plot ----
  /** Sample step along lines in px (default 2, min 0.75) */
  detail?: number;
  /** Hand-drawn wobble amplitude in px (default 0 — op-art wants machine lines) */
  wobble?: number;
  /** Chain strokes and order them to cut pen travel (default true) */
  optimize?: boolean;
}

/**
 * Look presets. `dome` bulges volumes out of a plain grating; `current` is
 * the Riley wave-shimmer (built-in sine plus ridge trains); `vortex` twists
 * the grating around hidden centres; `relief` reads a noise landscape as
 * occluded horizontal profile lines; `pinch` sucks concentric rings into
 * craters; `blaze` twists a radial burst.
 */
export const WARP_GRID_PRESETS: Record<
  WarpGridPreset,
  {
    basePattern: WarpBasePattern;
    kinds: WarpDeformerKind[];
    deformers: number;
    strength: number;
    relief: number;
    angle: number;
    occlude: boolean;
    /** Probability a dome/lens/vortex flips sign (crater / pinch / counter-twist) */
    flip: number;
    /** Preset noise feature size override (the occluded landscape wants
     *  steeper terrain than the default) */
    noiseScale?: number;
    /** Preset deformer-radius override (pinch wants lenses big enough to
     *  swallow whole rings) */
    scale?: number;
  }
> = {
  dome: { basePattern: 'lines', kinds: ['dome', 'lens'], deformers: 3, strength: 0.9, relief: 0.6, angle: 25, occlude: false, flip: 0.25 },
  current: { basePattern: 'waves', kinds: ['ridge'], deformers: 2, strength: 0.6, relief: 0.16, angle: 90, occlude: false, flip: 0.5 },
  vortex: { basePattern: 'lines', kinds: ['vortex', 'dome'], deformers: 3, strength: 0.65, relief: 0.18, angle: 0, occlude: false, flip: 0.35 },
  relief: { basePattern: 'lines', kinds: ['noise'], deformers: 1, strength: 0.9, relief: 0.85, angle: 0, occlude: true, flip: 0, noiseScale: 0.22 },
  pinch: { basePattern: 'circles', kinds: ['lens', 'dome'], deformers: 3, strength: 0.9, relief: 0.5, angle: 0, occlude: false, flip: 0.8, scale: 0.45 },
  blaze: { basePattern: 'rays', kinds: ['vortex', 'lens'], deformers: 2, strength: 0.6, relief: 0.2, angle: 0, occlude: false, flip: 0.4 },
};
