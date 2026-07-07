import { FlowLine } from '../flow-lines.js';
import { offsetEmphasisPasses } from './swell.js';

export interface StrokeEconomyOptions {
  /** Total drawn length allowed, px */
  budgetPx: number;
  /** Canvas size, px (for the coherence grid) */
  width: number;
  height: number;
  /** Physical length scale */
  scale: number;
  /** How informative a location is — importance × edge presence */
  scoreAt: (x: number, y: number) => number;
  /**
   * Total pen passes per surviving long stroke (1 = single pass; more
   * thickens survivors into fat, pressure-tapered brush strokes)
   */
  strokeWeight: number;
}

/**
 * Stroke economy, the sumi-e discipline: rank every candidate stroke by
 * how much it says (length × mean information along it, with contours
 * counting extra — the gesture IS the contour) and keep only what fits
 * the ink budget. Most of the paper stays paper.
 *
 * Pure top-N strands isolated strokes in empty space, which reads as
 * confetti, so selection is coherence-aware: the first tranche of budget
 * goes to the strongest strokes unconditionally (the anchors of the
 * gesture), and after that a stroke must land near ink that is already
 * kept — lone accents still make it in through the anchor tranche, lone
 * filler does not.
 *
 * Survivors above a length floor are thickened into brush strokes with
 * constant-profile offset passes, heavily end-trimmed — the pressure
 * taper of a loaded brush from a single pen. Weight passes don't count
 * against the budget: they are weight, not coverage.
 */
export function budgetStrokes(lines: FlowLine[], options: StrokeEconomyOptions): FlowLine[] {
  const { budgetPx, width, height, scale, scoreAt, strokeWeight } = options;

  interface Candidate {
    line: FlowLine;
    length: number;
    score: number;
  }

  const passthrough: FlowLine[] = [];
  const candidates: Candidate[] = [];

  for (const line of lines) {
    // Solid fill is a committed decision, not a candidate mark
    if (line.layer === 'fill') {
      passthrough.push(line);
      continue;
    }
    if (line.points.length < 2) continue;

    let length = 0;
    for (let i = 1; i < line.points.length; i++) {
      length += Math.hypot(
        line.points[i].x - line.points[i - 1].x,
        line.points[i].y - line.points[i - 1].y
      );
    }
    if (length <= 0) continue;

    let total = 0;
    let samples = 0;
    const stride = Math.max(1, Math.floor(line.points.length / 12));
    for (let i = 0; i < line.points.length; i += stride) {
      total += scoreAt(line.points[i].x, line.points[i].y);
      samples++;
    }
    let score = (total / samples) * length;
    // The gesture is the contour: committed outlines say the most
    if (line.pen === 'bold') score *= 1.5;

    candidates.push({ line, length, score });
  }

  // Deterministic order: score, then geometry as the tie-break
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const pa = a.line.points[0];
    const pb = b.line.points[0];
    return pa.x !== pb.x ? pa.x - pb.x : pa.y - pb.y;
  });

  // Coarse kept-ink grid for the coherence test
  const cell = Math.max(24 * scale, Math.hypot(width, height) / 24);
  const cols = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  const inked = new Uint8Array(cols * rows);
  const cellOf = (x: number, y: number): number => {
    const cx = Math.max(0, Math.min(cols - 1, Math.floor(x / cell)));
    const cy = Math.max(0, Math.min(rows - 1, Math.floor(y / cell)));
    return cy * cols + cx;
  };
  const markKept = (line: FlowLine): void => {
    for (const p of line.points) inked[cellOf(p.x, p.y)] = 1;
  };
  const nearInk = (line: FlowLine): boolean => {
    for (const p of line.points) {
      const cx = Math.floor(Math.max(0, Math.min(cols - 1, p.x / cell)));
      const cy = Math.floor(Math.max(0, Math.min(rows - 1, p.y / cell)));
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && inked[ny * cols + nx]) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const kept: Candidate[] = [];
  let spent = 0;
  const anchorBudget = budgetPx * 0.35;

  const deferred: Candidate[] = [];
  for (const c of candidates) {
    if (spent + c.length > budgetPx) continue;
    if (spent >= anchorBudget && !nearInk(c.line)) {
      deferred.push(c);
      continue;
    }
    kept.push(c);
    spent += c.length;
    markKept(c.line);
  }
  // Second look at the strokes that were alone on the first pass — the
  // gesture may have grown out to meet them
  for (const c of deferred) {
    if (spent + c.length > budgetPx) continue;
    if (!nearInk(c.line)) continue;
    kept.push(c);
    spent += c.length;
    markKept(c.line);
  }

  const out: FlowLine[] = [...passthrough];
  const weightPasses = Math.max(1, Math.round(strokeWeight));
  const weightFloor = 30 * scale;
  for (const c of kept) {
    out.push(c.line);
    if (weightPasses > 1 && c.length >= weightFloor) {
      // Constant-profile weight with strong end trims: the brush's
      // pressure taper, built from the shared offset-pass recipe
      for (const pass of offsetEmphasisPasses(c.line.points, weightPasses, 0.9 * scale, 0.18)) {
        const extra: FlowLine = { points: pass };
        if (c.line.pen) extra.pen = c.line.pen;
        if (c.line.layer !== undefined) extra.layer = c.line.layer;
        out.push(extra);
      }
    }
  }
  return out;
}
