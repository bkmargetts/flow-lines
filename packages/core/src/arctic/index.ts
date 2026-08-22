import type { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { orderPlot } from '../optimize.js';
import { randomSeed } from '../lib/rng.js';
import { clamp } from '../lib/math.js';
import { shuffleAztec, dominoClass, isPerfectTiling, type Domino, type DominoClass } from './shuffle.js';
import { MARK_CLASSES, arcticLayerName, outlineMarks, spineMarks, type ArcticMarks } from './marks.js';

export { shuffleAztec, dominoClass, isPerfectTiling, arcticLayerName, MARK_CLASSES };
export type { Domino, DominoClass, ArcticMarks };

/**
 * Arctic — the arctic circle of a uniformly random domino tiling, drawn in ink.
 *
 * A domino tiling of the Aztec diamond AD(n) is sampled EXACTLY uniformly by
 * domino shuffling (Elkies–Kuperberg–Larsen–Propp): O(n²), no Markov chain, no
 * burn-in, no mixing question — so the drawing is exactly deterministic per
 * seed and costs the same every time.
 *
 * What makes it a picture rather than a diagram is the arctic circle theorem
 * (Jockusch–Propp–Shor 1998): as n grows, the tiling freezes into four brick-
 * regular corners and stays disordered inside the circle inscribed in the
 * diamond, with the boundary between them becoming razor sharp. Nothing in the
 * algorithm mentions a circle.
 *
 * The four domino classes are what the theorem separates, so inking a subset of
 * them (see `marks.ts`) turns that into tone: solid welded rules where the
 * inked class is frozen, clean paper where the others are, broken dashes inside
 * the circle. The gradient and the hard curved edge are both consequences of
 * combinatorics — there is no shading anywhere in the code.
 *
 * Strokes are tagged `domino-n` / `domino-s` / `domino-e` / `domino-w` for
 * per-pen SVG export — one pen per domino class.
 */
export interface ArcticOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: the tiling. Exactly deterministic — no burn-in (default random) */
  seed?: number;
  /** Named look preset (default 'dissolve') */
  preset?: ArcticPreset;

  /**
   * Diamond order n. AD(n) holds n(n+1) dominoes, so cost and detail both grow
   * as n². Above ~200 the dominoes fall below a fine nib at A3 (default preset).
   */
  order?: number;
  /** Which domino classes get inked (default preset) */
  marks?: ArcticMarks;
  /**
   * Rotate the diamond by 45° so it reads as a square with the frozen regions
   * at the edges rather than the corners (default false).
   */
  upright?: boolean;

  // ---- Render ----
  /**
   * Hand-drawn wobble amplitude in px (default 0.35).
   *
   * Note there is deliberately no bold-emphasis option here. Everywhere else in
   * the repo weight comes from repeated offset passes of the same pen, but that
   * is a treatment for CONTOURS and this drawing has none: its tone is already
   * carried by how densely the welded runs pack, so extra passes would thread
   * new lines through a mass that is solid precisely because the tiling froze.
   * That would flatten the one thing the arctic circle theorem produces.
   */
  wobble?: number;
  /** Reorder strokes to cut pen travel (default true) */
  optimize?: boolean;
}

export type ArcticPreset = 'dissolve' | 'horizon' | 'brick' | 'weave';

/**
 * Look presets.
 * - `dissolve` inks ONE class: a solid mass at one pole dissolving into speckle
 *   across an exact circular arc. The strongest reading of the theorem.
 * - `horizon` inks both horizontal classes: dense rules top and bottom, blank
 *   paper left and right, chaos between — the circle cut twice.
 * - `brick` draws every domino outline: the even grey the theorem hides in,
 *   included because it is the honest default and reads well very large.
 * - `weave` inks all four classes as spines: an orthogonal weave that freezes
 *   into four directions at the corners.
 */
export const ARCTIC_PRESETS: Record<
  ArcticPreset,
  { order: number; marks: ArcticMarks; upright: boolean }
> = {
  dissolve: { order: 120, marks: 'one', upright: false },
  horizon: { order: 110, marks: 'horizontals', upright: false },
  brick: { order: 70, marks: 'outline', upright: false },
  weave: { order: 100, marks: 'all', upright: true },
};

/** Render a uniformly random domino tiling as plottable single-pen strokes. */
export function generateArctic(options: ArcticOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    seed = randomSeed(),
    preset = 'dissolve',
    wobble = 0.35,
    optimize = true,
  } = options;

  const p = ARCTIC_PRESETS[preset] ?? ARCTIC_PRESETS.dissolve;
  const order = clamp(Math.round(options.order ?? p.order), 4, 260);
  const marks = options.marks ?? p.marks;
  const upright = options.upright ?? p.upright;

  const dominoes = shuffleAztec(order, seed);

  // Lattice units are scaled after the fact, so the sampler never needs to know
  // the page size; `scale` is a placeholder and the fit below does the work.
  const raw = marks === 'outline'
    ? outlineMarks(dominoes, order, 1)
    : spineMarks(dominoes, order, MARK_CLASSES[marks] ?? ['N'], 1);

  // Fit the diamond into the page box, optionally turned 45° onto its side.
  const rot = upright ? Math.PI / 4 : 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const turned = raw.map((r) => ({
    cls: r.cls,
    points: r.points.map((q) => {
      const pt = { x: q.x * cos - q.y * sin, y: q.x * sin + q.y * cos };
      if (pt.x < x0) x0 = pt.x;
      if (pt.x > x1) x1 = pt.x;
      if (pt.y < y0) y0 = pt.y;
      if (pt.y > y1) y1 = pt.y;
      return pt;
    }),
  }));
  const spanX = Math.max(1e-6, x1 - x0);
  const spanY = Math.max(1e-6, y1 - y0);
  const boxW = Math.max(1, width - 2 * margin);
  const boxH = Math.max(1, height - 2 * margin);
  const k = Math.min(boxW / spanX, boxH / spanY);
  const offX = (width - spanX * k) / 2;
  const offY = (height - spanY * k) / 2;
  const place = (q: Point): Point => ({ x: (q.x - x0) * k + offX, y: (q.y - y0) * k + offY });

  const placed = turned.map((r) => ({ cls: r.cls, points: r.points.map(place) }));

  const lines: FlowLine[] = placed.map((r) => ({
    points: r.points,
    layer: arcticLayerName(r.cls),
  }));

  let result: FlowLinesResult = { lines, width, height, seed };
  if (wobble > 0) {
    result = applyHandDrawnStyle(result, { amplitude: wobble, wavelength: 90, jitter: wobble * 0.3, seed });
  }
  // orderPlot, not optimizePlot: chaining would fuse separate dominoes into one
  // path and round-cap the joins, softening exactly the crisp lattice geometry
  // the drawing is about. Reordering alone still cuts the pen-up travel.
  return optimize ? orderPlot(result) : result;
}
