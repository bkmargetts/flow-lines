import { FlowLine, Point } from '../flow-lines.js';
import { lerp, clamp01 } from '../lib/math.js';
import { TAU, pushRun, densifySegment, sampleProfileY } from './hatching.js';
import { occludeBehind } from './features.js';

/**
 * Flora and birds. Trees come in three archetypes drawn with real stroke
 * vocabulary (broken arcs, bough tiers, ground scrub) instead of one stamped
 * lollipop; they cluster the way trees actually gather, scale with depth
 * along the crest, and nearer canopies occlude farther ones. Birds fly in
 * loose flocks of curved, asymmetric wing strokes — a page of identical
 * shallow vees is a stamp, not a sky.
 */

export type TreeStyle = 'mixed' | 'round' | 'conifer' | 'scrub';

export interface TreeParams {
  crest: Point[];
  count: number;
  usableW: number;
  style: TreeStyle;
  lightX: number; // -1 | 1 — shade arcs go on the away side
  rng: () => number;
  /** Optional 0..1 acceptance weight — cluster centres retry toward high spots. */
  weight?: (x: number, y: number) => number;
}

interface TreeInstance {
  x: number;
  baseY: number;
  s: number;
  kind: Exclude<TreeStyle, 'mixed'>;
}

/** Approximate gaussian in [-1,1] from three uniform draws. */
function gauss(rng: () => number): number {
  return (rng() + rng() + rng()) / 1.5 - 1;
}

/** A slightly scalloped circular arc as a polyline (angles in radians). */
function scallopArc(cx: number, cy: number, r: number, a0: number, a1: number, wobAmp: number, wobFreq: number, phase: number): Point[] {
  const steps = Math.max(4, Math.round((Math.abs(a1 - a0) / TAU) * 26));
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = lerp(a0, a1, i / steps);
    const rr = r * (1 + wobAmp * Math.sin(a * wobFreq + phase));
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  return pts;
}

function drawRoundTree(out: FlowLine[], t: TreeInstance, lightX: number, rng: () => number): Point[] {
  const lean = (rng() - 0.5) * t.s * 0.35;
  const topX = t.x + lean;
  const cy = t.baseY - t.s * 1.9;
  // Trunk with a slight lean, forking near the canopy.
  pushRun(out, [{ x: t.x, y: t.baseY }, { x: lerp(t.x, topX, 0.6), y: t.baseY - t.s * 0.9 }, { x: topX, y: cy + t.s * 0.7 }], 'tree');
  if (rng() < 0.5) pushRun(out, [{ x: lerp(t.x, topX, 0.55), y: t.baseY - t.s * 0.8 }, { x: topX + t.s * 0.45, y: cy + t.s * 0.55 }], 'tree');
  // Two overlapping lobes, each outlined as 2-3 broken scalloped arcs — a
  // single closed outline reads as a die-cut sticker.
  const lobes: { cx: number; cy: number; r: number }[] = [
    { cx: topX - t.s * 0.38, cy: cy + t.s * 0.12, r: t.s * 0.72 },
    { cx: topX + t.s * 0.4, cy: cy - t.s * 0.12, r: t.s * 0.85 },
  ];
  for (const lobe of lobes) {
    let a = rng() * TAU;
    const pieces = 2 + Math.floor(rng() * 2);
    for (let p = 0; p < pieces; p++) {
      const span = TAU * (0.28 + 0.22 * rng());
      pushRun(out, scallopArc(lobe.cx, lobe.cy, lobe.r, a, a + span, 0.14, 5 + rng() * 3, rng() * TAU), 'tree');
      a += span + TAU * (0.04 + 0.06 * rng());
    }
  }
  // Shade arcs tucked into the away-from-light side.
  const shadeSide = -lightX;
  const nShade = 3 + Math.floor(rng() * 2);
  for (let sIdx = 0; sIdx < nShade; sIdx++) {
    const sc = lobes[rng() < 0.5 ? 0 : 1];
    const base = shadeSide > 0 ? 0 : Math.PI;
    const a0 = base - 0.5 + (rng() - 0.5) * 0.8;
    pushRun(out, scallopArc(sc.cx, sc.cy, sc.r * (0.45 + 0.25 * rng()), a0, a0 + 0.7 + rng() * 0.5, 0.1, 4, rng() * TAU), 'tree');
  }
  // Occlusion hull around both lobes.
  const hull = scallopArc(topX, cy, t.s * 1.25, 0, TAU, 0.08, 3, rng() * TAU);
  return hull;
}

