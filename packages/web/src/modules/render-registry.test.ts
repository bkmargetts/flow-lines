import { describe, it, expect } from 'vitest';
import { MODULES } from './registry';
import { RENDERERS } from './render-registry';

/**
 * Drift guard: the worker-safe render registry must stay in lockstep with the
 * full module registry — same pure-module id set, same render function, same
 * consumesAvoid flag. A module added to one but not the other fails here
 * instead of silently rendering nothing (or double-trimming) in the worker.
 */
describe('render-registry parity', () => {
  const pure = MODULES.filter((m) => m.kind === 'pure');

  it('covers exactly the pure module ids', () => {
    expect(Object.keys(RENDERERS).sort()).toEqual(pure.map((m) => m.id).sort());
  });

  it('agrees with each module on render and consumesAvoid', () => {
    for (const mod of pure) {
      const entry = RENDERERS[mod.id];
      expect(entry.render, mod.id).toBe(mod.render);
      expect(Boolean(entry.consumesAvoid), mod.id).toBe(Boolean(mod.consumesAvoid));
    }
  });
});
