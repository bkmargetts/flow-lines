import type { FacingMode } from '@flow-lines/core';
import { ColorField } from '../../components/ColorField';
import { InfoTip } from '../../components/InfoTip';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { Slider } from '../../components/controls/Slider';
import { Toggle } from '../../components/controls/Toggle';
import { SeedControl } from '../../components/controls/SeedControl';
import type { ControlsProps } from '../../modules/types';
import type { StickmenState } from './types';

const FACING_LABELS: { id: FacingMode; label: string }[] = [
  { id: 'random', label: 'Every which way' },
  { id: 'procession', label: 'All one way (procession)' },
  { id: 'toward', label: 'Toward a direction' },
];

/** Sidebar controls for the Stick Men generator. Primary knobs up top; the
 *  finer scene / figure / finish settings live in Advanced. */
export function StickmenControls({ state, update }: ControlsProps<StickmenState>) {
  const directional = state.facing === 'procession' || state.facing === 'toward';

  return (
    <div className="controls">
      <h3 className="section-title">Stick Men</h3>

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} title="New random crowd">
        <label className="label-text">
          Seed
          <InfoTip text="Every seed is a different crowd — same seed always redraws the same one." />
        </label>
      </SeedControl>

      <Slider
        labelNode={
          <span className="label-text">
            How many
            <InfoTip text="Number of stick men scattered across the ground plane." />
          </span>
        }
        value={state.count}
        min={1}
        max={400}
        step={1}
        onChange={(v) => update({ count: v })}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Pose energy
            <InfoTip text="0 = a calm standing crowd, 1 = lively — arms and legs swing into varied poses." />
          </span>
        }
        value={state.poseEnergy}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ poseEnergy: v })}
        format={(v) => `${Math.round(v * 100)}%`}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Limb roundness
            <InfoTip text="0 = angular hinged limbs, 1 = limbs curve smoothly through the joints." />
          </span>
        }
        value={state.limbCurve}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ limbCurve: v })}
        format={(v) => `${Math.round(v * 100)}%`}
      />

      <Slider
        label="Figure height"
        value={state.figureHeightMm}
        min={5}
        max={40}
        step={0.5}
        onChange={(v) => update({ figureHeightMm: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />

      <Slider label="Zoom" value={state.zoom} min={0.3} max={3} step={0.05} onChange={(v) => update({ zoom: v })} format={(v) => `${v.toFixed(2)}×`} />

      <AdvancedSection>
        <AdvGroup title="Scene">
          <Slider label="Spread" value={state.spread} min={0.4} max={2} step={0.05} onChange={(v) => update({ spread: v })} format={(v) => `${v.toFixed(2)}×`} />
          <Slider label="Clustering" value={state.clustering} min={0} max={1} step={0.05} onChange={(v) => update({ clustering: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Min spacing" value={state.minSeparationMm} min={0} max={20} step={0.5} onChange={(v) => update({ minSeparationMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
        </AdvGroup>

        <AdvGroup title="Figure">
          <Slider label="Height variety" value={state.scaleVariance} min={0} max={0.8} step={0.02} onChange={(v) => update({ scaleVariance: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Pen width" value={state.penWidthMm} min={0.15} max={1} step={0.05} onChange={(v) => update({ penWidthMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
        </AdvGroup>

        <AdvGroup title="Facing">
          <div className="control-group">
            <label className="label-text">Which way they face</label>
            <select value={state.facing} onChange={(e) => update({ facing: e.target.value as FacingMode })}>
              {FACING_LABELS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
          {directional && (
            <>
              <Slider label="Direction" value={state.facingAngleDeg} min={0} max={360} step={5} onChange={(v) => update({ facingAngleDeg: v })} format={(v) => `${v.toFixed(0)}°`} />
              <Slider label="Direction spread" value={state.facingJitterDeg} min={0} max={180} step={5} onChange={(v) => update({ facingJitterDeg: v })} format={(v) => `${v.toFixed(0)}°`} />
            </>
          )}
        </AdvGroup>

        <AdvGroup title="Overlap">
          <Toggle label="Nearer men hide farther men" checked={state.occlude} onChange={(v) => update({ occlude: v })} />
          <Toggle label="Ground contact shadow" checked={state.groundContact} onChange={(v) => update({ groundContact: v })} />
        </AdvGroup>

        <AdvGroup title="Pen & ink">
          <Slider label="Wobble" value={state.wobbleMm} min={0} max={1} step={0.02} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <ColorField label="Ink" value={state.strokeColor} onChange={(v) => update({ strokeColor: v })} />
        </AdvGroup>
      </AdvancedSection>
    </div>
  );
}
