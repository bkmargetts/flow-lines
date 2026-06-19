import { useEffect, useState } from 'react';
import { MODULES, getModule, DEFAULT_MODULE_ID } from '../modules/registry';
import { useLayerStore, MAX_LAYERS } from '../LayerStore';

/**
 * The per-layer hold-off (halo) field. A bare controlled number input can't be
 * cleared — emptying it parses to 0 and snaps straight back, so you can't delete
 * the 0 to type a new value. This keeps the raw text locally, commits any valid
 * number as you type, and only falls back to 0 on blur of an empty/invalid field.
 */
function HoldOffInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  // Re-sync when the committed value changes from elsewhere.
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      type="number"
      min={0}
      max={20}
      step={0.5}
      value={text}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (!Number.isNaN(n)) onChange(Math.max(0, n));
      }}
      onBlur={() => {
        const n = parseFloat(text);
        if (text === '' || Number.isNaN(n)) {
          setText('0');
          onChange(0);
        }
      }}
    />
  );
}

/**
 * The layer stack: an ordered list (top row = top of the stack) with per-layer
 * select, visibility, hold-off, reorder and remove, plus an "add layer" picker.
 * Replaces the old project tabs — a plot is now a stack of module instances.
 */
export function LayerStackPanel() {
  const {
    layers,
    selectedId,
    liveOutputs,
    addLayer,
    removeLayer,
    reorderLayer,
    selectLayer,
    setVisible,
    setHoldOff,
    canAdd,
  } = useLayerStore();
  const [pick, setPick] = useState(DEFAULT_MODULE_ID);

  return (
    <div className="layer-stack">
      <h3 className="section-title">Layers</h3>

      <div className="layer-list">
        {layers.length === 0 && (
          <p className="layer-empty">No layers yet — add one below to begin.</p>
        )}
        {/* Top of the stack renders at the top of the list. */}
        {layers
          .map((layer, index) => ({ layer, index }))
          .reverse()
          .map(({ layer, index }) => {
            const mod = getModule(layer.moduleId);
            const busy = liveOutputs[layer.instanceId]?.busy;
            return (
              <div
                key={layer.instanceId}
                className={`layer-row ${layer.instanceId === selectedId ? 'selected' : ''}`}
                onClick={() => selectLayer(layer.instanceId)}
              >
                <div className="layer-reorder">
                  <button
                    type="button"
                    title="Move up"
                    disabled={index === layers.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderLayer(index, index + 1);
                    }}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    title="Move down"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderLayer(index, index - 1);
                    }}
                  >
                    ▼
                  </button>
                </div>

                <button
                  type="button"
                  className="layer-visible"
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                  aria-pressed={layer.visible}
                  onClick={(e) => {
                    e.stopPropagation();
                    setVisible(layer.instanceId, !layer.visible);
                  }}
                >
                  {layer.visible ? '👁' : '🚫'}
                </button>

                <span className="layer-label">
                  {mod.label}
                  {busy && <span className="layer-busy" title="Rendering…"> ⟳</span>}
                </span>

                <label
                  className="layer-holdoff"
                  title="Clean-paper halo (mm) this layer reserves around the layers stacked above it"
                  onClick={(e) => e.stopPropagation()}
                >
                  halo
                  <HoldOffInput
                    value={layer.holdOffMm}
                    onChange={(v) => setHoldOff(layer.instanceId, v)}
                  />
                </label>

                <button
                  type="button"
                  className="layer-remove"
                  title="Remove layer"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeLayer(layer.instanceId);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
      </div>

      <div className="layer-add">
        <select value={pick} onChange={(e) => setPick(e.target.value)}>
          {MODULES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="secondary"
          disabled={!canAdd}
          title={canAdd ? 'Add a layer' : `At most ${MAX_LAYERS} layers`}
          onClick={() => addLayer(pick)}
        >
          + Add layer
        </button>
      </div>
    </div>
  );
}