function drawConifer(out: FlowLine[], t: TreeInstance, rng: () => number): Point[] {
  const h = t.s * 2.6;
  const lean = (rng() - 0.5) * t.s * 0.3;
  const topX = t.x + lean;
  const topY = t.baseY - h;
  const spineAt = (yy: number): number => lerp(t.x, topX, clamp01((t.baseY - yy) / h));
  pushRun(out, densifySegment({ x: t.x, y: t.baseY }, { x: topX, y: topY }, 8), 'tree');
  const tiers = 5 + Math.floor(rng() * 4);
  for (let k = 0; k < tiers; k++) {
    const f = (k + 0.6) / (tiers + 0.6); // 0 near tip … 1 near base
    const ty = topY + h * f * 0.92;
    const sx = spineAt(ty);
    const half = t.s * (0.15 + 0.85 * f);
    for (const side of [-1, 1]) {
      if (rng() < 0.18) continue; // some tiers miss a side
      const len = half * (0.7 + 0.4 * rng());
      const droop = len * (0.35 + 0.3 * rng());
      pushRun(out, [
        { x: sx, y: ty },
        { x: sx + side * len * 0.55, y: ty + droop * 0.35 },
        { x: sx + side * len, y: ty + droop },
      ], 'tree');
    }
  }
  return [
    { x: t.x - t.s * 1.05, y: t.baseY + 1 },
    { x: topX, y: topY - 1 },
    { x: t.x + t.s * 1.05, y: t.baseY + 1 },
  ];
}

function drawScrub(out: FlowLine[], t: TreeInstance, rng: () => number): Point[] {
  const n = 3 + Math.floor(rng() * 3);
  for (let k = 0; k < n; k++) {
    const bx = t.x + (k - (n - 1) / 2) * t.s * 0.55 + (rng() - 0.5) * t.s * 0.2;
    const r = t.s * (0.3 + 0.3 * rng());
    const by = t.baseY - r * 0.25;
    pushRun(out, scallopArc(bx, by, r, Math.PI * (1.05 + 0.1 * rng()), Math.PI * (1.95 + 0.1 * rng()), 0.15, 4 + rng() * 3, rng() * TAU), 'tree');
  }
  for (let k = 0; k < 2 + Math.floor(rng() * 3); k++) {
    const bx = t.x + (rng() - 0.5) * t.s * 1.4;
    const by = t.baseY - rng() * t.s * 0.2;
    pushRun(out, [{ x: bx, y: by }, { x: bx + (rng() - 0.5) * t.s * 0.2, y: by - t.s * (0.25 + 0.3 * rng()) }], 'tree');
  }
  return []; // too small to occlude anything
}

/** Trees along a crest: clustered, depth-scaled, nearer canopies occluding
 *  farther ones. */
