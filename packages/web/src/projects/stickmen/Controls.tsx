import type { FacingMode, PoseMode } from '@flow-lines/core';
import { ColorField } from '../../components/ColorField';
import { InfoTip } from '../../components/InfoTip';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { Slider } from '../../components/controls/Slider';
import { Toggle } from '../../components/controls/Toggle';
import { SeedControl } from '../../components/controls/SeedControl';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { RegionShape, StickmenState } from './types';

const FACING_LABELS: { id: FacingMode; label: string }[] = [
  { id: 'random', label: 'Every which way' },
  { id: 'procession', label: 'All one way (procession)' },
  { id: 'toward', label: 'Toward a direction' },
];

const FACING_MODES: FacingMode[] = ['random', 'procession', 'toward'];

const SHAPE_LABELS: { id: RegionShape; label: string }[] = [
  { id: 'full', label: 'Full ground' },
  { id: 'ellipse', label: 'Oval' },
  { id: 'ring', label: 'Ring' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'star', label: 'Star' },
  { id: 'heart', label: 'Heart' },
  { id: 'blob', label: 'Blob' },
];

const SHAPES: RegionShape[] = ['full', 'ellipse', 'ring', 'diamond', 'star', 'heart', 'blob'];

const POSE_MODE_LABELS: { id: PoseMode; label: string }[] = [
  { id: 'mixed', label: 'Mixed crowd' },
  { id: 'library', label: 'Doing things (walk, wave…)' },
  { id: 'procedural', label: 'Freeform' },
];

const POSE_MODES: PoseMode[] = ['mixed', 'library', 'procedural'];

/** Roll a whole fresh scene — every scene/figure/pose knob within its slider
 *  range. Limb roundness is biased to the rounded end so a surprise never
 *  lands ugly-angular; the pen/ink/zoom aesthetic prefs are left alone. */
export function randomStickmenGenome(rng: () => number): Partial<StickmenState> {
  // ~40% of rolls confine the crowd to a shape (never 'full' via this pick).
  const shaped = rng() < 0.4;
  const shape = SHAPES[1 + Math.floor(rng() * (SHAPES.length - 1))];
  return {
    count: 40 + Math.floor(rng() * 700),
    poseEnergy: Number(rng().toFixed(2)),
    poseMode: POSE_MODES[Math.floor(rng() * POSE_MODES.length)],
    limbCurve: Number((0.5 + rng() * 0.5).toFixed(2)),
    spread: Number((0.6 + rng() * 1).toFixed(2)),
    clustering: Number(rng().toFixed(2)),
    minSeparationMm: Number((2 + rng() * 8).toFixed(1)),
    scaleVariance: Number((rng() * 0.5).toFixed(2)),
    proportionVariance: Number((rng() * 0.8).toFixed(2)),
    depthGrade: Number((rng() * 0.3).toFixed(2)),
    figureHeightMm: Number((16 + rng() * 16).toFixed(1)),
    facing: FACING_MODES[Math.floor(rng() * FACING_MODES.length)],
    facingAngleDeg: Math.round(rng() * 360),
    facingJitterDeg: Math.round(rng() * 180),
    regionShape: shaped ? shape : 'full',
    regionSize: Number((0.5 + rng() * 0.45).toFixed(2)),
    regionX: Number((0.35 + rng() * 0.3).toFixed(2)),
    regionY: Number((0.35 + rng() * 0.3).toFixed(2)),
    regionInner: Number((0.3 + rng() * 0.4).toFixed(2)),
    occlude: rng() < 0.85,
    groundContact: rng() < 0.3,
  };
}

/** Sidebar controls for the Stick Men generator. Primary knobs up top; the
 *  finer scene / figure / finish settings live in Advanced. */
