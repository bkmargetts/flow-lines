import type { Point } from '../flow-lines.js';
import { TAU, arc, circle, commonTangents } from './geometry.js';
import type { CodexCtx } from './context.js';
import type { Belt, Machine, Pulley } from './types.js';

/**
 * Belts and pulleys. The straight runs are true common tangents (external,
 * or internal for the crossed figure-eight) and the wrap arcs hug each
 * pulley on its away side — anything less exact reads as clip-art. Belts are
 * drawn as single-line runs with little cross ticks (leather lacing).
 */

export function renderPulley(ctx: CodexCtx, p: Pulley, standalone: boolean): Point[][] {
  const { lines } = ctx;
  const m = Math.max(2, p.r * 0.22);
  const outer = circle(p.cx, p.cy, p.r);
  lines.push({ points: outer, layer: 'part' });
  lines.push({ points: circle(p.cx, p.cy, p.r * 0.8), layer: 'part' });
  if (standalone) {
    lines.push({ points: circle(p.cx, p.cy, m * 0.9), layer: 'part' });
    lines.push({ points: circle(p.cx, p.cy, m * 0.42), layer: 'part' });
  }
  return [outer];
}

/** The arc between two tangent angles that passes through `through`. */
function wrapArc(cx: number, cy: number, r: number, a0: number, a1: number, through: number): Point[] {
  const norm = (a: number): number => ((a % TAU) + TAU) % TAU;
  const s0 = norm(a0);
  let s1 = norm(a1);
  if (s1 < s0) s1 += TAU;
  let t = norm(through);
  if (t < s0) t += TAU;
  if (t <= s1) return arc(cx, cy, r, s0, s1);
  return arc(cx, cy, r, s1, s0 + TAU);
}

export function renderBelt(ctx: CodexCtx, machine: Machine, belt: Belt): Point[][] {
  const { lines } = ctx;
  const A = machine.pulleys.find((p) => p.id === belt.a);
  const B = machine.pulleys.find((p) => p.id === belt.b);
  if (!A || !B) return [];
  const tang = commonTangents(
    { cx: A.cx, cy: A.cy, r: A.r },
    { cx: B.cx, cy: B.cy, r: B.r },
    belt.crossed
  );
  if (!tang) return [];
  const base = Math.atan2(B.cy - A.cy, B.cx - A.cx);
  const m = machine.module;

  // Straight runs with lacing ticks.
  for (const [p1, p2] of tang.segs) {
    lines.push({ points: [p1, p2], layer: 'part' });
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const tickStep = m * 2.4;
    const tick = m * 0.22;
    for (let s = tickStep; s < len - tickStep * 0.5; s += tickStep) {
      lines.push({
        points: [
          { x: p1.x + ux * s + px * tick, y: p1.y + uy * s + py * tick },
          { x: p1.x + ux * s - px * tick, y: p1.y + uy * s - py * tick },
        ],
        layer: 'part',
      });
    }
  }

  // Wrap arcs on each pulley's away side.
  // As seen from A the belt bulges away from B (through base+π); from B it
  // bulges away from A (through base) — for the crossed belt too.
  lines.push({ points: wrapArc(A.cx, A.cy, A.r, tang.angA[0], tang.angA[1], base + Math.PI), layer: 'part' });
  lines.push({ points: wrapArc(B.cx, B.cy, B.r, tang.angB[0], tang.angB[1], base), layer: 'part' });
  return [];
}
