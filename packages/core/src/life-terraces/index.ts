import { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { optimizePlot } from '../optimize.js';
import { createNoise } from '../noise.js';
import { makeRandom, randomSeed, subSeed } from '../lib/rng.js';
import { smoothPolyline } from '../lib/polyline.js';
import { lerp } from '../lib/math.js';
import { simulate, classifyFinal } from '../conway/sim.js';
import {
  cellSquare,
  clipPolylineByMask,
  coreBoundaryPolylines,
  angledRegionHatch,
} from '../conway/render.js';
import { offsetEmphasisPasses } from '../pen-ink/swell.js';
import { inkLayerName } from '../marbling/index.js';
import { PenAssignment } from '../lapidary/carve.js';
import { buildTerraceField, buildBlockMasks } from './field.js';
import { buildFaults, faultTraces } from './faults.js';
import { walkContourAgents } from './agents.js';

/**
 * Life Terraces — the Conway long exposure crossed with the terraces mark
 * language. A real Game of Life run accumulates the same decayed exposure
 * field as the conway generator; that blurred field is treated as terrain
 * and quantized into a few discrete terrace levels. Contour-walking agents
 * then hatch each level the Jobard–Lefer way — walking the iso-line tangent,
 * terminating at their level's boundary — so the history laminates into
 * banded onion-skin rings separated by reserved-paper seams, like a
 * fortification agate grown by Life. The crisp final generation still sits
 * on top as the bold present (traced mass + residue squares) inside its own
 * paper halo, keeping the long-exposure identity: crisp present, ghostly
 * terraced past.
 */
export interface LifeTerracesOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: controls the detonation, agent deal, dashes, and wobble */
  seed?: number;

  // ---- Simulation (conway lineage) ---------------------------------------
  /** R-pentominoes detonated at the start (default 1) */
  seedCount?: number;
  /** Pixels per cell — the simulation's grid resolution (default ~width/100) */
  cellSize?: number;
  /** Generations to simulate (default 260) */
  generations?: number;
  /**
   * Per-generation exposure decay, 0..1 (default 0.96 — longer trails than
   * conway's 0.92: the laminae need a broad tonal skirt to terrace).
   */
  decay?: number;
  /** Perceptual lift on normalized exposure (default 0.45) */
  gamma?: number;
  /** Rule-of-thirds bias for a single detonation, 0..1 (default 0.6) */
  offCenter?: number;
  /** Gutter reserved around the drawing, in grid cells (default 2) */
  borderGap?: number;

  // ---- Field & terraces ---------------------------------------------------
  /** Gaussian blur of the tone field, in cells (default 1.5) */
  blurSigma?: number;
  /** Tone below this (0..1, post-gamma) leaves blank paper (default 0.08) */
  faintThreshold?: number;
  /** Terrace levels the visible tone range quantizes into, 2..8 (default 5) */
  levels?: number;
  /** Reserved-paper seam width at level boundaries, px (default cellSize * 0.5) */
  seamWidth?: number;
  /**
   * Strike-slip fault planes sheared through the history, 0..4 (default 2).
   * Everything on one side of each fault is displaced along it, so the
   * terrace rings and laminae visibly offset at inked, reserved-paper
   * scarps — the terraces module's signature brought to the Life terrain.
   * The crisp present never shears: the fault displaces the record, not the
   * living colony.
   */
  faults?: number;
  /**
   * Multiplier on each fault's seeded displacement, 0..2 (default 1).
   * Rescales the slip without moving the fault planes; 0 is a byte-identical
   * no-op.
   */
  faultThrow?: number;
  /** Ink the level-boundary iso-contours as broken bold dashes (default false) */
  outlines?: boolean;
  /** Offset passes each outline dash is built from, 1..3 (default 2) */
  outlineEmphasis?: number;

  // ---- Agents -------------------------------------------------------------
  /** Base streamline separation in cells (default 0.6); tone tightens it */
  spacing?: number;
  /** 0..1 spread between dense bright levels and sparse faint ones (default 0.6) */
  densityContrast?: number;
  /** Max stroke length in cells at full tone (default 40); faint levels shorter */
  strokeLength?: number;
  /** 0..1 cross-lamina undulation, capped so neighbours never touch (default 0.3) */
  waviness?: number;
  /** 0..1 end trims so dashes stop like a lifting pen (default 0.7) */
  taper?: number;
  /** Unbroken flowing laminae instead of hand-fed dashes (default false) */
  continuous?: boolean;

  // ---- Present (conway lineage) -------------------------------------------
  /** Final clusters this size or smaller are crisp residue squares (default 6) */
  residueMaxCells?: number;
  /** Trace the turbulent core as one hatched mass (default true) */
  massCore?: boolean;
  /** Offset passes building the bold core silhouette (default 3) */
  massOutlinePasses?: number;
  /** Base interior hatch angle for the core mass, degrees (default -32) */
  hatchAngle?: number;
  /** Cross-hatch second-layer angle, degrees (default 31) */
  crossHatchAngle?: number;
  /** Fraction of the core mass that gets the cross-hatch layer, 0..1 (default 0.5) */
  crossHatchAmount?: number;
  /** Low-frequency jitter on hatch spacing/phase, 0..1 (default 0.5) */
  hatchJitter?: number;
  /** Reserved-paper sliver around the present, px (default cellSize * 0.7) */
  haloRadius?: number;

  // ---- Pens & finish ------------------------------------------------------
  /** 1..4 — history strokes are tagged ink-0..ink-3 (default 1) */
  pens?: number;
  /**
   * 'per-region' gives each terrace level one pen (the banded-ring identity,
   * default); 'interleave' alternates pens agent-by-agent within a level.
   */
  penAssignment?: PenAssignment;
  /** Hand-drawn wobble amplitude in px (default scales with cellSize) */
  wobble?: number;
  /** Chain strokes and order them to cut pen travel (default true) */
  optimize?: boolean;
}

