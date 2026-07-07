import { FlowLine, Point } from '../flow-lines.js';
import { GrayscaleImage, sampleBilinear } from '../image.js';
import { traceIsoContours } from '../iso-contours.js';
import { offsetPolyline, clipPolylineToRect } from '../lib/polyline.js';

export interface SolidFillOptions {
  /** Canvas size in px */
  width: number;
  height: number;
  /** Margin from canvas edges, px */
  margin: number;
  /** Working raster geometry (see ImageField.getMassRaster) */
  rasterWidth: number;
  rasterHeight: number;
  /** Canvas-to-raster coordinate multipliers */
  scaleX: number;
  scaleY: number;
  /** Banded mass darkness at canvas coordinates (the value plan) */
  darknessAt: (x: number, y: number) => number;
  /** Darkness at or above which a point belongs to the solid plan */
  threshold: number;
  /** Distance between fill passes, px — the plotted pen width */
  spacing: number;
  /** Fill direction in radians */
  angle: number;
  /** Regions smaller than this many canvas px² stay hatched */
  minArea: number;
}

export interface SolidFillPlan {
  /** Whether a canvas point sits inside a kept solid region */
  isSolid: (x: number, y: number) => boolean;
  /** Serpentine fill passes + boundary passes, all tagged layer 'fill' */
  lines: FlowLine[];
}

/**
 * Plan committed solid blacks: the darkest value band is inked as one
 * decisive mass instead of accumulating cross-hatch layers. The fill is
 * built from scanline runs one pen width apart, joined into long
 * serpentines (boustrophedon — few pen lifts by construction), with the
 * region boundary traced and inked as concentric passes so the edge is a
 * drawn line, not scanline stair-steps. Everything stays a plain stroked
 * path from a single pen.
 *
 * Tiny flecks stay hatched — a hand doesn't flood-fill a speck — via the
 * minArea gate on 4-connected components of the thresholded plan.
 */
