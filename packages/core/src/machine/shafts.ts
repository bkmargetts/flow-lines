import type { Point } from '../flow-lines.js';
import type { MachineCtx } from './context.js';
import type { Bearing } from './types.js';

/**
 * Shaft mountings — every wheel hangs on something. A bearing is a double-line
 * pedestal (or bracket arm, when a post is nearer than the ground) from just
 * behind the hub to the frame member, with a small block capped around the
 * axle. Drawn at frame depth so the wheel occludes it: the support peeks out
 * from behind the wheel, which is exactly how the old machine plates read.
 */
export function renderBearing(ctx: MachineCtx, b: Bearing): Point[][] {
  const { lines } = ctx;
  const dir: Point =
    b.dir === 'down' ? { x: 0, y: 1 } : b.dir === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 };
  const px = -dir.y;
  const py = dir.x;
  const half = b.hubR * 0.6;
  const start = b.hubR * 0.4;

  // The support arm: two parallels from behind the hub to the frame member.
  for (const s of [1, -1]) {
    lines.push({
      points: [
        { x: b.x + dir.x * start + px * half * s, y: b.y + dir.y * start + py * half * s },
        { x: b.x + dir.x * b.len + px * half * s, y: b.y + dir.y * b.len + py * half * s },
      ],
      layer: 'frame',
    });
  }

  // Bearing block: a square around the axle, corners softened by the wobble.
  const bw = b.hubR * 1.5;
  const block: Point[] = [
    { x: b.x - bw, y: b.y - bw },
    { x: b.x + bw, y: b.y - bw },
    { x: b.x + bw, y: b.y + bw },
    { x: b.x - bw, y: b.y + bw },
    { x: b.x - bw, y: b.y - bw },
  ];
  lines.push({ points: block, layer: 'frame' });

  // Silhouette: the arm rectangle (the block hides behind the wheel hub).
  const sil: Point[] = [
    { x: b.x + dir.x * start + px * half, y: b.y + dir.y * start + py * half },
    { x: b.x + dir.x * b.len + px * half, y: b.y + dir.y * b.len + py * half },
    { x: b.x + dir.x * b.len - px * half, y: b.y + dir.y * b.len - py * half },
    { x: b.x + dir.x * start - px * half, y: b.y + dir.y * start - py * half },
  ];
  return [sil];
}
