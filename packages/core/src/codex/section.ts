import type { FlowLine, Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { densify } from '../lib/spatial.js';
import { TAU, arc } from './geometry.js';
import type { CodexCtx } from './context.js';
import type { Gear, Machine } from './types.js';
import { outerR, rootR } from './synth.js';

/**
 * Section cutaway — one wedge bitten out of a wheel, its cut face carrying
 * 45° section hatch. *The* mechanical-drawing signifier; one per plate, and
 * never through a mesh (a bitten contact point reads as broken gearing).
 */

export interface Bite {
  gearId: number;
  a0: number;
  a1: number;
  rIn: number;
}

const norm = (a: number): number => ((a % TAU) + TAU) % TAU;

/** Is angle `a` inside the CCW sector [a0, a1]? */
function inSector(a: number, a0: number, a1: number): boolean {
  const s = norm(a - a0);
  const w = norm(a1 - a0);
  return s <= w;
}

export function pickBite(ctx: CodexCtx, machine: Machine): Bite | null {
  const { o } = ctx;
  if (!o.cutaway) return null;
  const rng = makeRandom(subSeed(ctx.seed, 33));
  const eligible = machine.gears.filter(
    (g) =>
      g.teeth >= 20 &&
      !g.coaxialWith &&
      // No compound pinion, pulley or drum stacked on this shaft: the bite
      // face must be the topmost thing at its centre.
      !machine.gears.some((h) => h.coaxialWith === g.id) &&
      !machine.pulleys.some((p) => Math.abs(p.cx - g.cx) < 1e-6 && Math.abs(p.cy - g.cy) < 1e-6) &&
      !machine.drums.some((d) => Math.abs(d.cx - g.cx) < 1e-6 && Math.abs(d.cy - g.cy) < 1e-6)
  );
  if (eligible.length === 0) return null;
  const gear = eligible.reduce((a, b) => (b.teeth > a.teeth ? b : a));

  // Contact directions to keep clear of (meshes with children and parent).
  const avoid: number[] = [];
  for (const h of machine.gears) {
    if (h.parent === gear.id && h.meshAngle !== undefined) avoid.push(h.meshAngle);
  }
  if (gear.parent !== undefined && gear.meshAngle !== undefined) {
    avoid.push(gear.meshAngle + Math.PI);
  }
  for (let attempt = 0; attempt < 24; attempt++) {
    const a0 = rng() * TAU;
    const width = 0.5 + rng() * 0.3;
    const a1 = a0 + width;
    const clear = avoid.every((a) => {
      const margin = 0.55;
      return !inSector(a, a0 - margin, a1 + margin);
    });
    if (!clear) continue;
    return { gearId: gear.id, a0, a1, rIn: rootR(gear) - 2.2 * gear.module };
  }
  return null;
}

/** Remove everything the bite carved away: line runs whose points fall in
 *  the sector beyond the bite floor. */
export function clipGearBite(lines: FlowLine[], g: Gear, bite: Bite): FlowLine[] {
  const out: FlowLine[] = [];
  for (const ln of lines) {
    const pts = densify(ln.points, 2.2);
    let run: Point[] = [];
    for (const p of pts) {
      const dx = p.x - g.cx;
      const dy = p.y - g.cy;
      const inside = Math.hypot(dx, dy) > bite.rIn && inSector(Math.atan2(dy, dx), bite.a0, bite.a1);
      if (inside) {
        if (run.length >= 2) out.push({ points: run, layer: ln.layer });
        run = [];
      } else {
        run.push(p);
      }
    }
    if (run.length >= 2) out.push({ points: run, layer: ln.layer });
  }
  return out;
}

/** Draw the cut face: bold radial cuts + bite floor arc, 45° section hatch. */
export function renderCutFace(ctx: CodexCtx, g: Gear, bite: Bite): void {
  const { o, lines } = ctx;
  const ro = outerR(g);
  const rr = rootR(g);

  // Boundary: two radial cuts and the floor arc, emphasized with an extra
  // parallel pass (same pen, small offset — the bold convention).
  for (const a of [bite.a0, bite.a1]) {
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const px = -uy;
    const py = ux;
    for (const off of [0, o.penWidth * 0.5]) {
      lines.push({
        points: [
          { x: g.cx + ux * bite.rIn + px * off, y: g.cy + uy * bite.rIn + py * off },
          { x: g.cx + ux * ro + px * off, y: g.cy + uy * ro + py * off },
        ],
        layer: 'part',
      });
    }
  }
  for (const off of [0, o.penWidth * 0.5]) {
    lines.push({ points: arc(g.cx, g.cy, bite.rIn - off, bite.a0, bite.a1), layer: 'part' });
  }

  // 45° section hatch across the cut face (the rim band the blade passed
  // through, out to the root circle).
  const step = Math.max(1.8, o.hatchSpacing * 0.85);
  const ux = Math.SQRT1_2;
  const uy = Math.SQRT1_2;
  const px = -uy;
  const py = ux;
  const reach = ro + step;
  for (let s = -reach; s < reach; s += step) {
    let run: Point[] = [];
    for (let t = -reach; t <= reach; t += 1.3) {
      const x = g.cx + px * s + ux * t;
      const y = g.cy + py * s + uy * t;
      const dx = x - g.cx;
      const dy = y - g.cy;
      const r = Math.hypot(dx, dy);
      const inside = r > bite.rIn && r < rr && inSector(Math.atan2(dy, dx), bite.a0, bite.a1);
      if (inside) {
        run.push({ x, y });
      } else {
        if (run.length >= 2) lines.push({ points: run, layer: 'hatch' });
        run = [];
      }
    }
    if (run.length >= 2) lines.push({ points: run, layer: 'hatch' });
  }
}