export const LIFE_TERRACES_PRESETS: Record<string, Partial<LifeTerracesOptions>> = {
  /** The reference look: five dashed levels, one pen. */
  exposure: {},
  /** Fortification-agate: many tight continuous laminae with inked boundaries. */
  agate: { levels: 7, outlines: true, spacing: 0.5, densityContrast: 0.4, continuous: true },
  /** Short-lived blast: three coarse levels of short sparse ticks. */
  ember: { decay: 0.92, levels: 3, densityContrast: 0.9, strokeLength: 14, taper: 0.9 },
  /** Colliding colonies, loose undulating laminae, pens interleaved. */
  drift: { seedCount: 3, waviness: 0.6, levels: 4, penAssignment: 'interleave' },
};

/** Runaway guard on hostile spacing/seam knobs. */
const LINE_CAP = 40000;

export function generateLifeTerraces(options: LifeTerracesOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    seed = randomSeed(),
    seedCount = 1,
    generations = 260,
    decay = 0.96,
    gamma = 0.45,
    offCenter = 0.6,
    blurSigma = 1.5,
    outlines = false,
    residueMaxCells = 6,
    massCore = true,
    massOutlinePasses = 3,
    crossHatchAmount = 0.5,
    hatchJitter = 0.5,
    penAssignment = 'per-region',
    optimize = true,
  } = options;

  const borderGap = Math.max(0.5, options.borderGap ?? 2);
  const cellSize = Math.max(2, options.cellSize ?? Math.round(width / 100));
  const faintThreshold = Math.min(0.5, Math.max(0.02, options.faintThreshold ?? 0.08));
  const levels = Math.max(2, Math.min(8, Math.round(options.levels ?? 5)));
  const seamWidth = Math.max(0, options.seamWidth ?? cellSize * 0.5);
  const faultCount = Math.max(0, Math.min(4, Math.round(options.faults ?? 2)));
  const faultThrow = Math.max(0, Math.min(2, options.faultThrow ?? 1));
  const outlineEmphasis = Math.max(1, Math.min(3, Math.round(options.outlineEmphasis ?? 2)));
  const spacing = Math.max(0.4, options.spacing ?? 0.6);
  const densityContrast = Math.min(1, Math.max(0, options.densityContrast ?? 0.6));
  const strokeLength = Math.max(4, Math.min(80, options.strokeLength ?? 40));
  const waviness = Math.min(1, Math.max(0, options.waviness ?? 0.3));
  const taper = Math.min(1, Math.max(0, options.taper ?? 0.7));
  const continuous = options.continuous ?? false;
  const hatchAngle = ((options.hatchAngle ?? -32) * Math.PI) / 180;
  const crossHatchAngle = ((options.crossHatchAngle ?? 31) * Math.PI) / 180;
  const haloRadius = options.haloRadius ?? cellSize * 0.7;
  const pens = Math.max(1, Math.min(4, Math.round(options.pens ?? 1)));
  const wobble = options.wobble ?? Math.max(0.4, cellSize * 0.12);

  // The border gutter is reserved unconditionally (conway's art-mode rule):
  // the gap is part of the simulation's footprint, so the shared page border
  // frames the drawing without ever resizing the grid.
  const frameMargin = margin + borderGap * cellSize;
  const usableW = Math.max(0, width - 2 * frameMargin);
  const usableH = Math.max(0, height - 2 * frameMargin);
  const cols = Math.floor(usableW / cellSize);
  const rows = Math.floor(usableH / cellSize);
  if (cols < 3 || rows < 3) return { lines: [], width, height, seed };

  const originX = frameMargin + (usableW - cols * cellSize) / 2;
  const originY = frameMargin + (usableH - rows * cellSize) / 2;

  // Stream layout: the raw seed feeds the simulation (first draw, mirroring
  // conway); everything downstream gets its own decorrelated stream so a
  // knob change never reshuffles an unrelated concern.
  const random = makeRandom(seed);
  const sim = simulate(
    cols,
    rows,
    Math.max(0, generations),
    decay,
    random,
    Math.max(1, Math.round(seedCount)),
    offCenter,
    null
  );
  const isCore = classifyFinal(sim.finalAlive, cols, rows, residueMaxCells);
  const noise = createNoise(subSeed(seed, 11));

  const faultPlanes = buildFaults(subSeed(seed, 8), cols, rows, faultCount, faultThrow);
  const field = buildTerraceField(sim, gamma, blurSigma, faintThreshold, levels, faultPlanes);
  const scarps = faultTraces(faultPlanes, field.blurred, faintThreshold);
  const masks = buildBlockMasks(
    field,
    sim.finalAlive,
    levels,
    cellSize,
    seamWidth,
    haloRadius,
    scarps
  );

  const half = cellSize / 2;
  const lines: FlowLine[] = [];

  // Raster/cell coords -> page px (the conway cell-centre convention).
  const cellPointToPx = (p: Point): Point => ({
    x: originX + (p.x + 0.5) * cellSize,
    y: originY + (p.y + 0.5) * cellSize,
  });
  const cellCenter = (cx: number, cy: number): Point => cellPointToPx({ x: cx, y: cy });
  const cellIndexAt = (x: number, y: number): number => {
    const cxi = Math.min(cols - 1, Math.max(0, Math.floor((x - originX) / cellSize)));
    const cyi = Math.min(rows - 1, Math.max(0, Math.floor((y - originY) / cellSize)));
    return cyi * cols + cxi;
  };
  // Page-px point back to raster coords, for clipping px polylines by masks.
  const inHaloPx = (p: Point): boolean =>
    masks.inHalo((p.x - originX) / cellSize - 0.5, (p.y - originY) / cellSize - 0.5);

  // ---- History: contour-walking agents ------------------------------------
  lines.push(
    ...walkContourAgents(field, masks.blocked, {
      spacing,
      densityContrast,
      strokeLength,
      waviness,
      taper,
      continuous,
      faintThreshold,
      levels,
      cellSize,
      toPx: cellPointToPx,
      pens,
      penAssignment,
      seed,
      noise,
      lineCap: LINE_CAP,
    })
  );

  // Bold broken line built from offset emphasis passes (the terraces outline
  // idiom): shared by the level-boundary outlines and the fault scarps.
  const fs = cellSize / 6;
  const pushBoldDashes = (
    poly: Point[],
    rng: () => number,
    dashFs: [number, number],
    gapFs: [number, number],
    passes: number,
    layer: string
  ): void => {
    const emitDash = (dash: Point[]): void => {
      if (dash.length < 2) return;
      lines.push({ points: dash, pen: 'bold', layer });
      for (const pass of offsetEmphasisPasses(dash, passes, 0.7 * Math.max(0.5, fs), 0.15)) {
        lines.push({ points: pass, pen: 'bold', layer });
      }
    };
    const smooth = smoothPolyline(poly, 2);
    if (smooth.length < 2) return;
    const cum: number[] = new Array(smooth.length);
    cum[0] = 0;
    for (let i = 1; i < smooth.length; i++) {
      cum[i] = cum[i - 1] + Math.hypot(smooth[i].x - smooth[i - 1].x, smooth[i].y - smooth[i - 1].y);
    }
    const total = cum[smooth.length - 1];
    // Tiny loops stay whole — dashing them leaves confetti.
    if (total < 60 * fs) {
      emitDash(smooth);
      return;
    }
    const at = (s: number): Point => {
      let i = 1;
      while (i < smooth.length - 1 && cum[i] < s) i++;
      const span = cum[i] - cum[i - 1] || 1;
      const f = (s - cum[i - 1]) / span;
      return {
        x: smooth[i - 1].x + (smooth[i].x - smooth[i - 1].x) * f,
        y: smooth[i - 1].y + (smooth[i].y - smooth[i - 1].y) * f,
      };
    };
    let s = 0;
    let guard = 0;
    while (s < total - 2 && guard++ < 400) {
      const e = Math.min(total, s + (dashFs[0] + rng() * dashFs[1]) * fs);
      const dash: Point[] = [at(s)];
      for (let i = 0; i < smooth.length; i++) {
        if (cum[i] > s && cum[i] < e) dash.push(smooth[i]);
      }
      dash.push(at(e));
      emitDash(dash);
      s = e + (gapFs[0] + rng() * gapFs[1]) * fs;
    }
  };

  // ---- Optional inked terrace boundaries ----------------------------------
  // The traced seam isos as bold broken dashes. They live inside their own
  // reserved seam, so only the present halo clips them.
  if (outlines) {
    const rng = makeRandom(subSeed(seed, 31));
    for (let k = 1; k < levels; k++) {
      const layer = inkLayerName(k % pens);
      for (const poly of masks.seamContours[k - 1]) {
        if (poly.length < 3) continue;
        for (const run of clipPolylineByMask(poly.map(cellPointToPx), inHaloPx)) {
          pushBoldDashes(run, rng, [30, 40], [8, 16], outlineEmphasis, layer);
        }
      }
    }
  }

  // ---- Fault scarps --------------------------------------------------------
  // The visible fault traces, inked as near-continuous bold lines on the
  // darkest pen — long dashes, short lifts — so the sheared offset of the
  // terraces reads as a deliberate geological cut.
  if (scarps.length > 0) {
    const rng = makeRandom(subSeed(seed, 32));
    for (const trace of scarps) {
      for (const run of clipPolylineByMask(trace.map(cellPointToPx), inHaloPx)) {
        pushBoldDashes(run, rng, [50, 40], [4, 6], 2, inkLayerName(0));
      }
    }
  }

  // ---- The crisp present (conway's treatment, duplicated) ------------------
  const pushBoldMass = (points: Point[]): void => {
    lines.push({ points, pen: 'bold', layer: 'present' });
    for (const pass of offsetEmphasisPasses(points, massOutlinePasses, cellSize * 0.18, 0.12)) {
      lines.push({ points: pass, pen: 'bold', layer: 'present' });
    }
  };
  const renderPresent = (): void => {
    if (massCore) {
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
      if (maxX >= 0) {
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
          if (seg.length >= 2) {
            lines.push({ points: seg.map(cellPointToPx), pen: 'fine', layer: 'present' });
          }
        }
      }
    }

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const i = cy * cols + cx;
        if (!sim.finalAlive[i]) continue;
        if (isCore[i] && massCore) continue; // drawn as one mass above
        const c = cellCenter(cx, cy);
        if (isCore[i]) {
          // massCore off: crisp filled boxes (conway's faithful treatment).
          const boxSpacing = Math.max(1, cellSize * 0.2);
          const reach = half * 0.92;
          for (let off = -reach; off <= reach; off += boxSpacing) {
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
          lines.push({ points: cellSquare(c.x, c.y, half, cellSize * 0.06), pen: 'bold', layer: 'present' });
        } else {
          // Residue still-lifes / glider heads: nested hollow squares, the
          // inner inset noise-jittered so they aren't pixel-identical.
          const jit = noise.noise2D(cx * 0.7, cy * 0.7) * 0.06;
          lines.push({ points: cellSquare(c.x, c.y, half, cellSize * 0.1), pen: 'bold', layer: 'present' });
          lines.push({
            points: cellSquare(c.x, c.y, half, cellSize * (0.24 + jit)),
            pen: 'bold',
            layer: 'present',
          });
        }
      }
    }
  };
  renderPresent();

  let result: FlowLinesResult = { lines, width, height, seed };

  // Faint outer levels wobble loose (haunted); the crisp present stays firm.
  // The displacement cap is the terraces rule the conway generator lacks:
  // seams and halos are reserved paper, and the statistical tail of
  // wobble-plus-jitter must never bend ink back into them.
  const reserved = [seamWidth, haloRadius].filter((v) => v > 0);
  result = applyHandDrawnStyle(result, {
    amplitude: wobble,
    wavelength: cellSize * 8,
    seed: subSeed(seed, 41),
    amplitudeScale: (x, y) => lerp(1.3, 0.15, field.tone[cellIndexAt(x, y)]),
    layerAmplitude: { present: 0.4 },
    maxDisplacement: reserved.length
      ? Math.max(0.25, 0.35 * Math.min(...reserved))
      : undefined,
  });

  if (optimize) {
    result = optimizePlot(result, { mergeTolerance: Math.min(1.5, cellSize * 0.3) });
  }

  return result;
}
