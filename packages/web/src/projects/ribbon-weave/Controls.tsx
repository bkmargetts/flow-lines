import type { RibbonEdgeMode, RibbonStyle } from '@flow-lines/core';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { Slider } from '../../components/controls/Slider';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { RibbonWeaveState } from './types';
import { RIBBON_WEAVE_PRESETS, getRibbonWeavePreset, randomRibbonGenome } from './presets';

/** Sidebar controls for the Ribbon Weave. The master Tangle ↔ Knot slider is
 *  the module's identity; everything finer lives in Advanced. */
export function RibbonWeaveControls({ state, update }: ControlsProps<RibbonWeaveState>) {
  const selectPreset = (id: string) => {
    const preset = getRibbonWeavePreset(id);
    update(preset ? { ...preset.state, preset: id } : { preset: id });
  };

  const groups = Math.max(1, Math.min(3, Math.round(state.inkGroups)));
  const surprise = () => update({ ...randomRibbonGenome(Math.random), seed: randomSeed() });

  return (
    <div className="controls">
      <h3 className="section-title">Ribbon Weave</h3>

      <div className="control-group">
        <button type="button" className="secondary" onClick={surprise} title="Randomize everything" style={{ width: '100%' }}>
          🎲 Randomize everything
        </button>
        <p className="paint-hint">One roll for a whole new weave — or tune anything below.</p>
      </div>

      <div className="control-group">
        <div className="seed-input">
          <select value={state.preset} onChange={(e) => selectPreset(e.target.value)} style={{ flex: 1 }}>
            {RIBBON_WEAVE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="secondary"
            onClick={() => update({ seed: randomSeed() })}
            title="New random weave"
          >
            🎲
          </button>
        </div>
        <p className="paint-hint">Pick a weave, then slide between tangle and knot.</p>
      </div>

      <div className="control-group">
        <label className="label-text">Ribbon style</label>
        <select value={state.style} onChange={(e) => update({ style: e.target.value as RibbonStyle })}>
          <option value="band">Woven band</option>
          <option value="silk">Flat silk</option>
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
        label="Tangle ↔ Knot"
        value={state.order}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ order: v })}
        format={(v) => (v < 0.02 ? 'tangle' : v > 0.98 ? 'knot' : `${Math.round(v * 100)}%`)}
      />

      <Slider label="Weave size" value={state.cellMm} min={8} max={40} step={0.5} onChange={(v) => update({ cellMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <Slider label="Ribbon width" value={state.bandMm} min={1.5} max={12} step={0.1} onChange={(v) => update({ bandMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <Slider label="Knot breaks" value={state.breaks} min={0} max={1} step={0.01} onChange={(v) => update({ breaks: v })} format={(v) => (v < 0.005 ? 'plait' : `${Math.round(v * 100)}%`)} />
      <Slider label="Shading" value={state.shading} min={0} max={1} step={0.05} onChange={(v) => update({ shading: v })} format={(v) => `${Math.round(v * 100)}%`} />

      <AdvancedSection>
        <AdvGroup title="Weave">
          <div className="control-group">
            <label className="label-text">At the frame</label>
            <select value={state.edge} onChange={(e) => update({ edge: e.target.value as RibbonEdgeMode })}>
              <option value="closed">Turn around (closed loops)</option>
              <option value="bleed">Run off the page</option>
            </select>
          </div>
          <Slider label="Meander" value={state.meander} min={0} max={1} step={0.05} onChange={(v) => update({ meander: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Crossing gap" value={state.gapMm} min={0.3} max={2.5} step={0.05} onChange={(v) => update({ gapMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <Slider label="Twists" value={state.twists} min={0} max={1} step={0.05} onChange={(v) => update({ twists: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </AdvGroup>

        <AdvGroup title="Marks">
          <Slider label="Cross ticks" value={state.rungs} min={0} max={1} step={0.05} onChange={(v) => update({ rungs: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Tick bow" value={state.rungCurve} min={0} max={1} step={0.05} onChange={(v) => update({ rungCurve: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Contact shadow" value={state.shadowHatch} min={0} max={1} step={0.05} onChange={(v) => update({ shadowHatch: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Light angle" value={state.lightAngleDeg} min={-180} max={180} step={5} onChange={(v) => update({ lightAngleDeg: v })} format={(v) => `${v.toFixed(0)}°`} />
        </AdvGroup>

        <AdvGroup title="Pen & finish">
          <Slider label="Pen width" value={state.penWidthMm} min={0.15} max={1.2} step={0.05} onChange={(v) => update({ penWidthMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <Slider label="Wobble" value={state.wobbleMm} min={0} max={1.2} step={0.02} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <Slider label="Hand sketch" value={state.sketch} min={0} max={1} step={0.05} onChange={(v) => update({ sketch: v })} format={(v) => `${Math.round(v * 100)}%`} />
          {state.sketch > 0.01 && (
            <div className="control-group">
              <label className="label-text">Sketch style</label>
              <select value={state.sketchStyle} onChange={(e) => update({ sketchStyle: e.target.value as RibbonWeaveState['sketchStyle'] })}>
                <option value="loose">Loose</option>
                <option value="fine">Fine</option>
                <option value="gestural">Gestural</option>
                <option value="scratchy">Scratchy</option>
              </select>
            </div>
          )}
        </AdvGroup>

        <AdvGroup title="Ink">
          <Slider label="Pen count" value={groups} min={1} max={3} step={1} onChange={(v) => update({ inkGroups: v })} />
          <ColorField label={groups > 1 ? 'Pen 1' : 'Ink'} value={state.strokeColor} onChange={(v) => update({ strokeColor: v })} />
          {groups === 1 && (
            <ColorField label="Shade" value={state.shadeColor} onChange={(v) => update({ shadeColor: v })} />
          )}
          {groups > 1 && (
            <ColorField label="Pen 2" value={state.ink2Color} onChange={(v) => update({ ink2Color: v })} />
          )}
          {groups > 2 && (
            <ColorField label="Pen 3" value={state.ink3Color} onChange={(v) => update({ ink3Color: v })} />
          )}
        </AdvGroup>
      </AdvancedSection>
    </div>
  );
}
