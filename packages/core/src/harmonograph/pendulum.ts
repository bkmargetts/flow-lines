import { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { TracedLine, decimate, stepFor } from './sample.js';

/**
 * Damped-pendulum harmonograph: two lateral pendulums drive the pen while a
 * third rotary term swings the platen. Each axis is a decaying sinusoid
 *
 *   x(t) = sin(ω₁t + φ₁)·e^(−d₁t) + rotary·cos(ω₃t + φ₃)·e^(−d₃t)
 *   y(t) = sin(ω₂t + φ₂)·e^(−d₂t) + rotary·sin(ω₃t + φ₃)·e^(−d₃t)
 *
 * with ω₂/ω₁ = ratio + detune and ω₃ ≈ ω₁. The per-axis dampings carry a
 * small seeded asymmetry — the axes falling out of step at slightly
 * different rates is what makes a real harmonograph's bands breathe.
 * Zero damping, detune and rotary degenerate exactly to a Lissajous figure.
 */
export interface PendulumParams {
  seed: number;
  ratioNum: number;
  ratioDen: number;
  detune: number;
  damping: number;
  rotary: number;
  phaseDeg: number;
  periods: number;
  passes: number;
  inkGroups: number;
  jitter: number;
  /** Target chord length in unit space */
  detail: number;
  /** Collinearity decimation tolerance in unit space */
  decimateTol: number;
  pointCap: number;
}

export function tracePendulum(p: PendulumParams): TracedLine[] {
  const w1 = Math.PI * 2;
  const ratio = p.ratioNum / Math.max(1, p.ratioDen) + p.detune;
  const w2 = w1 * ratio;
  const T = p.periods;
  // Damping is "decay over the whole trace": damping 1 fades to e⁻⁴ ≈ 2%
  // by the end regardless of how many periods it takes to get there.
  const dBase = (p.damping * 4) / Math.max(1e-6, T);
  const norm = 1 + p.rotary;
  const lines: TracedLine[] = [];

  // Chord bound: axis speeds are at most ω·amp (+ d from the decay term).
  const vx = w1 + dBase + p.rotary * w1 * 1.05;
  const vy = Math.max(w1, w2) + dBase + p.rotary * w1 * 1.05;
  const vMax = Math.hypot(vx, vy) / norm;
  const dt = stepFor(p.detail, vMax, T * p.passes, p.pointCap);
  const steps = Math.max(2, Math.ceil(T / dt));

  for (let pass = 0; pass < p.passes; pass++) {
    const rng = makeRandom(subSeed(p.seed, 20 + pass));
    const jitterRad = p.jitter * 0.6 * Math.PI;
    const phi1 = (rng() - 0.5) * jitterRad;
    const phi2 = (p.phaseDeg * Math.PI) / 180 + (rng() - 0.5) * jitterRad;
    const phi3 = rng() * Math.PI * 2;
    // Seeded per-axis asymmetry — never enough to outweigh the knob.
    const d1 = dBase * (1 + 0.2 * (rng() - 0.5));
    const d2 = dBase * (1 + 0.2 * (rng() - 0.5));
    const d3 = dBase * (1 + 0.2 * (rng() - 0.5));
    const w3 = w1 * (1 + 0.04 * (rng() - 0.5));
    const amp = Math.pow(0.96, pass);

    const points: Point[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = Math.min(T, i * dt);
      const decay1 = Math.exp(-d1 * t);
      const decay2 = Math.exp(-d2 * t);
      const decay3 = Math.exp(-d3 * t) * p.rotary;
      const x = (Math.sin(w1 * t + phi1) * decay1 + Math.cos(w3 * t + phi3) * decay3) / norm;
      const y = (Math.sin(w2 * t + phi2) * decay2 + Math.sin(w3 * t + phi3) * decay3) / norm;
      points.push({ x: x * amp, y: y * amp });
    }
    lines.push({ points: decimate(points, p.decimateTol), group: pass % p.inkGroups });
  }

  return lines;
}
