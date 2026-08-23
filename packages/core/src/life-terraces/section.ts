import { FlowLine, Point } from '../flow-lines.js';
import { GrayscaleImage, sampleBilinear } from '../image.js';
import { offsetEmphasisPasses } from '../pen-ink/swell.js';
import { inkLayerName } from '../marbling/index.js';
import { TerraceField } from './field.js';
import { FaultPlane } from './faults.js';
import { dashRuns } from './marks.js';

/**
 * The survey cross-section: a seeded chord A-B across the colony, drawn on
 * the map as a dashed line with end ticks, and rendered along the bottom of
 * the sheet as a geological plate — the walked field's profile as a bold
 * crest, terrace levels as a layer-cake of dashed beds held below it with
 * reserved seams, fault crossings as near-vertical strokes, and a bold
 * ground-line datum. The same Life data as map above and section below.
 */
export interface SectionChord {
  /** Chord centre and unit direction, raster coords. */
  cx: number;
  cy: number;
  dx: number;
  dy: number;
  /** Signed arc range along the chord (raster cells). */
  tA: number;
  tB: number;
}

/**
 * Place the chord: through the exposure-weighted centroid at a seeded
 * shallow angle, spanning the visible footprint plus a little padding.
 * Returns null when the chord never crosses toned terrain (no plate
 * furniture over an empty sim). Draws exactly one rng value (the angle)
 * regardless of outcome, so downstream stream positions are stable.
 */
export function buildSectionChord(
  exposure: GrayscaleImage,
  faint: number,
  rng: () => number,
  pad = 3
): SectionChord | null {
  const { width, height, data } = exposure;
  const angle = (rng() - 0.5) * (Math.PI / 2);
  let wsum = 0;
  let cx = 0;
  let cy = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = data[y * width + x];
      if (v < faint) continue;
      wsum += v;
      cx += v * x;
      cy += v * y;
    }
  }
  if (wsum <= 0) return null;
  cx /= wsum;
  cy /= wsum;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  // Scan the chord for its visible span (the faultTraces walking idiom).
  const span = Math.hypot(width, height);
  let tMin = Infinity;
  let tMax = -Infinity;
  for (let t = -span; t <= span; t += 0.5) {
    const x = cx + dx * t;
    const y = cy + dy * t;
    if (x < 0 || x > width - 1 || y < 0 || y > height - 1) continue;
    if (sampleBilinear(exposure, x, y) >= faint) {
      if (t < tMin) tMin = t;
      if (t > tMax) tMax = t;
    }
  }
  if (tMax <= tMin) return null;

  // Extend by the padding but never off the grid box.
  const inBox = (t: number): boolean => {
    const x = cx + dx * t;
    const y = cy + dy * t;
    return x >= 0 && x <= width - 1 && y >= 0 && y <= height - 1;
  };
  let tA = tMin - pad;
  while (!inBox(tA) && tA < tMin) tA += 0.25;
  let tB = tMax + pad;
  while (!inBox(tB) && tB > tMax) tB -= 0.25;
  return { cx, cy, dx, dy, tA, tB };
}

const chordPoint = (c: SectionChord, t: number): Point => ({
  x: c.cx + c.dx * t,
  y: c.cy + c.dy * t,
});

/**
 * The A-B line on the map: fine seeded dashes plus a short perpendicular
 * tick at each end (no text — the ticks are the plate's only labels).
 * Raster coords; the caller maps to page px and clips by the present halo.
 */
export function sectionMapFurniture(chord: SectionChord, rng: () => number): Point[][] {
  const out: Point[][] = [];
  let t = chord.tA;
  let guard = 0;
  while (t < chord.tB && guard++ < 400) {
    const e = Math.min(chord.tB, t + 4 + rng() * 2);
    out.push([chordPoint(chord, t), chordPoint(chord, e)]);
    t = e + 0.8 + rng() * 0.6;
  }
  const tick = (tEnd: number): Point[] => {
    const p = chordPoint(chord, tEnd);
    const nx = -chord.dy;
    const ny = chord.dx;
    return [
      { x: p.x - nx * 1.8, y: p.y - ny * 1.8 },
      { x: p.x + nx * 1.8, y: p.y + ny * 1.8 },
    ];
  };
  out.push(tick(chord.tA), tick(chord.tB));
  return out;
}

