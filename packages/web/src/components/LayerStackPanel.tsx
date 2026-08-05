import { useEffect, useState } from 'react';
import { getModule } from '../modules/registry';
import { useLayerStore, MAX_LAYERS } from '../LayerStore';
import { LayerOptionsRow } from './LayerOptionsRow';
import { ModulePicker } from './ModulePicker';

/**
 * The per-layer hold-off (halo) field. A bare controlled number input can't be
 * cleared — emptying it parses to 0 and snaps straight back, so you can't delete
 * the 0 to type a new value. This keeps the raw text locally, commits any valid
 * number as you type, and only falls back to 0 on blur of an empty/invalid field.
 */
function HoldOffInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(value));
  // Re-sync when the committed value changes from elsewhere.
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      type="number"
      min={0}
      max={20}
      step={0.5}
      disabled={disabled}
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
    duplicateLayer,
    removeLayer,
    reorderLayer,
    selectLayer,
    setVisible,
    setHoldOff,
    setOverprint,
    canAdd,
  } = useLayerStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  // The one layer whose combination options strip is expanded ('' = none).
  const [optionsFor, setOptionsFor] = useState('');

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
            const optionsOpen = optionsFor === layer.instanceId;
            const optionsTouched =
              !!layer.transform || !!layer.clip || !!layer.haloOutline || !!layer.haloExempt;
            return (
              <div key={layer.instanceId} className="layer-entry">
              <div
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
                  className={`layer-holdoff ${layer.overprint ? 'disabled' : ''}`}
                  title={
                    layer.overprint
                      ? 'Overprint inks cross other layers — halo off'
                      : 'Clean-paper halo (mm) this layer reserves around the layers stacked above it'
                  }
                  onClick={(e) => e.stopPropagation()}
                >
                  halo
                  <HoldOffInput
                    value={layer.holdOffMm}
                    disabled={layer.overprint}
                    onChange={(v) => setHoldOff(layer.instanceId, v)}
                  />
                </label>

                <button
                  type="button"
                  className="layer-overprint"
                  title="Overprint — this layer's ink crosses the others: multiply preview, no reserved-paper halos against it"
                  aria-pressed={layer.overprint}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOverprint(layer.instanceId, !layer.overprint);
                  }}
                >
                  ⊗
                </button>

                <button
                  type="button"
                  className={`layer-gear ${optionsTouched ? 'touched' : ''}`}
                  title="Layer options — clip to a shape, transform & echo, halo extras"
                  aria-pressed={optionsOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOptionsFor(optionsOpen ? '' : layer.instanceId);
                  }}
                >
                  ⚙
                </button>

                <button
                  type="button"
                  className="layer-duplicate"
                  title={
                    canAdd
                      ? 'Duplicate layer — same settings, ready to nudge (seed, ink, a knob)'
                      : `At most ${MAX_LAYERS} layers`
                  }
                  disabled={!canAdd}
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateLayer(layer.instanceId);
                  }}
                >
                  ⧉
                </button>

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
              {optionsOpen && <LayerOptionsRow layer={layer} />}
              </div>
            );
          })}
      </div>

      <div className="layer-add">
        <button
          type="button"
          className="secondary layer-add-btn"
          disabled={!canAdd}
          title={canAdd ? 'Add a layer' : `At most ${MAX_LAYERS} layers`}
          onClick={() => setPickerOpen(true)}
        >
          + Add layer
        </button>
      </div>
      {pickerOpen && (
        <ModulePicker
          onPick={(id) => {
            addLayer(id);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
