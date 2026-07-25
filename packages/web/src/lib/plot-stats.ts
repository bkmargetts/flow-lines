import { measurePenTravel, type FlowLinesResult } from '@flow-lines/core';

/**
 * Plot cost of a composited result, in real-world units.
 *
 * `measurePenTravel` has been exported from core all along but was never used
 * anywhere in the app, so nothing told you a plot would take six hours until
 * the plotter was already running.
 */
export interface PlotStats {
  /** Number of separate strokes — one pen-down/pen-up cycle each. */
  strokes: number;
  /** Distance drawn with the pen down, mm. */
  drawnMm: number;
  /** Distance moved with the pen up, between strokes, mm. */
  travelMm: number;
  /** Rough wall-clock estimate, seconds. See PEN_DOWN_MM_S. */
  seconds: number;
}

/**
 * Speeds for the estimate, mm/s. These are deliberately conservative
 * mid-range plotter figures (an AxiDraw at default settings is near this);
 * machines vary a lot, so the number is presented as an estimate, not a
 * promise. Pen lifts cost real time too — a fixed penalty per stroke.
 */
const PEN_DOWN_MM_S = 25;
const PEN_UP_MM_S = 75;
const PEN_LIFT_S = 0.12;

function polylineLengthPx(points: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

export function computePlotStats(result: FlowLinesResult, pxPerMm: number): PlotStats {
  const perMm = pxPerMm > 0 ? pxPerMm : 1;
  let drawnPx = 0;
  for (const line of result.lines) drawnPx += polylineLengthPx(line.points);

  const drawnMm = drawnPx / perMm;
  const travelMm = measurePenTravel(result) / perMm;
  const strokes = result.lines.length;
  const seconds = drawnMm / PEN_DOWN_MM_S + travelMm / PEN_UP_MM_S + strokes * PEN_LIFT_S;

  return { strokes, drawnMm, travelMm, seconds };
}

/** "2h 15m", "8m 30s", "45s" — coarse on purpose; this is an estimate. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Metres once it gets long enough to be unreadable in mm. */
export function formatDistance(mm: number): string {
  if (!Number.isFinite(mm) || mm <= 0) return '—';
  return mm >= 1000 ? `${(mm / 1000).toFixed(1)}m` : `${Math.round(mm)}mm`;
}
