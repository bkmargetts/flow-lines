import type { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { circle } from './geometry.js';
import type { CodexCtx } from './context.js';
import type { Beam, Machine } from './types.js';

/**
 * Timber armature rendering — double-line beams with end-grain ovals, sparse
 * longitudinal grain, peg circles at the joints, and a hatch band of ground
 * shadow under the sill. Returns the beam rectangles as silhouettes for the
 * occlusion buffer.
 */

/** The four corners of a beam's rectangle. */
function beamRect(b: Beam): Point[] {
  const dx = b.b.x - b.a.x;
  const dy = b.b.y - b.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * (b.w / 2);
  const py = (dx / len) * (b.w / 2);
  return [
    { x: b.a.x + px, y: b.a.y + py },
    { x: b.b.x + px, y: b.b.y + py },
    { x: b.b.x - px, y: b.b.y - py },
    { x: b.a.x - px, y: b.a.y - py },
  ];
}

export function renderFrame(ctx: CodexCtx, machine: Machine): Point[][] {
  const { o, lines } = ctx;
  const rng = makeRandom(subSeed(ctx.seed, 7));
  const silhouettes: Point[][] = [];
  const m = machine.module;

  for (const beam of machine.frame) {
    const rect = beamRect(beam);
    silhouettes.push(rect);
    // Timber outline: the two long edges plus end caps, as one closed run.
    lines.push({ points: [...rect, { x: rect[0].x, y: rect[0].y }], layer: 'frame' });

    // Sparse longitudinal grain: 1–2 wavering strokes inside the timber.
    const dx = beam.b.x - beam.a.x;
    const dy = beam.b.y - beam.a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const grains = 1 + (rng() < 0.5 ? 1 : 0);
    for (let gi = 0; gi < grains; gi++) {
      const off = (rng() - 0.5) * beam.w * 0.55;
      const g0 = 0.06 + rng() * 0.12;
      const g1 = 0.88 - rng() * 0.12;
      const pts: Point[] = [];
      const steps = Math.max(4, Math.round((len * (g1 - g0)) / (m * 1.5)));
      for (let s = 0; s <= steps; s++) {
        const t = g0 + ((g1 - g0) * s) / steps;
        const wave = Math.sin(t * 9 + gi * 2.4) * beam.w * 0.06;
        pts.push({
          x: beam.a.x + ux * len * t + px * (off + wave),
          y: beam.a.y + uy * len * t + py * (off + wave),
        });
      }
      lines.push({ points: pts, layer: 'frame' });
      // The occasional knot loop on the grain line.
      if (rng() < 0.3) {
        const t = g0 + rng() * (g1 - g0);
        const kx = beam.a.x + ux * len * t + px * off;
        const ky = beam.a.y + uy * len * t + py * off;
        lines.push({ points: circle(kx, ky, beam.w * 0.12), layer: 'frame' });
      }
    }
  }

  // Peg circles where posts and braces meet the sill / top beam.
  const posts = machine.frame.filter((b) => b.kind === 'post' || b.kind === 'brace');
  for (const p of posts) {
    for (const end of [p.a, p.b]) {
      lines.push({ points: circle(end.x, end.y - Math.sign(end.y - (p.a.y + p.b.y) / 2 || 1) * 0, p.w * 0.18), layer: 'frame' });
    }
  }

  // Ground shadow: short diagonal hatch ticks under the sill.
  const ground = machine.frame.find((b) => b.kind === 'ground');
  if (ground && o.shading > 0.05) {
    const y = ground.a.y + ground.w / 2;
    const step = Math.max(2.2, o.hatchSpacing * 1.6);
    const tick = m * 0.9;
    const x0 = Math.min(ground.a.x, ground.b.x);
    const x1 = Math.max(ground.a.x, ground.b.x);
    for (let x = x0 + step; x < x1; x += step) {
      lines.push({
        points: [
          { x, y: y + 1 },
          { x: x - tick * 0.55, y: y + 1 + tick },
        ],
        layer: 'hatch',
      });
    }
  }

  return silhouettes;
}
