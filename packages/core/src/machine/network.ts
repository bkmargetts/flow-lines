import { commonTangents } from './geometry.js';
import { Z_BAND_STRIDE, allCircles, capsFor, circlesInBand, hubR, maxZAt, pitchR, segClear, type IdGen } from './synth.js';
import type { MachineCtx } from './context.js';
import type { Circle, Gear, Machine } from './types.js';

/**
 * The transmission network — what makes `connectivity: 1` read as ONE
 * mega-machine instead of scattered mechanisms. Candidate links are the MST
 * over cluster centroids plus a few extra chords at high connectivity; each
 * edge is realized as a belt between coaxial pulleys (differing radii = a
 * ratio, very machine) or, for mostly-vertical edges, a rope drop from a drum
 * to an idler pulley. A relaxation ladder keeps connectivity=1 a hard
 * invariant: strict clearance → endpoint-cluster clearance only with the belt
 * riding above both bands (occlusion sells it as depth) → the crossed variant.
 * Growth-time mesh links (synth.ts) are recorded in the same `links` graph.
 */

interface Edge {
  a: number;
  b: number;
  d: number;
}

/** Deterministic Prim MST over cluster centroids; returns tree edges. */
function mst(machine: Machine): Edge[] {
  const n = machine.clusters.length;
  const inTree = new Set<number>([0]);
  const edges: Edge[] = [];
  while (inTree.size < n) {
    let best: Edge | null = null;
    for (const i of inTree) {
      const ci = machine.clusters[i];
      for (let j = 0; j < n; j++) {
        if (inTree.has(j)) continue;
        const cj = machine.clusters[j];
        const d = Math.hypot(cj.cx - ci.cx, cj.cy - ci.cy);
        if (!best || d < best.d) best = { a: i, b: j, d };
      }
    }
    if (!best) break;
    inTree.add(best.b);
    edges.push(best);
  }
  return edges;
}

