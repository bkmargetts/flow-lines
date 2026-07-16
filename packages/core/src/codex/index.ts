import type { FlowLine, Point } from '../flow-lines.js';
import { randomSeed } from '../lib/rng.js';
import { DEFAULTS, type MachineCodexOptions, type ResolvedOptions } from './types.js';
import { makeCtx } from './context.js';
import { synthesize } from './synth.js';
import { renderGear } from './gears.js';
import { renderFrame } from './frame.js';
import { renderBearing } from './shafts.js';
import { renderBelt, renderPulley } from './belts.js';
import { renderLinkage } from './linkage.js';
import { renderDrum, renderRope, renderSpring, renderWeight } from './rigging.js';
import { clipGearBite, pickBite, renderCutFace } from './section.js';
import { renderAnnotations } from './drafting.js';
import { composeLayout, renderInsets } from './layout.js';
import { renderMarginalia } from './marginalia.js';
import { composeWithOcclusion, type PartRender } from './occlude.js';
import { applyFinish, fitMachineToMargin, renderPlateFurniture } from './furniture.js';

/**
 * Impossible Machine Codex — procedural da Vinci-style contraptions as
 * plottable pen-and-ink: a meshing gear train grown as a tree (exact pitch
 * tangency, tooth phases aligned), belts on true common tangents, pose-solved
 * linkages, rope-and-weight drives, all held in a timber frame and composed
 * on a codex/patent plate with drafting furniture and marginalia. Everything
 * is single-pen stroked polylines, deterministic per seed — bold lines are
 * repeated offset passes, never stroke-width.
 *
 * One concern per file: `synth.ts` grows the part graph (and never draws),
 * the part renderers (`gears.ts`, …) turn parts into lines, `furniture.ts`
 * holds the plate finish/fit. Mirrors the Planet/Botanical generator shape:
 * heavy algorithm here in core, thin web/CLI wrappers feed it.
 */

export type { MachineCodexOptions } from './types.js';

export function generateMachineCodex(options: MachineCodexOptions): {
  lines: FlowLine[];
  width: number;
  height: number;
} {
  const o: ResolvedOptions = { ...DEFAULTS, ...options };
  const seed = options.seed ?? randomSeed();
  const ctx = makeCtx(o, seed);

  // Layout first: the machine grows inside the region the page grants it.
  const layout = composeLayout(ctx);
  ctx.region = layout.region;

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

  const bite = pickBite(ctx, machine);
  capture(0, () => renderFrame(ctx, machine));
  for (const b of machine.bearings) capture(0, () => renderBearing(ctx, b));
  for (const g of machine.gears) {
    capture(g.z, () => {
      const silhouettes = renderGear(ctx, g);
      if (bite && bite.gearId === g.id) {
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

  composeWithOcclusion(ctx, parts);

  // Drafting goes over the drawing, never occluded; then the page dressing.
  const letters = renderAnnotations(ctx, machine);
  renderInsets(ctx, machine, layout, letters.length);
  renderMarginalia(ctx, layout.textBlocks);
  renderPlateFurniture(ctx);

  let finished = applyFinish(ctx);
  finished = fitMachineToMargin(ctx, finished);

  return { lines: finished, width: ctx.width, height: ctx.height };
}
