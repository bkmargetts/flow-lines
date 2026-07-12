import type { Point } from '../flow-lines.js';
import { ZBuffer, densify } from '../lib/spatial.js';
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

/** The ZBuffer covers [0,w]×[0,h], but the crowd overflows the page, so we
 *  translate every point by (offX, offY) into buffer space — the buffer is
 *  sized to the whole crowd so off-page heads occlude too. */
export interface ZOffset {
  offX: number;
  offY: number;
}

export function stampScene(zbuf: ZBuffer, builds: FigureBuild[], off: ZOffset): void {
  for (const b of builds) {
    for (const occ of b.occluders) {
      zbuf.fill(occ.poly.map((p) => ({ x: p.x + off.offX, y: p.y + off.offY })), b.depth);
    }
  }
}

/** Split a polyline into the runs that survive occlusion at `depth`. Points are
 *  queried in buffer space (via `off`) but returned in their original space. */
export function splitVisible(points: Point[], depth: number, zbuf: ZBuffer, step: number, off: ZOffset): Point[][] {
  const dense = densify(points, step);
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (const p of dense) {
    if (zbuf.hidden(p.x + off.offX, p.y + off.offY, depth)) {
      if (run.length >= 2) runs.push(run);
      run = [];
    } else {
      run.push(p);
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}
