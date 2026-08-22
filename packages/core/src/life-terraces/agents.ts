import { FlowLine, Point } from '../flow-lines.js';
import { ProximityGrid } from '../lib/spatial.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { smoothPolyline } from '../lib/polyline.js';
import { lerp } from '../lib/math.js';
import { SimplexNoise } from '../noise.js';
import { inkLayerName } from '../marbling/index.js';
import { PenAssignment } from '../lapidary/carve.js';
import { TerraceField } from './field.js';

export interface AgentConfig {
  /** Base streamline separation in cells at full tone. */
  spacing: number;
  /** 0..1 spread between dense bright levels and sparse faint ones. */
  densityContrast: number;
  /** Max stroke length in cells at full tone; faint levels run shorter. */
  strokeLength: number;
  /** 0..1 fBm undulation across the laminae. */
  waviness: number;
  /** 0..1 end trims so dashes stop like a lifting pen. */
  taper: number;
  /** Unbroken flowing laminae instead of hand-fed dashes. */
  continuous: boolean;
  faintThreshold: number;
  /** Terrace level count (sets the termination corridor width). */
  levels: number;
  cellSize: number;
  /** Cell/raster coords -> page px (cell-centre convention). */
  toPx: (p: Point) => Point;
  pens: number;
  penAssignment: PenAssignment;
  seed: number;
  /** Shared stateless noise (waviness undulation). */
  noise: SimplexNoise;
  /** Runaway guard: stop emitting once this many lines exist. */
  lineCap: number;
}

/**
 * Contour-walking agents: seeded walkers spawn on the blurred exposure
 * terrain (densest cells first) and integrate along the iso-line tangent —
 * perpendicular to the field gradient — depositing evenly-spaced strokes the
 * Jobard–Lefer way. Each agent belongs to the terrace level it spawned in
 * and terminates the moment it wanders across a level boundary, so the
 * strokes laminate into banded onion-skin rings; a Newton nudge back toward
 * the spawn iso keeps neighbouring laminae parallel instead of staircasing.
 * Emitted marks speak the terraces language: hand-fed dashes with tapered
 * ends (or continuous flowing laminae), a light fBm undulation, and pens
 * dealt per level or interleaved stroke-by-stroke.
 */
