import { FlowLine, Point } from './flow-lines.js';
import { createNoise } from './noise.js';
import { traceIsoContours } from './iso-contours.js';
import { gaussianBlur } from './image.js';
import { generateOverlappedLines, type MaskShape } from './overlapped-lines.js';
import { makeRandom, subSeed } from './lib/rng.js';
import { compileTextureRegion, type TextureRegionOptions } from './texture-region.js';

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
export type TextureStyle =
  | 'hatch'
  | 'stipple'
  | 'contours'
  | 'grid'
  | 'shapes'
  | 'dashes'
  | 'scribble'
  | 'grating';

/**
 * Grating-style texture: an interleaved multi-ink line grating (the same engine
 * as the Noise Texture project). Spacing, angle, jitter and seed come from the
 * shared `TextureOptions`; these are the grating-specific extras (mm / unitless).
 * The texture lines are tagged `texture-NN` (one per ink) so the background can
 * plot in several pens behind the drawing.
 */
export interface GratingTextureOptions {
  /** Number of interleaved inks (→ `texture-00`, `texture-01`, …). */
  colorCount: number;
  /** Line length as a fraction of the usable page span, 0..1. */
  lineLengthPct: number;
  /** Inter-colour offset built up along the lines, mm. */
  phaseDriftAlongMm: number;
  /** Inter-colour offset built up across the block, mm. */
  phaseDriftAcrossMm: number;
  /** Noise-driven inter-colour offset amplitude, mm. */
  phaseNoiseAmpMm: number;
  /** Spatial frequency of the phase noise. */
  phaseNoiseScale: number;
  /** Low-frequency wobble of each line, mm. */
  wobbleAmpMm: number;
  /** Wobble wavelength along the line, mm. */
  wobbleWavelengthMm: number;
  /** Edge-smoothing envelope width, mm (0 = off). */
  edgeSmoothMm: number;
  /** Optional parametric clip shapes (strips / rect / ellipse), in px. */
  maskShapes?: MaskShape[];
}

export interface TextureShapeOptions {
  /** The single shape to tile (one kind at a time) */
  kind: 'square' | 'circle' | 'line';
  /** Shape size in mm (consistent for every shape) */
  sizeMm: number;
  /** 0..1 — compresses the lattice pitch below `spacingMm` so shapes overlap */
  overlap: number;
}

/**
 * Organic broken dashes (style === 'dashes'): rows of short strokes that all
 * follow one consistent direction (`angleDeg`), row pitch from `spacingMm`,
 * length/gap variance from `jitter`. Each dash arcs gently and wobbles like a
 * hand-pulled stroke; a low-frequency noise gate thins coverage in patches.
 */
export interface DashTextureOptions {
  /** Mean dash length, mm */
  dashLengthMm: number;
  /** Mean gap between dashes along a row, mm */
  gapMm: number;
  /** Perpendicular hand-wobble amplitude, mm (0 = ruler-straight) */
  wobbleMm: number;
  /** Wobble wavelength along the stroke, mm (default 10) */
  wobbleWavelengthMm?: number;
  /** Max mid-dash arc deflection, mm (0 = no curvature) */
  curvatureMm: number;
  /** 0..1 — noise-gated dropout; coverage thins in organic patches */
  sparsity: number;
  /** Max direction drift, degrees (0 = every dash on `angleDeg`); each dash
   * rotates about its row anchor following a very-low-frequency noise field,
   * so the drift reads as wind-combing, not scatter */
  flowDeg?: number;
  /** 0..1 — patchy calm-vs-choppy variation: choppy patches get shorter,
   * denser, more agitated dashes; calm patches longer, even ones */
  turbulence?: number;
  /** -1..1 — page-vertical dash-length sweep (positive = longer toward the
   * bottom); 0 = off */
  gradient?: number;
}

/** Per-field dash defaults — the single source of truth shared with the web
 * module's `defaultClassicParams`; partial `dashes` sub-objects fall back
 * field by field. */
