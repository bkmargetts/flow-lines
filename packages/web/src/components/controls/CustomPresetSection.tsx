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
 *
 * The panel is a tap-to-apply list styled like the layer stack (no
 * select-and-then-act chrome): each row applies on click and carries its
 * own rename/export/delete icons; import and export-all sit as quiet text
 * actions in the footer.
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

  // One inline name editor serves both flows: 'save' shows it above the
  // list; a preset id swaps that row's label for the input.
  const [editing, setEditing] = useState<'save' | string | null>(null);
  const [name, setName] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) nameRef.current?.focus();
  }, [editing]);

  // Which preset the current state came from — purely visual feedback,
  // cleared as soon as the state changes underneath it (except for the
  // change the apply itself just made).
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const skipClearRef = useRef(false);
  useEffect(() => {
    if (skipClearRef.current) {
      skipClearRef.current = false;
      return;
    }
    setAppliedId(null);
  }, [state]);

  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const fileRef = useRef<HTMLInputElement>(null);

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed) {
      if (editing === 'save') {
        const saved = store.savePreset(moduleId, trimmed, capturePreset(state));
        setAppliedId(saved.id);
      } else if (editing) {
        store.renamePreset(moduleId, editing, trimmed);
      }
    }
    setEditing(null);
    setName('');
  };

  const apply = (id: string) => {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    const defaults = getModule(moduleId).defaultState() as Record<string, unknown>;
    skipClearRef.current = true;
    update(applyPreset(preset.state, defaults));
    setAppliedId(id);
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

  const nameEditor = (
    <div className="preset-name-edit">
      <input
        ref={nameRef}
        type="text"
        placeholder="Preset name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitName();
          if (e.key === 'Escape') setEditing(null);
        }}
        onBlur={commitName}
      />
    </div>
  );

  return (
    <div className="custom-presets">
      <h4 className="custom-presets-title">My presets</h4>

      {presets.length > 0 && (
        <div className="preset-list">
          {presets.map((p) =>
            editing === p.id ? (
              <div key={p.id} className="preset-row">
                {nameEditor}
              </div>
            ) : (
              <div
                key={p.id}
                className={`preset-row ${appliedId === p.id ? 'applied' : ''}`}
                role="button"
                tabIndex={0}
                title="Apply this preset (restores everything, seed included)"
                onClick={() => apply(p.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    apply(p.id);
                  }
                }}
              >
                <span className="preset-name">{p.name}</span>
                {appliedId === p.id && (
                  <span className="preset-applied" aria-label="Applied">
                    ✓
                  </span>
                )}
                <button
                  type="button"
                  className="preset-icon"
                  title="Rename"
                  aria-label={`Rename ${p.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setName(p.name);
                    setEditing(p.id);
                  }}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="preset-icon"
                  title="Export as JSON"
                  aria-label={`Export ${p.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    exportJson(
                      store.exportPresets(moduleId, p.id),
                      `${p.name.replace(/[^\w-]+/g, '-')}.flow-preset.json`
                    );
                  }}
                >
                  ⤓
                </button>
                <button
                  type="button"
                  className="preset-icon"
                  title="Delete"
                  aria-label={`Delete ${p.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete preset "${p.name}"?`)) {
                      store.deletePreset(moduleId, p.id);
                      if (appliedId === p.id) setAppliedId(null);
                    }
                  }}
                >
                  ×
                </button>
              </div>
            )
          )}
        </div>
      )}

      {editing === 'save' ? (
        <div className="preset-row preset-row-new">{nameEditor}</div>
      ) : (
        <button
          type="button"
          className="secondary preset-save"
          title="Save the current settings — seed included — as a reusable preset"
          onClick={() => {
            setName('');
            setEditing('save');
          }}
        >
          ＋ Save current as preset
        </button>
      )}

      <div className="preset-footer">
        <button type="button" className="preset-link" onClick={() => fileRef.current?.click()}>
          Import…
        </button>
        {store.listAll().length > 0 && (
          <button
            type="button"
            className="preset-link"
            onClick={() => exportJson(store.exportPresets(), 'flow-lines-presets.json')}
          >
            Export all
          </button>
        )}
      </div>
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

      {notice && <p className="custom-presets-notice">{notice}</p>}
    </div>
  );
}
