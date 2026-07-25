import type { FlowLine, Point } from '../flow-lines.js';
import { randomSeed } from '../lib/rng.js';
import { orderPlot } from '../optimize.js';
import { DEFAULTS, type MachineOptions, type ResolvedOptions } from './types.js';
import { makeCtx } from './context.js';
import { synthesize } from './synth.js';
import { renderGear } from './gears.js';
import { renderFrame } from './frame.js';
import { renderBearing } from './shafts.js';
import { renderBelt, renderPulley } from './belts.js';
import { renderLinkage } from './linkage.js';
import { renderDrum, renderRope, renderSpring, renderWeight } from './rigging.js';
import { clipGearBite, pickBites, renderCutFace } from './section.js';
import { composeWithOcclusion, type PartRender } from './occlude.js';
import { applyFinish, fitMachineToMargin } from './furniture.js';

/**
 * Machine — page-sized, hugely complex generative machines as plottable
 * pen-and-ink: clusters of meshing gear trains grown across the whole sheet
 * (exact pitch tangency, tooth phases aligned), tied into one transmission
 * network by belts, ropes and cross-cluster meshes — or left as an
 * overlapping engine-room wall (`connectivity`). Everything is single-pen
 * stroked polylines, deterministic per seed — bold lines are repeated offset
 * passes, never stroke-width.
 *
 * One concern per file: `synth.ts` grows the part graph (and never draws),
 * `network.ts` ties the clusters together, the part renderers (`gears.ts`, …)
 * turn parts into lines, `occlude.ts` composes them in depth order. Mirrors
 * the Planet/Botanical generator shape: heavy algorithm here in core, thin
 * web/CLI wrappers feed it.
 */

export type { MachineOptions } from './types.js';

export function generateMachine(options: MachineOptions): {
  lines: FlowLine[];
  width: number;
  height: number;
} {
  const o: ResolvedOptions = { ...DEFAULTS, ...options };
  const seed = options.seed ?? randomSeed();
  const ctx = makeCtx(o, seed);

  const machine = synthesize(ctx);

  // Each part renders into its own list (with its silhouette polygons), then
  // the ZBuffer composition breaks farther parts' lines where nearer parts
  // cover them — hidden spans re-emit as dashed hidden lines.
  const parts: PartRender[] = [];
  const capture = (z: number, fn: () => Point[][]): void => {
    const saved = ctx.lines;
    const acc: FlowLine[] = [];
    ctx.lines = acc;
    const silhouettes = fn();
    ctx.lines = saved;
    parts.push({ z, lines: acc, silhouettes });
  };

  const bites = pickBites(ctx, machine);
  capture(0, () => renderFrame(ctx, machine));
  for (const b of machine.bearings) capture(0, () => renderBearing(ctx, b));
  for (const g of machine.gears) {
    capture(g.z, () => {
      const silhouettes = renderGear(ctx, g);
      const bite = bites.find((bt) => bt.gearId === g.id);
      if (bite) {
        const clipped = clipGearBite(ctx.lines, g, bite);
        ctx.lines.length = 0;
        for (const l of clipped) ctx.lines.push(l);
        renderCutFace(ctx, g, bite);
      }
      return silhouettes;
    });
  }
  const gearCentres = new Set(machine.gears.map((g) => `${Math.round(g.cx)},${Math.round(g.cy)}`));
  for (const p of machine.pulleys) {
    const standalone = !gearCentres.has(`${Math.round(p.cx)},${Math.round(p.cy)}`);
    capture(p.z, () => renderPulley(ctx, p, standalone));
  }
  for (const d of machine.drums) capture(d.z, () => renderDrum(ctx, machine, d));
  for (const belt of machine.belts) {
    const pa = machine.pulleys.find((p) => p.id === belt.a);
    const pb = machine.pulleys.find((p) => p.id === belt.b);
    capture(Math.max(pa?.z ?? 1, pb?.z ?? 1) + 1, () => renderBelt(ctx, machine, belt));
  }
  for (const link of machine.linkages) capture(link.z, () => renderLinkage(ctx, machine, link));
  for (const rope of machine.ropes) capture(rope.z, () => renderRope(ctx, machine, rope));
  for (const w of machine.weights) capture(w.z, () => renderWeight(ctx, machine, w));
  for (const s of machine.springs) capture(s.z, () => renderSpring(ctx, machine, s));

  composeWithOcclusion(ctx, parts, machine);

  let finished = applyFinish(ctx);
  finished = fitMachineToMargin(ctx, finished);

  const result = { lines: finished, width: ctx.width, height: ctx.height };
  return ctx.o.optimize ? orderPlot(result) : result;
}
