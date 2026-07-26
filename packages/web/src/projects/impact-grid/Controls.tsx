import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import { randomImpactGridGenome, type ImpactGridState } from './types';

const LAYOUT_LABELS: Record<ImpactGridState['layout'], string> = {
  grid: 'Grid',
  frame: 'Frame',
};

/** Sidebar controls for Impact Grid: draw the strike on the canvas, then
 *  shape how hard the grid takes it. */
export function ImpactGridControls({ state, update }: ControlsProps<ImpactGridState>) {
  return (
    <div className="controls">
      <h3 className="section-title">Impact Grid</h3>

      <RandomiseButton
        onClick={() => update({ ...randomImpactGridGenome(Math.random), seed: randomSeed() })}
        hint="One roll for a fresh grid and impact response — your drawn strike and inks stay."
      />

      <div className="control-group">
        <div className="paint-controls">
          <button
            type="button"
            className={state.drawMode ? 'primary active' : 'primary'}
            onClick={() => update({ drawMode: !state.drawMode })}
          >
            {state.drawMode ? 'Stop drawing' : 'Draw impact'}
          </button>
          {state.maskPath.length > 0 && (
            <button type="button" className="secondary" onClick={() => update({ maskPath: [] })}>
              Clear ({state.maskPath.length})
            </button>
          )}
        </div>
        <p className="paint-hint">
          {state.drawMode
            ? 'Drag across the canvas to strike the grid along the path.'
            : 'Tap “Draw impact”, then drag on the canvas. Squares near the path scatter and shatter.'}
        </p>
      </div>

      <PresetPicker
        label="Layout"
        info="Grid fills the page; Frame keeps a border band with an empty centre."
        labels={LAYOUT_LABELS}
        value={state.layout}
        onChange={(layout) => update({ layout })}
      />

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} />

      <Slider label="Cell size" value={state.cellSizeMm} min={3} max={20} step={0.5} onChange={(v) => update({ cellSizeMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <Slider label="Size variation" value={state.sizeVariation} min={0} max={1} step={0.01} onChange={(v) => update({ sizeVariation: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Impact strength" value={state.impactStrength} min={0} max={1} step={0.01} onChange={(v) => update({ impactStrength: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Impact radius" value={state.impactRadiusMm} min={10} max={150} step={1} onChange={(v) => update({ impactRadiusMm: v })} format={(v) => `${Math.round(v)}mm`} />
      <Slider label="Shatter" value={state.shatter} min={0} max={1} step={0.01} onChange={(v) => update({ shatter: v })} format={(v) => `${Math.round(v * 100)}%`} />

      <AdvancedSection>
        <AdvGroup title="Grid character">
          <Slider label="Position jitter" value={state.positionJitter} min={0} max={1} step={0.01} onChange={(v) => update({ positionJitter: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Rotation jitter" value={state.rotationJitter} min={0} max={1} step={0.01} onChange={(v) => update({ rotationJitter: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Gap" value={state.gap} min={0} max={0.6} step={0.01} onChange={(v) => update({ gap: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Frame depth" value={state.frameDepth} min={1} max={6} step={1} onChange={(v) => update({ frameDepth: v })} format={(v) => `${Math.round(v)}`} disabled={state.layout !== 'frame'} />
        </AdvGroup>
        <AdvGroup title="Debris">
          <Slider label="Scatter" value={state.scatter} min={0} max={1} step={0.01} onChange={(v) => update({ scatter: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Debris" value={state.debris} min={0} max={1} step={0.01} onChange={(v) => update({ debris: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </AdvGroup>
        <AdvGroup title="Marks">
          <Slider label="Fill" value={state.fill} min={0} max={1} step={0.01} onChange={(v) => update({ fill: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Wobble" value={state.wobbleMm} min={0} max={1} step={0.01} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
        </AdvGroup>
      </AdvancedSection>

      <Slider label="Pen width" value={state.penWidthMm} min={0.05} max={0.8} step={0.05} onChange={(v) => update({ penWidthMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
      <ColorField label="Ink" value={state.strokeColor} onChange={(strokeColor) => update({ strokeColor })} />
    </div>
  );
}