/** Chord-arc positions where the chord crosses a fault's (raw) line. The
 *  map's scarps draw the raw fault lines too, so map and section agree. */
export function sectionFaultCrossings(
  chord: SectionChord,
  faults: FaultPlane[],
  exposure: GrayscaleImage,
  faint: number
): number[] {
  const out: number[] = [];
  for (const f of faults) {
    const nx = -f.ty;
    const ny = f.tx;
    const denom = chord.dx * nx + chord.dy * ny;
    if (Math.abs(denom) < 1e-6) continue;
    const t = ((f.px - chord.cx) * nx + (f.py - chord.cy) * ny) / denom;
    if (t <= chord.tA || t >= chord.tB) continue;
    const p = chordPoint(chord, t);
    // Only where the fault actually cuts toned terrain (the faultTraces
    // lit-probe idiom): a fault stroke over blank basement reads as a rule.
    const lit =
      sampleBilinear(exposure, p.x - f.ty * 1.2, p.y + f.tx * 1.2) >= faint ||
      sampleBilinear(exposure, p.x + f.ty * 1.2, p.y - f.tx * 1.2) >= faint;
    if (lit) out.push(t);
  }
  return out;
}

export interface SectionStripConfig {
  /** Strip rectangle in page px. */
  x0: number;
  x1: number;
  top: number;
  bottom: number;
  levels: number;
  levelIso: (k: number) => number;
  faint: number;
  /** Agent knobs the beds inherit so the plate speaks the map's language. */
  spacing: number;
  densityContrast: number;
  cellSize: number;
  seamWidth: number;
  taper: number;
  pens: number;
  rng: () => number;
}

