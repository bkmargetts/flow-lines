import { FlowLine, Point } from './flow-lines.js';
import { createNoise } from './noise.js';
import { traceIsoContours } from './iso-contours.js';
import { gaussianBlur } from './image.js';

/**
 * A plottable background texture — a field of single-pen strokes laid behind
 * the drawing on its own export layer ('texture'). Everything is stroked
 * polylines (lines, closed dots/shapes, contour loops), never fills or rasters,
 * so it plots like the rest of the toolbox. Deterministic per seed.
 *
 * An optional halo holds the texture a clean-paper sliver off the drawing's
 * strokes (`avoid` + `haloMm`), the same reserved-paper idea the contour halos
 * use, so the art reads off the textured ground instead of being crowded by it.
 */
export type TextureStyle = 'hatch' | 'stipple' | 'contours' | 'grid' | 'shapes';

export interface TextureShapeOptions {
  /** The single shape to tile (one kind at a time) */
  kind: 'square' | 'circle' | 'line';
  /** Shape size in mm (consistent for every shape) */
  sizeMm: number;
  /** 0..1 — compresses the lattice pitch below `spacingMm` so shapes overlap */
  overlap: number;
}

export interface TextureOptions {
  /** Page rectangle in px */
  width: number;
  height: number;
  /** Clear border in px — texture stays inside this inset */
  margin: number;
  /** Pixels per mm, so mm-based spacing scales with the sheet */
  pxPerMm: number;
  style: TextureStyle;
  /** Line spacing / mark pitch in mm (hatch, grid, stipple) */
  spacingMm: number;
  /** Orientation in degrees (hatch, grid, shapes) */
  angleDeg: number;
  /** Size multiplier (dots, shapes) and noise scale (contours) */
  scale: number;
  /** Low-frequency randomness, 0..1 */
  jitter: number;
  /** Coverage, 0..1 (stipple, shapes, contour line count) */
  density: number;
  /** Add a second perpendicular set of lines (hatch) */
  crossHatch: boolean;
  seed: number;
  shapes?: TextureShapeOptions;
  /** Drawing strokes the texture should hold off (for the halo) */
  avoid?: FlowLine[];
  /** Clean-paper sliver reserved around `avoid`, in mm (0 = no halo) */
  haloMm?: number;
}

/** Deterministic LCG, matching the convention used across the toolbox. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * A coarse occupancy grid marking cells within `haloPx` of any `avoid` stroke,
 * so the texture can be held off the drawing. Returns a clear-test in page px.
 */
function buildHaloMask(
  avoid: FlowLine[],
  width: number,
  height: number,
  haloPx: number
): (x: number, y: number) => boolean {
  const cellSize = Math.max(2, Math.round(haloPx / 2));
  const cols = Math.max(1, Math.ceil(width / cellSize));
  const rows = Math.max(1, Math.ceil(height / cellSize));
  const occupied = new Uint8Array(cols * rows);
  const r = Math.ceil(haloPx / cellSize);
  const haloPx2 = haloPx * haloPx;

  const stamp = (x: number, y: number): void => {
    const ci = Math.floor(x / cellSize);
    const cj = Math.floor(y / cellSize);
    for (let dj = -r; dj <= r; dj++) {
      const cy = cj + dj;
      if (cy < 0 || cy >= rows) continue;
      for (let di = -r; di <= r; di++) {
        const cx = ci + di;
        if (cx < 0 || cx >= cols) continue;
        // Disc, so the reserved halo is round rather than blocky.
        if ((di * cellSize) ** 2 + (dj * cellSize) ** 2 <= haloPx2 + cellSize * cellSize) {
          occupied[cy * cols + cx] = 1;
        }
      }
    }
  };

  for (const line of avoid) {
    const pts = line.points;
    if (pts.length === 0) continue;
    stamp(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(len / cellSize));
      for (let s = 1; s <= steps; s++) {
        stamp(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps);
      }
    }
  }

  return (x, y) => {
    const ci = Math.floor(x / cellSize);
    const cj = Math.floor(y / cellSize);
    if (ci < 0 || ci >= cols || cj < 0 || cj >= rows) return false;
    return occupied[cj * cols + ci] === 0;
  };
}

