import { makeRandom, subSeed } from '../lib/rng.js';
import { TAU, circleCircle, commonTangents } from './geometry.js';
import { linkClusters } from './network.js';
import type { MachineCtx } from './context.js';
import type { Bearing, Circle, Cluster, Gear, Machine } from './types.js';

/**
 * Machine synthesis — grows the part graph, never draws. The page is seeded
 * with gear-train *clusters* (best-candidate dart throwing), each grown as a
 * tree: every gear meshes exactly one parent, which keeps tooth-phase
 * alignment solvable in closed form and clearance testing simple. One gear
 * module per cluster — per-gear random tooth size is the #1 "clip-art" tell —
 * but clusters vary their module (`scaleVariety`), which is what makes a page
 * read as hugely complex rather than uniform. `connectivity` decides both the
 * depth structure (z-bands: 1 band at 1 — one planar machine with strict
 * clearance; 3 bands at 0 — overlapping engine-room wall) and how many
 * transmission links tie the clusters into one network (network.ts).
 */

/** Depth stride between z-bands: local part z spans ~0–5, so bands at 8 apart
 *  stay disjoint and the occlusion pass can tell "same band" from "behind". */
export const Z_BAND_STRIDE = 8;

/** Global part caps at the A4 tuning anchor (area-scaled gear cap computed
 *  in synthesize). */
export const CAPS = { clusters: 12, belts: 16, ropes: 8, linkages: 6, springs: 4, maxGears: 96 };

/** Part caps scaled by the sheet-area factor: bigger sheets earn more
 *  mechanisms at the same physical gear size. At factor 1 every value equals
 *  the CAPS constant exactly, so A4-and-smaller output is untouched. */
export function capsFor(sheetFactor: number): typeof CAPS {
  const f = Number.isFinite(sheetFactor) ? Math.max(1, sheetFactor) : 1;
  return {
    clusters: Math.round(CAPS.clusters * f),
    belts: Math.round(CAPS.belts * f),
    ropes: Math.round(CAPS.ropes * f),
    linkages: Math.round(CAPS.linkages * f),
    springs: Math.round(CAPS.springs * f),
    maxGears: Math.round(CAPS.maxGears * f),
  };
}

/** Pitch radius of a gear. */
export function pitchR(g: { teeth: number; module: number }): number {
  return (g.module * g.teeth) / 2;
}

/** Outermost radius (pitch + addendum). */
export function outerR(g: { teeth: number; module: number }): number {
  return pitchR(g) + g.module;
}

/** Root-circle radius (pitch - dedendum). */
export function rootR(g: { teeth: number; module: number }): number {
  return pitchR(g) - 1.25 * g.module;
}

/** Hub radius a bearing must clear (mirror of the renderer's hub sizing). */
export function hubR(g: Gear): number {
  return Math.max(g.module * 1.15, pitchR(g) * 0.14);
}

/** Tooth-phase alignment: place the child so a child *gap* faces a parent
 *  *tooth* at the contact point. u is the parent's fractional tooth offset at
 *  the mesh line; because meshed gears counter-rotate at the tooth ratio, a
 *  parent offset of u periods turns the child by +u of *its* periods, so the
 *  child phase is θ+π − τc(0.5 − u). (Pinned by the tooth-interleave test —
 *  the +u/−u sign is exactly the bug that reads as tooth-on-tooth clip-art.) */
export function meshPhase(parent: Gear, childTeeth: number, theta: number): number {
  const tauP = TAU / parent.teeth;
  const tauC = TAU / childTeeth;
  const u = ((theta - parent.phase) / tauP) % 1;
  const uu = u < 0 ? u + 1 : u;
  return theta + Math.PI - tauC * (0.5 - uu);
}

/** Distance from a circle to a segment stays above `pad` beyond its radius. */
export function segClear(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: Circle,
  pad: number
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((c.cx - a.x) * dx + (c.cy - a.y) * dy) / l2)) : 0;
  const qx = a.x + dx * t;
  const qy = a.y + dy * t;
  return Math.hypot(c.cx - qx, c.cy - qy) > c.r + pad;
}

