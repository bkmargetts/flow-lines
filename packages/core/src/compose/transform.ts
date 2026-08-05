import type { FlowLine, Point } from '../flow-lines.js';

/**
 * Page-space rigid transform applied to finished lines: `scale → rotate →
 * translate` about an origin (the compositor passes the page centre). This is
 * a layer-level control — modules render as usual and their output is moved,
 * so it composes with any generator.
 */
export interface LineTransformOptions {
  translateXPx?: number;
  translateYPx?: number;
  rotateDeg?: number;
  /** Uniform scale about the origin. Default 1. */
  scale?: number;
  /** Transform origin in page px. Default 0,0 — callers pass the page centre. */
  originX?: number;
  originY?: number;
}

function isIdentity(t: LineTransformOptions): boolean {
  return (
    !(t.translateXPx ?? 0) &&
    !(t.translateYPx ?? 0) &&
    !(t.rotateDeg ?? 0) &&
    (t.scale ?? 1) === 1
  );
}

/** Transform every line. Identity options return the input untouched. */
export function transformLines(lines: FlowLine[], t: LineTransformOptions): FlowLine[] {
  if (isIdentity(t)) return lines;
  const map = pointMapper(t);
  return lines.map((line) => ({ ...line, points: line.points.map(map) }));
}

function pointMapper(t: LineTransformOptions): (p: Point) => Point {
  const rad = ((t.rotateDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const s = t.scale ?? 1;
  const ox = t.originX ?? 0;
  const oy = t.originY ?? 0;
  const dx = t.translateXPx ?? 0;
  const dy = t.translateYPx ?? 0;
  return (p: Point) => {
    const x = (p.x - ox) * s;
    const y = (p.y - oy) * s;
    return {
      x: ox + x * cos - y * sin + dx,
      y: oy + x * sin + y * cos + dy,
    };
  };
}

/**
 * Echo a layer: `copies` total (the original included), copy k transformed by
 * the compounded delta (k× translate, k× rotate, scale^k). Copies land on the
 * same pens as the original — misregistration nudges, drop shadows, radial
 * repeats — and the layer's pen count stays put.
 */
export interface EchoOptions extends LineTransformOptions {
  /** Total copies including the original. 1 = no echo. */
  copies: number;
}

export function echoLines(lines: FlowLine[], e: EchoOptions): FlowLine[] {
  const copies = Math.max(1, Math.floor(e.copies));
  if (copies === 1 || isIdentity(e)) return lines;
  const out: FlowLine[] = lines.slice();
  for (let k = 1; k < copies; k++) {
    out.push(
      ...transformLines(lines, {
        translateXPx: (e.translateXPx ?? 0) * k,
        translateYPx: (e.translateYPx ?? 0) * k,
        rotateDeg: (e.rotateDeg ?? 0) * k,
        scale: (e.scale ?? 1) ** k,
        originX: e.originX,
        originY: e.originY,
      })
    );
  }
  return out;
}
