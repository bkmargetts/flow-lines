import { Point } from '../flow-lines.js';

/** Steer `angle` a fraction `amount` toward `target`, by the short way round. */
export function steer(angle: number, target: number, amount: number): number {
  let d = target - angle;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return angle + d * amount;
}

/** Smoothstep ease 0..1. */
export function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** A uniform spatial-hash grid for proximity ("anything within `dist`?") tests
 *  — the evenly-spaced-streamline pattern (flow-lines.ts). */
export class ProximityGrid {
  private readonly cell: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly buckets: Point[][];

  constructor(width: number, height: number, cell: number) {
    this.cell = Math.max(1, cell);
    this.cols = Math.max(1, Math.ceil(width / this.cell));
    this.rows = Math.max(1, Math.ceil(height / this.cell));
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  add(p: Point): void {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(p.x / this.cell)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(p.y / this.cell)));
    this.buckets[cy * this.cols + cx].push(p);
  }

  hasNear(x: number, y: number, dist: number): boolean {
    const d2 = dist * dist;
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cell)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cell)));
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      if (gy < 0 || gy >= this.rows) continue;
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        if (gx < 0 || gx >= this.cols) continue;
        for (const p of this.buckets[gy * this.cols + gx]) {
          const dx = p.x - x;
          const dy = p.y - y;
          if (dx * dx + dy * dy < d2) return true;
        }
      }
    }
    return false;
  }
}

/** A depth buffer of element ids: rasterize silhouettes (front wins), then ask
 *  whether a point is hidden by something nearer. Drives hidden-line removal. */
export class ZBuffer {
  private readonly cell: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly z: Float32Array;

  constructor(width: number, height: number, cell: number) {
    this.cell = Math.max(1, cell);
    this.cols = Math.max(1, Math.ceil(width / this.cell));
    this.rows = Math.max(1, Math.ceil(height / this.cell));
    this.z = new Float32Array(this.cols * this.rows).fill(-1);
  }

  /** Scanline-fill a closed polygon, keeping the max z per cell. */
  fill(poly: Point[], z: number): void {
    if (poly.length < 3) return;
    const c = this.cell;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of poly) {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const r0 = Math.max(0, Math.floor(minY / c));
    const r1 = Math.min(this.rows - 1, Math.floor(maxY / c));
    const xs: number[] = [];
    for (let r = r0; r <= r1; r++) {
      const yc = (r + 0.5) * c;
      xs.length = 0;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i];
        const b = poly[j];
        if ((a.y <= yc && b.y > yc) || (b.y <= yc && a.y > yc)) {
          xs.push(a.x + ((yc - a.y) / (b.y - a.y)) * (b.x - a.x));
        }
      }
      if (xs.length < 2) continue;
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const cx0 = Math.max(0, Math.floor(xs[k] / c));
        const cx1 = Math.min(this.cols - 1, Math.floor(xs[k + 1] / c));
        for (let cx = cx0; cx <= cx1; cx++) {
          const idx = r * this.cols + cx;
          if (z > this.z[idx]) this.z[idx] = z;
        }
      }
    }
  }

  /** Stamp only a polygon's outline as a thick band (radius `r` px), keeping
   *  the max z. Background lines then break with just a small gap where they
   *  cross a nearer element's edge — the botanical "interrupt at crossings"
   *  look — instead of a whole filled shape punching a large hole. */
  stampOutline(poly: Point[], z: number, r: number): void {
    const cell = this.cell;
    const rad = Math.max(1, Math.ceil(r / cell));
    const mark = (x: number, y: number) => {
      const ci = Math.floor(x / cell);
      const cj = Math.floor(y / cell);
      for (let dj = -rad; dj <= rad; dj++) {
        const cy = cj + dj;
        if (cy < 0 || cy >= this.rows) continue;
        for (let di = -rad; di <= rad; di++) {
          const cx = ci + di;
          if (cx < 0 || cx >= this.cols) continue;
          if (di * di + dj * dj > rad * rad) continue;
          const idx = cy * this.cols + cx;
          if (z > this.z[idx]) this.z[idx] = z;
        }
      }
    };
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j];
      const b = poly[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(len / cell));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        mark(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      }
    }
  }

  /** True if a point is hidden by an element nearer than `z`. */
  hidden(x: number, y: number, z: number): boolean {
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return false;
    return this.z[cy * this.cols + cx] > z + 0.5;
  }

  /** The nearest element's z covering a point, or -1 on bare paper. */
  zAt(x: number, y: number): number {
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return -1;
    return this.z[cy * this.cols + cx];
  }
}

/** Resample a polyline to ~`step`-spaced points (endpoints kept). */
export function densify(points: Point[], step: number): Point[] {
  if (points.length === 0) return [];
  const s = Math.max(0.5, step);
  const out: Point[] = [{ x: points[0].x, y: points[0].y }];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(segLen / s));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/** Per-point unit normals (perpendicular to the local tangent). */
export function normalsOf(points: Point[]): Point[] {
  const out: Point[] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const ahead = points[Math.min(i + 1, points.length - 1)];
    const behind = points[Math.max(i - 1, 0)];
    const tx = ahead.x - behind.x;
    const ty = ahead.y - behind.y;
    const len = Math.hypot(tx, ty) || 1;
    out[i] = { x: -ty / len, y: tx / len };
  }
  return out;
}

/** Polyline arc length. */
export function polylineLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

/** Close a blade/body silhouette from its two offset edges: down one edge and
 *  back up the other (left forward, right reversed). */
export function outlineFromEdges(left: Point[], right: Point[]): Point[] {
  return [...left, ...right.slice().reverse()];
}

/** Total fill lines we'll ever emit — keeps dense presets bounded & fast. */
export const STEM_CAP = 4000;
export const LINE_CAP = 90000;