/** Liang–Barsky clip of a segment to an axis-aligned rect; null if outside. */
function clipSegmentToRect(
  p0: Point,
  p1: Point,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): [Point, Point] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const tests: Array<[number, number]> = [
    [-dx, p0.x - x0],
    [dx, x1 - p0.x],
    [-dy, p0.y - y0],
    [dy, y1 - p0.y],
  ];
  for (const [p, q] of tests) {
    if (p === 0) {
      if (q < 0) return null; // parallel and outside
    } else {
      const t = q / p;
      if (p < 0) {
        if (t > t1) return null;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return null;
        if (t < t1) t1 = t;
      }
    }
  }
  return [
    { x: p0.x + t0 * dx, y: p0.y + t0 * dy },
    { x: p0.x + t1 * dx, y: p0.y + t1 * dy },
  ];
}

const TEX = (points: Point[]): FlowLine => ({ points, pen: 'fine', layer: 'texture' });

/**
 * Emit a polyline, split into the runs of points that pass `isClear` (the halo
 * test), so strokes break around the drawing instead of crossing it.
 */
function pushClipped(out: FlowLine[], pts: Point[], isClear: (x: number, y: number) => boolean): void {
  let run: Point[] = [];
  for (const p of pts) {
    if (isClear(p.x, p.y)) {
      run.push(p);
    } else {
      if (run.length >= 2) out.push(TEX(run));
      run = [];
    }
  }
  if (run.length >= 2) out.push(TEX(run));
}

/** Walk a clipped scanline at `step`, emitting halo-broken runs. */
function emitLine(
  out: FlowLine[],
  a: Point,
  b: Point,
  step: number,
  hasHalo: boolean,
  isClear: (x: number, y: number) => boolean
): void {
  if (!hasHalo) {
    out.push(TEX([a, b]));
    return;
  }
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(len / step));
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    pts.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
  }
  pushClipped(out, pts, isClear);
}

/** Parallel scanlines at `angleRad`, clipped to the inset rect (+ halo). */
function hatchLines(
  out: FlowLine[],
  angleRad: number,
  spacing: number,
  jitter: number,
  phase: number,
  rect: { x0: number; y0: number; x1: number; y1: number },
  random: () => number,
  step: number,
  hasHalo: boolean,
  isClear: (x: number, y: number) => boolean
): void {
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  const nx = -dy;
  const ny = dx;
  const corners = [
    { x: rect.x0, y: rect.y0 },
    { x: rect.x1, y: rect.y0 },
    { x: rect.x0, y: rect.y1 },
    { x: rect.x1, y: rect.y1 },
  ];
  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const c of corners) {
    const u = c.x * nx + c.y * ny;
    const v = c.x * dx + c.y * dy;
    uMin = Math.min(uMin, u);
    uMax = Math.max(uMax, u);
    vMin = Math.min(vMin, v);
    vMax = Math.max(vMax, v);
  }
  const noise = createNoise(Math.floor(phase * 1e6) || 1);
  let u = uMin + phase;
  while (u <= uMax) {
    const a = { x: nx * u + dx * vMin, y: ny * u + dy * vMin };
    const b = { x: nx * u + dx * vMax, y: ny * u + dy * vMax };
    const clipped = clipSegmentToRect(a, b, rect.x0, rect.y0, rect.x1, rect.y1);
    if (clipped) emitLine(out, clipped[0], clipped[1], step, hasHalo, isClear);
    const jit = jitter > 0 ? 1 + jitter * 0.6 * noise.noise2D(u * 0.02, phase) : 1;
    u += Math.max(2, spacing * jit) + (jitter > 0 ? (random() - 0.5) * jitter * spacing * 0.4 : 0);
  }
}