/**
 * Continuous looping meander (style === 'scribble'): rows of cursive-"e"
 * loops advancing along one direction, like a quick pen scrawl filling a
 * patch. Row pitch from `spacingMm`, direction from `angleDeg`, per-loop
 * size variance from `jitter`. One polyline per unbroken run, so it plots
 * without lifting the pen.
 */
export interface ScribbleTextureOptions {
  /** Loop height, mm */
  loopSizeMm: number;
  /** Advance per loop as a fraction of loop size (<1 = overlapping scrawl) */
  advance: number;
  /** -1..1 — loop shear along the travel direction */
  slant: number;
  /** fBm hand-wobble amplitude, mm */
  wobbleMm: number;
  /** 0..1 — noise-gated pen lifts; coverage thins in hand-sized patches */
  sparsity: number;
}

/** Per-field scribble defaults — the single source of truth shared with the
 * web module's `defaultClassicParams`. */
export const SCRIBBLE_DEFAULTS: Required<ScribbleTextureOptions> = {
  loopSizeMm: 5,
  advance: 0.55,
  slant: 0.15,
  wobbleMm: 1,
  sparsity: 0.15,
};

export const DASH_DEFAULTS: Required<DashTextureOptions> = {
  dashLengthMm: 6,
  gapMm: 3,
  wobbleMm: 0.4,
  wobbleWavelengthMm: 10,
  curvatureMm: 0.8,
  sparsity: 0.25,
  flowDeg: 12,
  turbulence: 0.3,
  gradient: 0,
};

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
  /** Broken-dash parameters (style === 'dashes') */
  dashes?: DashTextureOptions;
  /** Looping-meander parameters (style === 'scribble') */
  scribble?: ScribbleTextureOptions;
  /** Grating-style parameters (style === 'grating') */
  grating?: GratingTextureOptions;
  /** Drawing strokes the texture should hold off (for the halo) */
  avoid?: FlowLine[];
  /** Clean-paper sliver reserved around `avoid`, in mm (0 = no halo) */
  haloMm?: number;
  /** Organic framing / edge falloff (absent or rect+falloff 0 = legacy full rect) */
  region?: TextureRegionOptions;
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
  // Finer than the halo radius so the reserved boundary reads as a smooth
  // curve rather than coarse steps (refined further at clip time by bisection).
  const cellSize = Math.max(2, Math.round(haloPx / 3));
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

/**
 * Like `pushClipped`, but keeps the line's own layer (for multi-ink grating)
 * and refines each clear↔halo crossing to the boundary by bisection, so the
 * texture's edge against the halo is a smooth curve rather than stair-steps at
 * the sampling pitch.
 */
