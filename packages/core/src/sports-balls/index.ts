import type { FlowLine, FlowLinesResult } from '../flow-lines.js';
import { createNoise } from '../noise.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { randomSeed, subSeed } from '../lib/rng.js';
import { ZBuffer } from '../lib/spatial.js';
import { compileRegion, type StickmenRegion } from '../stickmen/region.js';
import { splitVisible, type ZOffset } from '../stickmen/occlude.js';
import { placeBalls, type BallType } from './layout.js';
import { buildBall, type BallBuild } from './ball.js';
import { castShadowStrokes } from './shadows.js';

export type { BallType } from './layout.js';

/** Placement regions are shared with the stick-men crowd — same normalized
 *  drawable-box contract, same preset shape builders (star/heart/…). */
export type SportsBallsRegion = StickmenRegion;

/**
 * A pile of sports balls filling the page (or a shaped region), drawn as
 * plottable pen-and-ink. Each ball is an orthographically projected sphere
 * with type-specific seam curves — the truncated-icosahedron net of a
 * football, a basketball's channels, a volleyball's panel strips, the
 * figure-8 seam of a baseball or tennis ball — at its own 3D orientation, so
 * no two balls read identical. Balls soft-pack (below-diameter separation ⇒
 * an overlapping pile) and resolve back-to-front with exact silhouette
 * hidden-line removal. Optional shadow-side hatch lit by one shared light.
 * Single pen, deterministic per seed. Mirrors the Stickmen generator: heavy
 * algorithm here in core, a thin web wrapper feeds it.
 */
export interface SportsBallsOptions {
  width: number;
  height: number;
  margin: number;
  seed?: number;

  // Scene / placement
  count?: number;
  clustering?: number; // 0..1
  /** Soft minimum gap between centres, px. Below the mean diameter ⇒ balls
   *  overlap into a pile (the default look); `count` stays exact. */
  minSeparation?: number;
  /** Confine balls to a shape on the page, in normalized drawable-box
   *  coords — see `StickmenRegion` for the coordinate contract. Unset /
   *  'full' = the whole drawable box. */
  region?: SportsBallsRegion;
  /** Soft region edge: only ball CENTRES are confined, so balls poke up to
   *  a radius past the shape outline (the stickmen-feet look). Default
   *  holds the whole ball inside — crisp shape silhouettes. */
  softRegionEdge?: boolean;

  // Balls
  ballScale?: number; // px mean diameter
  scaleVariance?: number; // 0..1
  /** 0..1 — blend uniform diameters toward real-world relative diameters
   *  (a ping-pong ball is a fifth of a basketball). */
  trueSizes?: number;
  /** 0..0.5 — nearer (lower on page) balls grow, farther shrink. */
  depthGrade?: number;
  /** Type weights; omitted/<=0 excludes a type. All-off falls back to all. */
  mix?: Partial<Record<BallType, number>>;
  /** 0..1 — amount of per-ball random 3D orientation (0 = every ball shows
   *  its canonical upright face). */
  spin?: number;

  // Render
  /** 0..1 — shadow-side hatch density (0 = pure line art). */
  shading?: number;
  /** 0..1 — contact shadows: where a nearer ball crosses a farther one, the
   *  farther ball is hatched with a tapered crescent hugging the nearer
   *  ball's silhouette (away from the light), so the pile reads as stacked
   *  spheres. 0 disables. */
  castShadows?: number;
  /** Page-space light direction, radians (default upper-left-ish). */
  lightAngle?: number;
  occlude?: boolean;
  penWidth?: number;
  wobble?: number;
}