function closedLoop(cx: number, cy: number, radius: number, segs: number, phase: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = phase + (i / segs) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(t) * radius, y: cy + Math.sin(t) * radius });
  }
  return pts;
}

/**
 * Build a plottable background texture as single-pen strokes, all tagged
 * `layer: 'texture'`.
 */
export function generateTexture(options: TextureOptions): FlowLine[] {
  const {
    width,
    height,
    margin,
    pxPerMm,
    style,
    spacingMm,
    angleDeg,
    scale,
    jitter,
    density,
    crossHatch,
    seed,
    shapes,
    avoid,
    haloMm = 0,
  } = options;

  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;
  if (x1 - x0 < 4 || y1 - y0 < 4) return [];

  const rect = { x0, y0, x1, y1 };
  const random = makeRandom(seed);
  const angle = (angleDeg * Math.PI) / 180;
  const spacing = Math.max(2, spacingMm * pxPerMm);

  const haloPx = Math.max(0, haloMm) * pxPerMm;
  const hasHalo = haloPx > 0 && !!avoid && avoid.length > 0;
  const isClear = hasHalo
    ? buildHaloMask(avoid as FlowLine[], width, height, haloPx)
    : () => true;
  // Densify step for halo clipping — fine enough to resolve the reserved gap.
  const step = Math.max(2, Math.min(spacing, haloPx > 0 ? haloPx : spacing));

  const out: FlowLine[] = [];

  if (style === 'hatch' || style === 'grid') {
    const gridMode = style === 'grid';
    const j = gridMode ? 0 : jitter;
    hatchLines(out, angle, spacing, j, 0.0001, rect, random, step, hasHalo, isClear);
    if (gridMode || crossHatch) {
      hatchLines(out, angle + Math.PI / 2, spacing, j, 0.137, rect, random, step, hasHalo, isClear);
    }
    return out;
  }

  if (style === 'stipple') {
    // Uniform hash-grid Poisson-ish scatter: reject candidates too close to an
    // accepted dot. Denser `density` and tighter `spacingMm` ⇒ more dots.
    const reject = Math.max(2, spacing * (1.1 - density));
    const cell = reject;
    const cols = Math.max(1, Math.ceil((x1 - x0) / cell));
    const rows = Math.max(1, Math.ceil((y1 - y0) / cell));
    const occupied: Point[][] = Array.from({ length: cols * rows }, () => []);
    const area = (x1 - x0) * (y1 - y0);
    const candidates = Math.min(60000, Math.round((area / (reject * reject)) * (0.6 + density)));
    const reject2 = reject * reject;
    for (let c = 0; c < candidates; c++) {
      const px = x0 + random() * (x1 - x0);
      const py = y0 + random() * (y1 - y0);
      if (!isClear(px, py)) continue;
      const ci = Math.min(cols - 1, Math.floor((px - x0) / cell));
      const cj = Math.min(rows - 1, Math.floor((py - y0) / cell));
      let ok = true;
      for (let dj = -1; dj <= 1 && ok; dj++) {
        for (let di = -1; di <= 1 && ok; di++) {
          const nb = occupied[(cj + dj) * cols + (ci + di)];
          if (!nb) continue;
          for (const q of nb) {
            if ((q.x - px) ** 2 + (q.y - py) ** 2 < reject2) {
              ok = false;
              break;
            }
          }
        }
      }
      if (!ok) continue;
      occupied[cj * cols + ci].push({ x: px, y: py });
      const radius = (0.55 + random() * 0.35) * Math.max(0.4, scale);
      out.push(TEX(closedLoop(px, py, radius, 7, random() * Math.PI * 2)));
    }
    return out;
  }

  if (style === 'contours') {
    // Trace nested iso-lines of a low-frequency noise field → organic ripples.
    const gx = Math.max(8, Math.round(width / 6));
    const gy = Math.max(8, Math.round(height / 6));
    const noise = createNoise(seed + 17);
    const freq = (0.6 + scale) * 1.2;
    const data = new Float32Array(gx * gy);
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        const nx = (i / gx) * freq;
        const ny = (j / gy) * freq;
        data[j * gx + i] = noise.fbm(nx, ny, 3, 0.5, 2.0, 1) * 0.5 + 0.5;
      }
    }
    const field = gaussianBlur({ width: gx, height: gy, data }, 0.8);
    const levels = Math.max(2, Math.round(3 + density * 8));
    for (let k = 0; k < levels; k++) {
      const iso = (k + 0.5) / levels;
      for (const poly of traceIsoContours(field, iso)) {
        if (poly.length < 2) continue;
        // Map field grid → page px (inside the inset rect).
        const mapped = poly.map((p) => ({
          x: x0 + (p.x / (gx - 1)) * (x1 - x0),
          y: y0 + (p.y / (gy - 1)) * (y1 - y0),
        }));
        if (hasHalo) pushClipped(out, mapped, isClear);
        else out.push(TEX(mapped));
      }
    }
    return out;
  }

  // style === 'shapes' — one shape tiled on a regular lattice, with consistent
  // (customizable) size, spacing and overlap. `spacingMm` sets the
  // centre-to-centre pitch; `overlap` compresses it so shapes overlap; every
  // shape is the same `sizeMm` and `kind`.
  const sh = shapes ?? { kind: 'square', sizeMm: 4, overlap: 0 };
  const kind = sh.kind;
  const size = Math.max(2, sh.sizeMm * pxPerMm * Math.max(0.2, scale));
  const half = size / 2;
  // How far a mark's outline reaches from its centre, so it stays fully in
  // bounds: a rotated square reaches its half-diagonal, a circle only its
  // radius, a line its half-length (≤ half at any angle).
  const reach = kind === 'square' ? half * Math.SQRT2 : half;
  const overlap = Math.min(0.9, Math.max(0, sh.overlap));
  const pitch = Math.max(2, spacing * (1 - overlap));
  // Centre the lattice in the drawable rect: count how many marks fit, then
  // distribute the leftover space evenly on both sides rather than letting it
  // pool on the right/bottom (which left the grid flush to the top-left corner).
  const innerW = x1 - x0 - 2 * reach;
  const innerH = y1 - y0 - 2 * reach;
  const cols = Math.max(1, Math.floor(innerW / pitch) + 1);
  const rows = Math.max(1, Math.floor(innerH / pitch) + 1);
  const startX = x0 + reach + (innerW - (cols - 1) * pitch) / 2;
  const startY = y0 + reach + (innerH - (rows - 1) * pitch) / 2;
  for (let r = 0; r < rows; r++) {
    const gy = startY + r * pitch;
    for (let c = 0; c < cols; c++) {
      const gx = startX + c * pitch;
      if (!isClear(gx, gy)) continue;
      const a = angle + (jitter > 0 ? (random() - 0.5) * jitter * Math.PI : 0);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      if (kind === 'circle') {
        out.push(TEX(closedLoop(gx, gy, half, 16, 0)));
      } else if (kind === 'line') {
        out.push(TEX([
          { x: gx - ca * half, y: gy - sa * half },
          { x: gx + ca * half, y: gy + sa * half },
        ]));
      } else {
        // Square as four straight edges (a closed loop would smooth into a
        // teardrop under the SVG writer's quadratic curves).
        const corners: Point[] = [
          { x: -half, y: -half },
          { x: half, y: -half },
          { x: half, y: half },
          { x: -half, y: half },
        ].map((p) => ({ x: gx + p.x * ca - p.y * sa, y: gy + p.x * sa + p.y * ca }));
        for (let e = 0; e < 4; e++) out.push(TEX([corners[e], corners[(e + 1) % 4]]));
      }
    }
  }
  return out;
}
