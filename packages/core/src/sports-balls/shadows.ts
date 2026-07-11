import type { FlowLine } from '../flow-lines.js';
import { ellipse } from '../planet/geometry.js';
import { clamp } from '../lib/math.js';
import type { BallSpec } from './layout.js';

const TAU = Math.PI * 2;

const wrapPi = (a: number): number => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};

export interface CastShadowOpts {
  castShadows: number; // 0..1 crescent width
  lightAngle: number; // radians, page-space
  penWidth: number;
}

/**
 * Contact shadows at overlaps: where a nearer ball crosses a farther one, the
 * farther ball is hatched with a tapered crescent of arcs hugging the nearer
 * ball's silhouette, on the side away from the light — arcs concentric with
 * the CASTER, the classic ink drop-shadow, so the pile reads as stacked
 * spheres instead of overlapping circles. The strokes belong to the receiving
 * ball (`specs[index]`) and ride its depth through occlusion, so a third,
 * still-nearer ball cuts them like any of the receiver's own ink.
 *
 * `specs` is depth-sorted back-to-front, so every candidate caster sits at
 * `index+1…`; ties within the occlusion threshold are skipped — if neither
 * ball hides the other, a shadow would contradict the drawing.
 */
export function castShadowStrokes(
  specs: BallSpec[],
  index: number,
  o: CastShadowOpts
): FlowLine[] {
  const out: FlowLine[] = [];
  const amount = clamp(o.castShadows, 0, 1);
  if (amount <= 0) return out;
  const b = specs[index];
  const spacing = Math.max(2.2, o.penWidth * 2);
  const inflate = Math.max(0.6, o.penWidth * 0.75); // clear the caster's occluder band
  const away = o.lightAngle + Math.PI;
  const rIn = b.r - Math.max(1, o.penWidth); // stay inside the receiver's outline

  for (let j = index + 1; j < specs.length; j++) {
    const a = specs[j];
    if (a.depth <= b.depth + 0.5) continue; // occlusion tie — neither is in front
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d >= a.r + rIn || d < 1e-6) continue; // no visible crossing
    const band = amount * 0.45 * Math.min(a.r, b.r);
    const rings = Math.max(1, Math.round(band / spacing));
    const psi = Math.atan2(dy, dx); // caster → receiver direction

    for (let k = 0; k < rings; k++) {
      const arcR = a.r + inflate + spacing * (k + 0.7);
      // Angles about the caster where this arc lies on the receiver's disc:
      // |cA + arcR·(cos φ, sin φ) − cB| ≤ rIn  ⇔  cos(φ − ψ) ≥ q.
      const q = (arcR * arcR + d * d - rIn * rIn) / (2 * arcR * d);
      if (q >= 1) continue; // arc clears the receiver entirely
      const alpha = q <= -1 ? Math.PI : Math.acos(q);
      // Outer rings fan narrower (the crescent taper), and only away from
      // the light — an overlap on the lit side casts no visible shadow.
      const theta = 1.9 * Math.sqrt(1 - k / (rings + 0.5));
      const off = wrapPi(away - psi);
      const lo = Math.max(-alpha, off - theta);
      const hi = Math.min(alpha, off + theta);
      if (hi - lo < 0.05) continue;
      out.push({
        points: ellipse(a.x, a.y, arcR, arcR, 0, psi + lo, psi + hi),
        pen: 'fine',
        layer: 'shading',
      });
    }
  }
  return out;
}
