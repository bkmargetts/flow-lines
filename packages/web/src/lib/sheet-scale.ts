import type { PageMetrics } from '@flow-lines/core';

/**
 * How much bigger this sheet is than the A4 tuning anchor, by physical area.
 * Floored at 1 so A4-and-smaller sheets keep their tuned look exactly (the
 * module goldens pin A4 defaults); only larger formats grow content. Modules
 * multiply *counts* by this (or its square root for per-edge quantities) so a
 * big sheet carries more marks at the same physical mark scale, never an
 * enlargement.
 */
export function sheetAreaFactor(page: PageMetrics): number {
  return Math.max(1, (page.widthMm * page.heightMm) / (210 * 297));
}

/**
 * Per-edge growth for simulation grids, capped at 2× (4× area): sim cost
 * rises with the cell count, and past 2× a denser grid costs far more than
 * the look gains. Exactly 1 at A4 and below.
 */
export function sheetGridFactor(page: PageMetrics): number {
  return Math.min(2, Math.sqrt(sheetAreaFactor(page)));
}
