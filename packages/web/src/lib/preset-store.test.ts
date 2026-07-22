import { describe, it, expect } from 'vitest';
import { PresetStore, PRESET_STORAGE_KEY } from './preset-store';

/** Minimal in-memory Storage stub — the store never touches the DOM. */
function fakeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
}

const KNOWN = new Set(['flow-field', 'marbling']);

describe('PresetStore', () => {
  it('saves, lists, renames and deletes per module', () => {
    const store = new PresetStore(fakeStorage());
    const a = store.savePreset('flow-field', 'Windy', { seed: 1 });
    store.savePreset('marbling', 'Bath', { seed: 2 });

    expect(store.listPresets('flow-field').map((p) => p.name)).toEqual(['Windy']);
    expect(store.listPresets('marbling').map((p) => p.name)).toEqual(['Bath']);
    expect(store.listPresets('unknown')).toEqual([]);

    store.renamePreset('flow-field', a.id, 'Gale');
    expect(store.listPresets('flow-field')[0].name).toBe('Gale');

    store.deletePreset('flow-field', a.id);
    expect(store.listPresets('flow-field')).toEqual([]);
    expect(store.listAll()).toHaveLength(1);
  });

  it('suffixes colliding names', () => {
    const store = new PresetStore(fakeStorage());
    store.savePreset('flow-field', 'Sketch', { a: 1 });
    store.savePreset('flow-field', 'Sketch', { a: 2 });
    store.savePreset('flow-field', 'Sketch', { a: 3 });
    expect(store.listPresets('flow-field').map((p) => p.name)).toEqual([
      'Sketch',
      'Sketch (2)',
      'Sketch (3)',
    ]);
    // Empty names get a fallback.
    store.savePreset('flow-field', '   ', { a: 4 });
    expect(store.listPresets('flow-field')[3].name).toBe('Preset');
  });

  it('round-trips export → import', () => {
    const store = new PresetStore(fakeStorage());
    store.savePreset('flow-field', 'Windy', { seed: 1, spacing: 3 });
    store.savePreset('marbling', 'Bath', { seed: 2 });

    const envelope = store.exportPresets();
    expect(envelope.format).toBe('flow-lines-presets');
    expect(envelope.presets).toHaveLength(2);

    const fresh = new PresetStore(fakeStorage());
    const report = fresh.importPresets(JSON.parse(JSON.stringify(envelope)), KNOWN);
    expect(report).toEqual({ added: 2, skipped: 0 });
    expect(fresh.listPresets('flow-field')[0].state).toEqual({ seed: 1, spacing: 3 });
  });

  it('exports a single preset by id', () => {
    const store = new PresetStore(fakeStorage());
    const keep = store.savePreset('flow-field', 'Keep', { a: 1 });
    store.savePreset('flow-field', 'Skip', { a: 2 });
    const envelope = store.exportPresets('flow-field', keep.id);
    expect(envelope.presets).toHaveLength(1);
    expect(envelope.presets[0].name).toBe('Keep');
  });

  it('import skips unknown modules and malformed entries, with a report', () => {
    const store = new PresetStore(fakeStorage());
    const report = store.importPresets(
      {
        format: 'flow-lines-presets',
        version: 1,
        exported: 'x',
        presets: [
          { moduleId: 'flow-field', name: 'Good', state: { seed: 1 } },
          { moduleId: 'not-a-module', name: 'Bad', state: {} },
          { moduleId: 'flow-field', name: 'NoState' },
          'garbage',
        ],
      },
      KNOWN
    );
    expect(report).toEqual({ added: 1, skipped: 3 });
    expect(store.listPresets('flow-field')).toHaveLength(1);
  });

  it('refuses a non-envelope', () => {
    const store = new PresetStore(fakeStorage());
    expect(() => store.importPresets({ some: 'json' }, KNOWN)).toThrow(/preset file/);
    expect(() =>
      store.importPresets({ format: 'flow-lines-presets', version: 2, presets: [] }, KNOWN)
    ).toThrow(/preset file/);
  });

  it('recovers from corrupt stored JSON', () => {
    const store = new PresetStore(
      fakeStorage({ [PRESET_STORAGE_KEY]: '{not json' })
    );
    expect(store.listAll()).toEqual([]);
    store.savePreset('flow-field', 'Fresh', { a: 1 });
    expect(store.listPresets('flow-field')).toHaveLength(1);
  });

  it('recovers from a wrong stored version', () => {
    const store = new PresetStore(
      fakeStorage({ [PRESET_STORAGE_KEY]: JSON.stringify({ version: 99, byModule: {} }) })
    );
    expect(store.listAll()).toEqual([]);
  });

  it('notifies subscribers on mutation', () => {
    const store = new PresetStore(fakeStorage());
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.savePreset('flow-field', 'A', {});
    expect(calls).toBe(1);
    off();
    store.savePreset('flow-field', 'B', {});
    expect(calls).toBe(1);
  });
});
