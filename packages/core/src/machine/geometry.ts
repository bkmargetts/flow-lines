import type { FlowLine, Point } from '../flow-lines.js';

export const TAU = Math.PI * 2;

/** Sampled circular arc, counter-clockwise from a0 to a1 (radians). */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number): Point[] {
  const sweep = a1 - a0;
  const n = Math.max(4, Math.ceil((Math.abs(sweep) * r) / 3));
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (sweep * i) / n;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

/** Closed sampled circle. */
export function circle(cx: number, cy: number, r: number): Point[] {
  return arc(cx, cy, r, 0, TAU);
}

/** Tiny plottable dot: a 4-pass shrinking circle (single-pen "filled" dot). */
export function dot(cx: number, cy: number, r: number): Point[] {
  const pts: Point[] = [];
  for (let pass = 0; pass < 4; pass++) {
    const rr = r * (1 - pass / 4);
    const n = Math.max(6, Math.ceil((TAU * rr) / 2));
    for (let i = 0; i <= n; i++) {
      const a = (TAU * i) / n;
      pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
    }
  }
  return pts;
}

/** Push a run of points as a line if it has any extent. */
export function pushRun(lines: FlowLine[], run: Point[], layer: string): void {
  if (run.length >= 2) lines.push({ points: run, layer });
}

/** Split a polyline into dash runs by arc length — discrete pen-up gaps,
 *  never an SVG dash-array (the plot must lift the pen). */
export function dashPolyline(pts: Point[], dash: number, gap: number): Point[][] {
  const out: Point[][] = [];
  let run: Point[] = [];
  let acc = 0;
  let drawing = true;
  const period = dash + gap;
  const flush = (): void => {
    if (run.length >= 2) out.push(run);
    run = [];
  };
  for (let i = 0; i < pts.length - 1; i++) {
    let a = pts[i];
    const b = pts[i + 1];
    let segLen = Math.hypot(b.x - a.x, b.y - a.y);
    while (segLen > 1e-9) {
      const limit = drawing ? dash : period;
      const room = limit - acc;
      if (drawing && run.length === 0) run.push({ x: a.x, y: a.y });
      if (segLen < room) {
        acc += segLen;
        if (drawing) run.push({ x: b.x, y: b.y });
        break;
      }
      const t = room / segLen;
      const mx = a.x + (b.x - a.x) * t;
      const my = a.y + (b.y - a.y) * t;
      if (drawing) {
        run.push({ x: mx, y: my });
        flush();
      }
      drawing = !drawing;
      acc = drawing ? 0 : dash;
      a = { x: mx, y: my };
      segLen -= room;
    }
  }
  flush();
  return out;
}

/** Radially offset a polygon about a centre — the safe "bold pass" offset for
 *  spiky closed profiles (tooth polygons), where a normal-based offset would
 *  fold at the corners. */
export function radialOffset(poly: Point[], cx: number, cy: number, d: number): Point[] {
  return poly.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const r = Math.hypot(dx, dy);
    if (r < 1e-6) return { x: p.x, y: p.y };
    const f = (r + d) / r;
    return { x: cx + dx * f, y: cy + dy * f };
  });
}

/** Both external (crossed=false) or internal (crossed=true) common tangent
 *  lines of two circles: returns the two tangent segments [aPt, bPt] plus the
 *  tangent angles on each circle, or null when the construction is impossible
 *  (circles too close for a crossed belt). */
export function commonTangents(
  a: { cx: number; cy: number; r: number },
  b: { cx: number; cy: number; r: number },
  crossed: boolean
):
  | {
      segs: [Point, Point][];
      /** Tangent-point angles on circle a and b for each segment. */
      angA: number[];
      angB: number[];
    }
  | null {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const d = Math.hypot(dx, dy);
  const base = Math.atan2(dy, dx);
  const k = crossed ? (a.r + b.r) / d : (a.r - b.r) / d;
  if (!(Math.abs(k) < 1)) return null;
  const beta = Math.acos(k);
  const segs: [Point, Point][] = [];
  const angA: number[] = [];
  const angB: number[] = [];
  for (const sgn of [1, -1]) {
    const ta = base + sgn * beta;
    const tb = crossed ? ta + Math.PI : ta;
    const p1 = { x: a.cx + Math.cos(ta) * a.r, y: a.cy + Math.sin(ta) * a.r };
    const p2 = { x: b.cx + Math.cos(tb) * b.r, y: b.cy + Math.sin(tb) * b.r };
    segs.push([p1, p2]);
    angA.push(ta);
    angB.push(tb);
  }
  return { segs, angA, angB };
}

/** Circle–circle intersection (the linkage pose solver). Returns the two
 *  intersection points, or null when the circles don't meet. */
export function circleCircle(
  c1: { x: number; y: number },
  r1: number,
  c2: { x: number; y: number },
  r2: number
): [Point, Point] | null {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-9 || d > r1 + r2 || d < Math.abs(r1 - r2)) return null;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (h2 < 0) return null;
  const h = Math.sqrt(h2);
  const mx = c1.x + (dx * a) / d;
  const my = c1.y + (dy * a) / d;
  return [
    { x: mx + (dy * h) / d, y: my - (dx * h) / d },
    { x: mx - (dy * h) / d, y: my + (dx * h) / d },
  ];
}
