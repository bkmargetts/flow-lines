import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { randomSeed } from './lib/rng.js';

/**
 * Complex-valued rational-function flow fields, after George Savva's
 * "Flow fields" post (https://georgemsavva.github.io/creativecoding/posts/flowfields/).
 *
 * Each canvas point is read as a complex number z = x + iy, and the field is a
 * rational function f(z) = Π(z - zeroⱼ) / Π(z - poleₖ). The zeros act as
 * sinks/sources, the poles as saddles — that algebraic topology gives the
 * swirling, sculptural streamlines that distinguish this from the noise-based
 * flow field. The vector is normalised to constant speed and streamlines are
 * traced bidirectionally (forward and backward) from each seed.
 *
 * Pure data in, pure `FlowLinesResult` out: no ML, no DOM. Colour is carried as
 * `FlowLine.layer` ('band-NN'), so the web/CLI can map bands to pens via
 * `SVGOptions.layerColors` / `toSVGLayers`.
 */

// ---- complex arithmetic (module-private; we expose only plain {x,y} data) ----

interface Complex {
  re: number;
  im: number;
}

const cSub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
const cDiv = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im; // |b|^2
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
const cAbs = (a: Complex): number => Math.hypot(a.re, a.im);

// ---- public option types ----

/** How a set of singularities (zeros or poles) is arranged in the plane. */
export type SingularityLayout = 'ring' | 'grid' | 'parabola' | 'random';

/** How streamline seeds are scattered. */
export type SeedLayout = 'random' | 'rings' | 'lines' | 'grid' | 'multiRing';

/** How a finished streamline is assigned to a colour band / pen layer. */
export type LayerBy = 'seedBand' | 'speed' | 'angle';

export interface ComplexFlowOptions {
  /** Output raster size in px (the page pixels). */
  width: number;
  height: number;
  /** RNG seed; the same seed reproduces the drawing exactly. */
  seed?: number;

  // ---- the field f(z) = Π(z - zero) / Π(z - pole) ----
  zeroCount: number;
  poleCount: number;
  zeroLayout: SingularityLayout;
  poleLayout: SingularityLayout;
  /** Extent (in plane units) of the ring/grid/parabola the singularities sit on. */
  singularitySpread: number;

  // ---- complex-plane window ----
  /** Half-extent of the shorter axis of the plane window (≈1 → roughly [-1,1]). */
  planeScale: number;
  /** Rotate the whole field, radians. */
  fieldRotation: number;

  /**
   * Interactive overrides, in PIXEL coordinates. Mapped into the plane and
   * appended to the laid-out singularities, so tapping the canvas adds zeros /
   * poles on top of (or, with the counts set to 0, instead of) the presets.
   */
  manualZerosPx?: Point[];
  manualPolesPx?: Point[];

  // ---- streamline tracer ----
  seedCount: number;
  seedLayout: SeedLayout;
  /** Steps taken in each direction (forward + backward) from the seed. */
  stepsPerDir: number;
  /** Step distance d, px. */
  stepLength: number;
  /** Randomise per-step magnitude within ±jitter of d to break up banding (0..1). */
  stepJitter: number;
  /** Decorative perpendicular wobble amplitude, px (does not feed back into the integration). */
  wobble: number;
  /** Stop a streamline when raw |f| exceeds this (it has hit a singularity). */
  speedClampMax: number;
  /** Discard streamlines shorter than this (px, summed segment length). */
  minLineLength: number;
  /** Clear border, px; streamlines stop when they cross it. */
  margin: number;

  // ---- colour banding ----
  /** Number of colour bands == pen layers. */
  layerCount: number;
  layerBy: LayerBy;
}

// ---- field ----

interface ComplexField {
  zeros: Complex[];
  poles: Complex[];
  rotor: Complex; // unit complex for fieldRotation
}

/**
 * Evaluate the field at z. Returns a unit-length px-space direction plus the
 * raw speed |f| (so the caller can clamp blow-ups near singularities). Guards
 * the denominator so a seed landing on a pole can't divide by zero.
 */
function evalField(field: ComplexField, z: Complex): { dir: Point; speed: number } {
  let num: Complex = { re: 1, im: 0 };
  for (const zero of field.zeros) num = cMul(num, cSub(z, zero));
  let den: Complex = { re: 1, im: 0 };
  for (const pole of field.poles) den = cMul(den, cSub(z, pole));

  if (cAbs(den) < 1e-9) den = { re: den.re + 1e-9, im: den.im + 1e-9 };
  let f = cDiv(num, den);
  f = cMul(f, field.rotor);

  const speed = cAbs(f);
  const inv = speed > 1e-12 ? 1 / speed : 0;
  return { dir: { x: f.re * inv, y: f.im * inv }, speed };
}

