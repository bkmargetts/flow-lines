import { InfoTip } from '../../components/InfoTip';
import { ColorField, PalettePicker } from '../../components/ColorField';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import type { ControlsProps, Updater } from '../../modules/types';
import type {
  AccentOrientation,
  AccentType,
  ColorFieldState,
  GradientMode,
  AccentUIState,
} from './types';
import { defaultAccent } from './types';

/** The colour-field label style: span.label-text with an optional InfoTip. */
function labelWithTip(label: string, info?: string) {
  return (
    <span className="label-text">
      {label}
      {info && <InfoTip text={info} />}
    </span>
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
        labelNode={labelWithTip('Position', 'Where the accent sits across the page.')}
        value={Math.round(accent.posPct * 100)}
        min={0}
        max={100}
        step={1}
        onChange={(v) => update({ posPct: v / 100 })}
        format={(v) => `${v}%`}
      />
      <Slider
        labelNode={labelWithTip('Start', 'Where the accent begins along its own length.')}
        value={Math.round(accent.startPct * 100)}
        min={0}
        max={100}
        step={1}
        onChange={(v) => update({ startPct: v / 100 })}
        format={(v) => `${v}%`}
      />
      <Slider
        labelNode={labelWithTip('Length')}
        value={Math.round(accent.lenPct * 100)}
        min={5}
        max={100}
        step={1}
        onChange={(v) => update({ lenPct: v / 100 })}
        format={(v) => `${v}%`}
      />
      <Slider
        labelNode={labelWithTip('Thickness')}
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
        labelNode={labelWithTip('Spacing', 'Gap between adjacent lines, mm. Tighter packs the striations denser.')}
        value={state.spacingMm}
        min={0.5}
        max={8}
        step={0.1}
        onChange={(v) => u({ spacingMm: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />
      <Slider
        labelNode={labelWithTip('Angle', 'Line direction. 0° is vertical — the colour bands then stack horizontally, top to bottom.')}
        value={state.angleDeg}
        min={0}
        max={180}
        step={5}
        onChange={(v) => u({ angleDeg: v })}
        format={(v) => `${v}°`}
      />
      <Slider
        labelNode={labelWithTip('Length')}
        value={Math.round(state.lineLengthPct * 100)}
        min={10}
        max={100}
        step={5}
        onChange={(v) => u({ lineLengthPct: v / 100 })}
        format={(v) => `${v}%`}
      />
      <Slider
        labelNode={labelWithTip('Fill', 'How much of each line is inked. 100% = solid (no white paper between strokes); lower leaves organic breaks. With Spacing, this sets overall density.')}
        value={Math.round(state.fill * 100)}
        min={30}
        max={100}
        step={5}
        onChange={(v) => u({ fill: v / 100 })}
        format={(v) => `${v}%`}
      />

      <h3 className="section-title">Colour</h3>
      <PalettePicker
        palette={state.palette}
        customRamp={state.customRamp}
        colorCount={state.colorCount}
        onChange={u}
        info="The gradient mixes these inks — every pen is present across the field and overlapping colours blend optically. 'Ice' / 'Ember' match the references; 'Custom…' lets you pick each ink."
      />
      <Slider
        labelNode={labelWithTip('Inks (pens)', 'How many inks are combined along the gradient. Each is its own pen layer; neighbours overlap and mix into in-between hues. A handful reads cleanest; high counts give a smooth many-ink gradient.')}
        value={state.colorCount}
        min={2}
        max={15}
        step={1}
        onChange={(v) => u({ colorCount: v })}
        format={(v) => String(v)}
      />
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={state.blendInks}
          onChange={(e) => u({ blendInks: e.target.checked })}
        />
        Overprint blend
        <InfoTip text="Stacks the inks on the same lines and multiplies them, so where two colours overlap you see the blended hue (like two pens overprinting). Off keeps them interleaved as a pure-ink optical mix." />
      </label>

      <h3 className="section-title">Gradient</h3>
      <div className="control-group">
        <label>
          <span className="label-text">
            Shape
            <InfoTip text="Linear runs the palette across the page in a direction; Radial spreads it out from a focal point (a glow)." />
          </span>
        </label>
        <select value={state.gradientMode} onChange={(e) => u({ gradientMode: e.target.value as GradientMode })}>
          <option value="linear">Linear</option>
          <option value="radial">Radial (focal glow)</option>
        </select>
      </div>
      {state.gradientMode === 'linear' && (
        <Slider
          labelNode={labelWithTip('Direction', 'Direction the palette runs. 0° = top→bottom.')}
          value={state.gradientAngleDeg}
          min={0}
          max={360}
          step={5}
          onChange={(v) => u({ gradientAngleDeg: v })}
          format={(v) => `${v}°`}
        />
      )}
      {state.gradientMode === 'radial' && (
        <>
          <Slider
            labelNode={labelWithTip('Focal X')}
            value={Math.round(state.focalXPct * 100)}
            min={0}
            max={100}
            step={1}
            onChange={(v) => u({ focalXPct: v / 100 })}
            format={(v) => `${v}%`}
          />
          <Slider
            labelNode={labelWithTip('Focal Y')}
            value={Math.round(state.focalYPct * 100)}
            min={0}
            max={100}
            step={1}
            onChange={(v) => u({ focalYPct: v / 100 })}
            format={(v) => `${v}%`}
          />
          <Slider
            labelNode={labelWithTip('Radius')}
            value={Math.round(state.gradientRadiusPct * 100)}
            min={20}
            max={150}
            step={5}
            onChange={(v) => u({ gradientRadiusPct: v / 100 })}
            format={(v) => `${v}%`}
          />
        </>
      )}
      <Slider
        labelNode={labelWithTip('Blend', 'How much the inks overlap. Higher mixes more colours at once for a softer, muddier blend; lower keeps each colour cleaner.')}
        value={state.blend}
        min={0.5}
        max={3}
        step={0.1}
        onChange={(v) => u({ blend: v })}
        format={(v) => `${v.toFixed(1)}×`}
      />
      <Slider
        labelNode={labelWithTip('Warp', 'Organic distortion of the gradient, mm — so the colour transition wanders instead of running dead straight.')}
        value={state.gradientNoiseAmpMm}
        min={0}
        max={40}
        step={1}
        onChange={(v) => u({ gradientNoiseAmpMm: v })}
        format={(v) => `${v.toFixed(0)}mm`}
      />
      <Slider
        labelNode={labelWithTip('Warp grain', 'Spatial frequency of the gradient warp. Lower = broad swells, higher = finer turbulence.')}
        value={state.gradientNoiseScale}
        min={0.001}
        max={0.02}
        step={0.001}
        onChange={(v) => u({ gradientNoiseScale: v })}
        format={(v) => v.toFixed(3)}
      />
      <Slider
        labelNode={labelWithTip('Mix grain', 'Texture of the density dither that interleaves the inks. Higher = finer, smoother mixing; lower = chunkier patches.')}
        value={state.ditherScale}
        min={0.01}
        max={0.1}
        step={0.005}
        onChange={(v) => u({ ditherScale: v })}
        format={(v) => v.toFixed(3)}
      />

      <h3 className="section-title">Weave</h3>
      <Slider
        labelNode={labelWithTip('Cross-hatch', 'Number of line directions. 1 = single direction; higher adds crossing passes (evenly spaced) that intersect into a woven grid. With Overprint, crossings of different colours blend.')}
        value={state.crossHatch}
        min={1}
        max={3}
        step={1}
        onChange={(v) => u({ crossHatch: v })}
        format={(v) => String(v)}
      />
      <Slider
        labelNode={labelWithTip('Colour fan', 'Fans each colour out to its own angle, so different-coloured lines physically cross and overlap (most grating-like). 0 = all colours share the direction. Heavier to render at high ink counts.')}
        value={state.inkAngleSpreadDeg}
        min={0}
        max={60}
        step={5}
        onChange={(v) => u({ inkAngleSpreadDeg: v })}
        format={(v) => `${v}°`}
      />

      <h3 className="section-title">Line style</h3>
      <Slider
        labelNode={labelWithTip('Jitter', 'Random per-point shake, mm — reads as inked, not printed.')}
        value={state.jitterMm}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => u({ jitterMm: v })}
        format={(v) => `${v.toFixed(2)}mm`}
      />
      <Slider
        labelNode={labelWithTip('Wobble', 'Low-frequency hand-drawn wander of each line, mm.')}
        value={state.wobbleAmpMm}
        min={0}
        max={3}
        step={0.1}
        onChange={(v) => u({ wobbleAmpMm: v })}
        format={(v) => `${v.toFixed(2)}mm`}
      />
      <Slider
        labelNode={labelWithTip('Min segment', 'Drops segments shorter than this, mm — clears feather slivers.')}
        value={state.minSegmentLengthMm}
        min={0}
        max={5}
        step={0.5}
        onChange={(v) => u({ minSegmentLengthMm: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />
      <Slider
        labelNode={labelWithTip('Pen width', 'Plotted line weight in millimetres.')}
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
      <SeedControl seed={state.seed} onChange={(seed) => u({ seed })}>
        <label>
          <span className="label-text">
            Seed
            <InfoTip text="Sets the band noise, feather, wander, jitter and wobble. Same seed → identical pattern." />
          </span>
        </label>
      </SeedControl>
    </div>
  );
}
