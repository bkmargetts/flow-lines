import { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { optimizePlot } from '../optimize.js';
import { gaussianBlur } from '../image.js';
import { traceIsoContours } from '../iso-contours.js';
import { createNoise } from '../noise.js';
import { makeRandom, randomSeed } from '../lib/rng.js';
import { trimPolyline, offsetPolyline, smoothPolyline } from '../lib/polyline.js';
import { lerp } from '../lib/math.js';
import { simulate, classifyFinal, motionDir } from './sim.js';
import {
  cellSquare,
  clipPolylineByMask,
  posterize,
  noiseAngle,
  coreBoundaryPolylines,
  angledRegionHatch,
  blurredMotionField,
  chamferDistanceCells,
} from './render.js';
import { renderWeave } from './weave.js';
import { bandLayerName } from '../overlapped-lines.js';

export { stepLife } from './sim.js';

/**
 * A still "long exposure" of Conway's Game of Life: one frame that holds the
 * recent history of a run. The final living configuration sits solid and
 * crisp; everything that came before fades backward into comet-like trails.
 *
 * The whole effect rides on one scalar per cell, accumulated as the simulation
 * runs:
 *
 *     exposure[i] = exposure[i] * decay + (aliveNow ? 1 : 0)
 *
 * After the final generation this equals Σ_g alive(i,g)·decay^(G−g): cells
 * alive through to the end (the final config, enduring still-lifes) saturate;
 * cells a glider only passed through long ago contribute a small, exponentially
 * decaying amount, so the receding track behind a glider's last position reads
 * as a comet tail. Because the toolbox plots a single pen at a single width,
 * that exposure is turned into ink as MARK DENSITY — sparse dashes for faint
 * ghosts, dense cross-hatch for solids — never opacity or stroke-width tricks.
 *
 * Six render styles share the same simulation:
 *  - `marks`      — discrete per-cell marks (the default look).
 *  - `contour`    — nested iso-contours of the blurred light field: continuous
 *                   organic ridges, comet tracks as long tapering loops.
 *  - `streaks`    — the paths of moving clusters (gliders) traced as continuous
 *                   centre-line strokes, with the core left as soft contours.
 *  - `slipstream` — evenly-spaced streamlines through the colony motion field.
 *  - `embers`     — stipple whose density carries the exposure tone.
 *  - `weave`      — the whole sheet as a calm ruled multi-ink grating that the
 *                   trails locally disturb (see ./weave.ts).
 *
 * Every stroke is tagged with a `layer` ('present' / 'ghost' / 'trail') so the
 * piece can be exported one SVG per pen — except the weave grating, whose inks
 * land on `band-NN` layers (the Ink Field convention) alongside 'present'.
 */
export interface ConwayExposureOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: controls the R-pentomino's placement and orientation, and wobble */
  seed?: number;
  /**
   * How many R-pentominoes to detonate at the start (default 1). One sits
   * near the centre; more are scattered across the central region, each with
   * its own orientation, so their evolutions collide and interleave.
   */
  seedCount?: number;
  /** Pixels per cell — sets the simulation's grid resolution (default ~width/100) */
  cellSize?: number;
  /** Generations to simulate from the seed (default 180) */
  generations?: number;
  /** Per-generation exposure decay, 0..1 (default 0.92) — higher = longer trails */
  decay?: number;
  /**
   * Perceptual lift applied to normalized exposure before tiering (default
   * 0.45). A moving point deposits little exposure per cell relative to a
   * stationary one, so without a <1 gamma the comet trails would be all but
   * invisible next to the solid core.
   */
  gamma?: number;
  /** Tone below this (0..1, post-gamma) leaves blank paper (default 0.1) */
  faintThreshold?: number;
  /** Faint→medium tone boundary (default 0.32) */
  mediumThreshold?: number;
  /** Medium→solid tone boundary (default 0.62) */
  solidThreshold?: number;
  /**
   * A connected cluster of final-generation cells this size or smaller is
   * "residue" (quiet still-lifes, glider heads) and is drawn as a crisp hollow
   * outline; anything larger is the turbulent "core" and is filled solid.
   * (default 6)
   */
  residueMaxCells?: number;
  /** Base hand-drawn wobble amplitude in px (default scales with cellSize) */
  wobble?: number;
  /** Render style for the history (default 'marks') */
  style?: 'marks' | 'contour' | 'streaks' | 'slipstream' | 'embers' | 'weave';
  /**
   * Reserved-paper sliver in px held around the crisp present (and, in
   * `streaks`, around the trails): history marks/lines stop short of it so the
   * present reads with a clean halo. (default ~cellSize * 0.6)
   */
  haloRadius?: number;
  /** Number of nested iso levels for the `contour` style (default 5) */
  contourLevels?: number;
  /** `streaks`: largest cluster (cells) tracked as a mover (default 8) */
  maxClusterCells?: number;
  /** `streaks`: a track must persist this many generations to count (default 12) */
  minTrackGenerations?: number;
  /** `streaks`: a track must travel this many cells end-to-end to count (default 6) */
  minTrackDisplacement?: number;
  /**
   * `slipstream`: base separation between flowing streamlines, in grid cells
   * (default 0.9). Tone tightens it (woven core) and loosens it (sparse
   * tails), so spacing carries the long-exposure value.
   */
  slipstreamSpacing?: number;
  /**
   * `embers`: stipple dots placed per cell at full tone (default 7). Faint
   * tails fall to a spark or two; the dark trails build a dense field.
   */
  stippleDensity?: number;
  /**
   * `weave`: inks in the calm grating, 1..4 — each emits on its own `band-NN`
   * pen layer (the Ink Field convention), alongside the crisp `present`
   * layer. (default 3)
   */
  weaveInks?: number;
  /** `weave`: ruling spacing within one ink, px (default max(1.5, cellSize*0.8)). */
  weavePitch?: number;
  /** `weave`: grating direction in degrees; 0 = vertical (default 0). */
  weaveAngle?: number;
  /**
   * `weave`: per-ink lateral split at full exposure, as a fraction of the
   * pitch per ink step (default 0.4). In calm paper the inks are always
   * near-coincident — every split is scaled by the local exposure tone.
   */
  weaveSeparation?: number;
  /**
   * `weave`: per-ink pitch differential at full exposure (default 0.01).
   * Inside a trail each ink's offset also grows with the ruling index, so the
   * coincidence beat sweeps across the trail — the vernier braid.
   */
  weaveVernier?: number;
  /**
   * `weave`: how far the ruling direction swings toward the local trail
   * motion at full exposure, 0..1 (default 0.7). Lines relax back to the calm
   * angle where exposure fades.
   */
  weaveBend?: number;
  /**
   * `weave`: signed density swell (default 0.5). >0 pulls rulings toward
   * trail ridges so spacing tightens and carries tone; <0 spreads them.
   */
  weavePitchSwell?: number;
  /**
   * `weave`: hand-wobble amplitude at full exposure, px (default
   * cellSize*0.35). Calm ruling keeps ~8% of it — drafted-straight paper,
   * agitated trails.
   */
  weaveWobble?: number;
  /**
   * `weave`: fraction of the calm-paper ruling that is drawn, 0..1 (default
   * 0.4). 1 is the full grating; lower keeps an evenly-spaced airy subset
   * (golden-ratio stratified, so it never clumps) and recruits the missing
   * rulings locally where the trails raise the tone — the drawing builds up
   * from white space.
   */
  weaveCoverage?: number;
  /**
   * `weave`: how the disturbance renders (default 'rings'). 'grating' bends
   * the rulings along the trails; 'rings' keeps the calm ruling
   * drafted-straight (it dissolves out where tone rises) and renders the
   * disturbance as nested ripple loops of the exposure tone (`contourLevels`
   * sets the ring count), the inks splitting and braiding along each ring.
   * `weaveBend`/`weavePitchSwell` act on the grating form only.
   */
  weaveForm?: 'grating' | 'rings';
  /** Chain strokes and order them to cut pen travel (default true) */
  optimize?: boolean;

  // ---- Art style (all optional; default to the drawn look, off = faithful) --
  /**
   * Master switch for the hand-drawn "art" treatment (default true). Each
   * sub-feature below defaults from this, so `artStyle: false` with nothing
   * else set reproduces the original faithful, grid-faithful render exactly.
   */
  artStyle?: boolean;
  /**
   * Draw the turbulent present-core as one traced mass — a confident tapered
   * silhouette filled with angled, jittered, patchy hatching — instead of a
   * grid of axis-aligned filled boxes (default = artStyle).
   */
  massCore?: boolean;
  /** Offset passes building the bold core silhouette (default 3) */
  massOutlinePasses?: number;
  /** Base interior hatch angle for the core mass, degrees (default -32) */
  hatchAngle?: number;
  /** Cross-hatch second-layer angle for the core mass, degrees (default 31) */
  crossHatchAngle?: number;
  /** Fraction of the core mass that gets the cross-hatch layer, 0..1 (default 0.5) */
  crossHatchAmount?: number;
  /** Low-frequency jitter on hatch spacing/phase, 0..1 (default 0.5) */
  hatchJitter?: number;
  /** Vary the faint-mark fallback angle with noise instead of a fixed 45° (default = artStyle) */
  markAngleNoise?: boolean;
  /**
   * Posterize the (blurred) exposure into this many committed value bands
   * before choosing marks, so trails read as decisive tonal shapes rather
   * than continuous per-cell noise. 0 = continuous (default artStyle ? 4 : 0).
   */
  valueBands?: number;
  /**
   * Bias a single detonation toward a rule-of-thirds point, 0..1
   * (default artStyle ? 0.6 : 0). 0 keeps the original centered placement.
   * Ignored when seedCount > 1 (those already scatter).
   */
  offCenter?: number;
  /**
   * Hold faint marks off the frame corners to reserve negative space, 0..1
   * (default artStyle ? 0.4 : 0). 0 = no vignette.
   */
  vignette?: number;
  /**
   * Gutter reserved around the drawing in art mode, in grid cells (default 2).
   * Keeps the drawing clear of the page edge so the shared page border (drawn
   * by the frame, not here) frames it. Reserving it for the whole art mode
   * means the value is part of the simulation's footprint.
   */
  borderGap?: number;
}

