import type { TextureStyle } from '@flow-lines/core';
import { InfoTip } from '../../components/InfoTip';
import { EditableValue } from '../../components/EditableValue';
import { ColorField } from '../../components/ColorField';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import type { ControlsProps } from '../../modules/types';
import type { ClassicParams } from './types';

const TEXTURE_STYLES: Array<{ id: TextureStyle; label: string }> = [
  { id: 'hatch', label: 'Hatch' },
  { id: 'grid', label: 'Grid' },
  { id: 'stipple', label: 'Stipple' },
  { id: 'contours', label: 'Contours' },
  { id: 'shapes', label: 'Shapes' },
];

const TEXTURE_INKS = ['#c9c2b4', '#b06a3c', '#5b6e7a', '#9aa0a6', '#1a1a1a'];

/** Controls for the classic single-pen texture styles. */
export function ClassicControls({ state, update }: ControlsProps<ClassicParams>) {
  return (
    <>
      <div className="control-group">
        <label>Style</label>
        <select
          value={state.style}
          onChange={(e) => update({ style: e.target.value as TextureStyle })}
        >
          {TEXTURE_STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {(state.style === 'hatch' ||
        state.style === 'grid' ||
        state.style === 'stipple' ||
        state.style === 'shapes') && (
        <Slider
          label="Spacing"
          value={state.spacingMm}
          min={1}
          max={12}
          step={0.5}
          onChange={(v) => update({ spacingMm: v })}
          format={(v) => `${v.toFixed(1)}mm`}
        />
      )}

      {(state.style === 'hatch' || state.style === 'grid' || state.style === 'shapes') && (
        <Slider
          label="Angle"
          value={state.angleDeg}
          min={0}
          max={180}
          step={1}
          onChange={(v) => update({ angleDeg: v })}
          format={(v) => `${v}°`}
        />
      )}

      {state.style === 'hatch' && (
        <div className="control-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={state.crossHatch}
              onChange={(e) => update({ crossHatch: e.target.checked })}
            />
            Cross-hatch
          </label>
        </div>
      )}

      {(state.style === 'stipple' || state.style === 'contours') && (
        <Slider
          label="Density"
          value={state.density}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ density: v })}
          format={(v) => v.toFixed(2)}
        />
      )}

      {state.style !== 'shapes' && (
        <Slider
          label={state.style === 'contours' ? 'Scale' : 'Mark size'}
          value={state.scale}
          min={0.2}
          max={3}
          step={0.1}
          onChange={(v) => update({ scale: v })}
          format={(v) => v.toFixed(2)}
        />
      )}

      {state.style !== 'grid' && (
        <Slider
          label="Jitter"
          value={state.jitter}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ jitter: v })}
          format={(v) => v.toFixed(2)}
        />
      )}

      {state.style === 'shapes' && (
        <div className="control-group">
          <label>Shape</label>
          <div className="segmented">
            {(['square', 'circle', 'line'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={state.shapes.kind === k ? 'active' : ''}
                onClick={() => update({ shapes: { ...state.shapes, kind: k } })}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}

      {state.style === 'shapes' && (
        <Slider
          label="Shape size"
          value={state.shapes.sizeMm}
          min={1}
          max={20}
          step={0.5}
          onChange={(v) => update({ shapes: { ...state.shapes, sizeMm: v } })}
          format={(v) => `${v.toFixed(1)}mm`}
        />
      )}

      {state.style === 'shapes' && (
        <div className="control-group">
          <label>
            Overlap{" "}
            <EditableValue value={state.shapes.overlap} min={0} max={0.9} step={0.05} onChange={(v) => update({ shapes: { ...state.shapes, overlap: v } })}>
              {state.shapes.overlap.toFixed(2)}
            </EditableValue>
            <InfoTip text="Compresses the lattice below the spacing so shapes overlap. 0 keeps them on the spacing grid; higher packs them together." />
          </label>
          <input
            type="range"
            min="0"
            max="0.9"
            step="0.05"
            value={state.shapes.overlap}
            onChange={(e) => update({ shapes: { ...state.shapes, overlap: parseFloat(e.target.value) } })}
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
              className={`paper-swatch ${state.color === ink ? 'active' : ''}`}
              title={ink}
              aria-label={ink}
              style={{ background: ink }}
              onClick={() => update({ color: ink })}
            />
          ))}
        </div>
      </div>
      <ColorField label="Texture ink (custom)" value={state.color} onChange={(color) => update({ color })} />

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} title="New texture seed">
        <label>Texture seed</label>
      </SeedControl>
    </>
  );
}
