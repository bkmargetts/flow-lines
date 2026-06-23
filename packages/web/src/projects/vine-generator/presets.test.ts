import { describe, it, expect } from 'vitest';
import { VINE_PRESETS, getVinePreset, crossVinePresets } from './presets';
import { VINE_PALETTES } from './palettes';
import { defaultVineState } from './types';

const PALETTE_IDS = new Set(VINE_PALETTES.map((p) => p.id));
const STATE_KEYS = new Set(Object.keys(defaultVineState));

describe('vine presets', () => {
  it('every preset has a unique id and a known label', () => {
    const ids = VINE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of VINE_PRESETS) expect(p.label.length).toBeGreaterThan(0);
  });

  it('every preset only sets valid VineState keys and a known palette', () => {
    for (const p of VINE_PRESETS) {
      for (const k of Object.keys(p.state)) {
        expect(STATE_KEYS.has(k)).toBe(true);
      }
      if (p.state.palette) expect(PALETTE_IDS.has(p.state.palette)).toBe(true);
    }
  });

  it('getVinePreset resolves ids and returns undefined for unknown', () => {
    expect(getVinePreset('wild-rose')).toBeDefined();
    expect(getVinePreset('not-a-species')).toBeUndefined();
  });

  it('crossVinePresets keeps the first parent habit and only sets defined keys', () => {
    const a = getVinePreset('wild-rose')!;
    const b = getVinePreset('grapevine')!;
    const genome = crossVinePresets(a, b, () => 0.99); // always take parent A
    // Habit fields come from A.
    expect(genome.composition).toBe(a.state.composition);
    // No key is set to undefined (would corrupt the merged state).
    for (const [k, v] of Object.entries(genome)) {
      expect(v).not.toBeUndefined();
      expect(STATE_KEYS.has(k)).toBe(true);
    }
  });

  it('crossVinePresets can pull traits from the second parent', () => {
    const a = getVinePreset('wild-rose')!;
    const b = getVinePreset('grapevine')!;
    const genome = crossVinePresets(a, b, () => 0.0); // always take parent B
    // Grapevine bears grapes; the hybrid should inherit that fruit trait.
    expect(genome.fruitType).toBe(b.state.fruitType ?? a.state.fruitType);
  });
});