function pushClippedLayer(
  out: FlowLine[],
  pts: Point[],
  layer: string,
  isClear: (x: number, y: number) => boolean
): void {
  let run: Point[] = [];
  const flush = (): void => {
    if (run.length >= 2) out.push({ points: run, pen: 'fine', layer });
    run = [];
  };
  const lerp = (p: Point, q: Point, t: number): Point => ({
    x: p.x + (q.x - p.x) * t,
    y: p.y + (q.y - p.y) * t,
  });
  // Boundary point between an in-halo `pOut` and a clear `pIn`.
  const cross = (pIn: Point, pOut: Point): Point => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      const q = lerp(pIn, pOut, mid);
      if (isClear(q.x, q.y)) lo = mid;
      else hi = mid;
    }
    return lerp(pIn, pOut, lo);
  };
  let prev: Point | null = null;
  let prevClear = false;
  for (const p of pts) {
    const clear = isClear(p.x, p.y);
    if (clear) {
      if (prev && !prevClear) run.push(cross(p, prev));
      run.push(p);
    } else {
      if (prev && prevClear) {
        run.push(cross(prev, p));
        flush();
      } else {
        flush();
      }
    }
    prev = p;
    prevClear = clear;
  }
  flush();
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
  const haloClear = hasHalo
    ? buildHaloMask(avoid as FlowLine[], width, height, haloPx)
    : () => true;
  // The region field composes with the halo: a stroke point must satisfy BOTH
  // masks. It draws from its own sub-seed, so region-off output is
  // bit-identical and toggling region knobs never reshuffles the base texture.
  const regionField = options.region
    ? compileTextureRegion(options.region, rect, pxPerMm, subSeed(seed, 5))
    : null;
  const hasClip = hasHalo || regionField !== null;
  const isClear = regionField
    ? (x: number, y: number): boolean => regionField.clear(x, y) && haloClear(x, y)
    : haloClear;
  // Densify step for clipping — fine enough to resolve the reserved halo gap,
  // or (region-only) the ragged organic edge.
  const step = Math.max(
    2,
    Math.min(spacing, haloPx > 0 ? haloPx : regionField ? 2 * pxPerMm : spacing)
  );

  const out: FlowLine[] = [];

  if (style === 'grating') {
    const g = options.grating;
    if (!g) return out;
    const grating = generateOverlappedLines({
      width,
      height,
      margin,
      angleDeg,
      lineLengthPct: g.lineLengthPct,
      spacingPx: spacing,
      colorCount: g.colorCount,
      phaseDriftAlongPx: g.phaseDriftAlongMm * pxPerMm,
      phaseDriftAcrossPx: g.phaseDriftAcrossMm * pxPerMm,
      phaseNoiseAmpPx: g.phaseNoiseAmpMm * pxPerMm,
      phaseNoiseScale: g.phaseNoiseScale,
      jitterPx: jitter * pxPerMm,
      wobbleAmpPx: g.wobbleAmpMm * pxPerMm,
      wobbleWavelengthPx: g.wobbleWavelengthMm * pxPerMm,
      edgeSmoothPx: g.edgeSmoothMm * pxPerMm,
      maskShapes: g.maskShapes,
      seed,
    });
    // Relabel the grating's band-NN inks to texture-NN (so they plot behind the
    // drawing on their own pens), holding the same clean-paper halo off the art.
    for (const line of grating.lines) {
      const band = line.layer ?? 'band-00';
      const texLayer = band.startsWith('band-') ? `texture-${band.slice(5)}` : 'texture';
      if (hasClip) pushClippedLayer(out, line.points, texLayer, isClear);
      else out.push({ points: line.points, pen: 'fine', layer: texLayer });
    }
    return out;
  }

  if (style === 'hatch' || style === 'grid') {
    const gridMode = style === 'grid';
    const j = gridMode ? 0 : jitter;
    hatchLines(out, angle, spacing, j, 0.0001, rect, random, step, hasClip, isClear);
    if (gridMode || crossHatch) {
      hatchLines(out, angle + Math.PI / 2, spacing, j, 0.137, rect, random, step, hasClip, isClear);
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
        if (hasClip) pushClipped(out, mapped, isClear);
        else out.push(TEX(mapped));
      }
    }
    return out;
  }

  if (style === 'dashes') {
    // Organic broken dashes: rows of short strokes along one consistent
    // direction. Each dash is traced as a polyline carrying a parabolic arc
    // (zero at both ends, so endpoints stay on the row line) plus a
    // perpendicular fBm wobble; lengths and gaps vary with `jitter`, and a
    // low-frequency noise gate drops whole dashes so coverage thins in
    // hand-sized patches rather than uniform confetti. Three stateless noise
    // fields make the sheet dynamic without any extra RNG draws (so the
    // sliders modulate the texture instead of reshuffling it): a flow field
    // drifts each dash's direction, a turbulence field varies length/gap/
    // wobble in calm-vs-choppy patches, and a page-vertical gradient sweeps
    // the dash length across the sheet.
    const d = { ...DASH_DEFAULTS, ...(options.dashes ?? {}) };
    const dashPx = Math.max(2, d.dashLengthMm * pxPerMm);
    const gapPx = Math.max(1, d.gapMm * pxPerMm);
    const wobblePx = Math.max(0, d.wobbleMm) * pxPerMm;
    const wavelenPx = Math.max(1, d.wobbleWavelengthMm * pxPerMm);
    const curvePx = Math.max(0, d.curvatureMm) * pxPerMm;
    const sparsity = Math.min(0.95, Math.max(0, d.sparsity));
    const flowRad = (Math.min(90, Math.max(0, d.flowDeg)) * Math.PI) / 180;
    const turb = Math.min(1, Math.max(0, d.turbulence));
    const grad = Math.min(1, Math.max(-1, d.gradient));
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;
    const corners = [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x0, y: y1 },
      { x: x1, y: y1 },
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
    const noise = createNoise(seed + 31);
    const gateNoise = createNoise(seed + 67);
    const flowNoise = createNoise(seed + 97);
    const turbNoise = createNoise(seed + 101);
    // Wobble and arc can push points past the margin, so the rect test rides
    // along with the halo test in one clipped-emit predicate.
    const clear = (x: number, y: number): boolean =>
      x >= x0 && x <= x1 && y >= y0 && y <= y1 && isClear(x, y);
    for (let u = uMin + spacing / 2; u <= uMax; u += spacing) {
      // Per-row phase so dashes never align into columns across rows.
      let v = vMin + random() * (dashPx + gapPx);
      while (v < vMax) {
        // Draw every random before the sparsity gate — a dropped dash must
        // consume the same stream, or changing sparsity would reshuffle the
        // whole texture instead of just thinning it.
        let len = Math.max(2, dashPx * (1 + jitter * 0.8 * (random() - 0.5)));
        let gap = Math.max(1, gapPx * (1 + jitter * 0.8 * (random() - 0.5)));
        // Turbulence, sampled at the slot start (the midpoint isn't known
        // until the length is): t > 0 stretches into calm patches, t < 0
        // chops into short, dense, agitated ones.
        const sx = nx * u + dx * v;
        const sy = ny * u + dy * v;
        const t = turb > 0 ? turbNoise.fbm(sx * 0.005, sy * 0.005, 2, 0.5, 2.0) : 0;
        if (turb > 0) {
          len = Math.max(2, len * (1 + turb * 0.7 * t));
          gap = Math.max(1, gap * (1 + turb * 0.5 * t));
        }
        const mid = v + len / 2;
        let mx = nx * u + dx * mid;
        let my = ny * u + dy * mid;
        // Page-vertical length sweep; the anchor moves with the stretched
        // length, so re-derive the midpoint after scaling.
        if (grad !== 0) {
          const gy01 = Math.min(1, Math.max(0, (my - y0) / (y1 - y0)));
          const gFac = Math.max(0.25, 1 + grad * (2 * gy01 - 1) * 0.75);
          len = Math.max(2, len * gFac);
          gap = Math.max(1, gap * gFac);
          const mid2 = v + len / 2;
          mx = nx * u + dx * mid2;
          my = ny * u + dy * mid2;
        }
        // Signed low-frequency bend: neighbouring dashes arc coherently while
        // the overall direction stays consistent. Scaled with dash length so
        // gradient/turbulence-shortened ticks stay straight instead of
        // scalloping into little waves.
        const bend = curvePx * Math.min(1, len / dashPx) * noise.noise2D(u * 0.011, v * 0.007);
        const gate = gateNoise.fbm(mx * 0.004, my * 0.004, 2, 0.5, 2.0) * 0.5 + 0.5;
        if (gate >= sparsity) {
          // Direction flow: rotate the dash about its midpoint anchor. Much
          // lower frequency than the sparsity gate, so neighbouring dashes
          // comb together instead of scattering.
          const th = flowRad > 0 ? flowRad * flowNoise.noise2D(mx * 0.0015, my * 0.0015) : 0;
          const ddx = Math.cos(angle + th);
          const ddy = Math.sin(angle + th);
          const dnx = -ddy;
          const dny = ddx;
          // Choppy patches wobble harder, calm patches settle.
          const wobAmp = wobblePx * Math.max(0, 1 - turb * t);
          const sampleStep = Math.max(1.5, Math.min(step, len / 4));
          const n = Math.max(4, Math.ceil(len / sampleStep));
          const pts: Point[] = [];
          for (let i = 0; i <= n; i++) {
            const s = i / n;
            const a = v + s * len;
            const wob = wobAmp > 0 ? wobAmp * noise.fbm(a / wavelenPx, u * 0.017, 2, 0.5, 2.0) : 0;
            const arc = bend * (1 - (2 * s - 1) ** 2);
            const off = wob + arc;
            const along = (s - 0.5) * len;
            pts.push({ x: mx + ddx * along + dnx * off, y: my + ddy * along + dny * off });
          }
          pushClipped(out, pts, clear);
        }
        v += len + gap;
      }
    }
    return out;
  }

  if (style === 'scribble') {
    // Continuous looping meander: each row traces a prolate cycloid (the
    // cursive-"eeee" path — a circle rolling forward slower than it spins, so
    // the pen loops back over itself) along the travel direction. Loop radius
    // breathes with a smooth noise field (per-loop RNG steps would kink the
    // curve), an fBm wobble shakes both axes, and a low-frequency stateless
    // gate lifts the pen in hand-sized patches per `sparsity` — stateless so
    // the sliders modulate the scrawl instead of reshuffling it.
    const sc = { ...SCRIBBLE_DEFAULTS, ...(options.scribble ?? {}) };
    const loopPx = Math.max(2, sc.loopSizeMm * pxPerMm);
    const advancePx = Math.max(0.5, sc.advance * loopPx);
    const slant = Math.max(-1, Math.min(1, sc.slant));
    const wobblePx = Math.max(0, sc.wobbleMm) * pxPerMm;
    const sparsity = Math.min(0.95, Math.max(0, sc.sparsity));
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;
    const corners = [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x0, y: y1 },
      { x: x1, y: y1 },
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
    const radNoise = createNoise(subSeed(seed, 7));
    const wobNoise = createNoise(subSeed(seed, 8));
    const gateNoise = createNoise(subSeed(seed, 9));
    // Loops overshoot their row line, so the rect test rides along with the
    // halo/region test (and the sparsity gate) in one clipped-emit predicate.
    const clear = (x: number, y: number): boolean =>
      x >= x0 &&
      x <= x1 &&
      y >= y0 &&
      y <= y1 &&
      isClear(x, y) &&
      (sparsity <= 0 || gateNoise.fbm(x * 0.004, y * 0.004, 2, 0.5, 2.0) * 0.5 + 0.5 >= sparsity);
    // Sample finely enough that the loop curvature and any clip boundary
    // (halo, organic edge) resolve smoothly.
    const sampleStep = Math.max(1.5, Math.min(step, loopPx / 8));
    const nPerLoop = Math.max(8, Math.ceil((Math.PI * loopPx + advancePx) / sampleStep));
    const ds = (Math.PI * 2) / nPerLoop;
    let row = 0;
    for (let u = uMin + spacing / 2; u <= uMax; u += spacing, row++) {
      // Per-row phase so loops never align into columns across rows.
      const v0 = vMin + random() * advancePx;
      const totalS = Math.max(0, ((vMax - v0) / advancePx) * Math.PI * 2);
      const pts: Point[] = [];
      for (let s = 0; s <= totalS; s += ds) {
        // Loop size breathes slowly along the row — a hand never repeats a
        // loop exactly — and the row baseline itself drifts at very low
        // frequency (nobody scrawls along a rail), which is what breaks the
        // phase-locked "chainmail" read of a perfectly periodic cycloid.
        const radius =
          (loopPx / 2) * (1 + jitter * 1.2 * radNoise.fbm(s * 0.05, row * 3.7, 2, 0.5, 2.0));
        const perpBase = radius * Math.sin(s);
        const along = v0 + (advancePx * s) / (Math.PI * 2) + radius * Math.cos(s) + slant * perpBase;
        const drift = 0.35 * loopPx * radNoise.fbm(along * 0.003, row * 3.7 + 51.3, 2, 0.5, 2.0);
        const wobAlong =
          wobblePx > 0 ? wobblePx * wobNoise.fbm(along * 0.02, u * 0.013, 2, 0.5, 2.0) : 0;
        const wobPerp =
          wobblePx > 0 ? wobblePx * wobNoise.fbm(along * 0.02 + 41.7, u * 0.013, 2, 0.5, 2.0) : 0;
        const uu = u + perpBase + drift + wobPerp;
        const vv = along + wobAlong;
        pts.push({ x: nx * uu + dx * vv, y: ny * uu + dy * vv });
      }
      pushClipped(out, pts, clear);
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
