import type { FlowLine, Point } from '../flow-lines.js';
import { ZBuffer, densify } from '../lib/spatial.js';
import { dashPolyline } from './geometry.js';
import { Z_BAND_STRIDE } from './synth.js';
import type { MachineCtx } from './context.js';
import type { Machine } from './types.js';

/** One part's rendered lines plus the silhouette polygons that hide whatever
 *  sits behind it. */
export interface PartRender {
  z: number;
  lines: FlowLine[];
  silhouettes: Point[][];
}

/**
 * Depth-ordered composition: every silhouette is rasterised into a ZBuffer
 * (front wins), then each part's lines are broken where a nearer part covers
 * them. Meshing teeth survive naturally — the silhouette is the actual tooth
 * polygon, and aligned phases put the other gear's teeth in the gaps.
 * Occluded spans of structural edges re-emit as dashed hidden lines — but
 * only when the occluder is a *near* neighbour in z: whole clusters buried
 * behind other z-bands stay buried (dash soup is worse than silence, and a
 * draughtsman wouldn't ghost a machine through a machine).
 */
export function composeWithOcclusion(ctx: MachineCtx, parts: PartRender[], machine: Machine): void {
  const { o } = ctx;
  const zb = new ZBuffer(ctx.width, ctx.height, 2);
  for (const p of parts) {
    for (const s of p.silhouettes) zb.fill(s, p.z);
  }

  const dash = o.penWidth * 3.2;
  const gap = o.penWidth * 2.4;
  // Hidden spans are judged against the machine's base wheel scale.
  const maxHiddenSpan = machine.module * 26 * 1.6;

  const spanLen = (pts: Point[]): number => {
    let l = 0;
    for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return l;
  };

  const sorted = [...parts].sort((a, b) => a.z - b.z);
  for (const p of sorted) {
    for (const ln of p.lines) {
      const pts = densify(ln.points, 2.5);
      let run: Point[] = [];
      let hiddenRun: Point[] = [];
      /** Was any covering part within the same z-band neighbourhood? */
      let nearOccluder = false;
      const flushRun = (): void => {
        if (run.length >= 2) ctx.lines.push({ points: run, layer: ln.layer });
        run = [];
      };
      const flushHidden = (): void => {
        if (o.hiddenLines && nearOccluder && ln.layer === 'part' && hiddenRun.length >= 2) {
          const l = spanLen(hiddenRun);
          if (l > 6 && l < maxHiddenSpan) {
            for (const d of dashPolyline(hiddenRun, dash, gap)) {
              ctx.lines.push({ points: d, layer: 'hidden' });
            }
          }
        }
        hiddenRun = [];
        nearOccluder = false;
      };
      for (const pt of pts) {
        if (zb.hidden(pt.x, pt.y, p.z)) {
          flushRun();
          hiddenRun.push(pt);
          if (zb.zAt(pt.x, pt.y) - p.z < Z_BAND_STRIDE) nearOccluder = true;
        } else {
          flushHidden();
          run.push(pt);
        }
      }
      flushRun();
      flushHidden();
    }
  }
}