const DEFAULTS: Required<Omit<SportsBallsOptions, 'width' | 'height' | 'margin' | 'seed' | 'region'>> = {
  count: 60,
  clustering: 0.35,
  minSeparation: 30,
  softRegionEdge: false,
  ballScale: 56,
  scaleVariance: 0.25,
  trueSizes: 0.5,
  depthGrade: 0.15,
  mix: {
    soccer: 1,
    basketball: 1,
    volleyball: 1,
    baseball: 1,
    tennis: 1,
    pingpong: 1,
  },
  spin: 1,
  shading: 0,
  castShadows: 0.5,
  lightAngle: Math.PI * 1.75, // light from the upper right (page y is down)
  occlude: true,
  penWidth: 1.4,
  wobble: 0.8,
};

/** Hard cap so a runaway count knob can't blow up plot time. */
const MAX_BALLS = 2000;

export function generateSportsBalls(options: SportsBallsOptions): FlowLinesResult {
  const o = { ...DEFAULTS, ...options };
  const seed = options.seed ?? randomSeed();
  const { width, height, margin } = options;
  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;

  const noise = createNoise(subSeed(seed, 5));
  const pageRegion =
    o.region && o.region.kind !== 'full' ? compileRegion(o.region, { x0, y0, x1, y1 }) : null;
  const specs = placeBalls(
    {
      count: Math.min(MAX_BALLS, Math.max(1, Math.round(o.count))),
      clustering: o.clustering,
      minSeparation: o.minSeparation,
      softEdge: o.softRegionEdge,
      ballScale: o.ballScale,
      scaleVariance: o.scaleVariance,
      trueSizes: o.trueSizes,
      depthGrade: o.depthGrade,
      mix: o.mix,
      x0,
      y0,
      x1,
      y1,
      region: pageRegion,
    },
    noise,
    seed
  );

  const builds: BallBuild[] = specs.map((s, i) => {
    const b = buildBall(s, {
      spin: o.spin,
      shading: o.shading,
      lightAngle: o.lightAngle,
      penWidth: o.penWidth,
    });
    // Contact shadows cast by nearer overlapping balls belong to the
    // receiver, so they're cut by anything nearer than it (never by it).
    b.strokes.push(
      ...castShadowStrokes(specs, i, {
        castShadows: o.castShadows,
        lightAngle: o.lightAngle,
        penWidth: o.penWidth,
      })
    );
    return b;
  });

  // Hidden-line removal against a shared depth buffer holding every ball's
  // silhouette — a farther ball's lines are cut wherever a nearer ball covers
  // them. Unlike stickmen (heads only) the silhouette IS the occluder, so the
  // cuts are exact. A ball never occludes itself: its disc shares its depth
  // and `hidden` needs something strictly nearer.
  const cell = Math.max(0.6, o.penWidth * 0.5);
  const step = Math.max(1, o.penWidth * 0.8);
  let zbuf: ZBuffer | null = null;
  let off: ZOffset = { offX: 0, offY: 0 };
  if (o.occlude && specs.length > 1) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const b of builds) {
      for (const p of b.occluder) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }
    if (isFinite(minX)) {
      const pad = 4 * cell;
      off = { offX: -minX + pad, offY: -minY + pad };
      zbuf = new ZBuffer(maxX - minX + 2 * pad, maxY - minY + 2 * pad, cell);
      for (const b of builds) {
        zbuf.fill(
          b.occluder.map((p) => ({ x: p.x + off.offX, y: p.y + off.offY })),
          b.depth
        );
      }
    }
  }

  const lines: FlowLine[] = [];
  for (const b of builds) {
    for (const s of b.strokes) {
      if (zbuf) {
        for (const run of splitVisible(s.points, b.depth, zbuf, step, off)) {
          lines.push({ ...s, points: run });
        }
      } else {
        lines.push(s);
      }
    }
  }

  // Hand finish: a light wobble. Placement already insets each centre by its
  // radius, so the pile stays on the sheet; the web layer still clips
  // defensively for a clean plot.
  const finished = applyHandDrawnStyle(
    { lines, width, height, seed },
    { amplitude: o.wobble, wavelength: 38, seed }
  ).lines;

  return { lines: finished, width, height, seed };
}
