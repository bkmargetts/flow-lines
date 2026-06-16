import { FlowLine, Point } from './flow-lines.js';

export interface PageBorderOptions {
  /** Page size in px. */
  width: number;
  height: number;
  /** Shared clear-paper margin in px — the border sits at this edge by default. */
  marginPx: number;
  /** Extra inset from the margin in px (0 = rule sits at the margin). */
  insetPx?: number;
  /** Layer tag for per-pen export (default 'border'). */
  layer?: string;
}

/**
 * A crisp ruled plate border framing the page, like a print. Four straight
 * two-point edges (kept straight so SVG path simplification can't round a
 * densified loop into an oval, and so it reads as a deliberate rule).
 *
 * This is a pure overlay: it never changes where the drawing sits, so adding a
 * border can't shift any module's output. Tagged on its own layer so the
 * texture can hold off around it and it can be plotted with its own pen.
 */
export function pageBorder(options: PageBorderOptions): FlowLine[] {
  const inset = (options.marginPx ?? 0) + (options.insetPx ?? 0);
  const x0 = inset;
  const y0 = inset;
  const x1 = options.width - inset;
  const y1 = options.height - inset;
  if (x1 - x0 <= 1 || y1 - y0 <= 1) return [];

  const layer = options.layer ?? 'border';
  const corners: Point[] = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  const lines: FlowLine[] = [];
  for (let e = 0; e < 4; e++) {
    lines.push({ points: [corners[e], corners[(e + 1) % 4]], pen: 'bold', layer });
  }
  return lines;
}
