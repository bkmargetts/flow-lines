import type { Point } from '../flow-lines.js';
import { circle, dot } from './geometry.js';
import type { CodexCtx } from './context.js';
import type { Linkage, Machine } from './types.js';

/**
 * Crank + connecting rod + rocker, drawn in a frozen pose the solver made
 * consistent. Double-line bars with pin circles at every joint, and a little
 * pedestal standard carrying the rocker pivot down to the sill.
 */

/** Double-line bar between two joints; returns its quad for the silhouette. */
function bar(
  ctx: CodexCtx,
  a: Point,
  b: Point,
  halfA: number,
  halfB: number,
  inset: number
): Point[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const a0 = { x: a.x + ux * inset, y: a.y + uy * inset };
  const b0 = { x: b.x - ux * inset, y: b.y - uy * inset };
  const quad: Point[] = [
    { x: a0.x + px * halfA, y: a0.y + py * halfA },
    { x: b0.x + px * halfB, y: b0.y + py * halfB },
    { x: b0.x - px * halfB, y: b0.y - py * halfB },
    { x: a0.x - px * halfA, y: a0.y - py * halfA },
  ];
  ctx.lines.push({ points: [...quad, { x: quad[0].x, y: quad[0].y }], layer: 'part' });
  return quad;
}

export function renderLinkage(ctx: CodexCtx, machine: Machine, link: Linkage): Point[][] {
  const { lines } = ctx;
  const m = machine.module;
  const silhouettes: Point[][] = [];

  // Crank pin boss on the wheel face.
  lines.push({ points: circle(link.pin.x, link.pin.y, m * 0.72), layer: 'part' });
  lines.push({ points: dot(link.pin.x, link.pin.y, m * 0.26), layer: 'part' });

  // Connecting rod and rocker (rocker tapers toward the joint).
  silhouettes.push(bar(ctx, link.pin, link.joint, m * 0.38, m * 0.38, m * 0.5));
  silhouettes.push(bar(ctx, link.pivot, link.joint, m * 0.5, m * 0.3, m * 0.4));

  // Joint pin.
  lines.push({ points: circle(link.joint.x, link.joint.y, m * 0.5), layer: 'part' });
  lines.push({ points: dot(link.joint.x, link.joint.y, m * 0.2), layer: 'part' });

  // Pivot standard: a block on a pedestal down to the sill.
  const ground = machine.frame.find((b) => b.kind === 'ground');
  lines.push({ points: circle(link.pivot.x, link.pivot.y, m * 0.55), layer: 'part' });
  lines.push({ points: dot(link.pivot.x, link.pivot.y, m * 0.2), layer: 'part' });
  if (ground) {
    const gy = ground.a.y - ground.w / 2;
    if (gy > link.pivot.y + m) {
      const half = m * 0.55;
      const top = link.pivot.y + m * 0.4;
      for (const s of [1, -1]) {
        lines.push({
          points: [
            { x: link.pivot.x + half * s, y: top },
            { x: link.pivot.x + half * s, y: gy },
          ],
          layer: 'frame',
        });
      }
      // Flared foot.
      lines.push({
        points: [
          { x: link.pivot.x - half * 1.8, y: gy },
          { x: link.pivot.x - half, y: gy - m * 0.7 },
        ],
        layer: 'frame',
      });
      lines.push({
        points: [
          { x: link.pivot.x + half * 1.8, y: gy },
          { x: link.pivot.x + half, y: gy - m * 0.7 },
        ],
        layer: 'frame',
      });
    }
  }

  return silhouettes;
}
