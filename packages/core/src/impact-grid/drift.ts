import type { Point } from '../flow-lines.js';
import { clamp01 } from '../lib/math.js';
import { smoothstep } from '../lib/spatial.js';
import { createNoise } from '../noise.js';
import type { PathField } from './impact.js';

/** One sample of the pane-wide displacement field. */
export interface DriftSample {
  dx: number;
  dy: number;
  /** Field strength 0..1 at this point — rotation/alignment scale from it. */
  f: number;
  /** Path tangent (unit, direction of travel) at the nearest point. */
  tx: number;
  ty: number;
  /** Which side of the path this point sits on (±1). */
  side: number;
}

export interface DriftField {
  at(x: number, y: number): DriftSample;
  /** Beyond this distance from the path, at() is exactly zero. */
  range: number;
}

const ZERO: DriftSample = { dx: 0, dy: 0, f: 0, tx: 1, ty: 0, side: 1 };

/**
 * The smooth displacement the stroke drags through the pane: material is
 * advected predominantly ALONG the direction of travel (laminar drifts —
 * neighbouring cells move together, the way whole neighbourhoods shear off
 * in the reference plates) plus a lateral push that parts the material away
 * from the channel. Coherence comes from one low-frequency noise shared by
 * every query — never per-cell randomness — so the motion reads as flow,
 * not confetti. Intact cells, cracked facets, and shards all ride the same
 * field; shards add their own ballistic scatter on top.
 */
export function makeDrift(
  field: PathField,
  radius: number,
  o: { drift: number; energy: number; seed: number }
): DriftField {
  const range = radius * (0.85 + 0.75 * o.drift);
  const noise = createNoise(o.seed);
  const k = 1.4 / range;
  const at = (x: number, y: number): DriftSample => {
    const hit = field.nearest(x, y);
    if (hit.d >= range) return ZERO;
    // Cubic falloff: the drag concentrates hard on the channel so the far
    // field keeps its pristine order — the reference panes stand still at
    // their ends.
    const g = smoothstep(clamp01(1 - hit.d / range));
    const f = g * g * g;
    // Laminar variation: broad patches travel farther than their
    // neighbours, but the gradient is gentle — coherent, not scattered.
    const coh = 0.55 + 0.45 * clamp01(0.5 + 0.5 * noise.fbm(x * k, y * k, 2, 0.5, 2));
    const speed = 0.35 + 0.65 * hit.speed;
    const advect = o.drift * radius * (0.5 + 0.85 * o.energy) * f * coh * speed;
    const lateral = o.drift * radius * 0.22 * f * g;
    return {
      dx: advect * hit.tx + lateral * hit.side * -hit.ty,
      dy: advect * hit.ty + lateral * hit.side * hit.tx,
      f,
      tx: hit.tx,
      ty: hit.ty,
      side: hit.side,
    };
  };
  return { at, range };
}

/** The best rigid motion (translation + rotation) fitting the field over a
 *  ring, plus how badly the field wanted to deviate from it. */
export interface RigidFit {
  /** Rest centroid. */
  cx: number;
  cy: number;
  /** Translation of the centroid. */
  dx: number;
  dy: number;
  cos: number;
  sin: number;
  /** Worst vertex misfit, px — how much the field disagreed with rigidity. */
  residual: number;
  /** Mean field strength over the vertices, 0..1. */
  f: number;
}

/** Map one point through a rigid fit. */
export function applyRigid(fit: RigidFit, p: Point): Point {
  const lx = p.x - fit.cx;
  const ly = p.y - fit.cy;
  return {
    x: fit.cx + fit.dx + lx * fit.cos - ly * fit.sin,
    y: fit.cy + fit.dy + lx * fit.sin + ly * fit.cos,
  };
}

/**
 * Fit the least-squares RIGID motion (2D Kabsch: mean translation, rotation
 * from the cross/dot sums of centred pairs) of the drift field sampled at a
 * ring's vertices. Glass never bends: a plate rides the field with this
 * transform — translating and rotating with the flow's shear, every edge
 * dead straight — and the `residual` tells the caller how hard the field
 * wanted to deform it, i.e. when the plate must FRACTURE instead.
 * Returns null when the field is dead across the ring.
 */
export function rigidFit(ring: Point[], drift: DriftField): RigidFit | null {
  const n = ring.length - 1;
  if (n < 3) return null;
  const ux: number[] = [];
  const uy: number[] = [];
  let f = 0;
  let any = false;
  for (let i = 0; i < n; i++) {
    const u = drift.at(ring[i].x, ring[i].y);
    ux.push(u.dx);
    uy.push(u.dy);
    f += u.f;
    if (u.f > 0) any = true;
  }
  if (!any) return null;
  f /= n;
  let cx = 0;
  let cy = 0;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    cx += ring[i].x;
    cy += ring[i].y;
    mx += ux[i];
    my += uy[i];
  }
  cx /= n;
  cy /= n;
  mx /= n;
  my /= n;
  let sCross = 0;
  let sDot = 0;
  for (let i = 0; i < n; i++) {
    const px = ring[i].x - cx;
    const py = ring[i].y - cy;
    const qx = px + ux[i] - mx;
    const qy = py + uy[i] - my;
    sCross += px * qy - py * qx;
    sDot += px * qx + py * qy;
  }
  const theta = Math.atan2(sCross, sDot);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  let residual = 0;
  for (let i = 0; i < n; i++) {
    const px = ring[i].x - cx;
    const py = ring[i].y - cy;
    const rx = cx + mx + px * cos - py * sin - (ring[i].x + ux[i]);
    const ry = cy + my + px * sin + py * cos - (ring[i].y + uy[i]);
    const r = Math.hypot(rx, ry);
    if (r > residual) residual = r;
  }
  return { cx, cy, dx: mx, dy: my, cos, sin, residual, f };
}
