import type { FlowLine } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { getSketchStyleConfig } from '../sketch-styles.js';
import { subSeed } from '../lib/rng.js';
import type { MachineCtx } from './context.js';

/** Hand-drawn finish: multi-pass sketch overdraw when `sketch` is set, else a
 *  single low-frequency wobble — the planet/botanical pattern. The machine is
 *  the whole artwork; everything takes the finish. */
export function applyFinish(ctx: MachineCtx): FlowLine[] {
  const { o, seed, width, height, lines } = ctx;
  if (o.sketch > 0.01) {
    const { passes, wavelength, amplitude, jitter } = getSketchStyleConfig(o.sketchStyle, o.sketch);
    const finished: FlowLine[] = [];
    for (let p = 0; p < passes; p++) {
      const pseed = subSeed(seed, p);
      const styled = applyHandDrawnStyle(
        { lines, width, height, seed: pseed },
        { amplitude, wavelength, jitter, seed: pseed }
      ).lines;
      for (const l of styled) finished.push(l);
    }
    return finished;
  }
  return applyHandDrawnStyle(
    { lines, width, height, seed },
    { amplitude: o.wobble, wavelength: 42, seed }
  ).lines;
}

/** Uniformly scale everything about the page centre so the drawing fits the
 *  margin box (the planet `fitBodyToMargin` pattern, with nothing pinned). */
export function fitMachineToMargin(ctx: MachineCtx, all: FlowLine[]): FlowLine[] {
  const { width, height, margin } = ctx;
  const cx = width / 2;
  const cy = height / 2;
  const halfW = width / 2 - margin;
  const halfH = height / 2 - margin;
  if (halfW <= 0 || halfH <= 0) return all;
  let maxDx = 0;
  let maxDy = 0;
  for (const ln of all) {
    for (const p of ln.points) {
      const ax = Math.abs(p.x - cx);
      const ay = Math.abs(p.y - cy);
      if (ax > maxDx) maxDx = ax;
      if (ay > maxDy) maxDy = ay;
    }
  }
  const scale = Math.min(1, maxDx > 0 ? halfW / maxDx : 1, maxDy > 0 ? halfH / maxDy : 1);
  if (scale >= 0.999) return all;
  return all.map((ln) => ({
    ...ln,
    points: ln.points.map((p) => ({ x: cx + (p.x - cx) * scale, y: cy + (p.y - cy) * scale })),
  }));
}
