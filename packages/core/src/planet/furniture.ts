import { FlowLine } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { textToStrokes, textWidth } from '../stroke-font.js';
import { getSketchStyleConfig } from '../sketch-styles.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { TAU } from './vec3.js';
import { dot4 } from './geometry.js';
import type { SceneCtx } from './context.js';

/** Scene background: starfield (behind everything). */
export function renderStarfield(scene: SceneCtx): void {
  const { o, seed, width, height, margin, cx, cy, R, lines } = scene;
  if (!o.starfield) return;
  const sr = makeRandom(seed + 1001);
  const x0 = margin;
  const y0 = margin;
  const w = width - 2 * margin;
  const h = height - 2 * margin;
  const reach = R * 1.06;
  for (let i = 0; i < o.starCount; i++) {
    const sx = x0 + sr() * w;
    const sy = y0 + sr() * h;
    const dx = sx - cx;
    const dy = sy - cy;
    if (dx * dx + dy * dy < reach * reach) continue; // keep the disk clear
    const big = sr();
    if (big > 0.9) {
      // a sparkle cross
      const r = o.penWidth * 1.8;
      lines.push({ points: [{ x: sx - r, y: sy }, { x: sx + r, y: sy }], layer: 'star' });
      lines.push({ points: [{ x: sx, y: sy - r }, { x: sx, y: sy + r }], layer: 'star' });
    } else {
      const r = o.penWidth * (0.45 + big * 0.4);
      lines.push({ points: dot4(sx, sy, r), layer: 'star' });
    }
  }
}

/** Atmosphere / corona around the limb (behind the body strokes). */
export function renderAtmosphere(scene: SceneCtx): void {
  const { o, seed, cx, cy, R, lines } = scene;
  if (!(o.atmosphere > 0 && o.layout === 'single')) return;
  if (o.planetType === 'star') {
    // Corona: short radial flares of varying length.
    const sr = makeRandom(seed + 1313);
    const flares = Math.round(120 * o.atmosphere);
    for (let i = 0; i < flares; i++) {
      const t = (i / flares) * TAU + (sr() - 0.5) * 0.05;
      const len = R * (0.04 + sr() * 0.12 * o.atmosphere);
      const c = Math.cos(t);
      const s = Math.sin(t);
      lines.push({
        points: [
          { x: cx + c * R, y: cy + s * R },
          { x: cx + c * (R + len), y: cy + s * (R + len) },
        ],
        layer: 'atmosphere',
      });
    }
  } else {
    const rings = Math.max(1, Math.round(o.atmosphere));
    for (let i = 0; i < rings; i++) {
      const rr = R * (1.02 + i * 0.035);
      lines.push({ points: dot4(cx, cy, rr), layer: 'atmosphere' });
    }
  }
}

/** Graduated neatline just inside the margin: an outer rule, an inner rule,
 *  and graduation ticks between them — the frame of an engraved plate. */
export function renderPlateFrame(scene: SceneCtx): void {
  const { o, width, height, margin, lines } = scene;
  if (!o.plateFrame) return;
  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;
  const inset = Math.max(3, margin * 0.18);
  const rect = (a: number, b: number, c: number, d: number): void => {
    lines.push({ points: [{ x: a, y: b }, { x: c, y: b }, { x: c, y: d }, { x: a, y: d }, { x: a, y: b }], layer: 'annotation' });
  };
  rect(x0, y0, x1, y1);
  rect(x0 + inset, y0 + inset, x1 - inset, y1 - inset);
  const divX = Math.max(8, Math.round((x1 - x0) / Math.max(20, (x1 - x0) / 24)));
  for (let i = 0; i <= divX; i++) {
    const fx = x0 + ((x1 - x0) * i) / divX;
    lines.push({ points: [{ x: fx, y: y0 }, { x: fx, y: y0 + inset }], layer: 'annotation' });
    lines.push({ points: [{ x: fx, y: y1 }, { x: fx, y: y1 - inset }], layer: 'annotation' });
  }
  const divY = Math.max(6, Math.round((divX * (y1 - y0)) / (x1 - x0)));
  for (let i = 0; i <= divY; i++) {
    const fy = y0 + ((y1 - y0) * i) / divY;
    lines.push({ points: [{ x: x0, y: fy }, { x: x0 + inset, y: fy }], layer: 'annotation' });
    lines.push({ points: [{ x: x1, y: fy }, { x: x1 - inset, y: fy }], layer: 'annotation' });
  }
}