// ---- pixel ↔ plane mapping (aspect-aware: maps via the shorter axis) ----

interface PlaneMap {
  toPlane: (x: number, y: number) => Complex;
  toPixel: (z: Complex) => Point;
}

function makePlaneMap(width: number, height: number, planeScale: number): PlaneMap {
  const half = Math.min(width, height) / 2; // shorter axis → no field stretch
  const k = planeScale / half;
  return {
    toPlane: (x, y) => ({ re: (x - width / 2) * k, im: (y - height / 2) * k }),
    toPixel: (z) => ({ x: z.re / k + width / 2, y: z.im / k + height / 2 }),
  };
}

// ---- deterministic singularity placement ----

function placeSingularities(
  layout: SingularityLayout,
  count: number,
  spread: number,
  rng: () => number,
  phase: number
): Complex[] {
  const out: Complex[] = [];
  if (count <= 0) return out;

  switch (layout) {
    case 'ring':
      for (let k = 0; k < count; k++) {
        const a = (2 * Math.PI * k) / count + phase;
        out.push({ re: spread * Math.cos(a), im: spread * Math.sin(a) });
      }
      break;
    case 'grid': {
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      for (let i = 0; i < count; i++) {
        const cx = i % cols;
        const cy = Math.floor(i / cols);
        const fx = cols > 1 ? cx / (cols - 1) : 0.5;
        const fy = rows > 1 ? cy / (rows - 1) : 0.5;
        out.push({ re: (fx * 2 - 1) * spread, im: (fy * 2 - 1) * spread });
      }
      break;
    }
    case 'parabola':
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;
        out.push({ re: spread * t, im: spread * (t * t - 0.5) });
      }
      break;
    case 'random':
      for (let i = 0; i < count; i++) {
        out.push({ re: (rng() * 2 - 1) * spread, im: (rng() * 2 - 1) * spread });
      }
      break;
  }
  return out;
}

// ---- seeding ----

interface Seed {
  start: Point; // pixel space
  band: number; // colour band index (pre-modulo)
}

function generateSeeds(
  layout: SeedLayout,
  count: number,
  width: number,
  height: number,
  margin: number,
  planeScale: number,
  layerCount: number,
  plane: PlaneMap,
  rng: () => number
): Seed[] {
  const seeds: Seed[] = [];
  const bands = Math.max(1, layerCount);
  const innerW = Math.max(1, width - 2 * margin);
  const innerH = Math.max(1, height - 2 * margin);

  switch (layout) {
    case 'random':
      for (let i = 0; i < count; i++) {
        const start = { x: margin + rng() * innerW, y: margin + rng() * innerH };
        seeds.push({ start, band: Math.floor(rng() * bands) });
      }
      break;

    case 'grid': {
      const cols = Math.max(1, Math.round(Math.sqrt((count * innerW) / innerH)));
      const rows = Math.max(1, Math.ceil(count / cols));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = margin + ((c + 0.5) / cols) * innerW;
          const y = margin + ((r + 0.5) / rows) * innerH;
          seeds.push({ start: { x, y }, band: c % bands });
        }
      }
      break;
    }

    case 'lines': {
      // Horizontal scan lines; each line is its own band.
      const rows = Math.max(1, Math.min(bands * 6, Math.round(Math.sqrt(count))));
      const perRow = Math.max(1, Math.ceil(count / rows));
      for (let r = 0; r < rows; r++) {
        const y = margin + ((r + 0.5) / rows) * innerH;
        for (let i = 0; i < perRow; i++) {
          const x = margin + ((i + 0.5) / perRow) * innerW;
          seeds.push({ start: { x, y }, band: r % bands });
        }
      }
      break;
    }

    case 'rings': {
      // A single ring near the plane edge; band cycles around the angle, so the
      // palette sweeps around the ring (Savva's hue-by-ring look).
      const radius = 0.72 * planeScale;
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const a = 2 * Math.PI * t;
        const start = plane.toPixel({ re: radius * Math.cos(a), im: radius * Math.sin(a) });
        seeds.push({ start, band: Math.floor(t * bands) % bands });
      }
      break;
    }

    case 'multiRing': {
      // Concentric rings, one band per ring — the most plotter-legible mapping.
      const ringCount = bands;
      const perRing = Math.max(1, Math.ceil(count / ringCount));
      for (let ring = 0; ring < ringCount; ring++) {
        const f = ringCount > 1 ? ring / (ringCount - 1) : 0.5;
        const radius = (0.2 + f * 0.58) * planeScale;
        for (let i = 0; i < perRing; i++) {
          const a = 2 * Math.PI * (i / perRing) + ring * 0.4;
          const start = plane.toPixel({ re: radius * Math.cos(a), im: radius * Math.sin(a) });
          seeds.push({ start, band: ring });
        }
      }
      break;
    }
  }

  return seeds;
}

