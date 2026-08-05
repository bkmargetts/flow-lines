import type { FlowLine, Point } from '../flow-lines.js';

/**
 * Generic hold-off: trim any portion of `lines` running within `haloPx` of the
 * `avoid` set, leaving clean paper around the foreground. A coverage grid of
 * the avoid samples (cell = haloPx) is tested with a 3×3 neighbourhood, so a
 * sample is dropped when it sits within roughly one halo of avoided ink. The
 * crossing/coalescence niceties of density protection aren't needed here —
 * this is a deliberate margin, not pile-up. Fragments shorter than a couple of
 * cells are discarded as dust.
 *
 * Lifted verbatim from the web compositor (identical arithmetic in identical
 * order — the composited goldens pin it) so the CLI stack command and the web
 * layer stack share one implementation.
 */
export function holdOffLines(lines: FlowLine[], avoid: FlowLine[], haloPx: number): FlowLine[] {
  if (!avoid.length || haloPx <= 0) return lines;
  const cell = Math.max(0.5, haloPx);
  const step = cell * 0.5;
  const blocked = new Set<string>();
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  const stamp = (p: Point) => blocked.add(key(Math.floor(p.x / cell), Math.floor(p.y / cell)));

  for (const line of avoid) {
    const pts = line.points;
    for (let i = 0; i < pts.length; i++) {
      stamp(pts[i]);
      if (i > 0) {
        const a = pts[i - 1];
        const b = pts[i];
        const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
        for (let s = 1; s < n; s++) {
          const t = s / n;
          stamp({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
      }
    }
  }

  const near = (p: Point): boolean => {
    const cx = Math.floor(p.x / cell);
    const cy = Math.floor(p.y / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (blocked.has(key(cx + dx, cy + dy))) return true;
      }
    }
    return false;
  };

  const minKeep = cell * 2;
  const out: FlowLine[] = [];
  for (const line of lines) {
    if (line.points.length < 2) {
      if (line.points.length && !near(line.points[0])) out.push(line);
      continue;
    }
    // Walk the densified samples, emitting maximal runs that clear the halo.
    let run: Point[] = [];
    const flush = () => {
      if (run.length >= 2 && pathLength(run) >= minKeep) out.push({ ...line, points: run });
      run = [];
    };
    const pts = line.points;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) {
        const a = pts[i - 1];
        const b = pts[i];
        const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
        for (let s = 1; s <= n; s++) {
          const t = s / n;
          const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
          if (near(p)) flush();
          else run.push(p);
        }
      } else {
        if (near(pts[0])) flush();
        else run.push(pts[0]);
      }
    }
    flush();
  }
  return out;
}

function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}