export function walkContourAgents(field: TerraceField, blocked: (x: number, y: number) => boolean, cfg: AgentConfig): FlowLine[] {
  const { cols, rows } = field;
  const lines: FlowLine[] = [];

  // Separation carries tone: tight through the bright core, sparse in the
  // faint outer levels. The grid bucket must be at least the *largest*
  // query distance — ProximityGrid only scans +-1 buckets.
  const maxSep = cfg.spacing * (1 + cfg.densityContrast * 1.6);
  const sepAt = (t: number): number => cfg.spacing * (1 + cfg.densityContrast * 1.6 * (1 - t));
  const grid = new ProximityGrid(cols, rows, maxSep);

  // One rng per concern (stream stability: option changes that don't alter
  // the candidate list must not shift draws consumed elsewhere).
  const rngAgents = makeRandom(subSeed(cfg.seed, 21));
  const rngMarks = makeRandom(subSeed(cfg.seed, 22));
  // Per-level interleave counters, dealt the lapidary way (occasional skip so
  // the alternation reads hand-fed, not machine-cycled).
  const interleave: Array<{ rng: () => number; counter: number }> = [];
  const penLayerFor = (level: number): string => {
    if (cfg.pens <= 1) return inkLayerName(0);
    if (cfg.penAssignment === 'per-region') return inkLayerName(level % cfg.pens);
    let slot = interleave[level];
    if (!slot) {
      const rng = makeRandom(subSeed(cfg.seed, 300 + level));
      slot = { rng, counter: Math.floor(rng() * cfg.pens) };
      interleave[level] = slot;
    }
    const layer = inkLayerName(slot.counter % cfg.pens);
    slot.counter++;
    if (slot.rng() < 0.15) slot.counter++;
    return layer;
  };

  const step = 0.4; // cells advanced per RK2 step
  const unitTangent = (g: Point): Point | null => {
    const len = Math.hypot(g.x, g.y);
    if (len < 1e-5) return null;
    return { x: -g.y / len, y: g.x / len };
  };

  // Integrate from the spawn along sign * tangent until the agent leaves the
  // field, crosses its terrace boundary, hits reserved paper, or crowds an
  // accepted neighbour (half-separation, the Jobard-Lefer d_test).
  // Corridor half-width in tone: a stroke may drift a bit less than half a
  // level band from its spawn value before it terminates. A hard level-bin
  // test would kill agents spawned near a boundary instantly; the symmetric
  // corridor gives every lamina the same running room while the seam mask
  // still reserves the paper at the boundary itself.
  const corridor = ((1 - cfg.faintThreshold) / cfg.levels) * 0.45;
  const integrate = (x0: number, y0: number, v0: number, sign: number, maxSteps: number): Point[] => {
    const pts: Point[] = [];
    let x = x0;
    let y = y0;
    // Directional inertia: the blurred field saturates into flat plateaus in
    // the bright core, where the gradient (and with it the iso tangent)
    // vanishes. Instead of dying there, an agent coasts straight through on
    // its last direction; the flip guard keeps a re-emerging tangent from
    // doubling the line back on itself.
    let lastT: Point | null = null;
    const orient = (t: Point): Point =>
      lastT && t.x * lastT.x + t.y * lastT.y < 0 ? { x: -t.x, y: -t.y } : t;
    for (let n = 0; n <= maxSteps; n++) {
      if (x < 0 || x > cols - 1 || y < 0 || y > rows - 1) break;
      const v = field.sample(x, y);
      if (v < cfg.faintThreshold) break;
      if (Math.abs(v - v0) > corridor) break;
      if (blocked(x, y)) break;
      if (grid.hasNear(x, y, sepAt(v) * 0.5)) break;
      pts.push({ x, y });
      const t1raw = unitTangent(field.gradient(x, y));
      const t1: Point | null = t1raw ? orient(t1raw) : lastT;
      if (!t1) break;
      const g2 = field.gradient(x + sign * t1.x * step * 0.5, y + sign * t1.y * step * 0.5);
      const t2raw = unitTangent(g2);
      const t2: Point = t2raw
        ? t2raw.x * t1.x + t2raw.y * t1.y < 0
          ? { x: -t2raw.x, y: -t2raw.y }
          : t2raw
        : t1;
      lastT = t2;
      x += sign * t2.x * step;
      y += sign * t2.y * step;
      // Newton nudge back onto the spawn iso so integration drift never
      // staircases across the band.
      const g3 = field.gradient(x, y);
      const glen = Math.hypot(g3.x, g3.y);
      if (glen > 1e-5) {
        const d = Math.max(-0.3, Math.min(0.3, (v0 - field.sample(x, y)) / glen));
        x += (g3.x / glen) * d;
        y += (g3.y / glen) * d;
      }
    }
    return pts;
  };

  // --- Mark emission: the terraces dash/taper idiom -----------------------
  // (Duplicated from the closures inside lapidary/textures.ts fillRegion —
  // trimRunEnds / dashPolyline — which aren't exported; re-scaled to cells.)
  const arcLengths = (pts: Point[]): number[] => {
    const cum: number[] = new Array(pts.length);
    cum[0] = 0;
    for (let i = 1; i < pts.length; i++) {
      cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return cum;
  };
  const sliceAt = (pts: Point[], cum: number[], sa: number, sb: number): Point[] => {
    const at = (s: number): Point => {
      let i = 1;
      while (i < pts.length - 1 && cum[i] < s) i++;
      const span = cum[i] - cum[i - 1] || 1;
      const f = (s - cum[i - 1]) / span;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f,
      };
    };
    const out: Point[] = [at(sa)];
    for (let i = 0; i < pts.length; i++) {
      if (cum[i] > sa && cum[i] < sb) out.push(pts[i]);
    }
    out.push(at(sb));
    return out;
  };
  const trimEnds = (pts: Point[]): Point[] => {
    if (cfg.taper <= 0 || pts.length < 3) return pts;
    const cum = arcLengths(pts);
    const total = cum[pts.length - 1];
    if (total < cfg.cellSize) return pts;
    const maxTrim = Math.min(total * 0.35, cfg.cellSize * 1.6) * cfg.taper;
    const a = rngMarks() * maxTrim * 0.7;
    const b = total - rngMarks() * maxTrim * 0.7;
    if (b - a < cfg.cellSize * 0.3) return pts;
    return sliceAt(pts, cum, a, b);
  };
  // Translate a dash a hair off its chord so nested laminae pieces don't
  // register into one unbroken line.
  const staggered = (pts: Point[]): Point[] => {
    const staggerPx = cfg.cellSize * 0.06;
    if (pts.length < 2) return pts;
    const a = pts[0];
    const b = pts[pts.length - 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) return pts;
    const off = (rngMarks() * 2 - 1) * staggerPx;
    const ox = (-(b.y - a.y) / len) * off;
    const oy = ((b.x - a.x) / len) * off;
    return pts.map((p) => ({ x: p.x + ox, y: p.y + oy }));
  };
  const dashRuns = (pts: Point[]): Point[][] => {
    if (cfg.continuous) return [trimEnds(pts)];
    const cum = arcLengths(pts);
    const total = cum[pts.length - 1];
    // Short runs stay whole — dashing them leaves confetti.
    if (total <= cfg.cellSize * 6) return [trimEnds(pts)];
    const out: Point[][] = [];
    let s = 0;
    let guard = 0;
    while (s < total - cfg.cellSize * 0.3 && guard++ < 200) {
      const e = Math.min(total, s + cfg.cellSize * (3.5 + 5 * rngMarks()));
      out.push(staggered(trimEnds(sliceAt(pts, cum, s, e))));
      s = e + cfg.cellSize * (0.4 + 0.5 * rngMarks());
    }
    return out;
  };
  // A light cross-lamina undulation so long runs breathe like a drawn line.
  // Capped well below half the local separation so neighbours never touch.
  const undulate = (pts: Point[]): Point[] => {
    if (cfg.waviness <= 0 || pts.length < 3) return pts;
    const amp = cfg.waviness * cfg.spacing * cfg.cellSize * 0.5 * 0.35;
    const lambda = Math.max(36, cfg.cellSize * 10);
    return pts.map((p, i) => {
      const ahead = pts[Math.min(i + 1, pts.length - 1)];
      const behind = pts[Math.max(i - 1, 0)];
      const tx = ahead.x - behind.x;
      const ty = ahead.y - behind.y;
      const len = Math.hypot(tx, ty) || 1;
      const w = amp * cfg.noise.fbm(p.x / lambda, p.y / lambda, 2, 0.5, 2);
      return { x: p.x + (-ty / len) * w, y: p.y + (tx / len) * w };
    });
  };

  // Seed densest first (deterministic, index tiebreak — the slipstream
  // idiom) so the committed core anchors the field and the faint outer
  // levels weave around it.
  // Candidates come from the *blurred* field — the terrain the agents
  // actually walk. The raw tone is spottier (a glider deposits exposure on
  // scattered cells) and seeding from it would starve the blurred skirt
  // where the outer laminae live.
  const order: number[] = [];
  const bdata = field.blurred.data;
  for (let i = 0; i < cols * rows; i++) {
    if (bdata[i] >= cfg.faintThreshold) order.push(i);
  }
  order.sort((a, b) => bdata[b] - bdata[a] || a - b);

  for (const i of order) {
    if (lines.length >= cfg.lineCap) break;
    // Draw the jitters unconditionally BEFORE any accept test so the rng
    // stream position depends only on the candidate list.
    const jx = (rngAgents() - 0.5) * 0.4;
    const jy = (rngAgents() - 0.5) * 0.4;
    const x0 = (i % cols) + jx;
    const y0 = ((i / cols) | 0) + jy;
    if (x0 < 0 || x0 > cols - 1 || y0 < 0 || y0 > rows - 1) continue;
    const v0 = field.sample(x0, y0);
    const level = field.levelOf(v0);
    if (level < 0) continue;
    if (blocked(x0, y0)) continue;
    if (grid.hasNear(x0, y0, sepAt(v0))) continue;

    const maxSteps = Math.max(4, Math.round((cfg.strokeLength * lerp(0.35, 1, v0)) / step));
    const fwd = integrate(x0, y0, v0, +1, maxSteps);
    const bwd = integrate(x0, y0, v0, -1, maxSteps);
    const linePts = bwd.slice(1).reverse().concat(fwd);
    if (linePts.length < 4) continue;
    for (const p of linePts) grid.add(p);

    const px = smoothPolyline(undulate(linePts.map(cfg.toPx)), 2);
    const layer = penLayerFor(level);
    for (const run of dashRuns(px)) {
      if (run.length >= 2) lines.push({ points: run, pen: 'fine', layer });
    }
  }

  return lines;
}