export function drawTrees(out: FlowLine[], p: TreeParams): void {
  if (p.count <= 0) return;
  const x0 = p.crest[0].x;
  const x1 = p.crest[p.crest.length - 1].x;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const pt of p.crest) {
    if (pt.y < yMin) yMin = pt.y;
    if (pt.y > yMax) yMax = pt.y;
  }
  const clusterCount = Math.max(1, Math.min(3, Math.round(p.count / 3) + (p.rng() < 0.4 ? 1 : 0)));
  const clusters: { x: number; kind: Exclude<TreeStyle, 'mixed'> }[] = [];
  for (let c = 0; c < clusterCount; c++) {
    const kind: Exclude<TreeStyle, 'mixed'> =
      p.style !== 'mixed' ? p.style : p.rng() < 0.45 ? 'round' : p.rng() < 0.64 ? 'conifer' : 'scrub';
    let cx = lerp(x0 + p.usableW * 0.08, x1 - p.usableW * 0.08, p.rng());
    if (p.weight) {
      for (let att = 0; att < 3 && p.rng() > p.weight(cx, sampleProfileY(p.crest, cx)); att++) {
        cx = lerp(x0 + p.usableW * 0.08, x1 - p.usableW * 0.08, p.rng());
      }
    }
    clusters.push({ x: cx, kind });
  }
  const trees: TreeInstance[] = [];
  for (let i = 0; i < p.count; i++) {
    const cl = clusters[Math.floor(p.rng() * clusters.length)];
    const x = Math.min(x1 - 4, Math.max(x0 + 4, cl.x + gauss(p.rng) * p.usableW * 0.055));
    const baseY = sampleProfileY(p.crest, x);
    // Lower on the page = nearer = larger.
    const depth = yMax > yMin ? clamp01((baseY - yMin) / (yMax - yMin)) : 0.5;
    const s = p.usableW * (0.02 + 0.014 * p.rng()) * lerp(0.72, 1.25, depth);
    trees.push({ x, baseY, s, kind: cl.kind });
  }
  // Far to near: each nearer canopy hull erases the tree lines behind it
  // before its own strokes go down.
  trees.sort((a, b) => a.baseY - b.baseY);
  let treeLines: FlowLine[] = [];
  for (const t of trees) {
    const pending: FlowLine[] = [];
    const hull =
      t.kind === 'round' ? drawRoundTree(pending, t, p.lightX, p.rng) : t.kind === 'conifer' ? drawConifer(pending, t, p.rng) : drawScrub(pending, t, p.rng);
    if (hull.length >= 3) treeLines = occludeBehind(treeLines, hull);
    for (const l of pending) treeLines.push(l);
  }
  for (const l of treeLines) out.push(l);
}

export interface BirdParams {
  x0: number;
  x1: number;
  skyTopY: number;
  horizonY: number;
  usableW: number;
  usableH: number;
  count: number;
  sunActive: boolean;
  sunX: number;
  sunY: number;
  haloR: number;
  rng: () => number;
}

/** Gulls in loose diagonal flocks: curved asymmetric wing pairs, distant ones
 *  a single tick. */
export function drawBirds(out: FlowLine[], p: BirdParams): void {
  let remaining = Math.round(p.count);
  let guard = 0;
  while (remaining > 0 && guard++ < 20) {
    const flock = Math.min(remaining, 1 + Math.floor(p.rng() * 4));
    remaining -= flock;
    const fx = lerp(p.x0 + p.usableW * 0.12, p.x1 - p.usableW * 0.12, p.rng());
    const fy = lerp(p.skyTopY + p.usableH * 0.06, p.horizonY - p.usableH * 0.15, p.rng() * 0.7);
    const dirA = (p.rng() - 0.5) * 0.7 + (p.rng() < 0.5 ? 0.3 : -0.3);
    const step = p.usableW * (0.03 + 0.02 * p.rng());
    for (let b = 0; b < flock; b++) {
      const bx = fx + Math.cos(dirA) * step * b + (p.rng() - 0.5) * step * 0.5;
      const by = fy + Math.sin(dirA) * step * b * 0.6 + (p.rng() - 0.5) * step * 0.4;
      if (p.sunActive && Math.hypot(bx - p.sunX, by - p.sunY) < p.haloR * 1.2) continue;
      if (bx < p.x0 + 4 || bx > p.x1 - 4 || by < p.skyTopY + 4) continue;
      const s = p.usableW * (0.008 + 0.011 * p.rng());
      if (s < p.usableW * 0.011 && p.rng() < 0.4) {
        // Distant bird: one shallow curved tick.
        pushRun(out, [{ x: bx - s * 0.7, y: by }, { x: bx, y: by + s * 0.25 }, { x: bx + s * 0.6, y: by - s * 0.1 }], 'bird');
        continue;
      }
      // Two curved wings, asymmetric in span and lift.
      const lSpan = s * (0.8 + 0.5 * p.rng());
      const rSpan = s * (0.8 + 0.5 * p.rng());
      const lLift = s * (0.3 + 0.3 * p.rng());
      const rLift = s * (0.3 + 0.3 * p.rng());
      const dip = s * 0.3;
      pushRun(out, [
        { x: bx - lSpan, y: by - lLift },
        { x: bx - lSpan * 0.45, y: by + dip * 0.2 },
        { x: bx, y: by + dip },
      ], 'bird');
      pushRun(out, [
        { x: bx, y: by + dip },
        { x: bx + rSpan * 0.5, y: by + dip * 0.1 },
        { x: bx + rSpan, y: by - rLift },
      ], 'bird');
    }
  }
}
