import type { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { createNoise } from '../noise.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { randomSeed, subSeed } from '../lib/rng.js';
import { clipPolylineToRect } from '../lib/polyline.js';
import { ellipse } from '../planet/geometry.js';
import { ZBuffer } from '../vines/spatial.js';
import { placeFigures, fitFigures, type FacingMode } from './layout.js';
import { buildFigure, type FigureBuild } from './figure.js';
import { stampScene, splitVisible } from './occlude.js';
import type { PoseMode } from './poses.js';

export type { FacingMode } from './layout.js';
export type { PoseMode } from './poses.js';

const TAU = Math.PI * 2;

/**
 * A crowd of stick men on an isometric ground plane, drawn as plottable
 * pen-and-ink. Figures are scattered (with optional clustering), posed by
 * fully-procedural forward kinematics, projected through the shared 2:1
 * pixel-iso mapping (`city/project.ts`), and resolved back-to-front with
 * head-only hidden-line removal so a limb never appears to pass through a
 * nearer head (limbs otherwise overlap freely). The look is the classic thin
 * stick figure: a circle head, single-pen curved (rounded) limbs that connect
 * to the spine. Single pen, tone is none — paper does
 * the work. Deterministic per seed. Mirrors the City / Vine / Planet
 * Generators: heavy algorithm here in core, a thin web/CLI wrapper feeds it.
 */
export interface StickmenOptions {
  width: number;
  height: number;
  margin: number;
  seed?: number;

  // Scene / placement
  count?: number;
  spread?: number; // world-region multiplier
  clustering?: number; // 0..1
  minSeparation?: number; // world px
  facing?: FacingMode;
  facingAngle?: number; // radians (procession / toward)
  facingJitter?: number; // radians

  // Figure
  figureScale?: number; // px mean standing height
  scaleVariance?: number; // 0..1
  penWidth?: number;
  /** 0 = angular hinged limbs, 1 = smoothly curved (rounded) limbs. */
  limbCurve?: number;

  // Pose
  poseEnergy?: number; // 0..1
  poseMode?: PoseMode; // reserved: only 'procedural' in v1

  // Render
  occlude?: boolean;
  groundContact?: boolean;
  wobble?: number;
}

const DEFAULTS: Required<Omit<StickmenOptions, 'width' | 'height' | 'margin' | 'seed'>> = {
  count: 60,
  spread: 1,
  clustering: 0.35,
  minSeparation: 26,
  facing: 'random',
  facingAngle: Math.PI * 0.25,
  facingJitter: 0.5,
  figureScale: 46,
  scaleVariance: 0.25,
  penWidth: 1.4,
  limbCurve: 0.7,
  poseEnergy: 0.6,
  poseMode: 'procedural',
  occlude: true,
  groundContact: false,
  wobble: 0.8,
};

/** Hard cap so a runaway count knob can't blow up plot time. */
const MAX_FIGURES = 1200;

/** A short flat contact ellipse under the feet, grounding the figure. */
function contactShadow(feet: Point[]): FlowLine | null {
  if (feet.length < 2) return null;
  const cx = (feet[0].x + feet[1].x) / 2;
  const cy = (feet[0].y + feet[1].y) / 2;
  const stance = Math.hypot(feet[1].x - feet[0].x, feet[1].y - feet[0].y);
  const rx = Math.max(stance * 0.7, 4) + 2;
  const ry = Math.max(rx * 0.42, 2);
  return { points: ellipse(cx, cy, rx, ry, 0, 0, TAU), pen: 'fine', layer: 'contact' };
}

export function generateStickmen(options: StickmenOptions): FlowLinesResult {
  const o = { ...DEFAULTS, ...options };
  const seed = options.seed ?? randomSeed();
  const { width, height, margin } = options;
  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;

  const noise = createNoise(subSeed(seed, 5));
  const specs = placeFigures(
    {
      count: Math.min(MAX_FIGURES, Math.max(1, Math.round(o.count))),
      spread: o.spread,
      clustering: o.clustering,
      minSeparation: o.minSeparation,
      facing: o.facing,
      facingAngle: o.facingAngle,
      facingJitter: o.facingJitter,
      figureScale: o.figureScale,
      scaleVariance: o.scaleVariance,
    },
    noise,
    seed
  );
  const { proj } = fitFigures(specs, { x0, y0, x1, y1 });

  const builds: FigureBuild[] = specs.map((s) =>
    buildFigure(s, proj, {
      poseEnergy: o.poseEnergy,
      penWidth: o.penWidth,
      limbCurve: o.limbCurve,
    })
  );

  // Hidden-line removal against a shared depth buffer holding every figure's
  // head — so a limb never appears to pass through a nearer head.
  const cell = Math.max(0.6, o.penWidth * 0.5);
  const zbuf = o.occlude ? new ZBuffer(width, height, cell) : null;
  if (zbuf) stampScene(zbuf, builds);
  const step = Math.max(1, o.penWidth * 0.8);

  const lines: FlowLine[] = [];
  for (const b of builds) {
    const emit: FlowLine[] = [];
    if (o.groundContact) {
      const c = contactShadow(b.feet);
      if (c) emit.push(c);
    }
    for (const s of b.strokes) emit.push(s);

    for (const s of emit) {
      if (zbuf) {
        for (const run of splitVisible(s.points, b.depth, zbuf, step)) {
          lines.push({ ...s, points: run });
        }
      } else {
        lines.push(s);
      }
    }
  }

  // Hand finish: a light wobble, then clip to the drawable box.
  let finished = applyHandDrawnStyle(
    { lines, width, height, seed },
    { amplitude: o.wobble, wavelength: 38, seed }
  ).lines;
  finished = finished.flatMap((l) =>
    clipPolylineToRect(l.points, x0, y0, x1, y1).map((pts) => ({ ...l, points: pts }))
  );

  return { lines: finished, width, height, seed };
}