export function planSolidFill(options: SolidFillOptions): SolidFillPlan {
  const {
    width,
    height,
    margin,
    rasterWidth: rw,
    rasterHeight: rh,
    scaleX,
    scaleY,
    darknessAt,
    threshold,
    spacing,
    angle,
    minArea,
  } = options;

  // Binary solidity mask on the working raster: 1 inside the darkest band.
  // Kept as floats so bilinear sampling gives a smooth sub-cell boundary —
  // the same boundary marching squares traces at the 0.5 iso level.
  const mask = new Float32Array(rw * rh);
  for (let ry = 0; ry < rh; ry++) {
    for (let rx = 0; rx < rw; rx++) {
      mask[ry * rw + rx] = darknessAt(rx / scaleX, ry / scaleY) >= threshold ? 1 : 0;
    }
  }

  // Area-gate 4-connected components; a raster cell covers 1/(scaleX*scaleY)
  // canvas px². Small components are erased from the mask entirely so both
  // the fill and the boundary passes skip them.
  const cellArea = 1 / (scaleX * scaleY);
  const visited = new Uint8Array(rw * rh);
  const stack: number[] = [];
  const component: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (visited[start] || mask[start] === 0) continue;
    stack.length = 0;
    component.length = 0;
    stack.push(start);
    visited[start] = 1;
    while (stack.length > 0) {
      const i = stack.pop()!;
      component.push(i);
      const x = i % rw;
      const y = (i - x) / rw;
      if (x > 0 && !visited[i - 1] && mask[i - 1] > 0) {
        visited[i - 1] = 1;
        stack.push(i - 1);
      }
      if (x < rw - 1 && !visited[i + 1] && mask[i + 1] > 0) {
        visited[i + 1] = 1;
        stack.push(i + 1);
      }
      if (y > 0 && !visited[i - rw] && mask[i - rw] > 0) {
        visited[i - rw] = 1;
        stack.push(i - rw);
      }
      if (y < rh - 1 && !visited[i + rw] && mask[i + rw] > 0) {
        visited[i + rw] = 1;
        stack.push(i + rw);
      }
    }
    if (component.length * cellArea < minArea) {
      for (const i of component) mask[i] = 0;
    }
  }

  const maskImage: GrayscaleImage = { width: rw, height: rh, data: mask };
  const solidAt = (x: number, y: number): number =>
    sampleBilinear(maskImage, x * scaleX, y * scaleY);
  const isSolid = (x: number, y: number): boolean => solidAt(x, y) >= 0.5;

  const lines: FlowLine[] = [];
  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;

  // Boundary passes: trace the mask's 0.5 iso-contour and ink it plus one
  // pass stepped inward — the serpentine's row ends then sit behind a
  // crisp drawn edge instead of showing sampling stair-steps.
  const minBoundary = Math.max(6 * spacing, 8);
  for (const poly of traceIsoContours(maskImage, 0.5)) {
    const canvasPoly = poly.map((p) => ({ x: p.x / scaleX, y: p.y / scaleY }));
    let length = 0;
    for (let i = 1; i < canvasPoly.length; i++) {
      length += Math.hypot(
        canvasPoly[i].x - canvasPoly[i - 1].x,
        canvasPoly[i].y - canvasPoly[i - 1].y
      );
    }
    if (length < minBoundary) continue;

    // Which normal side is the ink? Probe the offset polyline's midpoint.
    const probe = offsetPolyline(canvasPoly, spacing);
    const probeMid = probe[Math.floor(probe.length / 2)];
    const inward = isSolid(probeMid.x, probeMid.y) ? 1 : -1;

    for (let pass = 0; pass < 2; pass++) {
      const offset = pass === 0 ? canvasPoly : offsetPolyline(canvasPoly, inward * spacing * 0.9);
      for (const run of clipPolylineToRect(offset, x0, y0, x1, y1)) {
        lines.push({ points: run, layer: 'fill' });
      }
    }
  }

  // Serpentine fill: march scanlines perpendicular to the fill angle,
  // sample solidity along each, and join consecutive rows' runs whenever
  // the pen can slide from one row to the next without leaving the black.
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const vxAxis = -uy;
  const vyAxis = ux;

  const corners: Point[] = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x0, y: y1 },
    { x: x1, y: y1 },
  ];
  let tMin = Infinity;
  let tMax = -Infinity;
  let sMin = Infinity;
  let sMax = -Infinity;
  for (const c of corners) {
    const t = c.x * ux + c.y * uy;
    const s = c.x * vxAxis + c.y * vyAxis;
    tMin = Math.min(tMin, t);
    tMax = Math.max(tMax, t);
    sMin = Math.min(sMin, s);
    sMax = Math.max(sMax, s);
  }

  const sampleStep = Math.max(0.5, Math.min(2, spacing * 0.6));
  const minRun = spacing * 0.9;
  // Rows may be joined by a connector drawn through the black (invisible in
  // a solid mass), so the join reach is generous — the whole connector just
  // has to stay inside the ink. Round region caps need this: adjacent
  // chords' endpoints jump far apart near a pole
  const joinDistance = spacing * 12;
  // Row endpoints sit right on the mask's 0.5 boundary, so a connector
  // hugging a curved region edge samples marginally either side of it —
  // judge the connector with a softer cut. A genuine white gap between two
  // regions still reads near 0 and is rejected
  const connectorInside = (a: Point, b: Point): boolean => {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(d / spacing));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (solidAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t) < 0.3) return false;
    }
    return true;
  };

  interface OpenSerpentine {
    points: Point[];
    last: Point;
  }
  let open: OpenSerpentine[] = [];

  const finish = (o: OpenSerpentine): void => {
    if (o.points.length >= 2) {
      lines.push({ points: o.points, layer: 'fill' });
    }
  };

  let row = 0;
  for (let s = sMin + spacing * 0.5; s <= sMax; s += spacing, row++) {
    // Collect this row's runs of solid coverage
    const runs: { a: Point; b: Point }[] = [];
    let runStart: Point | null = null;
    let runEnd: Point | null = null;
    for (let t = tMin; t <= tMax + 1e-9; t += sampleStep) {
      const x = ux * t + vxAxis * s;
      const y = uy * t + vyAxis * s;
      const inside = x >= x0 && x <= x1 && y >= y0 && y <= y1 && isSolid(x, y);
      if (inside) {
        if (!runStart) runStart = { x, y };
        runEnd = { x, y };
      } else if (runStart && runEnd) {
        if (Math.hypot(runEnd.x - runStart.x, runEnd.y - runStart.y) >= minRun) {
          runs.push({ a: runStart, b: runEnd });
        }
        runStart = null;
        runEnd = null;
      }
    }
    if (runStart && runEnd && Math.hypot(runEnd.x - runStart.x, runEnd.y - runStart.y) >= minRun) {
      runs.push({ a: runStart, b: runEnd });
    }

    // Boustrophedon: alternate rows run in alternate directions so the
    // join to the previous row's end is a short hop, not a full carriage
    // return
    if (row % 2 === 1) {
      runs.reverse();
      for (const r of runs) {
        const tmp = r.a;
        r.a = r.b;
        r.b = tmp;
      }
    }

    const nextOpen: OpenSerpentine[] = [];
    for (const r of runs) {
      let joined: OpenSerpentine | null = null;
      for (let i = 0; i < open.length; i++) {
        const o = open[i];
        const d = Math.hypot(o.last.x - r.a.x, o.last.y - r.a.y);
        if (d <= joinDistance && connectorInside(o.last, r.a)) {
          joined = o;
          open.splice(i, 1);
          break;
        }
      }
      if (joined) {
        joined.points.push(r.a, r.b);
        joined.last = r.b;
        nextOpen.push(joined);
      } else {
        nextOpen.push({ points: [{ ...r.a }, { ...r.b }], last: r.b });
      }
    }

    // Serpentines that found no continuation this row are complete
    for (const o of open) finish(o);
    open = nextOpen;
  }
  for (const o of open) finish(o);

  return { isSolid, lines };
}