/** The big non-coaxial wheel of a cluster nearest a target point. */
function wheelToward(machine: Machine, cluster: number, tx: number, ty: number, skip?: Gear): Gear | undefined {
  let best: Gear | undefined;
  let bestD = Infinity;
  for (const g of machine.gears) {
    if (g.cluster !== cluster || g.coaxialWith !== undefined || g.teeth < 12) continue;
    if (skip && g.id === skip.id) continue;
    const d = Math.hypot(g.cx - tx, g.cy - ty);
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  return best;
}

/** Circles the belt run must clear at a given strictness, minus the two
 *  endpoint shafts. */
function obstacles(machine: Machine, strict: boolean, bandA: number, bandB: number, wa: Gear, wb: Gear): Circle[] {
  const raw = strict
    ? allCircles(machine)
    : [...circlesInBand(machine, bandA), ...(bandB !== bandA ? circlesInBand(machine, bandB) : [])];
  return raw.filter(
    (c) =>
      !(Math.abs(c.cx - wa.cx) < 1e-6 && Math.abs(c.cy - wa.cy) < 1e-6) &&
      !(Math.abs(c.cx - wb.cx) < 1e-6 && Math.abs(c.cy - wb.cy) < 1e-6)
  );
}

export function linkClusters(ctx: MachineCtx, machine: Machine, rng: () => number, ids: IdGen): void {
  const { o } = ctx;
  const caps = capsFor(o.sheetFactor);
  const n = machine.clusters.length;
  if (n < 2 || o.connectivity <= 0.02) return;

  const tree = mst(machine).sort((a, b) => a.d - b.d);
  // Growth-time mesh links already connect some pairs — skip their edges.
  const already = new Set(machine.links.map((l) => `${Math.min(l.a, l.b)}-${Math.max(l.a, l.b)}`));
  const want = Math.round(o.connectivity * (n - 1));
  const attempts: Edge[] = [];
  for (const e of tree) {
    if (attempts.length >= want) break;
    if (already.has(`${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`)) continue;
    attempts.push(e);
  }
  // Extra chords at high connectivity: shortest non-tree pairs.
  if (o.connectivity > 0.75) {
    const extra = Math.round(o.connectivity * n * 0.4);
    const chords: Edge[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const key = `${i}-${j}`;
        if (already.has(key) || tree.some((e) => (e.a === i && e.b === j) || (e.a === j && e.b === i))) continue;
        const ci = machine.clusters[i];
        const cj = machine.clusters[j];
        chords.push({ a: i, b: j, d: Math.hypot(cj.cx - ci.cx, cj.cy - ci.cy) });
      }
    }
    chords.sort((a, b) => a.d - b.d);
    for (const c of chords.slice(0, extra)) attempts.push(c);
  }

  for (const edge of attempts) {
    if (machine.belts.length >= caps.belts && machine.ropes.length >= caps.ropes) break;
    const ca = machine.clusters[edge.a];
    const cb = machine.clusters[edge.b];
    const wa = wheelToward(machine, edge.a, cb.cx, cb.cy);
    const wb = wheelToward(machine, edge.b, ca.cx, ca.cy);
    if (!wa || !wb) continue;

    const dx = wb.cx - wa.cx;
    const dy = wb.cy - wa.cy;
    const vertical = Math.abs(dy) > 1.4 * Math.abs(dx);

    // Mostly-vertical edges become a rope drop: drum on the upper shaft,
    // idler pulley on the lower — the clock-drive motif stretched into a
    // transmission.
    if (vertical && machine.ropes.length < caps.ropes) {
      const upper = wa.cy < wb.cy ? wa : wb;
      const lower = wa.cy < wb.cy ? wb : wa;
      const mUp = upper.module;
      const dr = Math.max(mUp * 1.5, hubR(upper) * 1.7);
      const ir = Math.max(lower.module * 1.1, hubR(lower) * 1.3);
      const side = lower.cx >= upper.cx ? 1 : -1;
      const x0 = upper.cx + side * dr;
      const x1 = lower.cx + side * ir;
      const zTop = 1 + Math.max(ca.zBand, cb.zBand) * Z_BAND_STRIDE + 6;
      let ok = true;
      for (const c of obstacles(machine, false, ca.zBand, cb.zBand, upper, lower)) {
        if (!segClear({ x: x0, y: upper.cy }, { x: x1, y: lower.cy - ir }, c, mUp * 0.5)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        const drumId = ids.next();
        const idlerId = ids.next();
        machine.drums.push({ kind: 'drum', id: drumId, cx: upper.cx, cy: upper.cy, r: dr, z: maxZAt(machine, upper.cx, upper.cy) + 1, cluster: upper.cluster });
        machine.pulleys.push({ kind: 'pulley', id: idlerId, cx: lower.cx, cy: lower.cy, r: ir, z: maxZAt(machine, lower.cx, lower.cy) + 1, cluster: lower.cluster });
        machine.ropes.push({
          drumId,
          idlerId,
          path: [
            { x: x0, y: upper.cy },
            { x: x1, y: lower.cy },
          ],
          z: zTop,
        });
        machine.links.push({ kind: 'rope', a: edge.a, b: edge.b });
        continue;
      }
    }

    // Belt between coaxial pulleys on the mutually-nearest wheels.
    if (machine.belts.length >= caps.belts) continue;
    let rA = Math.max(wa.module * 1.6, pitchR(wa) * 0.45);
    let rB = Math.max(wb.module * 1.4, pitchR(wb) * 0.35);
    let d = Math.hypot(dx, dy);
    // Wheels of different bands can sit arbitrarily close — shrink to idler
    // size when the span is too tight for real pulleys.
    if (d < rA + rB + 2 * Math.max(wa.module, wb.module)) {
      rA = wa.module * 1.15;
      rB = wb.module * 1.15;
      if (d < rA + rB + Math.max(wa.module, wb.module)) continue;
    }
    d = Math.hypot(dx, dy);
    const pad = Math.max(wa.module, wb.module) * 0.8;
    const zTop = 1 + Math.max(ca.zBand, cb.zBand) * Z_BAND_STRIDE + 6;

    // Relaxation ladder: strict against every wheel on the page → endpoint
    // clusters' bands only (the belt rides above both bands) → the crossed
    // variant on the relaxed rule.
    let realized = false;
    for (const [strict, crossed] of [
      [true, false],
      [false, false],
      [false, true],
    ] as [boolean, boolean][]) {
      if (crossed && d <= rA + rB + 2.5 * Math.max(wa.module, wb.module)) continue;
      const tang = commonTangents({ cx: wa.cx, cy: wa.cy, r: rA }, { cx: wb.cx, cy: wb.cy, r: rB }, crossed);
      if (!tang) continue;
      let ok = true;
      for (const [p1, p2] of tang.segs) {
        for (const c of obstacles(machine, strict, ca.zBand, cb.zBand, wa, wb)) {
          if (!segClear(p1, p2, c, pad)) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
      }
      if (!ok) continue;
      const idA = ids.next();
      const idB = ids.next();
      machine.pulleys.push({ kind: 'pulley', id: idA, cx: wa.cx, cy: wa.cy, r: rA, z: strict ? maxZAt(machine, wa.cx, wa.cy) + 1 : zTop, cluster: wa.cluster });
      machine.pulleys.push({ kind: 'pulley', id: idB, cx: wb.cx, cy: wb.cy, r: rB, z: strict ? maxZAt(machine, wb.cx, wb.cy) + 1 : zTop, cluster: wb.cluster });
      machine.belts.push({ a: idA, b: idB, crossed });
      machine.links.push({ kind: 'belt', a: edge.a, b: edge.b });
      realized = true;
      break;
    }
    if (realized) continue;

    // Final rung: straight rope between shaft-mounted idlers at top z —
    // endpoint clearance is all it needs, and at connectivity 1 (one band,
    // strict clearance everywhere) the geometry always cooperates.
    if (machine.ropes.length < caps.ropes) {
      const ir1 = wa.module * 1.15;
      const ir2 = wb.module * 1.15;
      if (d > ir1 + ir2 + Math.max(wa.module, wb.module)) {
        const drumId = ids.next();
        const idlerId = ids.next();
        machine.drums.push({ kind: 'drum', id: drumId, cx: wa.cx, cy: wa.cy, r: ir1, z: maxZAt(machine, wa.cx, wa.cy) + 1, cluster: wa.cluster });
        machine.pulleys.push({ kind: 'pulley', id: idlerId, cx: wb.cx, cy: wb.cy, r: ir2, z: maxZAt(machine, wb.cx, wb.cy) + 1, cluster: wb.cluster });
        const ux = dx / d;
        const uy = dy / d;
        const px = -uy;
        const py = ux;
        machine.ropes.push({
          drumId,
          idlerId,
          path: [
            { x: wa.cx + px * ir1, y: wa.cy + py * ir1 },
            { x: wb.cx + px * ir2, y: wb.cy + py * ir2 },
          ],
          z: zTop,
        });
        machine.links.push({ kind: 'rope', a: edge.a, b: edge.b });
      }
    }
  }
}