/** Highest z of any part sharing this shaft centre. */
export function maxZAt(machine: Machine, cx: number, cy: number): number {
  let z = 0;
  for (const g of machine.gears) if (Math.abs(g.cx - cx) < 1e-6 && Math.abs(g.cy - cy) < 1e-6) z = Math.max(z, g.z);
  for (const p of machine.pulleys) if (Math.abs(p.cx - cx) < 1e-6 && Math.abs(p.cy - cy) < 1e-6) z = Math.max(z, p.z);
  for (const d of machine.drums) if (Math.abs(d.cx - cx) < 1e-6 && Math.abs(d.cy - cy) < 1e-6) z = Math.max(z, d.z);
  return z;
}

/** Wheel circles a new part must clear, filtered to one z-band: cross-band
 *  overlap is allowed (the engine-room wall look), same-band contact must be
 *  either an exact mesh or clearly separated. */
export function circlesInBand(machine: Machine, band: number): Circle[] {
  const bandOf = (cluster: number): number => machine.clusters[cluster]?.zBand ?? 0;
  const cs: Circle[] = [];
  for (const g of machine.gears) if (bandOf(g.cluster) === band) cs.push({ cx: g.cx, cy: g.cy, r: outerR(g) });
  for (const p of machine.pulleys) if (bandOf(p.cluster) === band) cs.push({ cx: p.cx, cy: p.cy, r: p.r });
  for (const d of machine.drums) if (bandOf(d.cluster) === band) cs.push({ cx: d.cx, cy: d.cy, r: d.r });
  return cs;
}

/** All wheel circles regardless of band (belt routing at its strictest). */
export function allCircles(machine: Machine): Circle[] {
  const cs: Circle[] = [];
  for (const g of machine.gears) cs.push({ cx: g.cx, cy: g.cy, r: outerR(g) });
  for (const p of machine.pulleys) cs.push({ cx: p.cx, cy: p.cy, r: p.r });
  for (const d of machine.drums) cs.push({ cx: d.cx, cy: d.cy, r: d.r });
  return cs;
}

/** Mutable id counter shared by synthesis stages. */
export interface IdGen {
  next: () => number;
}

const sameShaft = (a: { cx: number; cy: number }, b: { cx: number; cy: number }): boolean =>
  Math.abs(a.cx - b.cx) < 1e-6 && Math.abs(a.cy - b.cy) < 1e-6;

/** Grow one cluster's gear tree (+ compound pinions, intra-cluster belt and
 *  linkage) inside its budget ellipse. The seed gear may already exist (a
 *  cross-cluster mesh grew it as a child of another cluster's wheel). */
