import { makeRandom, subSeed } from '../lib/rng.js';
import { TAU, circleCircle, commonTangents } from './geometry.js';
import type { CodexCtx } from './context.js';
import type { Bearing, Circle, Gear, Machine } from './types.js';

/** Distance from a circle to a segment stays above `pad` beyond its radius. */
function segClear(
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
function maxZAt(machine: Machine, cx: number, cy: number): number {
  let z = 0;
  for (const g of machine.gears) if (Math.abs(g.cx - cx) < 1e-6 && Math.abs(g.cy - cy) < 1e-6) z = Math.max(z, g.z);
  for (const p of machine.pulleys) if (Math.abs(p.cx - cx) < 1e-6 && Math.abs(p.cy - cy) < 1e-6) z = Math.max(z, p.z);
  for (const d of machine.drums) if (Math.abs(d.cx - cx) < 1e-6 && Math.abs(d.cy - cy) < 1e-6) z = Math.max(z, d.z);
  return z;
}

/**
 * Machine synthesis — grows the part graph, never draws. The gear train is a
 * tree: every gear meshes exactly one parent, which keeps tooth-phase
 * alignment solvable in closed form and clearance testing simple. One shared
 * gear module for the whole machine — per-gear random tooth size is the #1
 * "clip-art" tell in fake mechanical drawings.
 */

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

/** All the wheel circles a new part must clear (gear outers). */
function partCircles(machine: Machine): Circle[] {
  const cs: Circle[] = [];
  for (const g of machine.gears) cs.push({ cx: g.cx, cy: g.cy, r: outerR(g) });
  for (const p of machine.pulleys) cs.push({ cx: p.cx, cy: p.cy, r: p.r });
  for (const d of machine.drums) cs.push({ cx: d.cx, cy: d.cy, r: d.r });
  return cs;
}

export function synthesize(ctx: CodexCtx): Machine {
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
    module: 0,
  };

  // Growth budget: an ellipse inside the drawing region. Sampled parts must
  // keep their centres inside it, which is what stops the tree from sprawling
  // lopsided off the page (a final uniform fit still guards the margin).
  const ecx = (region.x0 + region.x1) / 2;
  const ecy = (region.y0 + region.y1) / 2;
  const eax = (region.x1 - region.x0) * 0.42;
  const eay = (region.y1 - region.y0) * 0.4;
  const inBudget = (x: number, y: number): boolean => {
    const nx = (x - ecx) / eax;
    const ny = (y - ecy) / eay;
    return nx * nx + ny * ny <= 1;
  };

  // One shared module, from the seed wheel: `gearSize` is the mean big-wheel
  // pitch radius, teeth counts are clock-work chunky (the codex look).
  const seedTeeth = Math.round(18 + rng() * 14 + o.complexity * 6);
  const module = Math.max(4, (2 * o.gearSize) / seedTeeth);
  machine.module = module;

  // Seed wheel near a golden-ish anchor left/above centre (marginalia tends
  // to sit right/below), largest of the train.
  const seedGear: Gear = {
    kind: 'gear',
    id: 0,
    cx: ecx - eax * (0.12 + rng() * 0.18),
    cy: ecy - eay * (0.05 + rng() * 0.2),
    teeth: seedTeeth,
    module,
    phase: rng() * TAU,
    z: 1,
  };
  machine.gears.push(seedGear);
  let nextId = 1;

  // Grow satellites. Small pinions hang off big wheels and vice versa — real
  // trains alternate to change ratio; same-size chains read as decoration.
  const satellites = Math.round(1 + o.complexity * 5);
  for (let i = 0; i < satellites; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 30 && !placed; attempt++) {
      const parent = machine.gears[Math.floor(rng() * machine.gears.length)];
      const parentBig = parent.teeth >= 18;
      const small = parentBig ? rng() < 0.7 : rng() < 0.25;
      const teeth = small
        ? 8 + Math.floor(rng() * 6)
        : 16 + Math.floor(rng() * 14);
      const theta = rng() * TAU;
      const d = (module * (parent.teeth + teeth)) / 2;
      const cx = parent.cx + Math.cos(theta) * d;
      const cy = parent.cy + Math.sin(theta) * d;
      if (!inBudget(cx, cy)) continue;
      const rOut = outerR({ teeth, module });
      // Clearance: every existing wheel is either the exact-tangent parent or
      // clearly separated — near-misses read as broken meshing.
      let ok = true;
      for (const c of partCircles(machine)) {
        if (Math.abs(c.cx - parent.cx) < 1e-6 && Math.abs(c.cy - parent.cy) < 1e-6) continue;
        const gap = Math.hypot(c.cx - cx, c.cy - cy) - (c.r + rOut);
        if (gap < Math.max(10, 0.35 * Math.min(c.r, rOut))) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const child: Gear = {
        kind: 'gear',
        id: nextId++,
        cx,
        cy,
        teeth,
        module,
        phase: meshPhase(parent, teeth, theta),
        z: parent.z === 1 ? 2 : 1,
        parent: parent.id,
        meshAngle: theta,
      };
      machine.gears.push(child);
      placed = true;
    }
  }

  // Compound coaxial pinions: stack a small pinion on a wheel's shaft (how a
  // real train changes ratio, and it layers the circles). Phase is free — a
  // coaxial pair shares a shaft, not a mesh.
  const wheels = machine.gears.filter((g) => g.teeth >= 18 && !g.coaxialWith);
  for (const wheel of wheels) {
    if (rng() < 0.35 * o.complexity) {
      const pinion: Gear = {
        kind: 'gear',
        id: nextId++,
        cx: wheel.cx,
        cy: wheel.cy,
        teeth: Math.max(7, Math.round(wheel.teeth / (2.4 + rng()))),
        module,
        phase: rng() * TAU,
        z: wheel.z + 2,
        coaxialWith: wheel.id,
      };
      machine.gears.push(pinion);
    }
  }

  // --- Belt run: a small pulley coaxial with a wheel, driving a standalone
  // pulley off the train through true common tangents (crossed — the
  // figure-eight — some of the time; it's very da Vinci).
  const mech = o.mechanisms;
  if (rng() < 0.35 + 0.65 * mech) {
    const beltWheels = machine.gears.filter((g) => g.teeth >= 16 && !g.coaxialWith);
    if (beltWheels.length > 0) {
      const wheel = beltWheels[Math.floor(rng() * beltWheels.length)];
      const rA = Math.max(module * 1.6, pitchR(wheel) * 0.45);
      for (let attempt = 0; attempt < 25; attempt++) {
        const r = module * (2.0 + rng() * 1.8);
        const d = rA + r + module * (5 + rng() * 9);
        const th = rng() * TAU;
        const bx = wheel.cx + Math.cos(th) * d;
        const by = wheel.cy + Math.sin(th) * d;
        if (!inBudget(bx, by)) continue;
        let ok = true;
        for (const c of partCircles(machine)) {
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
        // The belt's straight runs must not slice through other wheels.
        for (const [p1, p2] of tang.segs) {
          for (const c of partCircles(machine)) {
            if (Math.abs(c.cx - wheel.cx) < 1e-6 && Math.abs(c.cy - wheel.cy) < 1e-6) continue;
            if (!segClear(p1, p2, c, module * 0.8)) {
              ok = false;
              break;
            }
          }
          if (!ok) break;
        }
        if (!ok) continue;
        const idA = nextId++;
        const idB = nextId++;
        machine.pulleys.push({ kind: 'pulley', id: idA, cx: wheel.cx, cy: wheel.cy, r: rA, z: maxZAt(machine, wheel.cx, wheel.cy) + 1 });
        machine.pulleys.push({ kind: 'pulley', id: idB, cx: bx, cy: by, r, z: 2 });
        machine.belts.push({ a: idA, b: idB, crossed });
        break;
      }
    }
  }

  // --- Crank + rocker (4-bar), pose-solved so the pose is *consistent* even
  // though the machine as a whole is impossible.
  if (rng() < 0.25 + 0.7 * mech) {
    const wheels = machine.gears.filter((g) => g.teeth >= 16 && !g.coaxialWith);
    if (wheels.length > 0) {
      const wheel = wheels.reduce((a, b) => (Math.abs(b.cx - ecx) > Math.abs(a.cx - ecx) ? b : a));
      const side = wheel.cx > ecx ? 1 : -1;
      const rp = pitchR(wheel);
      for (let attempt = 0; attempt < 20; attempt++) {
        const ca = rng() * TAU;
        const pin = { x: wheel.cx + Math.cos(ca) * rp * 0.68, y: wheel.cy + Math.sin(ca) * rp * 0.68 };
        const pivot = {
          x: wheel.cx + side * rp * (1.7 + rng() * 0.8),
          y: wheel.cy + rp * (0.45 + rng() * 0.7),
        };
        if (!inBudget(pivot.x, pivot.y)) continue;
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

  buildFrame(machine, rng, o.complexity);

  // --- Drive: a rope drum on a shaft dropping to a hanging weight (the
  // clock-drive motif), or a coil spring off the rocker — both need the
  // frame's ground line to exist first.
  const ground = machine.frame.find((b) => b.kind === 'ground');
  const link = machine.linkages[0];
  if (ground && rng() < 0.3 + 0.7 * mech) {
    const groundY = ground.a.y;
    if (link && rng() < 0.45) {
      // Coil spring: rocker joint back down to an anchor on the sill.
      const side = link.joint.x > ecx ? 1 : -1;
      const anchor = { x: link.joint.x + side * module * 3, y: groundY - ground.w / 2 };
      machine.springs.push({
        a: link.joint,
        b: anchor,
        coils: 7 + Math.floor(rng() * 5),
        r: module * 0.75,
        z: link.z,
      });
    } else {
      const drumWheels = machine.gears.filter(
        (g) =>
          g.teeth >= 16 &&
          !g.coaxialWith &&
          g.id !== link?.gearId &&
          // Enough head-room below the shaft for a visible drop + the stone.
          groundY - g.cy > Math.max(module * 1.7, hubR(g) * 1.9) * 5
      );
      if (drumWheels.length > 0) {
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
          for (const c of partCircles(machine)) {
            if (Math.abs(c.cx - wheel.cx) < 1e-6 && Math.abs(c.cy - wheel.cy) < 1e-6) continue;
            if (!segClear({ x, y: wheel.cy }, { x, y: dropTo }, c, module * 0.6)) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
          const zD = maxZAt(machine, wheel.cx, wheel.cy) + 1;
          const drumId = nextId++;
          machine.drums.push({ kind: 'drum', id: drumId, cx: wheel.cx, cy: wheel.cy, r: dr, z: zD });
          const w = dr * 1.7;
          const h = stoneH;
          machine.ropes.push({
            drumId,
            path: [
              { x, y: wheel.cy },
              { x, y: dropTo },
            ],
            z: zD,
          });
          machine.weights.push({ x, y: dropTo, w, h, z: zD });
          break;
        }
      }
    }
  }

  return machine;
}

/** Hub radius a bearing must clear (mirror of the renderer's hub sizing). */
export function hubR(g: Gear): number {
  return Math.max(g.module * 1.15, pitchR(g) * 0.14);
}

/** The timber armature, fitted to the finished mechanism — ground sill,
 *  posts flanking the train, a top beam, braces, and a bearing for every
 *  shaft toward its nearest frame member. The frame is what turns floating
 *  parts into *a machine*. */
function buildFrame(machine: Machine, rng: () => number, complexity: number): void {
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
  machine.frame.push({ a: { x: leftX, y: groundY }, b: { x: leftX, y: topY }, w: m * 1.0, kind: 'post' });
  machine.frame.push({ a: { x: rightX, y: groundY }, b: { x: rightX, y: topY }, w: m * 1.0, kind: 'post' });
  if (rng() < 0.55 + 0.45 * complexity) {
    machine.frame.push({ a: { x: leftX, y: topY }, b: { x: rightX, y: topY }, w: m * 0.9, kind: 'beam' });
  }
  // A diagonal brace or two from the ground up a post.
  for (const side of [-1, 1]) {
    if (rng() < 0.45) continue;
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
  // frame member: pedestal to the ground or bracket arm to a post.
  const seen = new Set<string>();
  const shafts: { x: number; y: number; clearR: number }[] = [];
  for (const g of machine.gears) {
    const key = `${Math.round(g.cx)},${Math.round(g.cy)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const shaft = machine.gears.filter(
      (h) => Math.abs(h.cx - g.cx) < 1e-6 && Math.abs(h.cy - g.cy) < 1e-6
    );
    shafts.push({ x: g.cx, y: g.cy, clearR: Math.max(...shaft.map(hubR)) });
  }
  for (const p of machine.pulleys) {
    const key = `${Math.round(p.cx)},${Math.round(p.cy)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    shafts.push({ x: p.cx, y: p.cy, clearR: Math.max(m * 1.1, p.r * 0.35) });
  }
  for (const s of shafts) {
    const dDown = groundY - s.y;
    const dLeft = s.x - leftX;
    const dRight = rightX - s.x;
    const best = Math.min(dDown, dLeft, dRight);
    const bearing: Bearing =
      best === dDown
        ? { x: s.x, y: s.y, dir: 'down', len: dDown, hubR: s.clearR }
        : best === dLeft
          ? { x: s.x, y: s.y, dir: 'left', len: dLeft, hubR: s.clearR }
          : { x: s.x, y: s.y, dir: 'right', len: dRight, hubR: s.clearR };
    machine.bearings.push(bearing);
  }
}