// ---- tracing ----

function polylineLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

function traceStreamline(
  field: ComplexField,
  plane: PlaneMap,
  start: Point,
  o: ComplexFlowOptions,
  rng: () => number
): Point[] {
  // A seed dropped in the clear border (ring layouts / large planeScale) would
  // otherwise contribute an out-of-margin start point — skip it.
  if (
    start.x < o.margin ||
    start.x > o.width - o.margin ||
    start.y < o.margin ||
    start.y > o.height - o.margin
  ) {
    return [];
  }

  const half = (sign: 1 | -1): Point[] => {
    const pts: Point[] = [];
    let cur = { ...start };
    let arc = 0;
    for (let i = 0; i < o.stepsPerDir; i++) {
      const { dir, speed } = evalField(field, plane.toPlane(cur.x, cur.y));
      if (speed > o.speedClampMax || speed < 1e-9) break; // on/near a singularity
      const jig = o.stepJitter ? 1 + (rng() * 2 - 1) * o.stepJitter : 1;
      const step = sign * o.stepLength * jig;
      const cx = cur.x + dir.x * step; // clean integration point
      const cy = cur.y + dir.y * step;
      if (cx < o.margin || cx > o.width - o.margin || cy < o.margin || cy > o.height - o.margin) {
        break;
      }
      arc += o.stepLength;
      // Decorative perpendicular wobble — stored only, never fed back, so the
      // integration stays stable.
      let px = cx;
      let py = cy;
      if (o.wobble) {
        const w = o.wobble * Math.sin(arc * 0.15);
        px += -dir.y * w;
        py += dir.x * w;
      }
      pts.push({ x: px, y: py });
      cur = { x: cx, y: cy };
    }
    return pts;
  };

  const back = half(-1).reverse();
  return [...back, { ...start }, ...half(1)];
}

// ---- layer assignment ----

function bandForLine(o: ComplexFlowOptions, seedBand: number, pts: Point[], field: ComplexField, plane: PlaneMap): number {
  const bands = Math.max(1, o.layerCount);
  if (o.layerBy === 'seedBand') return ((seedBand % bands) + bands) % bands;

  const mid = pts[Math.floor(pts.length / 2)];
  if (o.layerBy === 'speed') {
    const { speed } = evalField(field, plane.toPlane(mid.x, mid.y));
    // Log-compress speed into a band; clamps the heavy tail near singularities.
    const t = Math.min(1, Math.log10(1 + speed) / 3);
    return Math.min(bands - 1, Math.floor(t * bands));
  }
  // 'angle' — tangent direction at the midpoint.
  const a = pts.length > 1 ? Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) : 0;
  const t = (a + Math.PI) / (2 * Math.PI);
  return Math.min(bands - 1, Math.floor(t * bands));
}

const bandName = (i: number): string => `band-${String(i).padStart(2, '0')}`;

// ---- top-level ----

export function generateComplexFlow(options: ComplexFlowOptions): FlowLinesResult {
  const o = options;
  const seed = o.seed ?? randomSeed();

  // One LCG stream, threaded in a fixed order (singularities → seeds → per-step
  // jitter) so output is deterministic per seed.
  let s = (seed & 0x7fffffff) || 1;
  const rng = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const plane = makePlaneMap(o.width, o.height, o.planeScale);

  const zeros = placeSingularities(o.zeroLayout, o.zeroCount, o.singularitySpread, rng, 0);
  const poles = placeSingularities(
    o.poleLayout,
    o.poleCount,
    o.singularitySpread,
    rng,
    Math.PI / Math.max(1, o.poleCount) // offset poles so they interleave zeros
  );
  for (const p of o.manualZerosPx ?? []) zeros.push(plane.toPlane(p.x, p.y));
  for (const p of o.manualPolesPx ?? []) poles.push(plane.toPlane(p.x, p.y));

  const field: ComplexField = {
    zeros,
    poles,
    rotor: { re: Math.cos(o.fieldRotation), im: Math.sin(o.fieldRotation) },
  };

  const seeds = generateSeeds(
    o.seedLayout,
    o.seedCount,
    o.width,
    o.height,
    o.margin,
    o.planeScale,
    o.layerCount,
    plane,
    rng
  );

  const lines: FlowLine[] = [];
  for (const seedItem of seeds) {
    const pts = traceStreamline(field, plane, seedItem.start, o, rng);
    if (pts.length < 2 || polylineLength(pts) < o.minLineLength) continue;
    const band = bandForLine(o, seedItem.band, pts, field, plane);
    lines.push({ points: pts, layer: bandName(band) });
  }

  return { lines, width: o.width, height: o.height, seed };
}
