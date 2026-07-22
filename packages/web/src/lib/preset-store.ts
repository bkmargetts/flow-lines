/**
 * localStorage-backed store for user-saved presets, keyed by module id.
 * Pure CRUD over an injected `Storage` so tests run against an in-memory
 * stub; the app passes `window.localStorage`. Corrupt or quota-blocked
 * storage degrades to an empty library with a console warning — the preset
 * library must never take the app down.
 */

export interface StoredPreset {
  id: string;
  name: string;
  savedAt: number;
  state: Record<string, unknown>;
}

interface StoreShape {
  version: 1;
  byModule: Record<string, StoredPreset[]>;
}

/** Export/import envelope — the same shape for one preset or a whole library. */
export interface PresetExport {
  format: 'flow-lines-presets';
  version: 1;
  exported: string;
  presets: { moduleId: string; name: string; state: Record<string, unknown> }[];
}

export interface ImportReport {
  added: number;
  skipped: number;
}

export const PRESET_STORAGE_KEY = 'flow-lines.customPresets.v1';

const EMPTY: StoreShape = { version: 1, byModule: {} };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export class PresetStore {
  private storage: Storage;
  private listeners = new Set<() => void>();

  constructor(storage: Storage) {
    this.storage = storage;
  }

  private read(): StoreShape {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(PRESET_STORAGE_KEY);
    } catch {
      return EMPTY;
    }
    if (!raw) return EMPTY;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isPlainObject(parsed) && parsed.version === 1 && isPlainObject(parsed.byModule)) {
        return parsed as unknown as StoreShape;
      }
    } catch {
      // fall through
    }
    console.warn('flow-lines: corrupt custom-preset storage, resetting');
    return EMPTY;
  }

  private write(next: StoreShape): void {
    try {
      this.storage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn('flow-lines: could not persist custom presets', err);
    }
    this.listeners.forEach((fn) => fn());
  }

  /** Notify on every mutation (and cross-tab, if the caller wires the
   *  window `storage` event to `notifyExternalChange`). */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notifyExternalChange(): void {
    this.listeners.forEach((fn) => fn());
  }

  listPresets(moduleId: string): StoredPreset[] {
    return this.read().byModule[moduleId] ?? [];
  }

  /** All presets across modules, as (moduleId, preset) pairs. */
  listAll(): { moduleId: string; preset: StoredPreset }[] {
    const data = this.read();
    return Object.entries(data.byModule).flatMap(([moduleId, presets]) =>
      presets.map((preset) => ({ moduleId, preset }))
    );
  }

  savePreset(moduleId: string, name: string, state: Record<string, unknown>): StoredPreset {
    const data = this.read();
    const existing = data.byModule[moduleId] ?? [];
    const preset: StoredPreset = {
      id: `${moduleId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: uniqueName(name, existing.map((p) => p.name)),
      savedAt: Date.now(),
      state,
    };
    this.write({
      ...data,
      byModule: { ...data.byModule, [moduleId]: [...existing, preset] },
    });
    return preset;
  }

  renamePreset(moduleId: string, id: string, name: string): void {
    const data = this.read();
    const existing = data.byModule[moduleId] ?? [];
    if (!existing.some((p) => p.id === id)) return;
    const taken = existing.filter((p) => p.id !== id).map((p) => p.name);
    const next = existing.map((p) =>
      p.id === id ? { ...p, name: uniqueName(name, taken) } : p
    );
    this.write({ ...data, byModule: { ...data.byModule, [moduleId]: next } });
  }

  deletePreset(moduleId: string, id: string): void {
    const data = this.read();
    const existing = data.byModule[moduleId] ?? [];
    const next = existing.filter((p) => p.id !== id);
    if (next.length === existing.length) return;
    const byModule = { ...data.byModule };
    if (next.length) byModule[moduleId] = next;
    else delete byModule[moduleId];
    this.write({ ...data, byModule });
  }

  /** Export one preset (by id) or, with no id, the whole library. */
  exportPresets(moduleId?: string, id?: string): PresetExport {
    const all = this.listAll();
    const selected =
      moduleId != null
        ? all.filter(
            (e) => e.moduleId === moduleId && (id == null || e.preset.id === id)
          )
        : all;
    return {
      format: 'flow-lines-presets',
      version: 1,
      exported: new Date().toISOString(),
      presets: selected.map((e) => ({
        moduleId: e.moduleId,
        name: e.preset.name,
        state: e.preset.state,
      })),
    };
  }

  /**
   * Import an export envelope. Entries whose module isn't known to the
   * caller are skipped (counted in the report); colliding names get a
   * numbered suffix. Throws only on a malformed envelope.
   */
  importPresets(json: unknown, knownModuleIds: ReadonlySet<string>): ImportReport {
    if (
      !isPlainObject(json) ||
      json.format !== 'flow-lines-presets' ||
      json.version !== 1 ||
      !Array.isArray(json.presets)
    ) {
      throw new Error('Not a Flow Lines preset file');
    }
    let added = 0;
    let skipped = 0;
    for (const entry of json.presets) {
      if (
        !isPlainObject(entry) ||
        typeof entry.moduleId !== 'string' ||
        typeof entry.name !== 'string' ||
        !isPlainObject(entry.state) ||
        !knownModuleIds.has(entry.moduleId)
      ) {
        skipped += 1;
        continue;
      }
      this.savePreset(entry.moduleId, entry.name, entry.state as Record<string, unknown>);
      added += 1;
    }
    return { added, skipped };
  }
}

/** "Sketch" → "Sketch (2)" → "Sketch (3)" until it's free. */
function uniqueName(name: string, taken: string[]): string {
  const base = name.trim() || 'Preset';
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`;
    if (!taken.includes(candidate)) return candidate;
  }
}
