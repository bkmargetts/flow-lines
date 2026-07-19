import { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { optimizePlot } from '../optimize.js';
import { createNoise } from '../noise.js';
import { makeRandom, randomSeed, subSeed } from '../lib/rng.js';
import { trimPolyline, offsetPolyline, smoothPolyline } from '../lib/polyline.js';
import { clamp } from '../lib/math.js';
import { simulateFracture, FractureSimParams } from './sim.js';
import { buildPlateRaster, hatchPlates } from './plates.js';

export { simulateFracture, SegmentGrid } from './sim.js';
export type {
  FractureSimParams,
  FractureCrack,
  FractureJunction,
  FractureSimResult,
  SegmentHit,
} from './sim.js';

/**
 * Fracture — crack-propagation networks (mud cracks, ceramic glaze crazing,
 * old paint), rendered as plottable single-pen strokes.
 *
 * The emergence lives in three local rules (see `sim.ts`): cracks nucleate at
 * maxima of a stress field, existing cracks *screen* the stress around them so
 * later cracks keep their distance, and a tip that senses a crack ahead turns
 * perpendicular and arrests on contact. Nobody draws the tessellation — it
 * emerges: long confident primaries, T-junctions (never X-crossings), and a
 * hierarchy of finer generations subdividing the plates the earlier ones left.
 *
 * Ink treatment: primaries are bold (base pass + tapered offset passes of the
 * same pen — never stroke width), finer generations are single fine strokes
 * with frayed dead ends (snapped junction ends are left exact so the T contact
 * holds). Plates between the cracks can be facet-hatched — each plate at its
 * own confident angle, most left as paper — with a tighter band along crack
 * edges where a curling plate would shadow (`edgeCurl`).
 *
 * Strokes are tagged `crack-primary` / `crack-fine` / `plate` for per-pen SVG
 * export.
 */
export interface FractureOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: controls the stress field, nucleation, tip wander, hatch angles */
  seed?: number;
  /**
   * Reference min dimension in px — clamps the dimension all feature sizes
   * derive from (plate relief radius, stress/wander scale, step, hatch
   * spacing) so cracks and hatch keep their tuned physical size on sheets
   * larger than the tuning anchor; nucleation counts still ride the real
   * page, so bigger sheets grow more plates instead of bigger ones. Callers
   * pass 297mm × pxPerMm (the largest previously-possible short edge); unset
   * or ≥ the page's min dimension is a no-op.
   */
  refMinDim?: number;
  /** Named look preset (default 'mud') */
  preset?: FracturePreset;

  // ---- Simulation ----
  /** Crack generations — hierarchy depth, 1..4 (default preset) */
  generations?: number;
  /** Nucleation density, 0..1 (default preset) */
  crackDensity?: number;
  /** Stress-noise feature size as a fraction of the min dimension (default 0.35) */
  stressScale?: number;
  /** Tip inertia, 0..1 — high = straight confident primaries (default preset) */
  straightness?: number;
  /** Per-step heading jitter, 0..1 (default 0.5) */
  jitter?: number;
  /** Alignment of crack directions to one axis, 0..1 (default preset) */
  anisotropy?: number;
  /** The preferred crack axis, degrees (default 90) */
  anisotropyAngleDeg?: number;
  /** Stress below this arrests a tip, 0..1 (default 0.25) */
  arrestThreshold?: number;
  /** Distance at which a tip senses and turns toward a crack, px (default 3× step) */
  captureRadius?: number;
  /** Fraction of gen-0 cracks seeded on the border growing inward, 0..1 (default preset) */
  edgeNucleation?: number;

  // ---- Render ----
  /** Offset passes on primary cracks (default preset) */
  boldPasses?: number;
  /** End-taper fraction on bold offset passes (default 0.12) */
  taper?: number;
  /** Facet-hatch the plates between cracks (default preset) */
  plateHatch?: boolean;
  /** Plate hatch spacing in px (default ~minDim/90) */
  hatchSpacing?: number;
  /** Fraction of plates that get hatched, 0..1 (default preset) */
  hatchCoverage?: number;
  /** Base plate hatch angle, degrees (default -28) */
  hatchAngleDeg?: number;
  /** Tighter hatch band along crack edges — curled-plate shadow, 0..1 (default preset) */
  edgeCurl?: number;

  // ---- Hand / plot ----
  /** Hand-drawn wobble amplitude in px (default scales with step) */
  wobble?: number;
  /** Chain strokes and order them to cut pen travel (default true) */
  optimize?: boolean;
}

