import type { Point } from '../flow-lines.js';
import { ZBuffer, densify } from '../vines/spatial.js';
import type { FigureBuild } from './figure.js';

/**
 * Scene hidden-line removal — heads only. Every figure fills its head disc
 * into one shared depth buffer at its ground depth; a farther figure's lines
 * are then cut wherever a nearer figure's head covers them, so a limb never
 * appears to pass through a nearer head. Limbs do NOT occlude each other —
 * stamping every limb broke lines far too aggressively. A figure never
 * occludes itself: its head shares its depth and `hidden` needs something
 * strictly nearer.
 */

export function stampScene(zbuf: ZBuffer, builds: FigureBuild[]): void {
  for (const b of builds) {
    for (const occ of b.occluders) zbuf.fill(occ.poly, b.depth);
  }
}

/** Split a polyline into the runs that survive occlusion at `depth`. */
export function splitVisible(points: Point[], depth: number, zbuf: ZBuffer, step: number): Point[][] {
  const dense = densify(points, step);
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (const p of dense) {
    if (zbuf.hidden(p.x, p.y, depth)) {
      if (run.length >= 2) runs.push(run);
      run = [];
    } else {
      run.push(p);
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}
