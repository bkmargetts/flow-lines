import { useEffect, useRef, useState } from 'react';
import { MODULES, getModule } from '../../modules/registry';
import { capturePreset, applyPreset } from '../../lib/preset-capture';
import { PresetStore, type PresetExport } from '../../lib/preset-store';
import { triggerDownload } from '../../lib/download';

/**
 * "My presets" — user-saved full-state snapshots of the selected layer,
 * mounted once from the shell (never inside a module's Controls: it needs
 * zero per-module code precisely because a preset is the whole state).
 * Unlike the built-in preset tables, applying one restores everything —
 * seed included — reproducing the exact drawing. Library edits
 * (save/rename/delete) are not document state and are deliberately outside
 * undo history; applying a preset flows through the normal update path and
 * is undoable like any other edit.
 */

// One store per tab, created on first render (never at import time — keeps
// the module loadable outside a browser); the window `storage` event keeps
// other tabs coherent.
let sharedStore: PresetStore | null = null;
function getStore(): PresetStore {
  if (!sharedStore) {
    sharedStore = new PresetStore(window.localStorage);
    window.addEventListener('storage', (e) => {
      if (e.key === null || e.key.startsWith('flow-lines.customPresets')) {
        sharedStore!.notifyExternalChange();
      }
    });
  }
  return sharedStore;
}

export function CustomPresetSection(props: {
  moduleId: string;
  state: unknown;
  update: (patch: object) => void;
}) {
  const { moduleId, state, update } = props;
  const store = getStore();
  // Re-list on any library mutation (this tab or another).
  const [, setVersion] = useState(0);
  useEffect(() => store.subscribe(() => setVersion((v) => v + 1)), [store]);

  const presets = store.listPresets(moduleId);
  const [selectedId, setSelectedId] = useState('');
  const selected = presets.find((p) => p.id === selectedId);

  // Inline name entry (no window.prompt — it's blocked in some mobile
  // webviews and can't be styled). One field serves save and rename.
  const [naming, setNaming] = useState<'save' | 'rename' | null>(null);
  const [name, setName] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (naming) nameRef.current?.focus();
  }, [naming]);

  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNaming(null);
      return;
    }
    if (naming === 'save') {
      const saved = store.savePreset(moduleId, trimmed, capturePreset(state));
      setSelectedId(saved.id);
    } else if (naming === 'rename' && selected) {
      store.renamePreset(moduleId, selected.id, trimmed);
    }
    setNaming(null);
    setName('');
  };

  const apply = (id: string) => {
    setSelectedId(id);
    const preset = store.listPresets(moduleId).find((p) => p.id === id);
    if (!preset) return;
    const defaults = getModule(moduleId).defaultState() as Record<string, unknown>;
    update(applyPreset(preset.state, defaults));
  };

  const exportJson = (envelope: PresetExport, filename: string) => {
    triggerDownload(
      new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' }),
      filename
    );
  };

  const importFile = async (file: File) => {
    try {
      const json = JSON.parse(await file.text()) as unknown;
      // Accept every module the registry knows, not just this one.
      const known = new Set(MODULES.map((m) => m.id));
      const report = store.importPresets(json, known);
      setNotice(
        report.skipped
          ? `Imported ${report.added}, skipped ${report.skipped}`
          : `Imported ${report.added} preset${report.added === 1 ? '' : 's'}`
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Import failed');
    }
  };

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  return (
    <div className="custom-presets">
      <h4 className="custom-presets-title">My presets</h4>

      <div className="control-group custom-presets-row">
        <select
          aria-label="My presets"
          value={selected ? selectedId : ''}
          onChange={(e) => apply(e.target.value)}
        >
          <option value="" disabled>
            {presets.length ? 'Apply a saved preset…' : 'No saved presets yet'}
          </option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setName('');
            setNaming('save');
          }}
        >
          Save current…
        </button>
      </div>

      {naming && (
        <div className="control-group custom-presets-row">
          <input
            ref={nameRef}
            type="text"
            placeholder={naming === 'save' ? 'Preset name' : 'New name'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') setNaming(null);
            }}
          />
          <button type="button" className="secondary" onClick={commitName}>
            {naming === 'save' ? 'Save' : 'Rename'}
          </button>
          <button type="button" className="secondary" onClick={() => setNaming(null)}>
            Cancel
          </button>
        </div>
      )}

      <div className="control-group custom-presets-row custom-presets-actions">
        <button
          type="button"
          className="secondary"
          disabled={!selected}
          onClick={() => {
            setName(selected?.name ?? '');
            setNaming('rename');
          }}
        >
          Rename
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!selected}
          onClick={() => {
            if (!selected) return;
            if (window.confirm(`Delete preset "${selected.name}"?`)) {
              store.deletePreset(moduleId, selected.id);
              setSelectedId('');
            }
          }}
        >
          Delete
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!selected}
          onClick={() =>
            selected &&
            exportJson(
              store.exportPresets(moduleId, selected.id),
              `${selected.name.replace(/[^\w-]+/g, '-')}.flow-preset.json`
            )
          }
        >
          Export
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!store.listAll().length}
          onClick={() => exportJson(store.exportPresets(), 'flow-lines-presets.json')}
        >
          Export all
        </button>
        <button type="button" className="secondary" onClick={() => fileRef.current?.click()}>
          Import…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importFile(file);
          }}
        />
      </div>

      {notice && <p className="custom-presets-notice">{notice}</p>}
    </div>
  );
}
