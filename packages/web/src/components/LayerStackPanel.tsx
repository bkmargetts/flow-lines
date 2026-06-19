import { useState } from 'react';
import { MODULES, getModule } from '../modules/registry';
import { useLayerStore, MAX_LAYERS } from '../LayerStore';

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
  const [pick, setPick] = useState(MODULES[0].id);

  return (
    <div className="layer-stack">
      <h3 className="section-title">Layers</h3>

      <div className="layer-list">
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

                <label className="layer-holdoff" title="Clean-paper halo reserved around the layers above this one (mm)" onClick={(e) => e.stopPropagation()}>
                  halo
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={0.5}
                    value={layer.holdOffMm}
                    onChange={(e) =>
                      setHoldOff(layer.instanceId, Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </label>

                <button
                  type="button"
                  className="layer-remove"
                  title="Remove layer"
                  disabled={layers.length <= 1}
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
