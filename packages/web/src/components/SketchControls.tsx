import type { SketchStyle } from '@flow-lines/core';
import { EditableValue } from './EditableValue';

/** The shared, opt-in "sketch" control: a Sketchiness intensity slider plus the
 *  four-style character picker (shown only once sketch is dialled up). One
 *  component for every module that wants the hand-drawn overdraw, so the slider
 *  + click-to-type badge + style select live in exactly one place instead of
 *  being copy-pasted per generator. Drop it into a module's Controls and mirror
 *  `sketch`/`sketchStyle` into that module's `LayerOutput.sketch` — the
 *  compositor's per-layer finishing stage does the rest. */
export interface SketchControlsProps {
  sketch: number;
  sketchStyle: SketchStyle;
  onChange: (patch: { sketch?: number; sketchStyle?: SketchStyle }) => void;
  /** Slider label; defaults to "Sketchiness". */
  label?: string;
}

export function SketchControls({ sketch, sketchStyle, onChange, label = 'Sketchiness' }: SketchControlsProps) {
  return (
    <>
      <div className="control-group">
        <label>
          {label}{' '}
          <EditableValue value={sketch} min={0} max={1} step={0.05} onChange={(v) => onChange({ sketch: v })}>
            {sketch.toFixed(2)}
          </EditableValue>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={sketch}
          onChange={(e) => onChange({ sketch: parseFloat(e.target.value) })}
        />
      </div>
      {sketch > 0 && (
        <div className="control-group">
          <label className="label-text">Sketch style</label>
          <select value={sketchStyle} onChange={(e) => onChange({ sketchStyle: e.target.value as SketchStyle })}>
            <option value="loose">Loose</option>
            <option value="fine">Fine</option>
            <option value="gestural">Gestural</option>
            <option value="scratchy">Scratchy</option>
          </select>
        </div>
      )}
    </>
  );
}
