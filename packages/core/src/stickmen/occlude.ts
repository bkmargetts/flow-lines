import type { Point } from '../flow-lines.js';
import { ZBuffer, densify } from '../vines/spatial.js';
import type { FigureBuild } from './figure.js';

/**
 * Scene hidden-line removal. Every figure stamps its ink into one shared
 * depth buffer at its ground depth (limb strokes as thin bands, the head as a
 * solid disc). A farther figure's lines are then cut wherever a nearer
 * figure's ink covers them — the "interrupt at crossings" look, so a foreground
 * arm cleanly breaks the wire of the man behind it. A figure never occludes
 * itself: its own marks share its depth, and `hidden` needs something strictly
 * nearer.
 */

export function stampScene(zbuf: ZBuffer, builds: FigureBuild[], bandR: number): void {
  for (const b of builds) {
    for (const occ of b.occluders) {
      if (occ.solid) zbuf.fill(occ.poly, b.depth);
      else zbuf.stampOutline(occ.poly, b.depth, bandR);
    }
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