export type FracturePreset = 'mud' | 'crazing' | 'shatter';

/**
 * Fracture look presets. `mud` is dried riverbed: bold plates, deep hierarchy,
 * light facet shading. `crazing` is ceramic glaze: a dense fine aligned net,
 * no bold, no fill. `shatter` is impact/old paint: long primaries driven in
 * from the edges, hard facets, heavy curl shadows.
 */
export const FRACTURE_PRESETS: Record<
  FracturePreset,
  {
    generations: number;
    crackDensity: number;
    straightness: number;
    anisotropy: number;
    edgeNucleation: number;
    plateHatch: boolean;
    hatchCoverage: number;
    edgeCurl: number;
    boldPasses: number;
  }
> = {
  mud: { generations: 3, crackDensity: 0.45, straightness: 0.75, anisotropy: 0, edgeNucleation: 0, plateHatch: true, hatchCoverage: 0.35, edgeCurl: 0.5, boldPasses: 3 },
  crazing: { generations: 3, crackDensity: 1, straightness: 0.7, anisotropy: 0.3, edgeNucleation: 0, plateHatch: false, hatchCoverage: 0, edgeCurl: 0, boldPasses: 1 },
  shatter: { generations: 2, crackDensity: 0.6, straightness: 0.9, anisotropy: 0.2, edgeNucleation: 0.7, plateHatch: true, hatchCoverage: 0.6, edgeCurl: 0.8, boldPasses: 3 },
};

/**
 * Render a fracture network as plottable single-pen strokes.
 */
