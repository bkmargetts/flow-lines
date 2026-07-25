import { Point } from '../flow-lines.js';
import { SimplexNoise } from '../noise.js';
import { Root, Stem } from './types.js';
import { ProximityGrid, STEM_CAP, polylineLength, steer } from '../lib/spatial.js';

// ——— growth model: recursive tip-growth ———

export interface GrowthParams {
  width: number;
  height: number;
  margin: number;
  stepLength: number;
  curl: number;
  noiseScale: number;
  gravitropism: number;
  branchProb: number;
  maxDepth: number;
}

export function growStems(
  roots: Root[],
  p: GrowthParams,
  rng: () => number,
  noise: SimplexNoise,
  grid: ProximityGrid | null,
  spacing: number,
  weightAt: ((x: number, y: number) => number) | null = null
): Stem[] {
  const { width, height, margin, stepLength, curl, noiseScale, gravitropism, branchProb, maxDepth } = p;
  const up = -Math.PI / 2;
  const stems: Stem[] = [];

  interface Tip {
    x: number;
    y: number;
    angle: number;
    depth: number;
    maxLength: number;
    half: number;
    guide?: Point[];
    gi: number;
    branch: boolean;
    branchMaxLen: number;
    /** A child branch starts tangent to its parent and curves away over the
     *  first few steps; this is the per-step turn applied during that ease-in,
     *  so the fork reads as a smooth crotch instead of a sharp angular V. */
    easeTurn: number;
  }
  const stack: Tip[] = roots.map((r) => ({ x: r.x, y: r.y, angle: r.angle, depth: 0, maxLength: r.maxLength, half: r.half, guide: r.guide, gi: 1, branch: false, branchMaxLen: r.branchMaxLen ?? Infinity, easeTurn: 0 }));
  const minBranchLen = stepLength * 6;
  const EASE_STEPS = 8; // steps over which a new branch eases away from its parent

  const inBounds = (x: number, y: number) => x >= margin && x <= width - margin && y >= margin && y <= height - margin;
  const clearDist = spacing * 1.6;
  const sepDist = spacing * 0.5;

  while (stack.length > 0 && stems.length < STEM_CAP) {
    const tip = stack.pop()!;
    const pts: Point[] = [{ x: tip.x, y: tip.y }];
    let { x, y, angle, gi } = tip;
    const startX = tip.x;
    const startY = tip.y;
    const steps = Math.max(2, Math.ceil(tip.maxLength / stepLength));
    const toInsert: Point[] = [];

    for (let i = 0; i < steps; i++) {
      if (tip.guide) {
        // Follow the composed master gesture: steer toward the active guide
        // point, advancing along the guide as we reach each.
        let target = tip.guide[Math.min(gi, tip.guide.length - 1)];
        if (Math.hypot(target.x - x, target.y - y) < stepLength * 2 && gi < tip.guide.length - 1) {
          gi++;
          target = tip.guide[gi];
        }
        const want = Math.atan2(target.y - y, target.x - x);
        angle = steer(angle, want, 0.25);
        angle += noise.noise2D(x * noiseScale, y * noiseScale) * curl * 0.18;
        if (gi >= tip.guide.length - 1 && Math.hypot(target.x - x, target.y - y) < stepLength * 1.5) break;
      } else {
        // Steer with two noise octaves offset per-branch by its start position,
        // so each cane wanders on its own slice of the field (neighbours don't
        // bend alike) — a low-frequency sweep plus a higher-frequency meander
        // that keeps short side-branches from reading as straight twigs.
        // Deterministic: derived from geometry, no new rng draws.
        const ox = startX * 0.013;
        const oy = startY * 0.017;
        const lf = noise.noise2D(x * noiseScale + ox, y * noiseScale + oy);
        const hf = noise.noise2D(x * noiseScale * 6.5 + ox + 50, y * noiseScale * 6.5 + oy + 50);
        angle += lf * curl * 0.28 + hf * curl * 0.5;
        // Gentle upward habit, softened — and weaker still on side-branches, so
        // they curl and wander instead of being pulled straight to vertical.
        angle = steer(angle, up, (0.03 + gravitropism * 0.09) * (tip.branch ? 0.5 : 1));
      }

      // Ease a new branch away from its parent: spread its divergence over the
      // first few steps so the fork is a smooth crotch, not a sharp angular kink.
      if (tip.easeTurn !== 0 && i < EASE_STEPS) angle += tip.easeTurn;

      const nx = x + Math.cos(angle) * stepLength;
      const ny = y + Math.sin(angle) * stepLength;
      if (!inBounds(nx, ny)) break;
      const cleared = Math.hypot(nx - startX, ny - startY) > clearDist;
      // The proximity break keeps *free* growth evenly spaced. A guided stem is
      // a designed line (a trellis column, a border edge, a master gesture) —
      // stopping it because an earlier stem's side-branch wandered past would
      // truncate the composition, so guided stems never break on proximity.
      if (grid && cleared && !tip.guide && grid.hasNear(nx, ny, sepDist)) break;

      x = nx;
      y = ny;
      pts.push({ x, y });
      if (grid && cleared) toInsert.push({ x, y });

      // Thin growth out as it enters the held-clear region (notan negative
      // space). Guarded so the rng sequence is untouched when massing is off.
      // The kill lands on side branches (which is what thins the canopy);
      // free trunks only thin weakly and guided trunks never die — a hard
      // per-step kill on the main gesture used to reduce a whole specimen to a
      // stub whenever its composed path crossed the held-clear third.
      if (weightAt && cleared) {
        const killP = tip.guide ? 0 : tip.branch ? 0.5 : 0.15;
        if (rng() < (1 - weightAt(x, y)) * killP) break;
      }

      const effBranchProb = weightAt ? branchProb * weightAt(x, y) : branchProb;
      if (tip.depth < maxDepth && stack.length + stems.length < STEM_CAP && rng() < effBranchProb) {
        const childMax = Math.min(tip.branchMaxLen, tip.maxLength * (0.5 + rng() * 0.28));
        // Skip stubby branches — they read as thorns, not growth.
        if (childMax >= minBranchLen) {
          // Asymmetric bias gives a more designed, less even branch pattern.
          // A shallow fork angle (~15°–34°) so branches diverge gently and the
          // junction flows — a wide kink reads as a snapped twig, not growth.
          const dir = rng() < 0.62 ? 1 : -1;
          const turn = dir * (0.26 + rng() * 0.34);
          // Continuous taper: a branch starts near the parent's *local* width.
          const parentLocal = tip.half * (1 - 0.5 * (i / steps));
          stack.push({
            x, y,
            // Start tangent to the parent; the divergence is spread over the
            // first EASE_STEPS via easeTurn, so the crotch curves rather than kinks.
            angle,
            depth: tip.depth + 1,
            maxLength: childMax,
            half: Math.max(0.6, parentLocal * 0.82),
            gi: 0,
            branch: true,
            branchMaxLen: tip.branchMaxLen,
            easeTurn: turn / EASE_STEPS,
          });
        }
      }
    }

    // Drop stubby branch fragments; keep all trunk/guide stems. The full
    // minBranchLen floor (not a fraction of it) — surviving nubs read as
    // thorn-stub noise scattered over the plant, not growth.
    if (pts.length >= 2 && (!tip.branch || polylineLength(pts) >= minBranchLen)) {
      stems.push({ points: pts, baseHalf: tip.half, branch: tip.branch });
      if (grid) for (const q of toInsert) grid.add(q);
    }
  }

  return stems;
}

