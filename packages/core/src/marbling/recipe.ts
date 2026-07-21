import { MarblingOp } from './ops.js';

/**
 * Seed → op sequence for the classical patterns. The pipeline order is the
 * traditional one: every drop lands in turn (deforming all earlier ink),
 * then the rake strokes comb the whole bath. Combs are single ops with a
 * tooth period (see ops.ts), so a pass costs one traversal of the bath
 * regardless of tooth count.
 */
export type MarblingPattern = 'stone' | 'nonpareil' | 'feather' | 'bouquet' | 'vortex';

export interface DropSpec {
  cx: number;
  cy: number;
  r: number;
  group: number;
}

export interface RecipeParams {
  pattern: MarblingPattern;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  drops: number;
  dropRadius: number;
  dropRadiusJitter: number;
  inkGroups: number;
  combSpacing: number;
  /** Peak comb displacement z in px */
  combZ: number;
  /** Falloff λ in px */
  falloff: number;
  /** Wavy-comb strength 0..1 (bouquet) */
  wavy: number;
  /** Wavy-comb period along the tooth in px */
  wavyPeriod: number;
  /** Max vortex twist in radians */
  vortexTwist: number;
  /** Vortex falloff λ in px */
  vortexLambda: number;
}

/**
 * Min-separation rejection scatter inside the margin box — stone marbling's
 * pebble field. Separation relaxes when a seed corners itself so the drop
 * count always lands.
 */
function scatterDrops(p: RecipeParams, rng: () => number): DropSpec[] {
  const w = p.x1 - p.x0;
  const h = p.y1 - p.y0;
  const drops: DropSpec[] = [];
  const placed: { x: number; y: number }[] = [];
  for (let i = 0; i < p.drops; i++) {
    const r = p.dropRadius * (1 + p.dropRadiusJitter * (rng() * 2 - 1));
    let sep = p.dropRadius * 1.1;
    let x = 0;
    let y = 0;
    for (let attempt = 0; ; attempt++) {
      x = p.x0 + rng() * w;
      y = p.y0 + rng() * h;
      let ok = true;
      for (const q of placed) {
        if (Math.hypot(q.x - x, q.y - y) < sep) {
          ok = false;
          break;
        }
      }
      if (ok) break;
      if (attempt > 0 && attempt % 12 === 0) sep *= 0.75;
    }
    placed.push({ x, y });
    drops.push({ cx: x, cy: y, r: Math.max(2, r), group: i % p.inkGroups });
  }
  return drops;
}

/** One comb pass: a tooth family with period `spacing`, pulled along the
 *  unit direction of `angle`, anchored at the box centre shifted `phase`
 *  teeth across the pull direction. */
function comb(
  p: RecipeParams,
  angle: number,
  spacing: number,
  z: number,
  opts: { phase?: number; alternate?: boolean; wavyAmp?: number } = {}
): MarblingOp {
  const mx = Math.cos(angle);
  const my = Math.sin(angle);
  const cx = (p.x0 + p.x1) / 2;
  const cy = (p.y0 + p.y1) / 2;
  const shift = (opts.phase ?? 0) * spacing;
  // λ rides each pass's own tooth spacing (the falloff knob is anchored at
  // the base spacing) so coarse and fine passes keep the same shear
  // character. Alternating combs are net-zero across a tooth pair already;
  // uniform combs subtract the profile mean so the bath doesn't drift.
  const lambda = Math.max(0.5, p.falloff * (spacing / p.combSpacing));
  const balance = opts.alternate
    ? 0
    : ((2 * lambda) / spacing) * Math.log(1 + spacing / (2 * lambda));
  return {
    kind: 'tine',
    bx: cx + -my * shift,
    by: cy + mx * shift,
    mx,
    my,
    z,
    lambda,
    balance,
    spacing,
    alternate: opts.alternate,
    wavyAmp: opts.wavyAmp,
    wavyPeriod: opts.wavyAmp ? p.wavyPeriod : undefined,
    wavyPhase: 0,
  };
}

export function buildOps(
  p: RecipeParams,
  rng: () => number
): { drops: DropSpec[]; strokes: MarblingOp[] } {
  const drops = scatterDrops(p, rng);
  const strokes: MarblingOp[] = [];
  // Small per-seed slant so two seeds never comb at the identical angle.
  const jitter = ((rng() * 2 - 1) * 6 * Math.PI) / 180;
  const down = Math.PI / 2 + jitter;

  switch (p.pattern) {
    case 'stone':
      break;
    case 'nonpareil':
      strokes.push(comb(p, down, p.combSpacing, p.combZ));
      break;
    case 'feather':
      // Git-gel base: two opposed coarse passes offset half a period, then
      // the fine nonpareil comb, then the chevron pass — a wide alternating
      // comb across the fine one folds its streaks into feather barbs.
      strokes.push(comb(p, down, p.combSpacing * 3, p.combZ * 0.45));
      strokes.push(comb(p, down + Math.PI, p.combSpacing * 3, p.combZ * 0.45, { phase: 0.5 }));
      strokes.push(comb(p, down, p.combSpacing, p.combZ * 0.5));
      strokes.push(comb(p, down + Math.PI / 2, p.combSpacing * 3, p.combZ * 0.9, { alternate: true }));
      break;
    case 'bouquet':
      strokes.push(comb(p, down, p.combSpacing, p.combZ * 0.6));
      strokes.push(comb(p, down, p.combSpacing * 1.5, p.combZ * 0.7, { wavyAmp: p.wavy }));
      break;
    case 'vortex': {
      const n = 2 + Math.floor(rng() * 2);
      const w = p.x1 - p.x0;
      const h = p.y1 - p.y0;
      for (let i = 0; i < n; i++) {
        const cx = p.x0 + w * (0.2 + 0.6 * rng());
        const cy = p.y0 + h * (0.2 + 0.6 * rng());
        const sign = i % 2 === 0 ? 1 : -1;
        strokes.push({
          kind: 'vortex',
          cx,
          cy,
          z: sign * p.vortexTwist * (0.75 + 0.5 * rng()),
          lambda: p.vortexLambda,
        });
      }
      break;
    }
  }
  return { drops, strokes };
}
