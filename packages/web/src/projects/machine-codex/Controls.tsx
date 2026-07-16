import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { Slider } from '../../components/controls/Slider';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { MachineCodexState } from './types';
import { MACHINE_CODEX_PRESETS, getMachineCodexPreset, randomCodexGenome } from './presets';

/** Sidebar controls for the Machine Codex. The Complexity slider is the
 *  module's identity — one wheel → full contraption; everything finer lives
 *  in Advanced. */
export function MachineCodexControls({ state, update }: ControlsProps<MachineCodexState>) {
  const selectPreset = (id: string) => {
    const preset = getMachineCodexPreset(id);
    update(preset ? { ...preset.state, preset: id } : { preset: id });
  };

  const surprise = () => update({ ...randomCodexGenome(Math.random), seed: randomSeed() });

  return (
    <div className="controls">
      <h3 className="section-title">Machine Codex</h3>

      <div className="control-group">
        <button type="button" className="secondary" onClick={surprise} title="Randomize everything" style={{ width: '100%' }}>
          🎲 Randomize everything
        </button>
        <p className="paint-hint">One roll for a whole new invention — or tune anything below.</p>
      </div>

      <div className="control-group">
        <div className="seed-input">
          <select value={state.preset} onChange={(e) => selectPreset(e.target.value)} style={{ flex: 1 }}>
            {MACHINE_CODEX_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="secondary"
            onClick={() => update({ seed: randomSeed() })}
            title="New random machine"
          >
            🎲
          </button>
        </div>
        <p className="paint-hint">Pick a plate style, then grow the contraption.</p>
      </div>

      <div className="control-group">
        <label className="label-text">Plate style</label>
        <select value={state.style} onChange={(e) => update({ style: e.target.value as MachineCodexState['style'] })}>
          <option value="codex">Codex (aged, asemic script)</option>
          <option value="patent">Patent plate (ruled)</option>
        </select>
      </div>

      <div className="control-group">
        <div className="seed-input">
          <label className="label-text" style={{ flex: 1 }}>Seed</label>
          <input
            type="number"
            value={state.seed}
            onChange={(e) => update({ seed: parseInt(e.target.value, 10) || 0 })}
            style={{ width: 110 }}
          />
          <button type="button" className="secondary" onClick={() => update({ seed: randomSeed() })} title="Random seed">
            🎲
          </button>
        </div>
      </div>

      <Slider
        label="Complexity"
        value={state.complexity}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ complexity: v })}
        format={(v) => (v < 0.02 ? 'one wheel' : `${Math.round(v * 100)}%`)}
      />

      <Slider label="Gear size" value={state.gearSizeMm} min={12} max={45} step={0.5} onChange={(v) => update({ gearSizeMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <Slider label="Mechanisms" value={state.mechanisms} min={0} max={1} step={0.05} onChange={(v) => update({ mechanisms: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Marginalia" value={state.marginalia} min={0} max={1} step={0.05} onChange={(v) => update({ marginalia: v })} format={(v) => (v < 0.025 ? 'none' : `${Math.round(v * 100)}%`)} />

      <AdvancedSection>
        <AdvGroup title="Machine">
          <div className="control-group">
            <label className="checkbox-row">
              <input type="checkbox" checked={state.hiddenLines} onChange={(e) => update({ hiddenLines: e.target.checked })} />
              <span>Dashed hidden lines</span>
            </label>
          </div>
          <div className="control-group">
            <label className="checkbox-row">
              <input type="checkbox" checked={state.cutaway} onChange={(e) => update({ cutaway: e.target.checked })} />
              <span>Section cutaway</span>
            </label>
          </div>
        </AdvGroup>

        <AdvGroup title="Plate">
          <Slider label="Annotations" value={state.annotations} min={0} max={1} step={0.05} onChange={(v) => update({ annotations: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Detail insets" value={state.detailInsets} min={0} max={2} step={1} onChange={(v) => update({ detailInsets: v })} />
          <div className="control-group">
            <label className="label-text">Title (blank = invented)</label>
            <input
              type="text"
              value={state.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="MACHINA VOLVENS"
            />
          </div>
        </AdvGroup>

        <AdvGroup title="Tone">
          <Slider label="Shading" value={state.shading} min={0} max={1} step={0.05} onChange={(v) => update({ shading: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Hatch spacing" value={state.hatchMm} min={0.5} max={2.5} step={0.05} onChange={(v) => update({ hatchMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
        </AdvGroup>

        <AdvGroup title="Pen & finish">
          <Slider label="Pen width" value={state.penWidthMm} min={0.15} max={1.2} step={0.05} onChange={(v) => update({ penWidthMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <Slider label="Wobble" value={state.wobbleMm} min={0} max={1.2} step={0.02} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <Slider label="Hand sketch" value={state.sketch} min={0} max={1} step={0.05} onChange={(v) => update({ sketch: v })} format={(v) => `${Math.round(v * 100)}%`} />
          {state.sketch > 0.01 && (
            <div className="control-group">
              <label className="label-text">Sketch style</label>
              <select value={state.sketchStyle} onChange={(e) => update({ sketchStyle: e.target.value as MachineCodexState['sketchStyle'] })}>
                <option value="loose">Loose</option>
                <option value="fine">Fine</option>
                <option value="gestural">Gestural</option>
                <option value="scratchy">Scratchy</option>
              </select>
            </div>
          )}
          <ColorField label="Ink" value={state.strokeColor} onChange={(v) => update({ strokeColor: v })} />
        </AdvGroup>
      </AdvancedSection>
    </div>
  );
}
