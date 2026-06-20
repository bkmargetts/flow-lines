import { InfoTip } from '../../components/InfoTip';
import { EditableValue } from '../../components/EditableValue';
import { ColorField, PalettePicker } from '../../components/ColorField';
import type { ControlsProps, Updater } from '../../modules/types';
import type { AccentOrientation, AccentType, AccentUIState, ColorFieldState } from './types';
import { defaultAccent } from './types';

/** One labelled range slider with a click-to-type value badge. */
function Slider(props: {
  label: string;
  info?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const { label, info, value, min, max, step, onChange, format } = props;
  const show = format ?? ((v: number) => String(v));
  return (
    <div className="control-group">
      <label>
        <span className="label-text">
          {label}
          {info && <InfoTip text={info} />}
        </span>
        <EditableValue value={value} min={min} max={max} step={step} onChange={onChange}>
          {show(value)}
        </EditableValue>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

/** Editor for a single geometric accent (bar or reserved-paper gap). */
function AccentEditor({
  accent,
  index,
  update,
  remove,
}: {
  accent: AccentUIState;
  index: number;
  update: (patch: Partial<AccentUIState>) => void;
  remove: () => void;
}) {
  return (
    <div className="control-group accent-editor">
      <div className="accent-header">
        <strong>Accent {index + 1}</strong>
        <button type="button" className="secondary" onClick={remove}>
          Remove
        </button>
      </div>

      <label>
        <span className="label-text">
          Type
          <InfoTip text="Bar: a contrasting solid line (its own pen). Gap: reserved clean paper the texture breaks around." />
        </span>
      </label>
      <select value={accent.type} onChange={(e) => update({ type: e.target.value as AccentType })}>
        <option value="bar">Bar (coloured)</option>
        <option value="gap">Gap (reserved paper)</option>
      </select>

      <label>
        <span className="label-text">Orientation</span>
      </label>
      <select
        value={accent.orientation}
        onChange={(e) => update({ orientation: e.target.value as AccentOrientation })}
      >
        <option value="vertical">Vertical</option>
        <option value="horizontal">Horizontal</option>
      </select>

      <Slider
        label="Position"
        info="Where the accent sits across the page."
        value={Math.round(accent.posPct * 100)}
        min={0}
        max={100}
        step={1}
        onChange={(v) => update({ posPct: v / 100 })}
        format={(v) => `${v}%`}
      />
      <Slider
        label="Start"
        info="Where the accent begins along its own length."
        value={Math.round(accent.startPct * 100)}
        min={0}
        max={100}
        step={1}
        onChange={(v) => update({ startPct: v / 100 })}
        format={(v) => `${v}%`}
      />
      <Slider
        label="Length"
        value={Math.round(accent.lenPct * 100)}
        min={5}
        max={100}
        step={1}
        onChange={(v) => update({ lenPct: v / 100 })}
        format={(v) => `${v}%`}
      />
      <Slider
        label="Thickness"
        value={accent.thicknessMm}
        min={0.5}
        max={20}
        step={0.5}
        onChange={(v) => update({ thicknessMm: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />

      {accent.type === 'bar' && (
        <>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={accent.taper}
              onChange={(e) => update({ taper: e.target.checked })}
            />
            Taper ends
          </label>
          <ColorField label="Bar colour" value={accent.color} onChange={(hex) => update({ color: hex })} />
        </>
      )}
    </div>
  );
}

/** Sidebar controls for the Colour Field module. */
export function ColorFieldControls({ state, update }: ControlsProps<ColorFieldState>) {
  const u: Updater<ColorFieldState> = update;

  const addAccent = () => u((s) => ({ accents: [...s.accents, { ...defaultAccent }] }));
  const updateAccent = (i: number, patch: Partial<AccentUIState>) =>
    u((s) => ({ accents: s.accents.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const removeAccent = (i: number) => u((s) => ({ accents: s.accents.filter((_, j) => j !== i) }));

  return (
    <div className="controls">
      <h3 className="section-title">Lines</h3>
      <Slider
        label="Spacing"
        info="Gap between adjacent lines, mm. Tighter packs the striations denser."
        value={state.spacingMm}
        min={0.5}
        max={8}
        step={0.1}
        onChange={(v) => u({ spacingMm: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />
      <Slider
        label="Angle"
        info="Line direction. 0° is vertical — the colour bands then stack horizontally, top to bottom."
        value={state.angleDeg}
        min={0}
        max={180}
        step={5}
        onChange={(v) => u({ angleDeg: v })}
        format={(v) => `${v}°`}
      />
      <Slider
        label="Length"
        value={Math.round(state.lineLengthPct * 100)}
        min={10}
        max={100}
        step={5}
        onChange={(v) => u({ lineLengthPct: v / 100 })}
        format={(v) => `${v}%`}
      />

      <h3 className="section-title">Colour bands</h3>
      <PalettePicker
        palette={state.palette}
        customRamp={state.customRamp}
        colorCount={state.colorCount}
        onChange={u}
        info="The gradient runs through these inks top→bottom, one pen per band. 'Ice' / 'Ember' match the references; 'Custom…' lets you pick each band."
      />
      <Slider
        label="Bands (pens)"
        info="How many colour bands stack along the gradient. Each is its own pen layer."
        value={state.colorCount}
        min={2}
        max={6}
        step={1}
        onChange={(v) => u({ colorCount: v })}
      />
      <Slider
        label="Boundary wave"
        info="Undulation of the band boundaries, mm — wavy edges instead of straight rules."
        value={state.bandWaveAmpMm}
        min={0}
        max={30}
        step={1}
        onChange={(v) => u({ bandWaveAmpMm: v })}
        format={(v) => `${v.toFixed(0)}mm`}
      />
      <Slider
        label="Wave length"
        value={state.bandWaveLengthMm}
        min={10}
        max={150}
        step={5}
        onChange={(v) => u({ bandWaveLengthMm: v })}
        format={(v) => `${v.toFixed(0)}mm`}
      />
      <Slider
        label="Feather"
        info="Width of the dithered transition zone where neighbouring bands interleave — the soft gradient blend, mm."
        value={state.featherMm}
        min={0}
        max={40}
        step={1}
        onChange={(v) => u({ featherMm: v })}
        format={(v) => `${v.toFixed(0)}mm`}
      />
      <Slider
        label="Feather grain"
        info="Spatial frequency of the feather dither. Higher = finer mottling."
        value={state.featherNoiseScale}
        min={0.005}
        max={0.08}
        step={0.005}
        onChange={(v) => u({ featherNoiseScale: v })}
        format={(v) => v.toFixed(3)}
      />

      <h3 className="section-title">Density (tone)</h3>
      <Slider
        label="Gradient"
        info="Adds lines toward the bottom so deep bands read denser/darker. 1 = uniform."
        value={state.densityGradient}
        min={1}
        max={3}
        step={0.1}
        onChange={(v) => u({ densityGradient: v })}
        format={(v) => `${v.toFixed(1)}×`}
      />
      <Slider
        label="Wander"
        info="Per-line bunching, as a fraction of spacing — the squeegee-pull look."
        value={state.densityNoiseAmt}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => u({ densityNoiseAmt: v })}
        format={(v) => v.toFixed(2)}
      />
      <Slider
        label="Wander grain"
        value={state.densityNoiseScale}
        min={0.002}
        max={0.04}
        step={0.002}
        onChange={(v) => u({ densityNoiseScale: v })}
        format={(v) => v.toFixed(3)}
      />

      <h3 className="section-title">Line style</h3>
      <Slider
        label="Jitter"
        info="Random per-point shake, mm — reads as inked, not printed."
        value={state.jitterMm}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => u({ jitterMm: v })}
        format={(v) => `${v.toFixed(2)}mm`}
      />
      <Slider
        label="Wobble"
        info="Low-frequency hand-drawn wander of each line, mm."
        value={state.wobbleAmpMm}
        min={0}
        max={3}
        step={0.1}
        onChange={(v) => u({ wobbleAmpMm: v })}
        format={(v) => `${v.toFixed(2)}mm`}
      />
      <Slider
        label="Min segment"
        info="Drops segments shorter than this, mm — clears feather slivers."
        value={state.minSegmentLengthMm}
        min={0}
        max={5}
        step={0.5}
        onChange={(v) => u({ minSegmentLengthMm: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />
      <Slider
        label="Pen width"
        info="Plotted line weight in millimetres."
        value={state.penWidthMm}
        min={0.05}
        max={0.8}
        step={0.05}
        onChange={(v) => u({ penWidthMm: v })}
        format={(v) => `${v.toFixed(2)}mm`}
      />

      <h3 className="section-title">Accents</h3>
      <p className="paint-hint">Geometric bars or reserved-paper gaps cutting through the texture.</p>
      {state.accents.map((accent, i) => (
        <AccentEditor
          key={i}
          accent={accent}
          index={i}
          update={(patch) => updateAccent(i, patch)}
          remove={() => removeAccent(i)}
        />
      ))}
      <div className="control-group">
        <button type="button" className="primary" onClick={addAccent}>
          Add accent
        </button>
      </div>

      <h3 className="section-title">Seed</h3>
      <div className="control-group">
        <label>
          <span className="label-text">
            Seed
            <InfoTip text="Sets the band noise, feather, wander, jitter and wobble. Same seed → identical pattern." />
          </span>
        </label>
        <div className="seed-input">
          <input
            type="number"
            value={state.seed}
            onChange={(e) => u({ seed: parseInt(e.target.value, 10) || 0 })}
          />
          <button
            type="button"
            className="secondary"
            title="New random seed"
            onClick={() => u({ seed: Math.floor(Math.random() * 1000000) })}
          >
            🎲
          </button>
        </div>
      </div>
    </div>
  );
}
