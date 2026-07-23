import { describe, it, expect } from 'vitest';
import { MODULES } from '../modules/registry';
import { capturePreset, sanitizePresetState, applyPreset } from './preset-capture';

/**
 * Custom presets are full-state snapshots (seed included — a saved preset is
 * an exact-drawing bookmark, by design). The registry-wide round-trip below
 * doubles as a guardrail: it fails if any module ever sneaks
 * non-JSON-serializable data into its layer state, which would also break
 * saving that module's presets.
 */
describe('capturePreset', () => {
  for (const mod of MODULES) {
    it(`round-trips ${mod.id}'s default state exactly`, () => {
      const state = mod.defaultState() as Record<string, unknown>;
      const captured = capturePreset(state);
      expect(captured).not.toBe(state); // a real copy, not the live object
      expect(captured).toEqual(state);
      expect(applyPreset(captured, mod.defaultState() as Record<string, unknown>)).toEqual(
        state
      );
    });
  }
});

describe('sanitizePresetState', () => {
  const defaults = {
    seed: 42,
    width: 0.3,
    enabled: true,
    style: 'ticks',
    points: [1, 2],
    settings: { seed: 7, gamma: 1.3 },
  };

  it('drops keys the defaults do not recognise', () => {
    const out = sanitizePresetState(
      { seed: 9, legacyKnob: 5, __proto__json: 'x' },
      defaults
    );
    expect(out).toEqual({ seed: 9 });
  });

  it('drops type mismatches, keeps matches', () => {
    const out = sanitizePresetState(
      { seed: 'nine', width: 0.5, enabled: 'yes', style: 'stipple', points: 'nope' },
      defaults
    );
    expect(out).toEqual({ width: 0.5, style: 'stipple' });
  });

  it('recurses into nested objects and fills missing nested keys from defaults', () => {
    const out = sanitizePresetState(
      { settings: { seed: 99, legacy: true } },
      defaults
    );
    expect(out).toEqual({ settings: { seed: 99, gamma: 1.3 } });
  });

  it('tolerates garbage input', () => {
    expect(sanitizePresetState(null, defaults)).toEqual({});
    expect(sanitizePresetState('junk', defaults)).toEqual({});
    expect(sanitizePresetState([1, 2, 3], defaults)).toEqual({});
  });
});

describe('applyPreset', () => {
  it('merges an old-shape preset onto current defaults — keys ⊆ defaults', () => {
    const defaults = { seed: 1, spacing: 2, newKnob: 0.5 };
    const oldPreset = { seed: 77, spacing: 9, removedKnob: 4 };
    const out = applyPreset(oldPreset, defaults);
    expect(out).toEqual({ seed: 77, spacing: 9, newKnob: 0.5 });
    expect(Object.keys(out).every((k) => k in defaults)).toBe(true);
  });
});