/**
 * Render a long-exposure still of an R-pentomino Game of Life run as
 * plottable single-pen strokes.
 */
export function generateConwayExposure(options: ConwayExposureOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    seed = randomSeed(),
    seedCount = 1,
    generations = 180,
    decay = 0.92,
    gamma = 0.45,
    faintThreshold = 0.1,
    mediumThreshold = 0.32,
    solidThreshold = 0.62,
    residueMaxCells = 6,
    style = 'marks',
    contourLevels = 5,
    maxClusterCells = 8,
    minTrackGenerations = 12,
    minTrackDisplacement = 6,
    slipstreamSpacing = 0.9,
    stippleDensity = 7,
    weaveInks = 3,
    weaveAngle = 0,
    weaveSeparation = 0.4,
    weaveVernier = 0.01,
    weaveBend = 0.7,
    weavePitchSwell = 0.5,
    weaveCoverage = 0.4,
    weaveForm = 'rings',
    optimize = true,
  } = options;

  // Art treatment, all gated off a single master switch so `artStyle: false`
  // (with nothing else set) reproduces the original faithful render exactly.
  const artStyle = options.artStyle ?? true;
  const massCore = options.massCore ?? artStyle;
  const massOutlinePasses = options.massOutlinePasses ?? 3;
  const hatchAngle = ((options.hatchAngle ?? -32) * Math.PI) / 180;
  const crossHatchAngle = ((options.crossHatchAngle ?? 31) * Math.PI) / 180;
  const crossHatchAmount = options.crossHatchAmount ?? 0.5;
  const hatchJitter = options.hatchJitter ?? 0.5;
  const markAngleNoise = options.markAngleNoise ?? artStyle;
  const valueBands = options.valueBands ?? (artStyle ? 4 : 0);
  const offCenter = options.offCenter ?? (artStyle ? 0.6 : 0);
  const vignette = options.vignette ?? (artStyle ? 0.4 : 0);
  const borderGap = Math.max(0.5, options.borderGap ?? 2);

  const cellSize = Math.max(2, options.cellSize ?? Math.round(width / 100));
  const wobble = options.wobble ?? Math.max(0.4, cellSize * 0.12);
  const haloRadius = options.haloRadius ?? cellSize * 0.6;
  const weavePitch = Math.max(0.75, options.weavePitch ?? Math.max(1.5, cellSize * 0.8));
  const weaveWobble = options.weaveWobble ?? cellSize * 0.35;
  const noise = createNoise(seed + 8101);

  // Reserve the border gutter (borderGap cells) for the whole art mode, not
  // just when the border is drawn — so toggling the plate border only
  // adds/removes the line and never resizes the grid (a different grid would
  // re-run an entirely different simulation). Changing the gap deliberately
  // does resize the drawing area. The faithful path keeps the full margin.
  const frameMargin = margin + (artStyle ? borderGap * cellSize : 0);

  const usableW = Math.max(0, width - 2 * frameMargin);
  const usableH = Math.max(0, height - 2 * frameMargin);
  const cols = Math.floor(usableW / cellSize);
  const rows = Math.floor(usableH / cellSize);

  const empty = (): FlowLinesResult => ({ lines: [], width, height, seed });
  if (cols < 3 || rows < 3) return empty();

  // Center the grid within the (framed) page margin.
  const originX = frameMargin + (usableW - cols * cellSize) / 2;
  const originY = frameMargin + (usableH - rows * cellSize) / 2;

  const random = makeRandom(seed);
  const sim = simulate(
    cols,
    rows,
    Math.max(0, generations),
    decay,
    random,
    Math.max(1, Math.round(seedCount)),
    offCenter,
    style === 'streaks'
      ? {
          maxCells: maxClusterCells,
          minGenerations: minTrackGenerations,
          minDisplacement: minTrackDisplacement,
        }
      : null
  );
  const isCore = classifyFinal(sim.finalAlive, cols, rows, residueMaxCells);

  const half = cellSize / 2;
  const lines: FlowLine[] = [];

  // Per-cell perceptual tone, kept so the hand-drawn pass can loosen faint
  // ghosts and hold the crisp solids steady, and reused as the contour field.
  const tone = new Float32Array(cols * rows);
  for (let i = 0; i < tone.length; i++) {
    tone[i] = Math.pow(Math.min(1, sim.exposure[i] / sim.maxExposure), gamma);
  }

  // Optionally commit the trail tone to a few value bands so history reads as
  // decisive tonal tiers, not a continuous gradient. Quantizing only the
  // visible range (≥ faintThreshold) keeps empty space as clean paper — and we
  // posterize the raw tone (not a blurred copy), so the gamma-lifted skirt of
  // near-zero cells around every trail isn't promoted into a frame-wide haze.
  // The hand-drawn pass below still reads the raw `tone`, so wobble follows
  // true exposure rather than the bands.
  let markTone = tone;
  if (valueBands > 0) {
    markTone = new Float32Array(tone.length);
    for (let i = 0; i < markTone.length; i++) markTone[i] = posterize(tone[i], valueBands, faintThreshold);
  }

  const cellCenter = (cx: number, cy: number): Point => ({
    x: originX + (cx + 0.5) * cellSize,
    y: originY + (cy + 0.5) * cellSize,
  });
  const cellIndexAt = (x: number, y: number): number => {
    const cxi = Math.min(cols - 1, Math.max(0, Math.floor((x - originX) / cellSize)));
    const cyi = Math.min(rows - 1, Math.max(0, Math.floor((y - originY) / cellSize)));
    return cyi * cols + cxi;
  };

  // Reserved-paper halo: dilate the present's cells so history holds off them.
  const haloCells = new Uint8Array(cols * rows);
  const haloR = Math.max(0, Math.ceil(haloRadius / cellSize));
  if (haloR > 0) {
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        if (!sim.finalAlive[cy * cols + cx]) continue;
        for (let dy = -haloR; dy <= haloR; dy++) {
          const yy = cy + dy;
          if (yy < 0 || yy >= rows) continue;
          for (let dx = -haloR; dx <= haloR; dx++) {
            const xx = cx + dx;
            if (xx < 0 || xx >= cols) continue;
            haloCells[yy * cols + xx] = 1;
          }
        }
      }
    }
  }
  const inHalo = (p: Point): boolean => haloCells[cellIndexAt(p.x, p.y)] === 1;

  // Map a point from cell space (raster coords) to page px, matching the
  // cell-centre convention used by cellCenter / renderContour.
  const cellPointToPx = (p: Point): Point => ({
    x: originX + (p.x + 0.5) * cellSize,
    y: originY + (p.y + 0.5) * cellSize,
  });

  // Bold line = base pass + offset/tapered passes of the same pen (no stroke
  // width tricks), mirroring the pen-ink emphasis technique.
  const pushBoldMass = (points: Point[]): void => {
    lines.push({ points, pen: 'bold', layer: 'present' });
    const spread = cellSize * 0.18;
    for (let pass = 1; pass < massOutlinePasses; pass++) {
      const offset = spread * (pass - (massOutlinePasses - 1) / 2);
      const trimmed = trimPolyline(offsetPolyline(points, offset), 0.12);
      if (trimmed.length >= 2) lines.push({ points: trimmed, pen: 'bold', layer: 'present' });
    }
  };

  // ---- The crisp present (shared by every style) -------------------------
  const renderPresent = (): void => {
    // The faithful per-cell treatment: solid axis-aligned cross-hatch boxes.
    const fillSolid = (c: Point): void => {
      const spacing = Math.max(1, cellSize * 0.2);
      const reach = half * 0.92;
      for (let off = -reach; off <= reach; off += spacing) {
        lines.push({
          points: [
            { x: c.x - reach, y: c.y + off },
            { x: c.x + reach, y: c.y + off },
          ],
          pen: 'bold',
          layer: 'present',
        });
        lines.push({
          points: [
            { x: c.x + off, y: c.y - reach },
            { x: c.x + off, y: c.y + reach },
          ],
          pen: 'bold',
          layer: 'present',
        });
      }
    };

    // The drawn-mass treatment: trace the whole core as one tapered silhouette
    // and fill it with angled, jittered, patchy hatching.
    const renderCoreMass = (): void => {
      let minX = cols;
      let minY = rows;
      let maxX = -1;
      let maxY = -1;
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          if (!isCore[cy * cols + cx]) continue;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
        }
      }
      if (maxX < 0) return; // no core cells

      for (const loop of coreBoundaryPolylines(isCore, cols, rows)) {
        if (loop.length < 3) continue;
        pushBoldMass(smoothPolyline(loop.map(cellPointToPx), 2));
      }

      const inRegion = (cx: number, cy: number): boolean =>
        cx >= 0 && cx < cols && cy >= 0 && cy < rows && isCore[cy * cols + cx] === 1;
      const bounds = { minX, minY, maxX: maxX + 1, maxY: maxY + 1 };
      const segs = [
        ...angledRegionHatch(inRegion, bounds, hatchAngle, 0.55, noise, hatchJitter, 0, 1),
        ...angledRegionHatch(
          inRegion,
          bounds,
          crossHatchAngle,
          0.55,
          noise,
          hatchJitter,
          0.27,
          crossHatchAmount
        ),
      ];
      for (const seg of segs) {
        if (seg.length >= 2) lines.push({ points: seg.map(cellPointToPx), pen: 'fine', layer: 'present' });
      }
    };

    if (massCore) renderCoreMass();

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const i = cy * cols + cx;
        if (!sim.finalAlive[i]) continue;
        const c = cellCenter(cx, cy);
        if (isCore[i]) {
          if (massCore) continue; // drawn as one mass above
          fillSolid(c);
          lines.push({ points: cellSquare(c.x, c.y, half, cellSize * 0.06), pen: 'bold', layer: 'present' });
        } else {
          // Residue still-lifes / glider heads: crisp hollow squares. In the
          // art style the inner inset is noise-jittered so they aren't all
          // pixel-identical.
          const jit = artStyle ? noise.noise2D(cx * 0.7, cy * 0.7) * 0.06 : 0;
          lines.push({ points: cellSquare(c.x, c.y, half, cellSize * 0.1), pen: 'bold', layer: 'present' });
          lines.push({ points: cellSquare(c.x, c.y, half, cellSize * (0.24 + jit)), pen: 'bold', layer: 'present' });
        }
      }
    }
  };

  // ---- History as discrete marks -----------------------------------------
  const renderMarks = (): void => {
    const dashFor = (c: Point, dir: Point | null, lengthFrac: number, layer: string): FlowLine => {
      const d = dir ?? { x: 0.7071, y: 0.7071 };
      const h = (cellSize * lengthFrac) / 2;
      return {
        points: [
          { x: c.x - d.x * h, y: c.y - d.y * h },
          { x: c.x + d.x * h, y: c.y + d.y * h },
        ],
        pen: 'fine',
        layer,
      };
    };
    const hatchFor = (c: Point, dir: Point | null, count: number, layer: string): FlowLine[] => {
      const d = dir ?? { x: 0.7071, y: 0.7071 };
      const perp = { x: -d.y, y: d.x };
      const out: FlowLine[] = [];
      const span = cellSize * 0.8;
      const spacing = cellSize / (count + 1);
      // A touch of low-frequency jitter on the offset so bundles don't read as
      // arithmetically even (art style only).
      const jit = artStyle ? noise.noise2D(c.x * 0.05, c.y * 0.05) * spacing * 0.25 : 0;
      for (let k = 0; k < count; k++) {
        const off = (k - (count - 1) / 2) * spacing + jit;
        const ox = perp.x * off;
        const oy = perp.y * off;
        out.push({
          points: [
            { x: c.x + ox - d.x * span * 0.5, y: c.y + oy - d.y * span * 0.5 },
            { x: c.x + ox + d.x * span * 0.5, y: c.y + oy + d.y * span * 0.5 },
          ],
          pen: 'fine',
          layer,
        });
      }
      return out;
    };

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const i = cy * cols + cx;
        if (sim.finalAlive[i]) continue; // present drawn separately
        // Reserve negative space in the frame corners by lightening tone there.
        let t = markTone[i];
        if (vignette > 0) {
          const fx = cols > 1 ? cx / (cols - 1) : 0.5;
          const fy = rows > 1 ? cy / (rows - 1) : 0.5;
          const w = Math.max(0, 1 - 2 * Math.min(fx, 1 - fx)) * Math.max(0, 1 - 2 * Math.min(fy, 1 - fy));
          t *= 1 - vignette * w;
        }
        if (t < faintThreshold) continue;
        if (haloCells[i]) continue; // hold history off the present's halo
        const c = cellCenter(cx, cy);
        const dir =
          motionDir(sim.lastAlive, cols, rows, cx, cy) ??
          (markAngleNoise ? noiseAngle(noise, cx, cy, 0.3) : null);
        if (t < mediumThreshold) {
          lines.push(dashFor(c, dir, 0.7, 'trail'));
        } else if (t < solidThreshold) {
          const count = 1 + Math.round(((t - mediumThreshold) / (solidThreshold - mediumThreshold)) * 2);
          lines.push(...hatchFor(c, dir, count, 'ghost'));
        } else {
          lines.push(...hatchFor(c, dir, 4, 'ghost'));
        }
      }
    }
  };

  // ---- History as nested iso-contours ------------------------------------
  const renderContour = (minLevelFrac: number): void => {
    const blurred = gaussianBlur({ width: cols, height: rows, data: new Float32Array(tone) }, 1.2);
    const span = solidThreshold - faintThreshold;
    for (let k = 0; k < contourLevels; k++) {
      const frac = (k + 0.5) / contourLevels;
      if (frac < minLevelFrac) continue;
      const iso = faintThreshold + span * frac;
      const layer = frac < 0.5 ? 'trail' : 'ghost';
      for (const poly of traceIsoContours(blurred, iso)) {
        if (poly.length < 3) continue;
        const px = poly.map((p) => ({
          x: originX + (p.x + 0.5) * cellSize,
          y: originY + (p.y + 0.5) * cellSize,
        }));
        for (const run of clipPolylineByMask(px, inHalo)) {
          const smooth = smoothPolyline(run, 2);
          if (smooth.length >= 2) lines.push({ points: smooth, pen: 'fine', layer });
        }
      }
    }
  };

  // ---- History as tracked centre-line streaks ----------------------------
  const renderStreaks = (): void => {
    for (const track of sim.tracks) {
      const px = track.map((p) => cellCenter(p.x, p.y));
      for (const run of clipPolylineByMask(px, inHalo)) {
        const smooth = smoothPolyline(run, 3);
        if (smooth.length >= 2) lines.push({ points: smooth, pen: 'fine', layer: 'trail' });
      }
    }
    // The chaotic core can't be tracked — render it as soft ghost contours.
    renderContour(0.5);
  };

  // ---- History as evenly-spaced flow streamlines -------------------------
  // The colony's motion field — the direction each region was last alive from
  // — drives a set of Jobard–Lefer evenly-spaced streamlines. Local spacing
  // carries tone, so the lines weave tight through the dense core and fan out
  // into the comet tails: one continuous flowing drawing, the toolbox's
  // signature streamline technique applied to the exposure.
  const renderSlipstream = (): void => {
    const { fx: fxField, fy: fyField } = blurredMotionField(sim.lastAlive, cols, rows, 1.5);

    // Bilinear sample of the (renormalized) flow field in cell coordinates.
    const sampleDir = (x: number, y: number): Point | null => {
      const gx = Math.min(cols - 1.001, Math.max(0, x));
      const gy = Math.min(rows - 1.001, Math.max(0, y));
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const tx = gx - x0;
      const ty = gy - y0;
      const i00 = y0 * cols + x0;
      const sx =
        fxField[i00] * (1 - tx) * (1 - ty) + fxField[i00 + 1] * tx * (1 - ty) +
        fxField[i00 + cols] * (1 - tx) * ty + fxField[i00 + cols + 1] * tx * ty;
      const sy =
        fyField[i00] * (1 - tx) * (1 - ty) + fyField[i00 + 1] * tx * (1 - ty) +
        fyField[i00 + cols] * (1 - tx) * ty + fyField[i00 + cols + 1] * tx * ty;
      const len = Math.hypot(sx, sy);
      if (len < 1e-4) return null;
      return { x: sx / len, y: sy / len };
    };
    const cellAt = (x: number, y: number): number => {
      const cxi = Math.min(cols - 1, Math.max(0, Math.round(x)));
      const cyi = Math.min(rows - 1, Math.max(0, Math.round(y)));
      return cyi * cols + cxi;
    };
    const toneAt = (x: number, y: number): number => tone[cellAt(x, y)];
    const haloAt = (x: number, y: number): boolean => haloCells[cellAt(x, y)] === 1;

    // Separation (in cells) carries tone: tight in the dark trails, loose in
    // the faint ones, so spacing reads the long-exposure value.
    const baseSep = Math.max(0.4, slipstreamSpacing);
    const sepAt = (t: number): number => baseSep * (1.8 - t);

    // Spatial hash of accepted streamline points for the separation test.
    const buckets = new Map<number, Point[]>();
    const keyOf = (x: number, y: number): number =>
      ((Math.floor(y / baseSep) | 0) * 100000) + Math.floor(x / baseSep);
    const tooClose = (x: number, y: number, sep: number): boolean => {
      const bx = Math.floor(x / baseSep);
      const by = Math.floor(y / baseSep);
      const s2 = sep * sep;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const arr = buckets.get(((by + dy) | 0) * 100000 + (bx + dx));
          if (!arr) continue;
          for (const p of arr) {
            const ddx = p.x - x;
            const ddy = p.y - y;
            if (ddx * ddx + ddy * ddy < s2) return true;
          }
        }
      }
      return false;
    };
    const addPoint = (x: number, y: number): void => {
      const key = keyOf(x, y);
      let arr = buckets.get(key);
      if (!arr) {
        arr = [];
        buckets.set(key, arr);
      }
      arr.push({ x, y });
    };

    const step = 0.5; // cell-units advanced per RK2 step
    const maxSteps = (cols + rows) * 2;

    // Integrate from (sx, sy) along sign·flow until the line leaves the field,
    // fades below the faint cutoff, reaches the present halo, or crowds an
    // already-accepted streamline.
    const integrate = (sx: number, sy: number, sign: number): Point[] => {
      const pts: Point[] = [];
      let x = sx;
      let y = sy;
      for (let n = 0; n < maxSteps; n++) {
        if (x < 0 || x >= cols || y < 0 || y >= rows) break;
        if (toneAt(x, y) < faintThreshold || haloAt(x, y)) break;
        if (tooClose(x, y, sepAt(toneAt(x, y)) * 0.5)) break;
        pts.push({ x, y });
        const d1 = sampleDir(x, y);
        if (!d1) break;
        const d2 = sampleDir(x + sign * d1.x * step * 0.5, y + sign * d1.y * step * 0.5) ?? d1;
        x += sign * d2.x * step;
        y += sign * d2.y * step;
      }
      return pts;
    };

    // Seed densest first (deterministic, index tiebreak) so the committed core
    // anchors the field and the trails weave around it.
    const order: number[] = [];
    for (let i = 0; i < cols * rows; i++) if (tone[i] >= faintThreshold) order.push(i);
    order.sort((a, b) => tone[b] - tone[a] || a - b);

    for (const i of order) {
      const x0 = i % cols;
      const y0 = (i / cols) | 0;
      if (haloAt(x0, y0) || tooClose(x0, y0, sepAt(tone[i]))) continue;
      const fwd = integrate(x0, y0, +1);
      const bwd = integrate(x0, y0, -1);
      const linePts = bwd.slice(1).reverse().concat(fwd);
      if (linePts.length < 4) continue;
      let meanTone = 0;
      for (const p of linePts) {
        addPoint(p.x, p.y);
        meanTone += toneAt(p.x, p.y);
      }
      meanTone /= linePts.length;
      const layer = meanTone < mediumThreshold ? 'trail' : 'ghost';
      const px = linePts.map(cellPointToPx);
      for (const run of clipPolylineByMask(px, inHalo)) {
        const smooth = smoothPolyline(run, 2);
        if (smooth.length >= 2) lines.push({ points: smooth, pen: 'fine', layer });
      }
    }
  };

  // ---- History as stipple (sparks & embers) ------------------------------
  // Dot density carries tone on its own curve: dense clustered comet heads
  // trailing off into sparse scattered sparks. Density reads the raw tone (not
  // the banded plan — quantizing kills a stipple gradient), each dot a minimal
  // tick smeared along travel so the field still records motion.
  const renderEmbers = (): void => {
    const rand = makeRandom((seed ^ 0x5be11a) >>> 0);
    const h = cellSize * 0.08;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const i = cy * cols + cx;
        if (sim.finalAlive[i]) continue; // present drawn separately
        if (haloCells[i]) continue; // hold history off the present's halo
        let t = tone[i];
        if (vignette > 0) {
          const fxn = cols > 1 ? cx / (cols - 1) : 0.5;
          const fyn = rows > 1 ? cy / (rows - 1) : 0.5;
          const w =
            Math.max(0, 1 - 2 * Math.min(fxn, 1 - fxn)) * Math.max(0, 1 - 2 * Math.min(fyn, 1 - fyn));
          t *= 1 - vignette * w;
        }
        if (t < faintThreshold) continue;
        const dots = Math.max(1, Math.round(stippleDensity * t));
        const c = cellCenter(cx, cy);
        const d = motionDir(sim.lastAlive, cols, rows, cx, cy) ?? { x: 0.7071, y: 0.7071 };
        const layer = t < mediumThreshold ? 'trail' : 'ghost';
        for (let k = 0; k < dots; k++) {
          const px = c.x + (rand() - 0.5) * cellSize;
          const py = c.y + (rand() - 0.5) * cellSize;
          lines.push({
            points: [
              { x: px - d.x * h, y: py - d.y * h },
              { x: px + d.x * h, y: py + d.y * h },
            ],
            pen: 'fine',
            layer,
          });
        }
      }
    }
  };

  // ---- History as a disturbed calm multi-ink grating ----------------------
  const renderWeaveStyle = (): void => {
    const { fx, fy } = blurredMotionField(sim.lastAlive, cols, rows, 1.5);
    const blurTone = gaussianBlur({ width: cols, height: rows, data: new Float32Array(tone) }, 1.5)
      .data;
    // Reserved paper around the present at an exact, smooth radius: chamfer
    // distance to the alive cells, lightly blurred so the silhouette's cell
    // corners round off (blurring the distance field can never delete a
    // one-cell still-life the way blurring the binary would).
    const haloDist = gaussianBlur(
      { width: cols, height: rows, data: chamferDistanceCells(sim.finalAlive, cols, rows) },
      0.6
    ).data;
    // Ring iso levels: 2 rings per contour level across the faint..solid
    // span (renderContour's range) — the trail skirts live in that band, so
    // that's where nesting density buys visible ripples.
    const ringLevelCount = Math.max(2, contourLevels) * 2;
    const ringIsoLevels =
      weaveForm === 'rings'
        ? Array.from(
            { length: ringLevelCount },
            (_, k) =>
              faintThreshold + (solidThreshold - faintThreshold) * ((k + 0.5) / ringLevelCount)
          )
        : [];
    lines.push(
      ...renderWeave({
        cols,
        rows,
        originX,
        originY,
        cellSize,
        blurTone,
        flowX: fx,
        flowY: fy,
        haloDist,
        haloRadius,
        seed,
        vignette,
        inks: weaveInks,
        pitch: weavePitch,
        angleDeg: weaveAngle,
        separation: weaveSeparation,
        vernier: weaveVernier,
        bend: weaveBend,
        pitchSwell: weavePitchSwell,
        wobble: weaveWobble,
        coverage: weaveCoverage,
        form: weaveForm,
        ringIsoLevels,
      })
    );
  };

  renderPresent();
  if (style === 'contour') renderContour(0);
  else if (style === 'streaks') renderStreaks();
  else if (style === 'slipstream') renderSlipstream();
  else if (style === 'embers') renderEmbers();
  else if (style === 'weave') renderWeaveStyle();
  else renderMarks();

  let result: FlowLinesResult = { lines, width, height, seed };

  // Faint old marks wobble (haunted); crisp final cells stay sharp. The weave
  // grating handles its own tone-scaled wobble inline — the default scale here
  // is exactly backwards for a calm ruling (calm ⇒ tone 0 ⇒ max shake) — so
  // its band layers are exempted; present-layer strokes keep their wobble.
  result = applyHandDrawnStyle(result, {
    amplitude: wobble,
    wavelength: cellSize * 8,
    seed,
    amplitudeScale: (x, y) => lerp(1.4, 0.12, tone[cellIndexAt(x, y)]),
    layerAmplitude:
      style === 'weave'
        ? Object.fromEntries(
            Array.from({ length: Math.max(1, Math.round(weaveInks)) }, (_, k) => [
              bandLayerName(k),
              0,
            ])
          )
        : undefined,
  });

  // Chaining could hairpin-join adjacent same-ink rulings where the weave's
  // swell/separation squeeze them, so cap the merge tolerance by the pitch.
  if (optimize) {
    result = optimizePlot(
      result,
      style === 'weave' ? { mergeTolerance: Math.min(1.5, weavePitch * 0.4) } : undefined
    );
  }

  // The framing rule is no longer drawn here — the shared page border (see the
  // frame/page controls) draws it for every module. Conway still reserves the
  // art-mode gutter above (frameMargin) so the drawing sits clear of that rule,
  // keeping its output identical to when the border lived here.

  return result;
}
