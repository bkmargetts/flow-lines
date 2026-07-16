import type { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { densify } from '../lib/spatial.js';
import { textToStrokes, textWidth } from '../stroke-font.js';
import { circle } from './geometry.js';
import { dashDot } from './drafting.js';
import { toothProfile } from './gears.js';
import { meshPhase, pitchR } from './synth.js';
import type { CodexCtx } from './context.js';
import type { Gear, Machine } from './types.js';

/**
 * Page composition — where the machine lives, where the script goes, where
 * detail insets sit. Two archetypes: a marginalia column beside the drawing
 * (the codex page), or a band across the bottom (the plate caption block).
 * Insets are circle-clipped re-renders at 2.5–4× linked back to the main
 * view by figure letters.
 */

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PageLayout {
  region: Rect;
  textBlocks: Rect[];
  insetSlots: { cx: number; cy: number; r: number }[];
  titleY: number;
}

export function composeLayout(ctx: CodexCtx): PageLayout {
  const { o, width, height, margin } = ctx;
  const rng = makeRandom(subSeed(ctx.seed, 11));
  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;
  const usableW = x1 - x0;

  const hasTitle = o.title !== '';
  const titleH = hasTitle ? Math.max(14, usableW * 0.05) + margin * 0.35 : 0;
  const top = y0 + titleH;
  const gutter = Math.max(8, usableW * 0.03);

  const wantText = o.marginalia > 0.02;
  const wantInsets = o.detailInsets > 0;
  if (!wantText && !wantInsets) {
    return { region: { x0, y0: top, x1, y1 }, textBlocks: [], insetSlots: [], titleY: y0 };
  }

  if (rng() < 0.45) {
    // Side column (right two-thirds of the time — the mirror-writing page).
    const colW = usableW * (0.24 + rng() * 0.06);
    const colRight = rng() < 0.66;
    const col: Rect = colRight
      ? { x0: x1 - colW, y0: top, x1, y1 }
      : { x0, y0: top, x1: x0 + colW, y1 };
    const region: Rect = colRight
      ? { x0, y0: top, x1: col.x0 - gutter, y1 }
      : { x0: col.x1 + gutter, y0: top, x1, y1 };
    const insetSlots: { cx: number; cy: number; r: number }[] = [];
    let textBottom = y1;
    if (wantInsets) {
      const r = colW * 0.44;
      // Held clear of the plate-number strip along the bottom edge.
      const bottom = y1 - usableW * 0.045;
      for (let i = 0; i < Math.min(2, o.detailInsets); i++) {
        insetSlots.push({ cx: (col.x0 + col.x1) / 2, cy: bottom - r - i * (r * 2 + gutter), r });
      }
      textBottom = insetSlots[insetSlots.length - 1].cy - insetSlots[insetSlots.length - 1].r - gutter;
    }
    return {
      region,
      textBlocks: wantText ? [{ ...col, y1: textBottom }] : [],
      insetSlots,
      titleY: y0,
    };
  }

  // Bottom band: insets at the left (the plate-number corner stays clear),
  // script filling the rest.
  const bandH = (y1 - top) * (0.2 + rng() * 0.06);
  const band: Rect = { x0, y0: y1 - bandH, x1, y1 };
  const region: Rect = { x0, y0: top, x1, y1: band.y0 - gutter };
  const insetSlots: { cx: number; cy: number; r: number }[] = [];
  let textLeft = x0;
  if (wantInsets) {
    const r = Math.min(bandH * 0.48, usableW * 0.11);
    for (let i = 0; i < Math.min(2, o.detailInsets); i++) {
      insetSlots.push({ cx: x0 + r + i * (r * 2 + gutter), cy: (band.y0 + band.y1) / 2, r });
    }
    textLeft = insetSlots[insetSlots.length - 1].cx + insetSlots[insetSlots.length - 1].r + gutter;
  }
  return {
    region,
    // Hold the block off the plate-number corner.
    textBlocks: wantText ? [{ ...band, x0: textLeft, y1: y1 - usableW * 0.035 }] : [],
    insetSlots,
    titleY: y0,
  };
}

/** Clip transformed points to the inset circle, pushing surviving runs. */
function pushClipped(
  ctx: CodexCtx,
  pts: Point[],
  slot: { cx: number; cy: number; r: number },
  layer: string
): void {
  const rr = slot.r * 0.92;
  let run: Point[] = [];
  for (const p of densify(pts, 2)) {
    if (Math.hypot(p.x - slot.cx, p.y - slot.cy) <= rr) {
      run.push(p);
    } else {
      if (run.length >= 2) ctx.lines.push({ points: run, layer });
      run = [];
    }
  }
  if (run.length >= 2) ctx.lines.push({ points: run, layer });
}

/**
 * Detail insets: (A) the classic zoomed two-tooth mesh contact; (B) an
 * exploded hub along a dash-dot axis. Everything is on pinned page layers —
 * insets belong to the plate, not the drawing, so the machine fit never
 * moves them. Returns the figure letters used, continuing `startLetter`.
 */
export function renderInsets(
  ctx: CodexCtx,
  machine: Machine,
  layout: PageLayout,
  startLetter: number
): void {
  const { o } = ctx;
  const usableW = ctx.width - 2 * ctx.margin;
  let letter = startLetter;
  for (let i = 0; i < layout.insetSlots.length; i++) {
    const slot = layout.insetSlots[i];
    // Double-circle border.
    ctx.lines.push({ points: circle(slot.cx, slot.cy, slot.r), layer: 'inset' });
    ctx.lines.push({ points: circle(slot.cx, slot.cy, slot.r * 0.955), layer: 'inset' });

    if (i === 0) {
      // Mesh contact zoom, drawn as an idealized two-gear contact at inset
      // scale: pitch circles exactly tangent at the slot centre, the same
      // phase rule as the machine (a gap of one faces a tooth of the other).
      const mi = slot.r / 4.5;
      const wheel: Gear = {
        kind: 'gear',
        id: -1,
        cx: slot.cx,
        cy: slot.cy + mi * 9,
        teeth: 18,
        module: mi,
        phase: -Math.PI / 2,
        z: 0,
      };
      const pinion: Gear = {
        kind: 'gear',
        id: -2,
        cx: slot.cx,
        cy: slot.cy - mi * 6,
        teeth: 12,
        module: mi,
        phase: meshPhase(wheel, 12, -Math.PI / 2),
        z: 0,
      };
      for (const g of [wheel, pinion]) {
        pushClipped(ctx, toothProfile(g), slot, 'inset');
        // Pitch-circle arc through the contact.
        const rp = pitchR(g);
        const toward = Math.atan2(slot.cy - g.cy, slot.cx - g.cx);
        const arcPts: Point[] = [];
        for (let t = -0.6; t <= 0.6; t += 0.04) {
          arcPts.push({
            x: g.cx + Math.cos(toward + t) * rp,
            y: g.cy + Math.sin(toward + t) * rp,
          });
        }
        pushClipped(ctx, arcPts, slot, 'inset');
      }
    } else {
      // Exploded hub: axle, washers, and a pin strung on a dash-dot axis.
      const r = slot.r;
      dashDot(ctx, { x: slot.cx - r * 0.85, y: slot.cy }, { x: slot.cx + r * 0.85, y: slot.cy }, 'inset');
      const hub = r * 0.34;
      ctx.lines.push({ points: circle(slot.cx - r * 0.35, slot.cy, hub), layer: 'inset' });
      ctx.lines.push({ points: circle(slot.cx - r * 0.35, slot.cy, hub * 0.4), layer: 'inset' });
      ctx.lines.push({ points: circle(slot.cx + r * 0.18, slot.cy, hub * 0.55), layer: 'inset' });
      ctx.lines.push({ points: circle(slot.cx + r * 0.18, slot.cy, hub * 0.28), layer: 'inset' });
      // The pin: a little bar with a head.
      const px = slot.cx + r * 0.62;
      ctx.lines.push({
        points: [
          { x: px - hub * 0.15, y: slot.cy - hub * 0.5 },
          { x: px + hub * 0.15, y: slot.cy - hub * 0.5 },
          { x: px + hub * 0.15, y: slot.cy + hub * 0.5 },
          { x: px - hub * 0.15, y: slot.cy + hub * 0.5 },
          { x: px - hub * 0.15, y: slot.cy - hub * 0.5 },
        ],
        layer: 'inset',
      });
    }

    // Figure letter just inside the circle's lower rim.
    const label = String.fromCharCode(65 + letter);
    letter++;
    const size = Math.max(8, usableW * 0.02);
    const tx = slot.cx - textWidth(label, size) / 2;
    for (const stroke of textToStrokes(label, tx, slot.cy + slot.r - size * 1.8, size)) {
      ctx.lines.push({ points: stroke, layer: 'inset' });
    }
  }
}
