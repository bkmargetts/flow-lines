import { getModule } from '../modules/registry';
import { useLayerStore, type Layer } from '../LayerStore';
import {
  defaultClipState,
  defaultTransformState,
  type LayerClipState,
  type LayerTransformState,
} from '../lib/composite';
import { Slider } from './controls/Slider';
import { Toggle } from './controls/Toggle';

/**
 * The per-layer combination options strip, expanded under a layer row from its
 * ⚙ button: stencil clip (render only inside/outside another layer's shape),
 * page-space transform + echo copies, and the halo extras (outline the
 * reserved-paper gap, exempt from other layers' halos). Options materialise on
 * first touch and reset back to `undefined` (inert, lean snapshots).
 */
export function LayerOptionsRow({ layer }: { layer: Layer }) {
  const { layers, patchLayer } = useLayerStore();
  const t = layer.transform ?? defaultTransformState();
  const c = layer.clip ?? defaultClipState();
  const patchT = (p: Partial<LayerTransformState>) =>
    patchLayer(layer.instanceId, { transform: { ...t, ...p } });
  const patchC = (p: Partial<LayerClipState>) =>
    patchLayer(layer.instanceId, { clip: { ...c, ...p } });

  const sources = layers
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.instanceId !== layer.instanceId);

  return (
    <div className="layer-options" onClick={(e) => e.stopPropagation()}>
      <div className="layer-options-section">
        <div className="layer-options-head">
          <span>Clip to layer</span>
          {layer.clip && (
            <button
              type="button"
              className="layer-options-reset"
              title="Remove the clip"
              onClick={() => patchLayer(layer.instanceId, { clip: undefined })}
            >
              reset
            </button>
          )}
        </div>
        <div className="control-group">
          <label>
            Shape source{' '}
            <select
              value={c.sourceId ?? ''}
              onChange={(e) => patchC({ sourceId: e.target.value || null })}
            >
              <option value="">None</option>
              {sources.map(({ l, i }) => (
                <option key={l.instanceId} value={l.instanceId}>
                  L{i} · {getModule(l.moduleId).label}
                  {l.visible ? '' : ' (hidden — clip inactive)'}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="control-group">
          <label>
            Keep{' '}
            <select
              value={c.mode}
              disabled={!c.sourceId}
              onChange={(e) => patchC({ mode: e.target.value as LayerClipState['mode'] })}
            >
              <option value="inside">inside the shape</option>
              <option value="outside">outside the shape</option>
            </select>
          </label>
        </div>
        <Slider
          label="Merge radius (mm)"
          value={c.growMm}
          min={0.5}
          max={10}
          step={0.5}
          disabled={!c.sourceId}
          onChange={(v) => patchC({ growMm: v })}
        />
        <Slider
          label="Expand (mm)"
          value={c.expandMm}
          min={-5}
          max={5}
          step={0.5}
          disabled={!c.sourceId}
          onChange={(v) => patchC({ expandMm: v })}
        />
        <Slider
          label="Feather (mm)"
          value={c.featherMm}
          min={0}
          max={5}
          step={0.25}
          disabled={!c.sourceId}
          onChange={(v) => patchC({ featherMm: v })}
        />
      </div>

      <div className="layer-options-section">
        <div className="layer-options-head">
          <span>Transform</span>
          {layer.transform && (
            <button
              type="button"
              className="layer-options-reset"
              title="Reset the transform and echo"
              onClick={() => patchLayer(layer.instanceId, { transform: undefined })}
            >
              reset
            </button>
          )}
        </div>
        <Slider
          label="Offset X (mm)"
          value={t.dxMm}
          min={-100}
          max={100}
          step={1}
          onChange={(v) => patchT({ dxMm: v })}
        />
        <Slider
          label="Offset Y (mm)"
          value={t.dyMm}
          min={-100}
          max={100}
          step={1}
          onChange={(v) => patchT({ dyMm: v })}
        />
        <Slider
          label="Rotate (°)"
          value={t.rotateDeg}
          min={-180}
          max={180}
          step={1}
          onChange={(v) => patchT({ rotateDeg: v })}
        />
        <Slider
          label="Scale"
          value={t.scale}
          min={0.2}
          max={3}
          step={0.05}
          onChange={(v) => patchT({ scale: v })}
        />
        <Slider
          label="Echo copies"
          value={t.echoCopies}
          min={1}
          max={6}
          step={1}
          onChange={(v) => patchT({ echoCopies: v })}
        />
        <Slider
          label="Echo ΔX (mm)"
          value={t.echoDxMm}
          min={-20}
          max={20}
          step={0.5}
          disabled={t.echoCopies < 2}
          onChange={(v) => patchT({ echoDxMm: v })}
        />
        <Slider
          label="Echo ΔY (mm)"
          value={t.echoDyMm}
          min={-20}
          max={20}
          step={0.5}
          disabled={t.echoCopies < 2}
          onChange={(v) => patchT({ echoDyMm: v })}
        />
        <Slider
          label="Echo Δrotate (°)"
          value={t.echoRotateDeg}
          min={-90}
          max={90}
          step={1}
          disabled={t.echoCopies < 2}
          onChange={(v) => patchT({ echoRotateDeg: v })}
        />
        <Slider
          label="Echo Δscale"
          value={t.echoScale}
          min={0.8}
          max={1.25}
          step={0.01}
          disabled={t.echoCopies < 2}
          onChange={(v) => patchT({ echoScale: v })}
        />
      </div>

      <div className="layer-options-section">
        <div className="layer-options-head">
          <span>Halo</span>
        </div>
        <Toggle
          label="Outline the halo gap"
          checked={!!layer.haloOutline}
          disabled={layer.overprint}
          onChange={(v) =>
            patchLayer(layer.instanceId, { haloOutline: v ? true : undefined })
          }
        />
        {layer.haloOutline && layer.holdOffMm <= 0 && !layer.overprint && (
          <p className="layer-options-hint">Set this layer's halo above 0 to see the outline.</p>
        )}
        <Toggle
          label="Exempt from other layers' halos"
          checked={!!layer.haloExempt}
          disabled={layer.overprint}
          onChange={(v) =>
            patchLayer(layer.instanceId, { haloExempt: v ? true : undefined })
          }
        />
      </div>
    </div>
  );
}