// ——— space colonization (Runions) ———

export interface ColonizeParams {
  width: number;
  height: number;
  margin: number;
  stepLength: number;
  attractorCount: number;
  attractorRadius: number;
  killRadius: number;
}

export function colonize(
  roots: Root[],
  p: ColonizeParams,
  rng: () => number,
  baseHalf: number,
  penPx: number,
  maxLength: number,
  region?: (x: number, y: number) => boolean,
  boundary?: Point[][]
): Stem[] {
  const { width, height, margin, stepLength } = p;
  const attractorCount = Math.min(p.attractorCount, 1500);
  const arSq = p.attractorRadius * p.attractorRadius;
  const krSq = p.killRadius * p.killRadius;

  // Scatter attractors; for a `fill` composition keep only those inside the
  // target region so the network grows into its shape.
  const attractors: { x: number; y: number; alive: boolean }[] = [];
  let tries = 0;
  while (attractors.length < attractorCount && tries < attractorCount * 20) {
    tries++;
    const x = margin + rng() * (width - 2 * margin);
    const y = margin + rng() * (height - 2 * margin);
    if (region && !region(x, y)) continue;
    attractors.push({ x, y, alive: true });
  }
  // Extra attractors banked along the region's rim: uniform scatter alone
  // leaves the boundary under-served, so growth rounds the shape off into a
  // blob — the rim is exactly where the silhouette is decided.
  if (region && boundary && boundary.length > 0) {
    const rim = boundary.flat();
    if (rim.length > 0) {
      const jitterR = p.killRadius * 2;
      const extra = Math.min(500, Math.round(attractorCount * 0.5));
      for (let i = 0; i < extra; i++) {
        const p0 = rim[Math.floor(rng() * rim.length)];
        const x = p0.x + (rng() - 0.5) * jitterR;
        const y = p0.y + (rng() - 0.5) * jitterR;
        if (region(x, y)) attractors.push({ x, y, alive: true });
      }
    }
  }

  interface Node { x: number; y: number; parent: number; }
  const nodes: Node[] = roots.map((r) => ({ x: r.x, y: r.y, parent: -1 }));

  const MAX_ITER = 600;
  const NODE_CAP = 6000;
  for (let iter = 0; iter < MAX_ITER && nodes.length < NODE_CAP; iter++) {
    const influence = new Map<number, { dx: number; dy: number }>();
    let any = false;
    for (const a of attractors) {
      if (!a.alive) continue;
      let best = -1;
      let bestD = arSq;
      for (let n = 0; n < nodes.length; n++) {
        const dx = a.x - nodes[n].x;
        const dy = a.y - nodes[n].y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = n; }
      }
      if (best >= 0) {
        any = true;
        const nd = nodes[best];
        const dx = a.x - nd.x;
        const dy = a.y - nd.y;
        const L = Math.hypot(dx, dy) || 1;
        const inf = influence.get(best) ?? { dx: 0, dy: 0 };
        inf.dx += dx / L;
        inf.dy += dy / L;
        influence.set(best, inf);
      }
    }
    if (!any) break;

    const base = nodes.length;
    for (const [ni, inf] of influence) {
      const L = Math.hypot(inf.dx, inf.dy) || 1;
      const nd = nodes[ni];
      nodes.push({ x: nd.x + (inf.dx / L) * stepLength, y: nd.y + (inf.dy / L) * stepLength, parent: ni });
      if (nodes.length >= NODE_CAP) break;
    }

    for (const a of attractors) {
      if (!a.alive) continue;
      for (let n = base; n < nodes.length; n++) {
        const dx = a.x - nodes[n].x;
        const dy = a.y - nodes[n].y;
        if (dx * dx + dy * dy < krSq) { a.alive = false; break; }
      }
    }
  }

  return extractChains(nodes, baseHalf, penPx, maxLength, stepLength);
}

