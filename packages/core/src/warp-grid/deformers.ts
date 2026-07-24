import { Point } from '../flow-lines.js';
import { SimplexNoise } from '../noise.js';
import { applyVortex } from '../marbling/ops.js';
import { WarpDeformerKind } from './types.js';

/** Height deformers add up into a scalar field the relief shift samples. */
export type HeightDeformer =
  | { kind: 'dome'; cx: number; cy: number; r: number; h: number }
  | {
      kind: 'ridge';
      cx: number;
      cy: number;
      /** Unit wave direction (crests run perpendicular to it) */
      mx: number;
      my: number;
      wavelength: number;
      phase: number;
      /** Gaussian half-width across the train (Infinity = full-page) */
      sigma: number;
      h: number;
    }
  | { kind: 'noise'; scale: number; ox: number; oy: number; h: number };

/** Domain deformers are exact plane maps applied after the relief shift. */
export type DomainDeformer =
  | { kind: 'vortex'; cx: number; cy: number; z: number; lambda: number }
  | { kind: 'lens'; cx: number; cy: number; r: number; k: number };

export interface WarpScene {
  heights: HeightDeformer[];
  domains: DomainDeformer[];
  noise: SimplexNoise;
}

/** C¹ Wendland-style bump: 1 at the centre, 0 with zero slope at t = 1. */
function bump(t: number): number {
  if (t >= 1) return 0;
  const s = 1 - t * t;
  return s * s;
}

/** Sum every height deformer at (x, y), soft-clamped so overlapping forms
 *  compose into one surface instead of blowing past the relief scale. */
export function sampleHeight(scene: WarpScene, x: number, y: number): number {
  let sum = 0;
  for (const d of scene.heights) {
    if (d.kind === 'dome') {
      const t = Math.hypot(x - d.cx, y - d.cy) / d.r;
      sum += d.h * bump(t);
    } else if (d.kind === 'ridge') {
      const dx = x - d.cx;
      const dy = y - d.cy;
      const u = dx * d.mx + dy * d.my;
      const w = -dx * d.my + dy * d.mx;
      const envelope = d.sigma === Infinity ? 1 : Math.exp(-((w / d.sigma) * (w / d.sigma)));
      sum += d.h * Math.sin((2 * Math.PI * u) / d.wavelength + d.phase) * envelope;
    } else {
      sum += d.h * scene.noise.noise2D(x / d.scale + d.ox, y / d.scale + d.oy);
    }
  }
  return Math.tanh(sum);
}

/** Radial magnify (k > 0) / pinch (k < 0) inside radius r; identity outside.
 *  |k| stays well under 1 upstream so the map never folds. */
function applyLens(x: number, y: number, d: Extract<DomainDeformer, { kind: 'lens' }>): Point {
  const dist = Math.hypot(x - d.cx, y - d.cy);
  const s = 1 + d.k * bump(dist / d.r);
  return { x: d.cx + (x - d.cx) * s, y: d.cy + (y - d.cy) * s };
}

/** Run the domain maps in placement order, each damped toward identity by
 *  the caller's edge-calm envelope at the incoming point. */
export function applyDomain(scene: WarpScene, x: number, y: number, envelope: number): Point {
  let p = { x, y };
  if (envelope <= 0) return p;
  for (const d of scene.domains) {
    const q = d.kind === 'vortex' ? applyVortex(p.x, p.y, d) : applyLens(p.x, p.y, d);
    p = envelope >= 1 ? q : { x: p.x + (q.x - p.x) * envelope, y: p.y + (q.y - p.y) * envelope };
  }
  return p;
}

export interface PlaceParams {
  kinds: WarpDeformerKind[];
  count: number;
  /** Per-deformer strength 0..1 (jittered ±30% per instance) */
  strength: number;
  /** Deformer radius in px (jittered 0.6..1.4× per instance) */
  radius: number;
  /** Probability a signed deformer flips (crater / pinch / counter-twist) */
  flip: number;
  wavelength: number;
  /** Noise feature size in px */
  noiseScale: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Scatter the hidden forms: centres rejection-sampled with breathing room
 * (bounded tries, so pathological rects still terminate), radii and
 * strengths jittered per instance, signs flipped per the preset's taste.
 */
export function placeDeformers(
  rng: () => number,
  noise: SimplexNoise,
  p: PlaceParams
): WarpScene {
  const scene: WarpScene = { heights: [], domains: [], noise };
  if (p.count <= 0 || p.kinds.length === 0) return scene;
  const innerW = p.x1 - p.x0;
  const innerH = p.y1 - p.y0;
  const minDim = Math.min(innerW, innerH);
  const pad = minDim * 0.12;
  const minSep = minDim * 0.35;
  const centres: Point[] = [];
  for (let tries = 0; centres.length < p.count && tries < 200; tries++) {
    const cx = p.x0 + pad + rng() * Math.max(1, innerW - pad * 2);
    const cy = p.y0 + pad + rng() * Math.max(1, innerH - pad * 2);
    if (centres.every((c) => Math.hypot(c.x - cx, c.y - cy) > minSep)) {
      centres.push({ x: cx, y: cy });
    }
  }

  for (const c of centres) {
    const kind = p.kinds[Math.floor(rng() * p.kinds.length)];
    const r = p.radius * (0.6 + rng() * 0.8);
    const strength = p.strength * (0.7 + rng() * 0.6);
    const sign = rng() < p.flip ? -1 : 1;
    if (kind === 'dome') {
      scene.heights.push({ kind, cx: c.x, cy: c.y, r, h: sign * strength * 1.15 });
    } else if (kind === 'ridge') {
      const a = rng() * Math.PI;
      scene.heights.push({
        kind,
        cx: c.x,
        cy: c.y,
        mx: Math.cos(a),
        my: Math.sin(a),
        wavelength: p.wavelength * (0.75 + rng() * 0.5),
        phase: rng() * Math.PI * 2,
        sigma: r * 1.6,
        h: strength * 0.8,
      });
    } else if (kind === 'noise') {
      scene.heights.push({
        kind,
        scale: p.noiseScale * (0.8 + rng() * 0.4),
        ox: rng() * 100,
        oy: rng() * 100,
        h: strength * 0.9,
      });
    } else if (kind === 'vortex') {
      // Tight λ keeps the twist a local knot in the grating — a page-sized λ
      // would rotate the whole sheet instead.
      scene.domains.push({ kind, cx: c.x, cy: c.y, z: sign * strength * 3, lambda: r * 0.55 });
    } else {
      // Lens folds if |k| reaches 1 at the centre — cap well under.
      scene.domains.push({ kind, cx: c.x, cy: c.y, r, k: sign * Math.min(0.7, strength * 0.65) });
    }
  }
  return scene;
}
