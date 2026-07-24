import { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { optimizePlot } from '../optimize.js';
import { createNoise } from '../noise.js';
import { makeRandom, randomSeed, subSeed } from '../lib/rng.js';
import { clipPolylineToRect } from '../lib/polyline.js';
import { clamp } from '../lib/math.js';
import { WarpGridOptions, WARP_GRID_PRESETS } from './types.js';
import { buildField } from './field.js';
import { placeDeformers, sampleHeight, applyDomain } from './deformers.js';

export { WARP_GRID_PRESETS } from './types.js';
export type {
  WarpGridOptions,
  WarpGridPreset,
  WarpBasePattern,
  WarpDeformerKind,
} from './types.js';

/**
 * Warp grid — op-art gratings deformed by hidden forms, rendered as
 * plottable single-pen strokes.
 *
 * A flat base grating (parallel lines, wave rows, concentric rings, or a
 * radial burst) is displaced by an invisible surface: height deformers
 * (domes, ridge trains, rolling noise) sum into a soft-clamped heightfield
 * that shifts every sample along its line's normal, so each line traces a
 * profile section of the form — Riley's *Current* and *Blaze*, the classic
 * plotter hidden-relief pieces. Exact domain maps (vortex, lens) then bend
 * the whole sheet. The 3D read is protected by taste rules: an edge-calm
 * band returns the grating to flat at the margin so forms emerge from a
 * quiet sheet, a compression floor breaks lines before they pool into ink,
 * and optional hidden-line occlusion turns a noise field into an occluded
 * landscape of profiles. Tone is carried purely by line placement — the
 * compressed side of a form shades, the stretched side lights.
 */
export function generateWarpGrid(options: WarpGridOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    seed = randomSeed(),
    preset = 'dome',
    optimize = true,
  } = options;

  const p = WARP_GRID_PRESETS[preset] ?? WARP_GRID_PRESETS.dome;

  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;
  const innerW = x1 - x0;
  const innerH = y1 - y0;
  const empty = (): FlowLinesResult => ({ lines: [], width, height, seed });
  if (innerW < 16 || innerH < 16) return empty();
  const minDim = Math.min(innerW, innerH);

  const basePattern = options.basePattern ?? p.basePattern;
  const spacing = Math.max(2, options.spacing ?? minDim / 55);
  const angle = options.angle ?? p.angle;
  const waveAmp = clamp(options.waveAmp ?? 0.5, 0, 1);
  const wavelength = Math.max(8, options.wavelength ?? minDim / 6);
  const deformerCount = clamp(Math.round(options.deformers ?? p.deformers), 0, 8);
  const kinds = options.kinds ?? p.kinds;
  const strength = clamp(options.strength ?? p.strength, 0, 1);
  const relief = clamp(options.relief ?? p.relief, 0, 1);
  const scale = clamp(options.scale ?? p.scale ?? 0.28, 0.05, 1);
  const noiseScale = clamp(options.noiseScale ?? p.noiseScale ?? 0.35, 0.05, 2) * minDim;
  const dropFloor = clamp(options.dropFloor ?? 0.35, 0, 1);
  const occlude = (options.occlude ?? p.occlude) && basePattern !== 'circles' && basePattern !== 'rays';
  const edgeCalm = clamp(options.edgeCalm ?? 0.35, 0, 1);
  const detail = Math.max(0.75, options.detail ?? 2);
  const wobble = options.wobble ?? 0;

  const reliefPx = relief * minDim * 0.22;
  const rng = makeRandom(seed);
  const noise = createNoise(subSeed(seed, 1));
  const scene = placeDeformers(rng, noise, {
    kinds,
    count: deformerCount,
    strength,
    radius: scale * minDim,
    flip: p.flip,
    wavelength,
    noiseScale,
    x0,
    y0,
    x1,
    y1,
  });

  const field = buildField(basePattern, {
    x0,
    y0,
    x1,
    y1,
    spacing,
    angle,
    waveAmp,
    wavelength,
    detail,
    pad: reliefPx + minDim * 0.15,
    pointCap: 220_000,
  });
  if (field.lines.length === 0) return empty();

  // Edge calm: displacement ramps to zero in a band inside the margin, so
  // the grating returns flat at the sheet edge and the forms read as
  // emerging from it (and clipping never chops a swollen line mid-bulge).
  const band = edgeCalm * 0.28 * minDim;
  const envelope = (x: number, y: number): number => {
    if (band <= 0) return 1;
    const d = Math.min(x - x0, x1 - x, y - y0, y1 - y);
    const t = clamp(d / band, 0, 1);
    return t * t * (3 - 2 * t);
  };

  const sampleCount = field.lines[0].points.length;
  const occludeTol = spacing * 0.12;
  const floorGap = dropFloor * spacing;
  const minRun = 5;
  const runningMax = new Float64Array(sampleCount).fill(-Infinity);
  // Last drawn position per sample column, for the compression floor.
  const lastKept: (Point | null)[] = new Array(sampleCount).fill(null);

  const lines: FlowLine[] = [];
  const pushRun = (run: Point[]): void => {
    if (run.length < 2) return;
    for (const piece of clipPolylineToRect(run, x0, y0, x1, y1)) {
      if (piece.length >= 2) lines.push({ points: piece, pen: 'fine', layer: 'grid' });
    }
  };

  // Positive height pushes against the normal — up the page for the default
  // horizontal grating, so relief reads as rising ground. Occlusion walks the
  // lines nearest-first (bottom of the page) so a peak hides what's behind it.
  const order = occlude ? [...field.lines].reverse() : field.lines;
  for (const line of order) {
    let run: Point[] = [];
    const flush = (): void => {
      if (run.length >= minRun) pushRun(run);
      run = [];
    };
    for (let i = 0; i < line.points.length; i++) {
      const pt = line.points[i];
      const env = envelope(pt.x, pt.y);
      const h = env > 0 && reliefPx > 0 ? sampleHeight(scene, pt.x, pt.y) * env : 0;
      const qx = pt.x - line.normals[i].x * reliefPx * h;
      const qy = pt.y - line.normals[i].y * reliefPx * h;

      let visible = true;
      if (occlude) {
        // Hidden-line removal in the relief frame: a sample shows only where
        // it rises above every nearer line already drawn in its column.
        const s = -(qx * field.nx + qy * field.ny);
        visible = s >= runningMax[i] - occludeTol;
        if (s > runningMax[i]) runningMax[i] = s;
      }

      const r = visible ? applyDomain(scene, qx, qy, envelope(qx, qy)) : { x: qx, y: qy };

      if (visible && floorGap > 0) {
        // Compression floor: where the warp squeezes this line against the
        // last one drawn, lift the pen — a crisp band instead of pooled ink.
        const prev = lastKept[i];
        if (prev !== null && Math.hypot(r.x - prev.x, r.y - prev.y) < floorGap) {
          visible = false;
        }
      }

      if (visible) {
        lastKept[i] = r;
        run.push(r);
      } else {
        flush();
      }
    }
    flush();
  }

  let result: FlowLinesResult = { lines, width, height, seed };

  if (wobble > 0) {
    result = applyHandDrawnStyle(result, {
      amplitude: wobble,
      wavelength: Math.max(24, spacing * 4),
      seed: subSeed(seed, 11),
    });
  }

  if (optimize) result = optimizePlot(result);

  return result;
}