function extractChains(
  nodes: { x: number; y: number; parent: number }[],
  baseHalf: number,
  penPx: number,
  longLen: number,
  stepLength: number
): Stem[] {
  const childCount = new Array(nodes.length).fill(0);
  for (const nd of nodes) if (nd.parent >= 0) childCount[nd.parent]++;
  const firstChild = new Array(nodes.length).fill(-1);
  for (let i = nodes.length - 1; i >= 0; i--) {
    const par = nodes[i].parent;
    if (par >= 0) firstChild[par] = i;
  }

  // Terminal spurs shorter than this read as spiky noise on the network rather
  // than growth, so they're dropped — the single biggest legibility win for the
  // colonized 'fill' shapes (the heart was a thicket of stubs).
  const minTerminal = stepLength * 5;

  const stems: Stem[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const par = nodes[i].parent;
    const beginsBranch = par < 0 || childCount[par] > 1;
    if (!beginsBranch) continue;
    const pts: Point[] = [];
    if (par >= 0) pts.push({ x: nodes[par].x, y: nodes[par].y });
    let cur = i;
    pts.push({ x: nodes[cur].x, y: nodes[cur].y });
    while (childCount[cur] === 1) {
      cur = firstChild[cur];
      pts.push({ x: nodes[cur].x, y: nodes[cur].y });
    }
    if (pts.length >= 2) {
      const len = polylineLength(pts);
      const terminal = childCount[cur] === 0;
      if (terminal && par >= 0 && len < minTerminal) continue;
      const frac = Math.min(1, Math.sqrt(len / Math.max(1, longLen)));
      stems.push({ points: pts, baseHalf: penPx + (baseHalf - penPx) * frac, branch: par >= 0 });
    }
  }
  return stems;
}