/** Scale bar: a divided rule near the bottom of the plate. */
export function renderScaleBar(scene: SceneCtx): void {
  const { o, width, height, margin, cx, lines } = scene;
  if (!o.scaleBar) return;
  const usableW = width - 2 * margin;
  const len = usableW * 0.28;
  const bx0 = cx - len / 2;
  const by0 = height - margin - Math.max(16, margin * 0.6);
  const h = Math.max(5, usableW * 0.012);
  const segs = 5;
  lines.push({ points: [{ x: bx0, y: by0 }, { x: bx0 + len, y: by0 }], layer: 'annotation' });
  lines.push({ points: [{ x: bx0, y: by0 - h }, { x: bx0 + len, y: by0 - h }], layer: 'annotation' });
  for (let i = 0; i <= segs; i++) {
    const sx = bx0 + (len * i) / segs;
    lines.push({ points: [{ x: sx, y: by0 - h }, { x: sx, y: by0 }], layer: 'annotation' });
  }
}

/** Engraved title / caption (single-stroke, plottable). */
export function renderTitleCaption(scene: SceneCtx): void {
  const { o, width, height, margin, cx, lines } = scene;
  const usableW = width - 2 * margin;
  if (o.title) {
    const size = Math.max(11, usableW * 0.05);
    const tx = cx - textWidth(o.title, size) / 2;
    const ty = margin + (o.plateFrame ? margin * 0.5 : size * 0.4);
    for (const stroke of textToStrokes(o.title, tx, ty, size)) lines.push({ points: stroke, layer: 'label' });
  }
  if (o.caption) {
    const size = Math.max(9, usableW * 0.032);
    const cxs = cx - textWidth(o.caption, size) / 2;
    const cyy = height - margin - size - (o.scaleBar ? Math.max(16, margin * 0.6) + size * 1.4 : o.plateFrame ? margin * 0.5 : 0);
    for (const stroke of textToStrokes(o.caption, cxs, cyy, size)) lines.push({ points: stroke, layer: 'label' });
  }
}

/** Hand-drawn finish: a multi-pass sketch overdraw (shared with the Vine
 *  Generator) when `sketch` is set, otherwise a single low-frequency wobble. */
export function applyFinish(scene: SceneCtx): FlowLine[] {
  const { o, seed, width, height, lines } = scene;
  if (o.sketch > 0.01) {
    const { passes, wavelength, amplitude, jitter } = getSketchStyleConfig(o.sketchStyle, o.sketch);
    const acc: FlowLine[] = [];
    for (let p = 0; p < passes; p++) {
      const pseed = subSeed(seed, p);
      const styled = applyHandDrawnStyle({ lines, width, height, seed: pseed }, { amplitude, wavelength, jitter, seed: pseed }).lines;
      for (const l of styled) acc.push(l);
    }
    return acc;
  }
  return applyHandDrawnStyle({ lines, width, height, seed }, { amplitude: o.wobble, wavelength: 42, seed }).lines;
}

/** Uniformly scale the non-furniture lines about the page centre so their
 *  bounding box fits within the margin box. Plate furniture (frame, scale bar,
 *  labels, background starfield) is already margin-bound and stays pinned;
 *  only the body (disk, rings, moon, orbits, …) is fitted, so a ringed planet
 *  shrinks to fit rather than spilling past the margin. */
export function fitBodyToMargin(scene: SceneCtx, all: FlowLine[]): FlowLine[] {
  const { width, height, margin, cx, cy } = scene;
  const isFurniture = (layer?: string): boolean =>
    layer === 'annotation' || layer === 'label' || layer === 'star';
  const halfW = width / 2 - margin;
  const halfH = height / 2 - margin;
  if (halfW <= 0 || halfH <= 0) return all;
  let maxDx = 0;
  let maxDy = 0;
  for (const ln of all) {
    if (isFurniture(ln.layer)) continue;
    for (const p of ln.points) {
      const ax = Math.abs(p.x - cx);
      const ay = Math.abs(p.y - cy);
      if (ax > maxDx) maxDx = ax;
      if (ay > maxDy) maxDy = ay;
    }
  }
  const scale = Math.min(1, maxDx > 0 ? halfW / maxDx : 1, maxDy > 0 ? halfH / maxDy : 1);
  if (scale >= 0.999) return all;
  return all.map((ln) =>
    isFurniture(ln.layer)
      ? ln
      : { ...ln, points: ln.points.map((p) => ({ x: cx + (p.x - cx) * scale, y: cy + (p.y - cy) * scale })) }
  );
}
