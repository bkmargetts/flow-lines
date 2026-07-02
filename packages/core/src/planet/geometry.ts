import { FlowLine, Point } from '../flow-lines.js';
import { TAU } from './vec3.js';

/** Append `pts` as a FlowLine if it has enough points to draw. */
export function pushRun(out: FlowLine[], pts: Point[], layer: string, pen?: 'fine' | 'bold'): void {
  if (pts.length >= 2) out.push({ points: pts, layer, ...(pen ? { pen } : {}) });
}

/** A small closed dot polygon. */
export function dot4(x: number, y: number, r: number): Point[] {
  return ellipse(x, y, r, r, 0, 0, TAU);
}

/** Ellipse (or arc) polyline. */
export function ellipse(
  x: number,
  y: number,
  a: number,
  bb: number,
  rot: number,
  start: number,
  end: number
): Point[] {
  const span = end - start;
  const n = Math.max(10, Math.ceil((Math.abs(span) / TAU) * 48));
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = start + (i / n) * span;
    const lx = Math.cos(t) * a;
    const ly = Math.sin(t) * bb;
    pts.push({ x: x + lx * cr - ly * sr, y: y + lx * sr + ly * cr });
  }
  return pts;
}
