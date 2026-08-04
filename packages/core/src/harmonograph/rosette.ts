import { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { clamp } from '../lib/math.js';
import { RosetteEnvelope } from './types.js';
import { TracedLine, decimate, stepFor } from './sample.js';

/**
 * Guilloché rosette (engine turning): concentric rings whose radius carries
 * a sine wave, each ring's wave phase advanced a few degrees past the last —
 * adjacent crests slide past each other and the interference weave appears,
 * the rose-engine pattern on watch dials and banknotes. A second harmonic
 * folds barleycorn detail into the wave, and an envelope shapes where the
 * depth lives across the band (calm rim, blooming middle, or flat drafting).
 */
export interface RosetteParams {
  seed: number;
  rings: number;
  waves: number;
  waveAmp: number;
  phaseAdvanceDeg: number;
  innerHole: number;
  waves2: number;
  wave2Amp: number;
  envelope: RosetteEnvelope;
  inkGroups: number;
  jitter: number;
  /** Target chord length in unit space */
  detail: number;
  /** Collinearity decimation tolerance in unit space */
  decimateTol: number;
  pointCap: number;
}

function envelopeAt(kind: RosetteEnvelope, u: number): number {
  switch (kind) {
    case 'bloom':
      // Peaks mid-band; small floor so the rim rings still carry a whisper.
      return 0.08 + 0.92 * Math.sin(Math.PI * u);
    case 'edge':
      return 0.15 + 0.85 * u;
    default:
      return 1;
  }
}

export function traceRosette(p: RosetteParams): TracedLine[] {
  const rings = clamp(Math.round(p.rings), 1, 120);
  const waves = clamp(Math.round(p.waves), 1, 96);
  const waves2 = clamp(Math.round(p.waves2), 0, 96);
  const hole = clamp(p.innerHole, 0, 0.9);
  const advance = (p.phaseAdvanceDeg * Math.PI) / 180;
  // Ring pitch; the wave depth prices off it so adjacent crests interleave
  // without a ring ever wandering more than a band or so from home.
  const pitch = rings > 1 ? (1 - hole) / (rings - 1) : (1 - hole) / 2;
  const depth = 1.6 * pitch;

  const rng = makeRandom(subSeed(p.seed, 60));

  interface RingSpec {
    base: number;
    amp: number;
    amp2: number;
    phase: number;
    phase2: number;
  }
  const specs: RingSpec[] = [];
  let maxRho = 0;
  for (let i = 0; i < rings; i++) {
    const u = rings > 1 ? i / (rings - 1) : 0.5;
    const env = envelopeAt(p.envelope, u);
    const base = rings > 1 ? hole + (1 - hole) * u : hole + (1 - hole) * 0.5;
    let amp = p.waveAmp * depth * env * (1 + p.jitter * (rng() - 0.5) * 0.5);
    let amp2 = waves2 > 0 ? p.wave2Amp * depth * env : 0;
    // Slope cap: constant wave depth on a shrinking circumference steepens
    // toward the centre until the innermost rings knot; taper both harmonics
    // so no ring's wave ever climbs steeper than ~55° off its circle.
    const slope = (amp * waves + amp2 * waves2) / Math.max(1e-6, base);
    if (slope > 1.4) {
      const taper = (1.4 / slope) ** 0.9;
      amp *= taper;
      amp2 *= taper;
    }
    const phase = i * advance + p.jitter * (rng() - 0.5) * 0.3;
    // The golden-ratio multiplier keeps the two harmonics' weaves from
    // ever locking into a repeat.
    const phase2 = i * advance * 1.618 + rng() * 0.01;
    specs.push({ base, amp, amp2, phase, phase2 });
    maxRho = Math.max(maxRho, base + amp + amp2);
  }
  const norm = Math.max(1, maxRho);

  // Whole-figure step from the fastest ring: |dP/dθ| ≤ ρmax + Σ ampᵢ·kᵢ.
  let vMax = 0;
  let span = 0;
  for (const s of specs) {
    vMax = Math.max(vMax, (s.base + s.amp + s.amp2 + s.amp * waves + s.amp2 * waves2) / norm);
    span += Math.PI * 2;
  }
  const dt = stepFor(p.detail, vMax, span, p.pointCap);

  const lines: TracedLine[] = [];
  for (let i = 0; i < rings; i++) {
    const s = specs[i];
    const steps = Math.max(12, Math.ceil((Math.PI * 2) / dt));
    const points: Point[] = [];
    for (let k = 0; k < steps; k++) {
      const theta = (k / steps) * Math.PI * 2;
      const rho = Math.max(
        0.005,
        (s.base +
          s.amp * Math.sin(waves * theta + s.phase) +
          (waves2 > 0 ? s.amp2 * Math.sin(waves2 * theta + s.phase2) : 0)) /
          norm
      );
      points.push({ x: rho * Math.cos(theta), y: rho * Math.sin(theta) });
    }
    const out = decimate(points, p.decimateTol);
    out.push({ ...out[0] });
    lines.push({ points: out, group: i % p.inkGroups });
  }

  return lines;
}
