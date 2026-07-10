import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getPaperSize, pageMetrics } from '@flow-lines/core';

import { MODULES } from './modules/registry';
import type { Module, PureModule, RenderEnv } from './modules/types';
import { composite, type CompositeLayer } from './lib/composite';
import { defaultFrame, type FrameSettings } from './FrameContext';

/**
 * Golden-output regression suite for the web modules — the sibling of
 * packages/core/src/goldens.test.ts (see its header for the philosophy and
 * the regeneration procedure: UPDATE_GOLDENS=1, but only after eyeballing).
 *
 * Every pure module's `render` is hashed at seed 42 against a fixed frame,
 * plus preset variants for the preset-driven modules, plus one `composite()`
 * of a small stack with hold-off — pinning the compositor (namespacing,
 * border, hold-off trim) ahead of any refactor that touches it.
 */

const GOLDENS_PATH = fileURLToPath(new URL('./module-goldens.json', import.meta.url));

// Low density keeps the heavy simulation modules fast while exercising the
// same code paths; the physical sheet is a plain A4 portrait.
const frame: FrameSettings = { ...defaultFrame, resolution: 1.5 };
const page = pageMetrics(getPaperSize(frame.paper), frame.orientation, frame.resolution);
const env: RenderEnv = { page, frame, marginPx: frame.marginMm * page.pxPerMm };

const pureModules = MODULES.filter((m): m is PureModule<Record<string, unknown>> => m.kind === 'pure');

function stateFor(mod: PureModule<Record<string, unknown>>, patch: Record<string, unknown> = {}) {
  const state = { ...mod.defaultState() };
  if ('seed' in state) state.seed = 42;
  return { ...state, ...patch };
}

const CASES: Record<string, () => unknown> = {};

for (const mod of pureModules) {
  // The blank template texture renders nothing by design — nothing to pin.
  if (mod.id === 'blank') continue;
  CASES[`${mod.id}/default`] = () => mod.render(stateFor(mod), env);
}

const PRESET_VARIANTS: Record<string, Record<string, unknown>> = {
  'reaction-diffusion': { preset: 'coral' },
  lenia: { preset: 'cells' },
  physarum: { preset: 'veins' },
  'city-generator': { style: 'mixed' },
  stickmen: { poseEnergy: 1 },
  'ribbon-weave': { order: 0.1 },
  gesture: { preset: 'kline' },
};
for (const [id, patch] of Object.entries(PRESET_VARIANTS)) {
  const mod = pureModules.find((m) => m.id === id);
  if (mod) CASES[`${id}/${Object.values(patch)[0]}`] = () => mod.render(stateFor(mod, patch), env);
}

// One small stack through the compositor: a texture under two generative
// layers, the top layer holding paper off the lines above it — exercises
// hold-off accumulation, per-slot namespacing, and the border pen.
CASES['composite/stack'] = () => {
  const borderFrame: FrameSettings = { ...frame, borderEnabled: true, borderCornerRadiusMm: 4 };
  const byId = new Map(pureModules.map((m) => [m.id, m]));
  const mods = [byId.get('classic')!, byId.get('flow-field')!, byId.get('conway')!];
  const layers: CompositeLayer[] = mods.map((mod, i) => ({
    instanceId: `golden-${i}`,
    // React component props are invariant, so a concretely-typed module needs
    // the same registry-boundary widening as modules/registry.ts itself.
    module: mod as Module,
    state: stateFor(mod),
    visible: true,
    holdOffMm: mod.id === 'classic' ? 1.5 : 0,
  }));
  return composite(borderFrame, page, layers).exportSvg;
};

// The same stack with the global hand-sketch finish on — pins the unified
// sketch pass (breaks, overshoot, overdraw, steady border) at a fixed seed.
CASES['composite/sketch'] = () => {
  const sketchFrame: FrameSettings = {
    ...frame,
    borderEnabled: true,
    borderCornerRadiusMm: 4,
    sketchEnabled: true,
    sketchIntensity: 0.6,
    sketchSeed: 42,
  };
  const byId = new Map(pureModules.map((m) => [m.id, m]));
  const mods = [byId.get('classic')!, byId.get('flow-field')!, byId.get('conway')!];
  const layers: CompositeLayer[] = mods.map((mod, i) => ({
    instanceId: `golden-${i}`,
    module: mod as Module,
    state: stateFor(mod),
    visible: true,
    holdOffMm: mod.id === 'classic' ? 1.5 : 0,
  }));
  return composite(sketchFrame, page, layers).exportSvg;
};

function hashOf(name: string, value: unknown): string {
  const json = JSON.stringify(value);
  if (json.length < 500) throw new Error(`${name}: suspiciously small output (${json.length} chars)`);
  return createHash('sha256').update(json).digest('hex');
}

describe('web module golden hashes', () => {
  if (process.env.UPDATE_GOLDENS) {
    it('regenerates module-goldens.json', () => {
      const next: Record<string, string> = {};
      for (const [name, render] of Object.entries(CASES)) next[name] = hashOf(name, render());
      writeFileSync(GOLDENS_PATH, JSON.stringify(next, null, 2) + '\n');
      expect(Object.keys(next).length).toBe(Object.keys(CASES).length);
    });
    return;
  }

  const goldens: Record<string, string> = existsSync(GOLDENS_PATH)
    ? JSON.parse(readFileSync(GOLDENS_PATH, 'utf8'))
    : {};

  it('module-goldens.json covers exactly the current case list', () => {
    expect(Object.keys(goldens).sort()).toEqual(Object.keys(CASES).sort());
  });

  for (const [name, render] of Object.entries(CASES)) {
    it(name, () => {
      expect(
        hashOf(name, render()),
        `${name}: output changed. If intentional, eyeball the app/galleries, then UPDATE_GOLDENS=1.`,
      ).toBe(goldens[name]);
    });
  }
});
