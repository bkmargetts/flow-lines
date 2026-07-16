import type { Point } from '../flow-lines.js';
import { pointInPolygon } from '../lib/polyline.js';
import { arc, circle, radialOffset } from './geometry.js';
import type { MachineCtx } from './context.js';
import type { Drum, Machine, Rope, Spring, Weight } from './types.js';

/**
 * The drive: a rope drum, twisted rope, hanging stone weight (the clock-drive
 * motif), or a coil spring back to the frame. Rope is two parallels with
 * twist ticks; the weight carries 45° tone hatch clipped to its silhouette.
 */

export function renderDrum(ctx: MachineCtx, machine: Machine, d: Drum): Point[][] {
  const { lines } = ctx;
  const outer = circle(d.cx, d.cy, d.r);
  lines.push({ points: outer, layer: 'part' });
  lines.push({ points: circle(d.cx, d.cy, d.r * 0.86), layer: 'part' });
  // A couple of wound-rope grooves on the upper half.
  lines.push({ points: arc(d.cx, d.cy, d.r * 0.93, Math.PI * 1.15, Math.PI * 1.85), layer: 'part' });
  lines.push({ points: arc(d.cx, d.cy, d.r * 0.9, Math.PI * 1.2, Math.PI * 1.8), layer: 'part' });
  return [outer];
}

export function renderRope(ctx: MachineCtx, machine: Machine, rope: Rope): Point[][] {
  const { lines } = ctx;
  const m = machine.module;
  const drum = machine.drums.find((d) => d.id === rope.drumId);
  const half = m * 0.16;

  // Wrap over the drum's top from the tangent point.
  if (drum && rope.path.length > 0) {
    const t0 = rope.path[0];
    const side = t0.x >= drum.cx ? 1 : -1;
    const start = side > 0 ? 0 : Math.PI;
    const end = side > 0 ? -Math.PI : Math.PI * 2;
    for (const rr of [drum.r - half, drum.r + half]) {
      lines.push({ points: arc(drum.cx, drum.cy, rr, start, end), layer: 'part' });
    }
  }

  // The drop: two parallels plus twist ticks.
  for (let i = 0; i < rope.path.length - 1; i++) {
    const a = rope.path[i];
    const b = rope.path[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    for (const s of [1, -1]) {
      lines.push({
        points: [
          { x: a.x + px * half * s, y: a.y + py * half * s },
          { x: b.x + px * half * s, y: b.y + py * half * s },
        ],
        layer: 'part',
      });
    }
    const step = m * 1.15;
    for (let t = step; t < len - step * 0.4; t += step) {
      lines.push({
        points: [
          { x: a.x + ux * (t - half * 1.4) + px * half, y: a.y + uy * (t - half * 1.4) + py * half },
          { x: a.x + ux * (t + half * 1.4) - px * half, y: a.y + uy * (t + half * 1.4) - py * half },
        ],
        layer: 'part',
      });
    }
  }
  return [];
}

export function renderWeight(ctx: MachineCtx, machine: Machine, w: Weight): Point[][] {
  const { o, lines } = ctx;
  const m = machine.module;
  const ringR = m * 0.5;

  // Hanging ring, then the trapezoid stone below it.
  lines.push({ points: circle(w.x, w.y + ringR, ringR), layer: 'part' });
  const top = w.y + ringR * 2;
  const poly: Point[] = [
    { x: w.x - w.w * 0.36, y: top },
    { x: w.x + w.w * 0.36, y: top },
    { x: w.x + w.w * 0.5, y: top + w.h },
    { x: w.x - w.w * 0.5, y: top + w.h },
  ];
  const closed = [...poly, { x: poly[0].x, y: poly[0].y }];
  lines.push({ points: closed, layer: 'part' });
  const cx = w.x;
  const cy = top + w.h * 0.55;
  lines.push({ points: radialOffset(closed, cx, cy, -o.penWidth * 0.5), layer: 'part2' });

  // 45° tone hatch clipped to the stone.
  if (o.shading > 0.05) {
    const step = Math.max(1.8, o.hatchSpacing) / Math.max(0.4, o.shading);
    const reach = Math.hypot(w.w, w.h);
    const ux = Math.SQRT1_2;
    const uy = Math.SQRT1_2;
    const px = -uy;
    const py = ux;
    for (let s = -reach; s < reach; s += step) {
      let run: Point[] = [];
      for (let t = -reach; t <= reach; t += 1.4) {
        const x = cx + px * s + ux * t;
        const y = cy + py * s + uy * t;
        if (pointInPolygon(poly, x, y)) {
          run.push({ x, y });
        } else if (run.length >= 2) {
          lines.push({ points: run, layer: 'hatch' });
          run = [];
        } else {
          run = [];
        }
      }
      if (run.length >= 2) lines.push({ points: run, layer: 'hatch' });
    }
  }
  return [poly];
}

export function renderSpring(ctx: MachineCtx, machine: Machine, s: Spring): Point[][] {
  const { lines } = ctx;
  const m = machine.module;
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  // Straight hook ends, flattened-sine coils between.
  const hook = Math.min(len * 0.14, m * 2);
  const coilLen = len - 2 * hook;
  const pts: Point[] = [{ x: s.a.x, y: s.a.y }];
  const steps = Math.max(24, Math.round(coilLen / 2.5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const along = hook + coilLen * t;
    const wave = Math.sin(t * s.coils * Math.PI * 2) * s.r;
    pts.push({ x: s.a.x + ux * along + px * wave, y: s.a.y + uy * along + py * wave });
  }
  pts.push({ x: s.b.x, y: s.b.y });
  lines.push({ points: pts, layer: 'part' });

  // Anchor block at the sill end.
  const bw = m * 0.7;
  lines.push({
    points: [
      { x: s.b.x - bw, y: s.b.y - bw },
      { x: s.b.x + bw, y: s.b.y - bw },
      { x: s.b.x + bw, y: s.b.y + bw },
      { x: s.b.x - bw, y: s.b.y + bw },
      { x: s.b.x - bw, y: s.b.y - bw },
    ],
    layer: 'frame',
  });
  return [];
}
