import type { FlowLine, Point } from '../flow-lines.js';
import { ZBuffer, densify } from '../lib/spatial.js';
import { dashPolyline } from './geometry.js';
import type { CodexCtx } from './context.js';

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
 * Occluded spans of structural edges re-emit as dashed hidden lines (a local
 * crossing only — a wholly buried feature stays buried, as a draughtsman
 * would leave it).
 */
export function composeWithOcclusion(ctx: CodexCtx, parts: PartRender[]): void {
  const { o } = ctx;
  const zb = new ZBuffer(ctx.width, ctx.height, 2);
  for (const p of parts) {
    for (const s of p.silhouettes) zb.fill(s, p.z);
  }

  const dash = o.penWidth * 3.2;
  const gap = o.penWidth * 2.4;
  const maxHiddenSpan = ctx.o.gearSize * 1.6;

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
      const flushRun = (): void => {
        if (run.length >= 2) ctx.lines.push({ points: run, layer: ln.layer });
        run = [];
      };
      const flushHidden = (): void => {
        if (o.hiddenLines && ln.layer === 'part' && hiddenRun.length >= 2) {
          const l = spanLen(hiddenRun);
          if (l > 6 && l < maxHiddenSpan) {
            for (const d of dashPolyline(hiddenRun, dash, gap)) {
              ctx.lines.push({ points: d, layer: 'hidden' });
            }
          }
        }
        hiddenRun = [];
      };
      for (const pt of pts) {
        if (zb.hidden(pt.x, pt.y, p.z)) {
          flushRun();
          hiddenRun.push(pt);
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
