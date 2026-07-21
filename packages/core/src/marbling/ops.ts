import type { Point } from '../flow-lines.js';

/**
 * Closed-form marbling deformations (Jaffer / Lu et al., "Mathematical
 * Marbling"). Each op is an exact plane map applied to every live point, so
 * rings stay clean polylines through any number of operations — no fluid
 * simulation, no grid, fully deterministic.
 *
 * - `drop`: dropping a circle of ink at c pushes every point p radially
 *   outward to conserve area: p' = c + (p−c)·√(1 + r²/|p−c|²).
 * - `tine`: a rake tooth along direction m through b displaces points
 *   parallel to m by z·λ/(d+λ), d = distance from the tooth line. With
 *   `spacing` set the op is a whole comb: d is measured to the nearest
 *   tooth of a parallel family (one op per pass instead of one per tooth),
 *   `alternate` flips the pull direction on odd teeth (chevron/feather),
 *   and the wavy fields modulate strength along the tooth (bouquet).
 * - `vortex`: a localized swirl about c; twist falls off as (λ/(d+λ))² so
 *   the arc displacement (≈ d·θ) decays to zero far away — the linear
 *   falloff used for tines would swirl the whole bath.
 */
export type MarblingOp =
  | { kind: 'drop'; cx: number; cy: number; r: number }
  | {
      kind: 'tine';
      bx: number;
      by: number;
      /** Unit direction of the pull */
      mx: number;
      my: number;
      /** Peak displacement in px */
      z: number;
      /** Falloff distance λ in px */
      lambda: number;
      /** Comb period across the pull direction; single tooth when unset */
      spacing?: number;
      /** Chevron: pull direction reverses smoothly from tooth to tooth */
      alternate?: boolean;
      /**
       * Mean of the falloff profile over one comb period. Subtracting it
       * balances the pass — teeth drag ink forward, the bands between
       * drift back (the bath's return flow) — so a comb shears the pattern
       * instead of translating the whole bath off the sheet.
       */
      balance?: number;
      /** Wavy comb: strength modulation amplitude 0..1 along the tooth */
      wavyAmp?: number;
      /** Wavy comb: modulation period along the tooth in px */
      wavyPeriod?: number;
      wavyPhase?: number;
    }
  | { kind: 'vortex'; cx: number; cy: number; z: number; lambda: number };

/** Exact ink-drop displacement. A point sitting on the centre is placed on
 *  the drop's rim (any direction is as wrong as any other; +x keeps it
 *  deterministic). */
export function applyDrop(x: number, y: number, op: { cx: number; cy: number; r: number }): Point {
  const dx = x - op.cx;
  const dy = y - op.cy;
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-12) return { x: op.cx + op.r, y: op.cy };
  const s = Math.sqrt(1 + (op.r * op.r) / d2);
  return { x: op.cx + dx * s, y: op.cy + dy * s };
}

export function applyTine(
  x: number,
  y: number,
  op: Extract<MarblingOp, { kind: 'tine' }>
): Point {
  const nx = -op.my;
  const ny = op.mx;
  const px = x - op.bx;
  const py = y - op.by;
  // Signed distance across the pull direction; fold onto the nearest tooth
  // when the op is a whole comb.
  let off = px * nx + py * ny;
  let sign = 1;
  if (op.spacing && op.spacing > 0) {
    // Chevron alternation is a smooth cosine across the period, not a hard
    // per-tooth sign flip — a flip is a discontinuity in the map, and
    // segments straddling it stretch into long straight streaks.
    if (op.alternate) sign = Math.cos((Math.PI * off) / op.spacing);
    off -= Math.round(off / op.spacing) * op.spacing;
  }
  const d = Math.abs(off);
  let z = op.z * sign;
  if (op.wavyAmp && op.wavyPeriod) {
    const u = px * op.mx + py * op.my;
    z *= 1 + op.wavyAmp * Math.sin((2 * Math.PI * u) / op.wavyPeriod + (op.wavyPhase ?? 0));
  }
  const disp = z * (op.lambda / (d + op.lambda) - (op.balance ?? 0));
  return { x: x + op.mx * disp, y: y + op.my * disp };
}

export function applyVortex(
  x: number,
  y: number,
  op: { cx: number; cy: number; z: number; lambda: number }
): Point {
  const dx = x - op.cx;
  const dy = y - op.cy;
  const d = Math.hypot(dx, dy);
  const f = op.lambda / (d + op.lambda);
  const theta = op.z * f * f;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return { x: op.cx + dx * cos - dy * sin, y: op.cy + dx * sin + dy * cos };
}

export function applyOp(x: number, y: number, op: MarblingOp): Point {
  switch (op.kind) {
    case 'drop':
      return applyDrop(x, y, op);
    case 'tine':
      return applyTine(x, y, op);
    case 'vortex':
      return applyVortex(x, y, op);
  }
}

/**
 * Distance beyond which an op moves a point by less than `minDispPx` —
 * rings whose bbox sits entirely farther away can skip the op unchanged.
 * Combs (spacing set) repeat across the whole sheet and single tines reach
 * far (z·λ/(d+λ) decays slowly at rake strength), so only drops and
 * vortices yield a useful finite radius.
 */
export function opInfluenceRadius(op: MarblingOp, minDispPx: number): number {
  if (op.kind === 'drop') {
    // Far-field drop displacement ≈ r²/(2d).
    return (op.r * op.r) / (2 * minDispPx);
  }
  if (op.kind === 'vortex') {
    // Far-field arc displacement ≈ d·z·(λ/d)² = z·λ²/d.
    return (op.z * op.lambda * op.lambda) / minDispPx;
  }
  if (op.spacing && op.spacing > 0) return Infinity;
  return op.z <= minDispPx ? 0 : op.lambda * (op.z / minDispPx - 1);
}