export function generateFracture(options: FractureOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    seed = randomSeed(),
    preset = 'mud',
    stressScale = 0.35,
    jitter = 0.5,
    anisotropyAngleDeg = 90,
    arrestThreshold = 0.25,
    taper = 0.12,
    hatchAngleDeg = -28,
    optimize = true,
  } = options;

  const p = FRACTURE_PRESETS[preset] ?? FRACTURE_PRESETS.mud;
  const generations = clamp(Math.round(options.generations ?? p.generations), 1, 4);
  const crackDensity = clamp(options.crackDensity ?? p.crackDensity, 0, 1);
  const straightness = clamp(options.straightness ?? p.straightness, 0, 1);
  const anisotropy = clamp(options.anisotropy ?? p.anisotropy, 0, 1);
  const edgeNucleation = clamp(options.edgeNucleation ?? p.edgeNucleation, 0, 1);
  const plateHatch = options.plateHatch ?? p.plateHatch;
  const hatchCoverage = clamp(options.hatchCoverage ?? p.hatchCoverage, 0, 1);
  const edgeCurl = clamp(options.edgeCurl ?? p.edgeCurl, 0, 1);
  const boldPasses = clamp(Math.round(options.boldPasses ?? p.boldPasses), 1, 6);

  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;
  const innerW = x1 - x0;
  const innerH = y1 - y0;
  const empty = (): FlowLinesResult => ({ lines: [], width, height, seed });
  if (innerW < 16 || innerH < 16) return empty();
  const minDim = Math.min(innerW, innerH);
  // Feature sizes anchor at refMinDim on oversized sheets (identity wherever
  // minDim is smaller); extents/counts keep the real dimensions.
  const sizingDim = Math.min(minDim, options.refMinDim ?? Infinity);

  const step = clamp(sizingDim / 220, 2, 5);
  const captureRadius = Math.max(step * 1.5, options.captureRadius ?? step * 3);
  const hatchSpacing = Math.max(1.5, options.hatchSpacing ?? sizingDim / 90);

  const simParams: FractureSimParams = {
    x0,
    y0,
    x1,
    y1,
    generations,
    crackDensity,
    stressScale,
    straightness,
    jitter: clamp(jitter, 0, 1),
    anisotropy,
    anisotropyAngle: (anisotropyAngleDeg * Math.PI) / 180,
    arrestThreshold: clamp(arrestThreshold, 0, 1),
    captureRadius,
    edgeNucleation,
    step,
    refMinDim: options.refMinDim,
  };

  const random = makeRandom(seed);
  const stressNoise = createNoise(seed);
  const orientNoise = createNoise(seed + 8101);
  const sim = simulateFracture(simParams, random, stressNoise, orientNoise);
  if (sim.cracks.length === 0) return empty();

  const lines: FlowLine[] = [];

  // Bold line = base pass + offset/tapered passes of the same pen (no stroke
  // width tricks), the shared pen-ink emphasis technique.
  const pushBold = (points: Point[]): void => {
    lines.push({ points, pen: 'bold', layer: 'crack-primary' });
    const spread = step * 0.35;
    for (let pass = 1; pass < boldPasses; pass++) {
      const offset = spread * (pass - (boldPasses - 1) / 2);
      const trimmed = trimPolyline(offsetPolyline(points, offset), taper);
      if (trimmed.length >= 2) lines.push({ points: trimmed, pen: 'bold', layer: 'crack-primary' });
    }
  };

  // Fray a crack's dead ends (arrested in the open sheet) without touching
  // snapped junction/border ends — trimming those would open the T contact.
  const frayEnds = (c: { points: Point[]; endA: string; endB: string }): Point[] => {
    let pts = c.points;
    const fray = Math.min(step * 1.2, 4);
    if (c.endA === 'faded' && pts.length > 3) {
      const cut = Math.min(fray, 0.1 * pts.length * step);
      let acc = 0;
      let i = 1;
      while (i < pts.length - 2 && acc < cut) {
        acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        i++;
      }
      pts = pts.slice(i - 1);
    }
    if (c.endB === 'faded' && pts.length > 3) {
      const cut = Math.min(fray, 0.1 * pts.length * step);
      let acc = 0;
      let i = pts.length - 2;
      while (i > 1 && acc < cut) {
        acc += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        i--;
      }
      pts = pts.slice(0, i + 2);
    }
    return pts;
  };

  for (const crack of sim.cracks) {
    if (crack.points.length < 2) continue;
    const pts = smoothPolyline(frayEnds(crack), 1);
    if (pts.length < 2) continue;
    if (crack.generation === 0) {
      pushBold(pts);
    } else {
      lines.push({ points: pts, pen: 'fine', layer: 'crack-fine' });
    }
  }

  // Facet-hatch the plates between the cracks.
  if (plateHatch && (hatchCoverage > 0 || edgeCurl > 0)) {
    const cellPx = clamp(sizingDim / 160, 1, 3);
    const raster = buildPlateRaster(sim.cracks, x0, y0, x1, y1, cellPx);
    if (raster) {
      const segs = hatchPlates(raster, {
        x0,
        y0,
        x1,
        y1,
        seed,
        spacing: hatchSpacing,
        baseAngle: (hatchAngleDeg * Math.PI) / 180,
        coverage: hatchCoverage,
        edgeCurl,
      });
      for (const seg of segs) {
        if (seg.length >= 2) lines.push({ points: trimPolyline(seg, 0.04), pen: 'fine', layer: 'plate' });
      }
    }
  }

  let result: FlowLinesResult = { lines, width, height, seed };

  // Primaries stay steady; fine cracks and plate hatch wobble looser.
  const wobble = options.wobble ?? Math.max(0.4, step * 0.16);
  result = applyHandDrawnStyle(result, {
    amplitude: wobble,
    wavelength: step * 10,
    seed: subSeed(seed, 11),
    layerAmplitude: { 'crack-primary': 0.45, 'crack-fine': 1, plate: 1.2 },
  });

  if (optimize) result = optimizePlot(result);

  return result;
}