function growCluster(
  machine: Machine,
  cluster: Cluster,
  seedGear: Gear,
  budget: (x: number, y: number) => boolean,
  rng: () => number,
  o: MachineCtx['o'],
  ids: IdGen,
  maxGears: number,
  caps: typeof CAPS
): void {
  const module = cluster.module;
  const zBase = 1 + cluster.zBand * Z_BAND_STRIDE;

  // Satellites: small pinions hang off big wheels and vice versa — real
  // trains alternate to change ratio; same-size chains read as decoration.
  const satellites = Math.round(3 + o.complexity * 8);
  for (let i = 0; i < satellites && machine.gears.length < maxGears; i++) {
    const mine = machine.gears.filter((g) => g.cluster === cluster.id);
    let placed = false;
    for (let attempt = 0; attempt < 30 && !placed; attempt++) {
      const parent = mine[Math.floor(rng() * mine.length)];
      const parentBig = parent.teeth >= 18;
      const small = parentBig ? rng() < 0.7 : rng() < 0.25;
      const teeth = small ? 8 + Math.floor(rng() * 6) : 16 + Math.floor(rng() * 14);
      const theta = rng() * TAU;
      const d = (module * (parent.teeth + teeth)) / 2;
      const cx = parent.cx + Math.cos(theta) * d;
      const cy = parent.cy + Math.sin(theta) * d;
      if (!budget(cx, cy)) continue;
      const rOut = outerR({ teeth, module });
      // Clearance against everything in this band: every wheel is either the
      // exact-tangent parent or clearly separated — near-misses read as
      // broken meshing.
      let ok = true;
      for (const c of circlesInBand(machine, cluster.zBand)) {
        if (Math.abs(c.cx - parent.cx) < 1e-6 && Math.abs(c.cy - parent.cy) < 1e-6) continue;
        const gap = Math.hypot(c.cx - cx, c.cy - cy) - (c.r + rOut);
        if (gap < Math.max(10, 0.35 * Math.min(c.r, rOut))) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      machine.gears.push({
        kind: 'gear',
        id: ids.next(),
        cx,
        cy,
        teeth,
        module,
        phase: meshPhase(parent, teeth, theta),
        z: parent.z === zBase ? zBase + 1 : zBase,
        cluster: cluster.id,
        parent: parent.id,
        meshAngle: theta,
      });
      placed = true;
    }
  }

  // Compound coaxial pinions: stack a small pinion on a wheel's shaft (how a
  // real train changes ratio, and it layers the circles). Phase is free — a
  // coaxial pair shares a shaft, not a mesh.
  const wheels = machine.gears.filter((g) => g.cluster === cluster.id && g.teeth >= 18 && !g.coaxialWith);
  for (const wheel of wheels) {
    if (machine.gears.length >= maxGears) break;
    if (rng() < 0.35 * o.complexity) {
      machine.gears.push({
        kind: 'gear',
        id: ids.next(),
        cx: wheel.cx,
        cy: wheel.cy,
        teeth: Math.max(7, Math.round(wheel.teeth / (2.4 + rng()))),
        module,
        phase: rng() * TAU,
        z: wheel.z + 2,
        cluster: cluster.id,
        coaxialWith: wheel.id,
      });
    }
  }

  // Intra-cluster belt run: a small pulley coaxial with a wheel, driving a
  // standalone pulley through true common tangents (crossed — the
  // figure-eight — some of the time).
  if (machine.belts.length < caps.belts && rng() < 0.3 + 0.55 * o.mechanisms) {
    const beltWheels = machine.gears.filter((g) => g.cluster === cluster.id && g.teeth >= 16 && !g.coaxialWith);
    if (beltWheels.length > 0) {
      const wheel = beltWheels[Math.floor(rng() * beltWheels.length)];
      const rA = Math.max(module * 1.6, pitchR(wheel) * 0.45);
      for (let attempt = 0; attempt < 25; attempt++) {
        const r = module * (2.0 + rng() * 1.8);
        const d = rA + r + module * (5 + rng() * 9);
        const th = rng() * TAU;
        const bx = wheel.cx + Math.cos(th) * d;
        const by = wheel.cy + Math.sin(th) * d;
        if (!budget(bx, by)) continue;
        let ok = true;
        for (const c of circlesInBand(machine, cluster.zBand)) {
          if (Math.abs(c.cx - wheel.cx) < 1e-6 && Math.abs(c.cy - wheel.cy) < 1e-6) continue;
          if (Math.hypot(c.cx - bx, c.cy - by) < c.r + r + module * 1.5) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        const crossed = rng() < 0.3 && d > rA + r + module * 2.5;
        const tang = commonTangents({ cx: wheel.cx, cy: wheel.cy, r: rA }, { cx: bx, cy: by, r }, crossed);
        if (!tang) continue;
        for (const [p1, p2] of tang.segs) {
          for (const c of circlesInBand(machine, cluster.zBand)) {
            if (Math.abs(c.cx - wheel.cx) < 1e-6 && Math.abs(c.cy - wheel.cy) < 1e-6) continue;
            if (!segClear(p1, p2, c, module * 0.8)) {
              ok = false;
              break;
            }
          }
          if (!ok) break;
        }
        if (!ok) continue;
        const idA = ids.next();
        const idB = ids.next();
        machine.pulleys.push({ kind: 'pulley', id: idA, cx: wheel.cx, cy: wheel.cy, r: rA, z: maxZAt(machine, wheel.cx, wheel.cy) + 1, cluster: cluster.id });
        machine.pulleys.push({ kind: 'pulley', id: idB, cx: bx, cy: by, r, z: 1 + cluster.zBand * Z_BAND_STRIDE + 1, cluster: cluster.id });
        machine.belts.push({ a: idA, b: idB, crossed });
        break;
      }
    }
  }

  // Crank + rocker (4-bar), pose-solved so the pose is *consistent* even
  // though the machine as a whole is impossible.
  if (machine.linkages.length < caps.linkages && rng() < 0.2 + 0.5 * o.mechanisms) {
    const linkWheels = machine.gears.filter((g) => g.cluster === cluster.id && g.teeth >= 16 && !g.coaxialWith);
    if (linkWheels.length > 0) {
      const wheel = linkWheels.reduce((a, b) =>
        Math.abs(b.cx - cluster.cx) > Math.abs(a.cx - cluster.cx) ? b : a
      );
      const side = wheel.cx > cluster.cx ? 1 : -1;
      const rp = pitchR(wheel);
      for (let attempt = 0; attempt < 20; attempt++) {
        const ca = rng() * TAU;
        const pin = { x: wheel.cx + Math.cos(ca) * rp * 0.68, y: wheel.cy + Math.sin(ca) * rp * 0.68 };
        const pivot = {
          x: wheel.cx + side * rp * (1.7 + rng() * 0.8),
          y: wheel.cy + rp * (0.45 + rng() * 0.7),
        };
        if (!budget(pivot.x, pivot.y)) continue;
        const dd = Math.hypot(pivot.x - pin.x, pivot.y - pin.y);
        const rod = dd * (0.74 + rng() * 0.18);
        const rock = dd * (0.45 + rng() * 0.25);
        const sol = circleCircle(pin, rod, pivot, rock);
        if (!sol) continue;
        const joint = sol[0].y < sol[1].y ? sol[0] : sol[1];
        machine.linkages.push({
          gearId: wheel.id,
          pin,
          joint,
          pivot,
          z: maxZAt(machine, wheel.cx, wheel.cy) + 2,
        });
        break;
      }
    }
  }
}

export function synthesize(ctx: MachineCtx): Machine {
  const { o, region } = ctx;
  const rng = makeRandom(subSeed(ctx.seed, 1));
  const machine: Machine = {
    gears: [],
    pulleys: [],
    drums: [],
    belts: [],
    linkages: [],
    ropes: [],
    weights: [],
    springs: [],
    frame: [],
    bearings: [],
    clusters: [],
    links: [],
    module: 0,
  };
  let idCounter = 0;
  const ids: IdGen = { next: () => idCounter++ };

  const areaW = region.x1 - region.x0;
  const areaH = region.y1 - region.y0;
  const area = areaW * areaH;

  // Base module: `gearSize` is the mean big-wheel pitch radius at clock-work
  // chunky tooth counts (~26). The first cluster pins ~1.0× so the option
  // stays honest; the rest spread log-uniform by `scaleVariety`.
  const baseModule = Math.max(4, (2 * o.gearSize) / 26);
  machine.module = baseModule;

  // Part caps grow with the physical sheet (`sheetFactor`, 1 at A4): the
  // area-driven formulas below are already area-proportional, but A4 is
  // cap-bound, so without this a big sheet gets the same ≤96 gears spread thin.
  const caps = capsFor(o.sheetFactor);
  const maxGears = Math.min(caps.maxGears, Math.round(area / Math.pow(24 * baseModule, 2) * 10) + 8);
  const nClusters = Math.max(
    1,
    Math.min(caps.clusters, 1 + Math.round((o.complexity * area) / Math.pow(3.8 * o.gearSize, 2)))
  );
  const nBands = 1 + Math.round((1 - o.connectivity) * 2);

  // Cluster seeds: best-candidate dart throwing. At connectivity 1 seeds keep
  // real clearance (one planar machine); toward 0 they pack closer, so
  // clusters overlap across bands — the wall.
  const minD = o.gearSize * (0.95 + 1.05 * o.connectivity);
  const inset = o.gearSize * 0.8;
  const sample = (): { x: number; y: number } => ({
    x: region.x0 + inset + rng() * Math.max(1, areaW - 2 * inset),
    y: region.y0 + inset + rng() * Math.max(1, areaH - 2 * inset),
  });
  const seeds: { x: number; y: number }[] = [sample()];
  while (seeds.length < nClusters) {
    let best = sample();
    let bestD = -1;
    for (let k = 0; k < 12; k++) {
      const cand = k === 0 ? best : sample();
      let dMin = Infinity;
      for (const s of seeds) dMin = Math.min(dMin, Math.hypot(cand.x - s.x, cand.y - s.y));
      if (dMin > bestD) {
        bestD = dMin;
        best = cand;
      }
      if (bestD >= minD) break;
    }
    seeds.push(best);
  }

  // Grow each cluster. A cluster may start life *meshed into* an earlier
  // cluster (same module + band, seed gear grown as a child of one of its
  // wheels) — that's how cross-cluster gear trains happen; belts and ropes
  // (network.ts) are the workhorse links.
  for (let i = 0; i < nClusters; i++) {
    const zBand = i % nBands;

    // Try a growth-time mesh link to a compatible earlier cluster.
    let meshParent: Gear | undefined;
    let meshCluster: Cluster | undefined;
    if (i > 0 && rng() < 0.3 * o.connectivity) {
      const candidates = machine.clusters
        .filter((c) => c.zBand === zBand)
        .sort(
          (a, b) =>
            Math.hypot(a.cx - seeds[i].x, a.cy - seeds[i].y) -
            Math.hypot(b.cx - seeds[i].x, b.cy - seeds[i].y)
        );
      const near = candidates[0];
      if (near && Math.hypot(near.cx - seeds[i].x, near.cy - seeds[i].y) < o.gearSize * 3.4) {
        const wheels = machine.gears.filter((g) => g.cluster === near.id && !g.coaxialWith);
        if (wheels.length > 0) {
          meshParent = wheels.reduce((a, b) =>
            Math.hypot(b.cx - seeds[i].x, b.cy - seeds[i].y) < Math.hypot(a.cx - seeds[i].x, a.cy - seeds[i].y) ? b : a
          );
          meshCluster = near;
        }
      }
    }

    const module =
      meshCluster !== undefined
        ? meshCluster.module
        : i === 0
          ? baseModule
          : Math.max(4, baseModule * Math.exp((rng() * 2 - 1) * o.scaleVariety * 0.55));

    if (machine.gears.length >= maxGears) break;

    // Cluster id must equal its index in machine.clusters (links and the
    // band lookup index by it), so the cluster is only pushed once its seed
    // gear actually lands.
    const clusterId = machine.clusters.length;
    const zBase = 1 + zBand * Z_BAND_STRIDE;
    let seedGear: Gear | undefined;
    let meshed = false;
    if (meshParent && meshCluster) {
      const teeth = Math.round(16 + rng() * 12 + o.complexity * 4);
      for (let attempt = 0; attempt < 24 && !seedGear; attempt++) {
        const toward = Math.atan2(seeds[i].y - meshParent.cy, seeds[i].x - meshParent.cx);
        const theta = toward + (rng() - 0.5) * 1.2;
        const d = (module * (meshParent.teeth + teeth)) / 2;
        const cx = meshParent.cx + Math.cos(theta) * d;
        const cy = meshParent.cy + Math.sin(theta) * d;
        if (cx < region.x0 || cx > region.x1 || cy < region.y0 || cy > region.y1) continue;
        const rOut = outerR({ teeth, module });
        let ok = true;
        for (const c of circlesInBand(machine, zBand)) {
          if (Math.abs(c.cx - meshParent.cx) < 1e-6 && Math.abs(c.cy - meshParent.cy) < 1e-6) continue;
          const gap = Math.hypot(c.cx - cx, c.cy - cy) - (c.r + rOut);
          if (gap < Math.max(10, 0.35 * Math.min(c.r, rOut))) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        seedGear = {
          kind: 'gear',
          id: ids.next(),
          cx,
          cy,
          teeth,
          module,
          phase: meshPhase(meshParent, teeth, theta),
          z: meshParent.z === zBase ? zBase + 1 : zBase,
          cluster: clusterId,
          parent: meshParent.id,
          meshAngle: theta,
        };
        meshed = true;
      }
    }
    if (!seedGear) {
      // Free-standing seed: clearance-checked like everything else — the
      // dart throw spaces cluster *centres*, but an earlier cluster's
      // satellites may have grown right up to this spot. Jitter outward and
      // shrink the wheel before giving up on the cluster entirely.
      let teeth = Math.round(18 + rng() * 14 + o.complexity * 6);
      for (let attempt = 0; attempt < 40 && !seedGear; attempt++) {
        if (attempt === 24) teeth = Math.max(14, Math.round(teeth * 0.7));
        const wander = attempt === 0 ? 0 : o.gearSize * 0.35 * (attempt / 12) * rng();
        const wa = rng() * TAU;
        const cx = seeds[i].x + Math.cos(wa) * wander;
        const cy = seeds[i].y + Math.sin(wa) * wander;
        const rOut = outerR({ teeth, module });
        if (
          cx < region.x0 + rOut * 0.2 ||
          cx > region.x1 - rOut * 0.2 ||
          cy < region.y0 + rOut * 0.2 ||
          cy > region.y1 - rOut * 0.2
        )
          continue;
        let ok = true;
        for (const c of circlesInBand(machine, zBand)) {
          const gap = Math.hypot(c.cx - cx, c.cy - cy) - (c.r + rOut);
          if (gap < Math.max(10, 0.35 * Math.min(c.r, rOut))) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        seedGear = {
          kind: 'gear',
          id: ids.next(),
          cx,
          cy,
          teeth,
          module,
          phase: rng() * TAU,
          z: zBase,
          cluster: clusterId,
        };
      }
    }
    if (!seedGear) continue; // no room — the page is already full here

    const cluster: Cluster = { id: clusterId, cx: seedGear.cx, cy: seedGear.cy, module, zBand };
    machine.clusters.push(cluster);
    if (meshed && meshCluster) machine.links.push({ kind: 'mesh', a: meshCluster.id, b: clusterId });
    machine.gears.push(seedGear);

    // Budget ellipse: reach to roughly the midpoint toward the nearest other
    // seed, never smaller than a workable train (~1.35 wheel diameters, so a
    // satellite at pitch distance always has room).
    let nearest = Infinity;
    for (let j = 0; j < nClusters; j++) {
      if (j !== i) nearest = Math.min(nearest, Math.hypot(seeds[j].x - seeds[i].x, seeds[j].y - seeds[i].y));
    }
    const reach = Math.max(
      module * 26 * 1.35,
      nearest === Infinity ? Math.min(areaW, areaH) * 0.42 : nearest * 0.62
    );
    const budget = (x: number, y: number): boolean => {
      if (x < region.x0 || x > region.x1 || y < region.y0 || y > region.y1) return false;
      const nx = (x - cluster.cx) / reach;
      const ny = (y - cluster.cy) / reach;
      return nx * nx + ny * ny <= 1;
    };
    growCluster(machine, cluster, seedGear, budget, rng, o, ids, maxGears, caps);
  }

  // Transmission network: tie the clusters together (belts, rope drops) —
  // realized fraction follows `connectivity`.
  linkClusters(ctx, machine, rng, ids);

  buildFrame(machine, rng, o);

  // Drives: rope drums dropping to hanging stone weights (the clock-drive
  // motif) and coil springs off rockers — they need the ground line.
  const ground = machine.frame.find((b) => b.kind === 'ground');
  if (ground) {
    const groundY = ground.a.y;
    for (const cluster of machine.clusters) {
      if (rng() >= 0.25 + 0.55 * o.mechanisms) continue;
      const link = machine.linkages.find((l) =>
        machine.gears.some((g) => g.id === l.gearId && g.cluster === cluster.id)
      );
      if (link && machine.springs.length < caps.springs && rng() < 0.45) {
        const side = link.joint.x > cluster.cx ? 1 : -1;
        const anchor = { x: link.joint.x + side * cluster.module * 3, y: groundY - ground.w / 2 };
        machine.springs.push({
          a: link.joint,
          b: anchor,
          coils: 7 + Math.floor(rng() * 5),
          r: cluster.module * 0.75,
          z: link.z,
        });
        continue;
      }
      if (machine.ropes.length >= caps.ropes) continue;
      const module = cluster.module;
      const drumWheels = machine.gears.filter(
        (g) =>
          g.cluster === cluster.id &&
          g.teeth >= 16 &&
          !g.coaxialWith &&
          g.id !== link?.gearId &&
          !machine.drums.some((d) => sameShaft(d, g)) &&
          groundY - g.cy > Math.max(module * 1.7, hubR(g) * 1.9) * 5
      );
      if (drumWheels.length === 0) continue;
      const wheel = drumWheels[Math.floor(rng() * drumWheels.length)];
      const dr = Math.max(module * 1.7, hubR(wheel) * 1.9);
      const stoneH = dr * 2.1;
      for (const side of rng() < 0.5 ? [1, -1] : [-1, 1]) {
        const x = wheel.cx + side * dr;
        const dropTo = Math.min(
          wheel.cy + (groundY - wheel.cy) * (0.5 + rng() * 0.15),
          groundY - stoneH - module * 2.6
        );
        if (dropTo < wheel.cy + dr * 1.5) continue;
        let ok = true;
        for (const c of circlesInBand(machine, cluster.zBand)) {
          if (Math.abs(c.cx - wheel.cx) < 1e-6 && Math.abs(c.cy - wheel.cy) < 1e-6) continue;
          if (!segClear({ x, y: wheel.cy }, { x, y: dropTo }, c, module * 0.6)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        const zD = maxZAt(machine, wheel.cx, wheel.cy) + 1;
        const drumId = ids.next();
        machine.drums.push({ kind: 'drum', id: drumId, cx: wheel.cx, cy: wheel.cy, r: dr, z: zD, cluster: cluster.id });
        machine.ropes.push({
          drumId,
          path: [
            { x, y: wheel.cy },
            { x, y: dropTo },
          ],
          z: zD,
        });
        machine.weights.push({ x, y: dropTo, w: dr * 1.7, h: stoneH, z: zD });
        break;
      }
    }
  }

  // Wheel dressing: a small variant vocabulary so sixty wheels don't read as
  // sixty copies. At most one variant per wheel, ~40% of wheels get any.
  for (const g of machine.gears) {
    if (g.coaxialWith !== undefined) continue;
    const roll = rng();
    if (g.teeth >= 22 && roll < 0.12) g.variant = 'flywheel';
    else if (g.teeth >= 16 && roll < 0.22) g.variant = 'ratchet';
    else if (g.teeth >= 14 && roll < 0.3) g.variant = 'crank';
    else if (g.teeth >= 20 && roll < 0.45) g.variant = 'sspoke';
  }

  return machine;
}

/** The timber armature, fitted to the finished mechanism — full-width ground
 *  sill, outer posts, interior posts in the seams between clusters, beam
 *  levels, braces, and a bearing for every shaft toward its nearest member.
 *  The frame is what turns floating parts into *a machine*; it recedes as
 *  connectivity drops (the wall composes itself) but bearings never do. */
function buildFrame(machine: Machine, rng: () => number, o: MachineCtx['o']): void {
  const m = machine.module;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number, r: number): void => {
    minX = Math.min(minX, x - r);
    maxX = Math.max(maxX, x + r);
    minY = Math.min(minY, y - r);
    maxY = Math.max(maxY, y + r);
  };
  for (const g of machine.gears) grow(g.cx, g.cy, outerR(g));
  for (const p of machine.pulleys) grow(p.cx, p.cy, p.r);
  for (const l of machine.linkages) {
    grow(l.pin.x, l.pin.y, m);
    grow(l.joint.x, l.joint.y, m);
    grow(l.pivot.x, l.pivot.y, m);
  }
  if (!isFinite(minX)) return;
  const density = o.frameDensity * (0.45 + 0.55 * o.connectivity);
  const pad = m * 1.8;
  const groundY = maxY + m * 2.6;
  const topY = minY - m * 1.6;
  const leftX = minX - pad;
  const rightX = maxX + pad;
  const overhang = pad * 2.2;

  machine.frame.push({
    a: { x: leftX - overhang, y: groundY },
    b: { x: rightX + overhang, y: groundY },
    w: m * 1.25,
    kind: 'ground',
  });
  machine.frame.push({ a: { x: leftX, y: groundY }, b: { x: leftX, y: topY }, w: m, kind: 'post' });
  machine.frame.push({ a: { x: rightX, y: groundY }, b: { x: rightX, y: topY }, w: m, kind: 'post' });
  if (rng() < 0.35 + 0.65 * density) {
    machine.frame.push({ a: { x: leftX, y: topY }, b: { x: rightX, y: topY }, w: m * 0.9, kind: 'beam' });
  }

  // Interior posts in the vertical seams between cluster x-extents, and beam
  // levels in the horizontal seams — the multi-bay scaffold.
  if (machine.clusters.length > 1 && density > 0.15) {
    const xIntervals = machine.clusters
      .map((c) => {
        let lo = Infinity;
        let hi = -Infinity;
        for (const g of machine.gears) {
          if (g.cluster !== c.id) continue;
          lo = Math.min(lo, g.cx - outerR(g));
          hi = Math.max(hi, g.cx + outerR(g));
        }
        return { lo, hi };
      })
      .filter((iv) => isFinite(iv.lo))
      .sort((a, b) => a.lo - b.lo);
    let cursorHi = xIntervals[0]?.hi ?? -Infinity;
    for (let i = 1; i < xIntervals.length; i++) {
      const gapLo = cursorHi;
      const gapHi = xIntervals[i].lo;
      cursorHi = Math.max(cursorHi, xIntervals[i].hi);
      if (gapHi - gapLo < m * 2.2) continue;
      if (rng() >= density) continue;
      const px = (gapLo + gapHi) / 2;
      if (px <= leftX + m * 3 || px >= rightX - m * 3) continue;
      machine.frame.push({ a: { x: px, y: groundY }, b: { x: px, y: topY }, w: m * 0.85, kind: 'post' });
    }
    const yIntervals = machine.clusters
      .map((c) => {
        let lo = Infinity;
        let hi = -Infinity;
        for (const g of machine.gears) {
          if (g.cluster !== c.id) continue;
          lo = Math.min(lo, g.cy - outerR(g));
          hi = Math.max(hi, g.cy + outerR(g));
        }
        return { lo, hi };
      })
      .filter((iv) => isFinite(iv.lo))
      .sort((a, b) => a.lo - b.lo);
    let yCursor = yIntervals[0]?.hi ?? -Infinity;
    for (let i = 1; i < yIntervals.length; i++) {
      const gapLo = yCursor;
      const gapHi = yIntervals[i].lo;
      yCursor = Math.max(yCursor, yIntervals[i].hi);
      if (gapHi - gapLo < m * 2.2) continue;
      if (rng() >= density * 0.8) continue;
      const py = (gapLo + gapHi) / 2;
      if (py <= topY + m * 3 || py >= groundY - m * 3) continue;
      machine.frame.push({ a: { x: leftX, y: py }, b: { x: rightX, y: py }, w: m * 0.8, kind: 'beam' });
    }
  }

  // Diagonal braces from the ground up the outer posts.
  for (const side of [-1, 1]) {
    if (rng() >= 0.25 + 0.6 * density) continue;
    const px = side < 0 ? leftX : rightX;
    const reach = Math.min((rightX - leftX) * 0.28, (groundY - topY) * 0.5);
    machine.frame.push({
      a: { x: px - side * reach, y: groundY },
      b: { x: px, y: groundY - reach },
      w: m * 0.65,
      kind: 'brace',
    });
  }

  // One bearing per shaft (coaxial parts share one), toward the nearest
  // frame member: pedestal to the ground, bracket arm to a post, or hanger
  // up to a beam. Floating wheels are the #1 fake tell — this never relaxes.
  const posts = machine.frame.filter((b) => b.kind === 'post').map((b) => b.a.x);
  const beams = machine.frame.filter((b) => b.kind === 'beam').map((b) => b.a.y);
  const seen = new Set<string>();
  const shafts: { x: number; y: number; clearR: number }[] = [];
  for (const g of machine.gears) {
    const key = `${Math.round(g.cx)},${Math.round(g.cy)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const shaft = machine.gears.filter((h) => sameShaft(h, g));
    shafts.push({ x: g.cx, y: g.cy, clearR: Math.max(...shaft.map(hubR)) });
  }
  for (const p of machine.pulleys) {
    const key = `${Math.round(p.cx)},${Math.round(p.cy)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    shafts.push({ x: p.cx, y: p.cy, clearR: Math.max(m * 1.1, p.r * 0.35) });
  }
  for (const s of shafts) {
    const options: Bearing[] = [{ x: s.x, y: s.y, dir: 'down', len: groundY - s.y, hubR: s.clearR }];
    for (const px of posts) {
      if (px < s.x) options.push({ x: s.x, y: s.y, dir: 'left', len: s.x - px, hubR: s.clearR });
      else options.push({ x: s.x, y: s.y, dir: 'right', len: px - s.x, hubR: s.clearR });
    }
    for (const by of beams) {
      if (by < s.y) options.push({ x: s.x, y: s.y, dir: 'up', len: s.y - by, hubR: s.clearR });
    }
    const best = options.reduce((a, b) => (b.len < a.len ? b : a));
    if (best.len > s.clearR * 0.5) machine.bearings.push(best);
  }
}