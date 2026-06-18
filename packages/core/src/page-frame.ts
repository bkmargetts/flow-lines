import { FlowLine, Point } from './flow-lines.js';

export interface PageBorderOptions {
  /** Page size in px. */
  width: number;
  height: number;
  /** Shared clear-paper margin in px — the border sits at this edge by default. */
  marginPx: number;
  /** Extra inset from the margin in px (0 = rule sits at the margin). */
  insetPx?: number;
  /** Corner radius in px (0 = sharp right-angle corners, the default). */
  cornerRadiusPx?: number;
  /** Layer tag for per-pen export (default 'border'). */
  layer?: string;
}

/**
 * A crisp ruled plate border framing the page, like a print. With sharp
 * corners it's four straight two-point edges (kept straight so SVG path
 * simplification can't round a densified loop into an oval, and so it reads as
 * a deliberate rule). When `cornerRadiusPx > 0` the edges are shortened by the
 * radius and joined by quarter-circle arc polylines — the straight runs stay
 * straight, and only the corners densify into real arc points (which clear the
 * RDP simplification threshold comfortably, so they round rather than collapse).
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
  // Radius can't exceed half the shorter side, or opposing arcs would overlap.
  const r = Math.max(0, Math.min(options.cornerRadiusPx ?? 0, (x1 - x0) / 2, (y1 - y0) / 2));

  if (r <= 0) {
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

  // Straight edges shortened by the radius (each a 2-point segment), then a
  // quarter-circle arc tucked into each corner. Edge e runs to corner e, whose
  // arc sweeps 90° from that edge's end into the next edge's start.
  const lines: FlowLine[] = [
    { points: [{ x: x0 + r, y: y0 }, { x: x1 - r, y: y0 }], pen: 'bold', layer }, // top
    { points: [{ x: x1, y: y0 + r }, { x: x1, y: y1 - r }], pen: 'bold', layer }, // right
    { points: [{ x: x1 - r, y: y1 }, { x: x0 + r, y: y1 }], pen: 'bold', layer }, // bottom
    { points: [{ x: x0, y: y1 - r }, { x: x0, y: y0 + r }], pen: 'bold', layer }, // left
  ];

  // Arc centres and the angle (radians, screen y-down) each quarter starts at.
  const arcs: Array<{ cx: number; cy: number; start: number }> = [
    { cx: x1 - r, cy: y0 + r, start: -Math.PI / 2 }, // top-right: top edge → right edge
    { cx: x1 - r, cy: y1 - r, start: 0 }, //              right edge → bottom edge
    { cx: x0 + r, cy: y1 - r, start: Math.PI / 2 }, //    bottom edge → left edge
    { cx: x0 + r, cy: y0 + r, start: Math.PI }, //        left edge → top edge
  ];
  const segments = Math.max(4, Math.ceil(r / 2));
  for (const { cx, cy, start } of arcs) {
    const points: Point[] = [];
    for (let i = 0; i <= segments; i++) {
      const a = start + (Math.PI / 2) * (i / segments);
      points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    lines.push({ points, pen: 'bold', layer });
  }
  return lines;
}