export function renderSectionStrip(
  field: TerraceField,
  chord: SectionChord,
  crossings: number[],
  cfg: SectionStripConfig
): FlowLine[] {
  const lines: FlowLine[] = [];
  const { x0, x1, top, bottom, faint } = cfg;
  const stripW = x1 - x0;
  const stripH = bottom - top;
  if (stripW < 8 || stripH < 8) return lines;
  const seamGap = Math.max(2, cfg.seamWidth);

  // Profile samples along the chord.
  const step = 0.25;
  const ts: number[] = [];
  const hs: number[] = [];
  for (let t = chord.tA; t <= chord.tB; t += step) {
    const p = chordPoint(chord, t);
    ts.push(t);
    hs.push(field.sample(p.x, p.y));
  }
  const xOf = (t: number): number => x0 + ((t - chord.tA) / (chord.tB - chord.tA)) * stripW;
  const yOf = (h: number): number => bottom - h * stripH;
  const crossingXs = crossings.map(xOf);

  const pushBold = (pts: Point[], layer: string): void => {
    lines.push({ points: pts, pen: 'bold', layer });
    for (const pass of offsetEmphasisPasses(pts, 2, cfg.cellSize * 0.18, 0.12)) {
      lines.push({ points: pass, pen: 'bold', layer });
    }
  };

  // Ground line: the plate's datum, full width (furniture, so it runs past
  // the terrain).
  pushBold(
    [
      { x: x0, y: bottom },
      { x: x1, y: bottom },
    ],
    inkLayerName(0)
  );

  // Profile crest: bold runs wherever the chord is over toned terrain.
  let crest: Point[] = [];
  for (let i = 0; i < ts.length; i++) {
    if (hs[i] >= faint) {
      crest.push({ x: xOf(ts[i]), y: yOf(hs[i]) });
    } else {
      if (crest.length >= 2) pushBold(crest, inkLayerName(0));
      crest = [];
    }
  }
  if (crest.length >= 2) pushBold(crest, inkLayerName(0));

  // Bed boundary lines: a fine continuous rule at each iso height wherever
  // the terrain rises above it — these are what make the layer-cake legible
  // as discrete beds rather than one dashed mass. Same fault gaps as the
  // rows; the rows' seam clearance leaves paper either side of each rule.
  for (let k = 1; k < cfg.levels; k++) {
    const iso = cfg.levelIso(k);
    const yIso = yOf(iso);
    let run: Point[] = [];
    for (let i = 0; i < ts.length; i++) {
      const x = xOf(ts[i]);
      const ok =
        hs[i] >= iso + 0.01 &&
        yIso - yOf(hs[i]) >= seamGap * 0.5 &&
        crossingXs.every((cx) => Math.abs(x - cx) >= seamGap);
      if (ok) {
        run.push({ x, y: yIso });
      } else {
        if (run.length >= 2) lines.push({ points: run, pen: 'fine', layer: inkLayerName(k % cfg.pens) });
        run = [];
      }
    }
    if (run.length >= 2) lines.push({ points: run, pen: 'fine', layer: inkLayerName(k % cfg.pens) });
  }

  // Layer-cake beds: for each terrace level, horizontal ruled rows between
  // its iso heights, clipped below the profile with a paper halo under the
  // crest and reserved gaps at every fault crossing. Bed 0 runs down to the
  // ground line — below-faint basement is still rock in a cross-section; it
  // only shows under visible terrain because rows require h >= faint.
  const dashOpts = { cellSize: cfg.cellSize, taper: cfg.taper, continuous: false };
  for (let k = 0; k < cfg.levels; k++) {
    const isoLo = cfg.levelIso(k); // levelIso(0) === faint
    const isoHi = k === cfg.levels - 1 ? 1 : cfg.levelIso(k + 1);
    const vMid = (Math.max(isoLo, faint) + isoHi) / 2;
    const pitch = cfg.spacing * cfg.cellSize * (1 + cfg.densityContrast * 1.6 * (1 - vMid));
    const yTop = yOf(isoHi) + seamGap / 2;
    const yBottom = k === 0 ? bottom - seamGap : yOf(isoLo) - seamGap / 2;
    const layer = inkLayerName(k % cfg.pens);
    for (let yRow = yTop; yRow <= yBottom; yRow += Math.max(1.5, pitch)) {
      if (lines.length > 8000) break; // strip runaway guard
      const vRow = (bottom - yRow) / stripH;
      let run: Point[] = [];
      const flush = (): void => {
        if (run.length >= 2) {
          for (const piece of dashRuns(run, cfg.rng, dashOpts)) {
            if (piece.length >= 2) lines.push({ points: piece, pen: 'fine', layer });
          }
        }
        run = [];
      };
      for (let i = 0; i < ts.length; i++) {
        const x = xOf(ts[i]);
        const h = hs[i];
        const ok =
          h >= Math.max(vRow, faint) &&
          yRow - yOf(h) >= seamGap &&
          crossingXs.every((cx) => Math.abs(x - cx) >= seamGap);
        if (ok) {
          run.push({ x, y: yRow });
        } else {
          flush();
        }
      }
      flush();
    }
  }

  // Fault strokes: near-vertical bold cuts from the datum up to the crest,
  // each tilted a seeded hair so the plate reads drawn, not drafted.
  for (let c = 0; c < crossings.length; c++) {
    const t = crossings[c];
    const tilt = Math.tan(((cfg.rng() * 2 - 1) * 6 * Math.PI) / 180);
    const p = chordPoint(chord, t);
    const hTop = field.sample(p.x, p.y);
    if (hTop < faint) continue;
    const xBase = xOf(t);
    const yTop = yOf(hTop);
    pushBold(
      [
        { x: xBase, y: bottom },
        { x: xBase + tilt * (bottom - yTop), y: yTop },
      ],
      inkLayerName(0)
    );
  }

  return lines;
}
