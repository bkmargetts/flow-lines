import type { FlowLine } from '../flow-lines.js';
import type { ResolvedOptions } from './types.js';

/** Everything shared by the whole plate: resolved options, the page frame,
 *  the region the machine may occupy (layout carves marginalia and inset
 *  territory out of the page), and the one output line list. */
export interface CodexCtx {
  o: ResolvedOptions;
  seed: number;
  width: number;
  height: number;
  margin: number;
  /** Drawing region for the machine, in page px. */
  region: { x0: number; y0: number; x1: number; y1: number };
  /** Fixed scene light: upper-left, so shadow-side hatch sits lower-right. */
  shadowAngle: number;
  lines: FlowLine[];
}

export function makeCtx(o: ResolvedOptions, seed: number): CodexCtx {
  const { width, height, margin } = o;
  return {
    o,
    seed,
    width,
    height,
    margin,
    region: { x0: margin, y0: margin, x1: width - margin, y1: height - margin },
    shadowAngle: Math.PI / 4,
    lines: [],
  };
}
