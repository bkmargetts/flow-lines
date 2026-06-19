import type { TextureStyle } from '@flow-lines/core';
import { InfoTip } from '../../components/InfoTip';
import { EditableValue } from '../../components/EditableValue';
import { ColorField } from '../../components/ColorField';
import type { ClassicParams } from './index';

const TEXTURE_STYLES: Array<{ id: TextureStyle; label: string }> = [
  { id: 'hatch', label: 'Hatch' },
  { id: 'grid', label: 'Grid' },
  { id: 'stipple', label: 'Stipple' },
  { id: 'contours', label: 'Contours' },
  { id: 'shapes', label: 'Shapes' },
];

const TEXTURE_INKS = ['#c9c2b4', '#b06a3c', '#5b6e7a', '#9aa0a6', '#1a1a1a'];

interface Props {
  params: ClassicParams;
  update: (updates: Partial<ClassicParams>) => void;
}

/** Controls for the classic single-pen texture styles. */
export function ClassicControls({ params, update }: Props) {
  return (
    <>
      <div className="control-group">
        <label>Style</label>
        <select
          value={params.style}
          onChange={(e) => update({ style: e.target.value as TextureStyle })}
        >
          {TEXTURE_STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {(params.style === 'hatch' ||
        params.style === 'grid' ||
        params.style === 'stipple' ||
        params.style === 'shapes') && (
        <div className="control-group">
          <label>
            Spacing{" "}
            <EditableValue value={params.spacingMm} min={1} max={12} step={0.5} onChange={(v) => update({ spacingMm: v })}>
              {params.spacingMm.toFixed(1)}mm
            </EditableValue>
          </label>
          <input
            type="range"
            min="1"
            max="12"
            step="0.5"
            value={params.spacingMm}
            onChange={(e) => update({ spacingMm: parseFloat(e.target.value) })}
          />
        </div>
      )}

      {(params.style === 'hatch' || params.style === 'grid' || params.style === 'shapes') && (
        <div className="control-group">
          <label>
            Angle{" "}
            <EditableValue value={params.angleDeg} min={0} max={180} step={1} onChange={(v) => update({ angleDeg: v })}>
              {params.angleDeg}°
            </EditableValue>
          </label>
          <input
            type="range"
            min="0"
            max="180"
            step="1"
            value={params.angleDeg}
            onChange={(e) => update({ angleDeg: parseInt(e.target.value, 10) })}
          />
        </div>
      )}

      {params.style === 'hatch' && (
        <div className="control-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={params.crossHatch}
              onChange={(e) => update({ crossHatch: e.target.checked })}
            />
            Cross-hatch
          </label>
        </div>
      )}

      {(params.style === 'stipple' || params.style === 'contours') && (
        <div className="control-group">
          <label>
            Density{" "}
            <EditableValue value={params.density} min={0} max={1} step={0.05} onChange={(v) => update({ density: v })}>
              {params.density.toFixed(2)}
            </EditableValue>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={params.density}
            onChange={(e) => update({ density: parseFloat(e.target.value) })}
          />
        </div>
      )}

      {params.style !== 'shapes' && (
        <div className="control-group">
          <label>
            {params.style === 'contours' ? 'Scale' : 'Mark size'}{" "}
            <EditableValue value={params.scale} min={0.2} max={3} step={0.1} onChange={(v) => update({ scale: v })}>
              {params.scale.toFixed(2)}
            </EditableValue>
          </label>
          <input
            type="range"
            min="0.2"
            max="3"
            step="0.1"
            value={params.scale}
            onChange={(e) => update({ scale: parseFloat(e.target.value) })}
          />
        </div>
      )}

      {params.style !== 'grid' && (
        <div className="control-group">
          <label>
            Jitter{" "}
            <EditableValue value={params.jitter} min={0} max={1} step={0.05} onChange={(v) => update({ jitter: v })}>
              {params.jitter.toFixed(2)}
            </EditableValue>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={params.jitter}
            onChange={(e) => update({ jitter: parseFloat(e.target.value) })}
          />
        </div>
      )}

      {params.style === 'shapes' && (
        <div className="control-group">
          <label>Shape</label>
          <div className="segmented">
            {(['square', 'circle', 'line'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={params.shapes.kind === k ? 'active' : ''}
                onClick={() => update({ shapes: { ...params.shapes, kind: k } })}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}

      {params.style === 'shapes' && (
        <div className="control-group">
          <label>
            Shape size{" "}
            <EditableValue value={params.shapes.sizeMm} min={1} max={20} step={0.5} onChange={(v) => update({ shapes: { ...params.shapes, sizeMm: v } })}>
              {params.shapes.sizeMm.toFixed(1)}mm
            </EditableValue>
          </label>
          <input
            type="range"
            min="1"
            max="20"
            step="0.5"
            value={params.shapes.sizeMm}
            onChange={(e) => update({ shapes: { ...params.shapes, sizeMm: parseFloat(e.target.value) } })}
          />
        </div>
      )}

      {params.style === 'shapes' && (
        <div className="control-group">
          <label>
            Overlap{" "}
            <EditableValue value={params.shapes.overlap} min={0} max={0.9} step={0.05} onChange={(v) => update({ shapes: { ...params.shapes, overlap: v } })}>
              {params.shapes.overlap.toFixed(2)}
            </EditableValue>
            <InfoTip text="Compresses the lattice below the spacing so shapes overlap. 0 keeps them on the spacing grid; higher packs them together." />
          </label>
          <input
            type="range"
            min="0"
            max="0.9"
            step="0.05"
            value={params.shapes.overlap}
            onChange={(e) => update({ shapes: { ...params.shapes, overlap: parseFloat(e.target.value) } })}
          />
        </div>
      )}

      <div className="control-group">
        <label>Texture ink</label>
        <div className="paper-swatches">
          {TEXTURE_INKS.map((ink) => (
            <button
              key={ink}
              type="button"
              className={`paper-swatch ${params.color === ink ? 'active' : ''}`}
              title={ink}
              aria-label={ink}
              style={{ background: ink }}
              onClick={() => update({ color: ink })}
            />
          ))}
        </div>
      </div>
      <ColorField label="Texture ink (custom)" value={params.color} onChange={(color) => update({ color })} />

      <div className="control-group">
        <label>Texture seed</label>
        <div className="seed-input">
          <input
            type="number"
            value={params.seed}
            onChange={(e) => update({ seed: parseInt(e.target.value, 10) || 0 })}
          />
          <button
            type="button"
            className="secondary"
            title="New texture seed"
            onClick={() => update({ seed: Math.floor(Math.random() * 1000000) })}
          >
            🎲
          </button>
        </div>
      </div>
    </>
  );
}
