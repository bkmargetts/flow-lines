import { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';

/**
 * Translate a content-sized result onto a larger page and reframe the canvas.
 * Marks that fall outside the page (a 'fill' crop) are clipped to its edge.
 */
export function frameOntoPage(
  result: FlowLinesResult,
  contentWidth: number,
  contentHeight: number,
  page: { width: number; height: number; offsetX: number; offsetY: number }
): FlowLinesResult {
  const { width: pageW, height: pageH, offsetX, offsetY } = page;
  const needsClip =
    offsetX < -0.5 ||
    offsetY < -0.5 ||
    offsetX + contentWidth > pageW + 0.5 ||
    offsetY + contentHeight > pageH + 0.5;

  const lines: FlowLine[] = [];
  for (const line of result.lines) {
    const moved = line.points.map((p) => ({ x: p.x + offsetX, y: p.y + offsetY }));
    if (needsClip) {
      for (const run of clipPolylineToRect(moved, pageW, pageH)) {
        lines.push({ points: run, pen: line.pen });
      }
    } else {
      lines.push({ points: moved, pen: line.pen });
    }
  }
  return { lines, width: pageW, height: pageH, seed: result.seed };
}

/**
 * Clip a polyline to the rectangle [0,width]×[0,height], returning the
 * inside runs (Liang–Barsky per segment, stitched where consecutive segments
 * stay inside). Points exactly on the edge are kept.
 */
function clipPolylineToRect(points: Point[], width: number, height: number): Point[][] {
  const runs: Point[][] = [];
  let current: Point[] = [];
  const flush = (): void => {
    if (current.length >= 2) runs.push(current);
    current = [];
  };
  for (let i = 0; i < points.length - 1; i++) {
    const seg = clipSegmentToRect(points[i], points[i + 1], width, height);
    if (!seg) {
      flush();
      continue;
    }
    if (current.length === 0) {
      current.push(seg.a, seg.b);
    } else {
      const last = current[current.length - 1];
      if (Math.abs(last.x - seg.a.x) < 1e-6 && Math.abs(last.y - seg.a.y) < 1e-6) {
        current.push(seg.b);
      } else {
        flush();
        current.push(seg.a, seg.b);
      }
    }
    if (seg.clippedEnd) flush();
  }
  flush();
  return runs;
}

function clipSegmentToRect(
  p0: Point,
  p1: Point,
  width: number,
  height: number
): { a: Point; b: Point; clippedEnd: boolean } | null {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, p0.x],
    [dx, width - p0.x],
    [-dy, p0.y],
    [dy, height - p0.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null; // parallel and outside
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return {
    a: { x: p0.x + t0 * dx, y: p0.y + t0 * dy },
    b: { x: p0.x + t1 * dx, y: p0.y + t1 * dy },
    clippedEnd: t1 < 1,
  };
}
