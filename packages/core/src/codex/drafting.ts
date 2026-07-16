import type { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { textToStrokes, textWidth } from '../stroke-font.js';
import { dashPolyline, dot } from './geometry.js';
import type { CodexCtx } from './context.js';
import type { Machine } from './types.js';
import { outerR, pitchR } from './synth.js';

/**
 * The drafting apparatus — dash-dot centerlines, center marks, dimension
 * lines with arrowheads and pseudo-measures, leader-letter callouts. Every
 * dash is a discrete polyline (the pen must lift); nothing here uses SVG
 * dash-arrays. Drawn after occlusion: drafting lines pass over the drawing,
 * as they do on a real plate.
 */

export function romanNumeral(n: number): string {
  const table: [number, string][] = [
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let v = Math.max(1, Math.min(399, Math.round(n)));
  let out = '';
  for (const [val, sym] of table) {
    while (v >= val) {
      out += sym;
      v -= val;
    }
  }
  return out;
}

/** Dash-dot centerline between two points: long dash · dot · long dash… */
export function dashDot(ctx: CodexCtx, p1: Point, p2: Point, layer = 'center'): void {
  const m = ctx.o.gearSize * 0.06 + 3;
  const dashLen = m * 1.9;
  const gap = m * 0.55;
  const dotLen = m * 0.22;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  let s = 0;
  let phase = 0; // 0 = dash, 1 = dot
  while (s < len) {
    const seg = phase === 0 ? dashLen : dotLen;
    const e = Math.min(len, s + seg);
    ctx.lines.push({
      points: [
        { x: p1.x + ux * s, y: p1.y + uy * s },
        { x: p1.x + ux * e, y: p1.y + uy * e },
      ],
      layer,
    });
    s = e + gap;
    phase = 1 - phase;
  }
}

/** Crosshair centerlines through a wheel, extended past its edge. */
export function centerMark(ctx: CodexCtx, cx: number, cy: number, r: number): void {
  const ext = r * 1.12;
  dashDot(ctx, { x: cx - ext, y: cy }, { x: cx + ext, y: cy });
  dashDot(ctx, { x: cx, y: cy - ext }, { x: cx, y: cy + ext });
}

/** A filled-look arrowhead: two nested V strokes. */
function arrowhead(ctx: CodexCtx, tip: Point, dirX: number, dirY: number, size: number, layer: string): void {
  const px = -dirY;
  const py = dirX;
  for (const k of [1, 0.55]) {
    ctx.lines.push({
      points: [
        { x: tip.x - dirX * size * k + px * size * 0.34 * k, y: tip.y - dirY * size * k + py * size * 0.34 * k },
        { x: tip.x, y: tip.y },
        { x: tip.x - dirX * size * k - px * size * 0.34 * k, y: tip.y - dirY * size * k - py * size * 0.34 * k },
      ],
      layer,
    });
  }
}

/** Dimension between two points: extension lines, a dimension line at
 *  perpendicular `offset`, inward arrowheads, and a pseudo-measure label. */
export function dimension(ctx: CodexCtx, p1: Point, p2: Point, offset: number, label: string): void {
  const m = ctx.o.gearSize * 0.06 + 3;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < m * 4) return;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const q1 = { x: p1.x + px * offset, y: p1.y + py * offset };
  const q2 = { x: p2.x + px * offset, y: p2.y + py * offset };
  const over = Math.sign(offset) * m * 0.5;
  // Extension lines: from just off the feature to just past the dim line.
  for (const [p, q] of [
    [p1, q1],
    [p2, q2],
  ] as [Point, Point][]) {
    ctx.lines.push({
      points: [
        { x: p.x + px * Math.sign(offset) * m * 0.6, y: p.y + py * Math.sign(offset) * m * 0.6 },
        { x: q.x + px * over, y: q.y + py * over },
      ],
      layer: 'dim',
    });
  }
  ctx.lines.push({ points: [q1, q2], layer: 'dim' });
  arrowhead(ctx, q1, -ux, -uy, m * 0.9, 'dim');
  arrowhead(ctx, q2, ux, uy, m * 0.9, 'dim');
  // Label above the middle of the dimension line, along its direction.
  const size = Math.max(7, m * 1.35);
  const w = textWidth(label, size);
  const mid = { x: (q1.x + q2.x) / 2, y: (q1.y + q2.y) / 2 };
  const lift = m * 0.6 + size;
  const horizontal = Math.abs(ux) >= Math.abs(uy);
  const tx = horizontal ? mid.x - w / 2 : mid.x + px * (Math.sign(offset) * lift) - w / 2;
  const ty = horizontal ? mid.y + py * Math.sign(offset || 1) * 0 - m * 0.8 - size : mid.y - size / 2;
  for (const stroke of textToStrokes(label, tx, ty, size)) {
    ctx.lines.push({ points: stroke, layer: 'dim' });
  }
}

/** Leader callout: anchor dot → elbow → short horizontal shelf → letter. */
export function leader(ctx: CodexCtx, anchor: Point, out: Point, label: string): void {
  const m = ctx.o.gearSize * 0.06 + 3;
  const size = Math.max(8, m * 1.7);
  const shelfDir = out.x >= anchor.x ? 1 : -1;
  const shelf = { x: out.x + shelfDir * m * 1.4, y: out.y };
  ctx.lines.push({ points: dot(anchor.x, anchor.y, ctx.o.penWidth * 0.9), layer: 'callout' });
  ctx.lines.push({ points: [anchor, out, shelf], layer: 'callout' });
  const w = textWidth(label, size);
  const tx = shelfDir > 0 ? shelf.x + m * 0.5 : shelf.x - m * 0.5 - w;
  // Letters ride the callout layer (not 'label') so the margin fit scales
  // them together with the leader lines they belong to.
  for (const stroke of textToStrokes(label, tx, shelf.y - size * 0.55, size)) {
    ctx.lines.push({ points: stroke, layer: 'callout' });
  }
}

/**
 * Place the plate's annotations: center marks on wheels, one or two
 * dimensions taken off real geometry (measures quoted in tooth-modules, so
 * the numbers are honest), and leader letters on the interesting parts.
 */
export function renderAnnotations(ctx: CodexCtx, machine: Machine): string[] {
  const { o } = ctx;
  const rng = makeRandom(subSeed(ctx.seed, 21));
  const letters: string[] = [];
  if (o.annotations <= 0.02) return letters;
  const patent = o.style === 'patent';
  const wheels = machine.gears.filter((g) => !g.coaxialWith);

  // Center marks: all wheels in patent style, a scattering in codex.
  for (const g of wheels) {
    if (patent || rng() < o.annotations * 0.6) centerMark(ctx, g.cx, g.cy, outerR(g));
  }

  // Dimensions off real geometry.
  const dims = o.annotations < 0.35 ? 1 : o.annotations < 0.75 ? 2 : 3;
  const biggest = wheels.reduce((a, b) => (b.teeth > a.teeth ? b : a), wheels[0]);
  const measure = (px: number): string => {
    const n = Math.max(1, Math.round(px / machine.module));
    return patent ? String(n) : romanNumeral(n);
  };
  if (biggest && dims >= 1) {
    const r = outerR(biggest);
    let top = Infinity;
    for (const g of machine.gears) top = Math.min(top, g.cy - outerR(g));
    const offset = biggest.cy - (top - machine.module * 4);
    dimension(
      ctx,
      { x: biggest.cx - r, y: biggest.cy },
      { x: biggest.cx + r, y: biggest.cy },
      -offset,
      measure(2 * r)
    );
  }
  let placed = 1;
  if (placed < dims && machine.weights.length > 0) {
    const w = machine.weights[0];
    const top = w.y + machine.module;
    dimension(
      ctx,
      { x: w.x - w.w / 2, y: top + w.h },
      { x: w.x + w.w / 2, y: top + w.h },
      machine.module * 2.2,
      measure(w.w)
    );
    placed++;
  }
  // The shaft-to-shaft dimension crosses the busiest part of the drawing —
  // only at high annotation settings.
  if (dims >= 3 && placed < dims && wheels.length >= 2) {
    const other = wheels.filter((g) => g.id !== biggest.id)[0];
    if (other) {
      dimension(
        ctx,
        { x: biggest.cx, y: biggest.cy },
        { x: other.cx, y: other.cy },
        machine.module * (2.5 + rng()),
        measure(Math.hypot(other.cx - biggest.cx, other.cy - biggest.cy))
      );
    }
  }

  // Leader letters on the storytelling parts.
  const targets: Point[] = [];
  if (machine.linkages[0]) targets.push(machine.linkages[0].pin);
  if (machine.drums[0]) {
    const d = machine.drums[0];
    targets.push({ x: d.cx + d.r * 0.6, y: d.cy - d.r * 0.6 });
  }
  const stand = machine.pulleys.find((p) => !machine.gears.some((g) => Math.abs(g.cx - p.cx) < 1e-6 && Math.abs(g.cy - p.cy) < 1e-6));
  if (stand) targets.push({ x: stand.cx, y: stand.cy - stand.r });
  if (machine.weights[0]) targets.push({ x: machine.weights[0].x + machine.weights[0].w * 0.4, y: machine.weights[0].y + machine.weights[0].h * 0.6 });
  if (targets.length === 0 && biggest) targets.push({ x: biggest.cx + pitchR(biggest) * 0.7, y: biggest.cy - pitchR(biggest) * 0.7 });
  const count = Math.min(targets.length, Math.max(1, Math.round(o.annotations * 3.4)));
  const ecx = (ctx.region.x0 + ctx.region.x1) / 2;
  for (let i = 0; i < count; i++) {
    const t = targets[i];
    const side = t.x >= ecx ? 1 : -1;
    const letter = String.fromCharCode(65 + i);
    letters.push(letter);
    leader(
      ctx,
      t,
      { x: t.x + side * machine.module * (3.2 + rng() * 1.6), y: t.y - machine.module * (2.2 + rng() * 1.4) },
      letter
    );
  }
  return letters;
}
