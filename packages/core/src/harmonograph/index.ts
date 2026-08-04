import { FlowLine, FlowLinesResult } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { optimizePlot } from '../optimize.js';
import { randomSeed, subSeed } from '../lib/rng.js';
import { clipPolylineToRect } from '../lib/polyline.js';
import { clamp } from '../lib/math.js';
import { HarmonographOptions, HARMONOGRAPH_PRESETS } from './types.js';
import { tracePendulum } from './pendulum.js';
import { traceTrochoid } from './trochoid.js';
import { traceRosette } from './rosette.js';
import { TracedLine } from './sample.js';

export { HARMONOGRAPH_PRESETS } from './types.js';
export type {
  HarmonographOptions,
  HarmonographMode,
  HarmonographPreset,
  TrochoidKind,
  RosetteEnvelope,
} from './types.js';

/** Pen-layer name for an ink group — mirrors marbling's inkLayerName. */
export function harmonographLayerName(group: number): string {
  return `ink-${group}`;
}

/**
 * Harmonograph / guilloché — the classic curve-drawing machines, rendered as
 * plottable single-pen strokes.
 *
 * Three machines share one frame: damped-pendulum harmonographs (decaying
 * sinusoid sums — `pendulum.ts`), spirograph trochoids (wheels rolling in
 * wheels — `trochoid.ts`), and engine-turned guilloché rosettes (woven
 * concentric rings — `rosette.ts`). All are closed-form curves traced with
 * an exact chord-length step, so the geometry is smooth at any size without
 * simulation. Repeats, passes and rings cycle through up to four pens
 * (`ink-<group>` layers) for the overprinted banknote look.
 */
export function generateHarmonograph(options: HarmonographOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    seed = randomSeed(),
    preset = 'pendulum',
    optimize = true,
  } = options;

  const p = HARMONOGRAPH_PRESETS[preset] ?? HARMONOGRAPH_PRESETS.pendulum;
  const mode = options.mode ?? p.mode;

  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;
  const innerW = x1 - x0;
  const innerH = y1 - y0;
  const empty = (): FlowLinesResult => ({ lines: [], width, height, seed });
  if (innerW < 16 || innerH < 16) return empty();
  const minDim = Math.min(innerW, innerH);

  const scale = clamp(options.scale ?? 0.92, 0.05, 1);
  const radius = (scale * minDim) / 2;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;

  const inkGroups = clamp(Math.round(options.inkGroups ?? 1), 1, 4);
  const jitter = clamp(options.jitter ?? p.jitter, 0, 1);
  const detailPx = Math.max(0.4, options.detail ?? 1.2);
  const pointCap = Math.max(1000, options.pointCap ?? 200_000);
  const wobble = options.wobble ?? 0;

  // Tracers work in unit space; fidelity converts to their scale.
  const detail = detailPx / radius;
  const decimateTol = 0.12 / radius;

  let traced: TracedLine[];
  if (mode === 'spirograph') {
    traced = traceTrochoid({
      seed,
      lobes: options.lobes ?? p.lobes ?? 7,
      wheelOrder: options.wheelOrder ?? p.wheelOrder ?? 3,
      penOffset: clamp(options.penOffset ?? p.penOffset ?? 0.8, 0, 1.5),
      kind: options.trochoidKind ?? p.trochoidKind ?? 'hypo',
      nest: options.nest ?? p.nest ?? 1,
      nestShrink: options.nestShrink ?? p.nestShrink ?? 0.88,
      nestRotateDeg: options.nestRotateDeg ?? 0,
      inkGroups,
      jitter,
      detail,
      decimateTol,
      pointCap,
    });
  } else if (mode === 'rosette') {
    traced = traceRosette({
      seed,
      rings: options.rings ?? p.rings ?? 28,
      waves: options.waves ?? p.waves ?? 12,
      waveAmp: clamp(options.waveAmp ?? p.waveAmp ?? 0.5, 0, 1),
      phaseAdvanceDeg: options.phaseAdvanceDeg ?? p.phaseAdvanceDeg ?? 7,
      innerHole: options.innerHole ?? p.innerHole ?? 0.25,
      waves2: options.waves2 ?? p.waves2 ?? 0,
      wave2Amp: clamp(options.wave2Amp ?? p.wave2Amp ?? 0.3, 0, 1),
      envelope: options.envelope ?? p.envelope ?? 'bloom',
      inkGroups,
      jitter,
      detail,
      decimateTol,
      pointCap,
    });
  } else {
    traced = tracePendulum({
      seed,
      ratioNum: clamp(Math.round(options.ratioNum ?? p.ratioNum ?? 3), 1, 16),
      ratioDen: clamp(Math.round(options.ratioDen ?? p.ratioDen ?? 2), 1, 16),
      detune: options.detune ?? p.detune ?? 0.008,
      damping: clamp(options.damping ?? p.damping ?? 0.25, 0, 1),
      rotary: clamp(options.rotary ?? p.rotary ?? 0, 0, 1),
      phaseDeg: options.phaseDeg ?? p.phaseDeg ?? 90,
      periods: clamp(options.periods ?? p.periods ?? 40, 2, 200),
      passes: clamp(Math.round(options.passes ?? inkGroups), 1, 8),
      inkGroups,
      jitter,
      detail,
      decimateTol,
      pointCap,
    });
  }

  const lines: FlowLine[] = [];
  for (const t of traced) {
    const run = t.points.map((pt) => ({ x: cx + pt.x * radius, y: cy + pt.y * radius }));
    // Curves stay inside the figure radius by construction; the clip is a
    // safety net for looped trochoids grazing a tight margin.
    for (const piece of clipPolylineToRect(run, x0, y0, x1, y1)) {
      if (piece.length >= 2) {
        lines.push({ points: piece, pen: 'fine', layer: harmonographLayerName(t.group) });
      }
    }
  }

  let result: FlowLinesResult = { lines, width, height, seed };

  if (wobble > 0) {
    result = applyHandDrawnStyle(result, {
      amplitude: wobble,
      wavelength: Math.max(24, radius * 0.2),
      seed: subSeed(seed, 11),
    });
  }

  if (optimize) result = optimizePlot(result);

  return result;
}