export function StickmenControls({ state, update }: ControlsProps<StickmenState>) {
  const directional = state.facing === 'procession' || state.facing === 'toward';
  const shaped = state.regionShape !== 'full';
  const hasInner = state.regionShape === 'ring' || state.regionShape === 'star';
  const surprise = () => update({ ...randomStickmenGenome(Math.random), seed: randomSeed() });

  return (
    <div className="controls">
      <h3 className="section-title">Stick Men</h3>

      <RandomiseButton onClick={surprise} hint="One roll for a whole new crowd — or tune anything below." />

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} title="New random crowd">
        <label className="label-text">
          Seed
          <InfoTip text="Every seed is a different crowd — same seed always redraws the same one." />
        </label>
      </SeedControl>

      <Slider
        labelNode={
          <span className="label-text">
            Density
            <InfoTip text="How many stick men pack the ground. Crank it right up to saturate the whole ground plane." />
          </span>
        }
        value={state.count}
        min={1}
        max={3000}
        step={1}
        onChange={(v) => update({ count: v })}
      />

      <div className="control-group">
        <label className="label-text">
          Crowd shape
          <InfoTip text="Confine the crowd to a shape on the page — or fill the whole ground." />
        </label>
        <select value={state.regionShape} onChange={(e) => update({ regionShape: e.target.value as RegionShape })}>
          {SHAPE_LABELS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {shaped && (
        <Slider
          label="Shape size"
          value={state.regionSize}
          min={0.15}
          max={1}
          step={0.01}
          onChange={(v) => update({ regionSize: v })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      )}

      <div className="control-group">
        <label className="label-text">
          Pose style
          <InfoTip text="Mixed crowd = people walking, waving and cheering among figures milling about. Freeform = the classic anything-goes poses." />
        </label>
        <select value={state.poseMode} onChange={(e) => update({ poseMode: e.target.value as PoseMode })}>
          {POSE_MODE_LABELS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

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
          {!shaped && (
            <Slider label="Spread" value={state.spread} min={0.4} max={2} step={0.05} onChange={(v) => update({ spread: v })} format={(v) => `${v.toFixed(2)}×`} />
          )}
          <Slider label="Clustering" value={state.clustering} min={0} max={1} step={0.05} onChange={(v) => update({ clustering: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Min spacing" value={state.minSeparationMm} min={0} max={20} step={0.5} onChange={(v) => update({ minSeparationMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
          <Slider
            labelNode={
              <span className="label-text">
                Depth size grading
                <InfoTip text="Nearer figures grow, farther ones shrink — a perspective cue on top of the isometric view." />
              </span>
            }
            value={state.depthGrade}
            min={0}
            max={0.5}
            step={0.01}
            onChange={(v) => update({ depthGrade: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </AdvGroup>

        {shaped && (
          <AdvGroup title="Crowd shape">
            <Slider label="Position X" value={state.regionX} min={0} max={1} step={0.01} onChange={(v) => update({ regionX: v })} format={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="Position Y" value={state.regionY} min={0} max={1} step={0.01} onChange={(v) => update({ regionY: v })} format={(v) => `${Math.round(v * 100)}%`} />
            {hasInner && (
              <Slider
                label={state.regionShape === 'ring' ? 'Hole size' : 'Point depth'}
                value={state.regionInner}
                min={0.1}
                max={0.9}
                step={0.01}
                onChange={(v) => update({ regionInner: v })}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            )}
          </AdvGroup>
        )}

        <AdvGroup title="Figure">
          <Slider label="Height variety" value={state.scaleVariance} min={0} max={0.8} step={0.02} onChange={(v) => update({ scaleVariance: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider
            labelNode={
              <span className="label-text">
                Body variety
                <InfoTip text="Vary each figure's build — leggy or stocky, longer arms, bigger heads, broader shoulders." />
              </span>
            }
            value={state.proportionVariance}
            min={0}
            max={1}
            step={0.02}
            onChange={(v) => update({ proportionVariance: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
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
          <Toggle label="Hide limbs behind nearer heads" checked={state.occlude} onChange={(v) => update({ occlude: v })} />
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
