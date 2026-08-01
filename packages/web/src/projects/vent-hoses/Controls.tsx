import { ColorField } from '../../components/ColorField';
import { InfoTip } from '../../components/InfoTip';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { Slider } from '../../components/controls/Slider';
import { SeedControl } from '../../components/controls/SeedControl';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { VentHosesState } from './types';

/** Roll a whole fresh pile of ducts — every scene/mark knob within its
 *  slider range. Pen/ink aesthetic prefs are left alone. */
export function randomVentHosesGenome(rng: () => number): Partial<VentHosesState> {
  const radiusMinMm = Number((2 + rng() * 4).toFixed(1));
  return {
    count: 3 + Math.floor(rng() * 9),
    radiusMinMm,
    radiusMaxMm: Number((radiusMinMm + 1.5 + rng() * (12 - radiusMinMm)).toFixed(1)),
    wander: Number((0.2 + rng() * 0.75).toFixed(2)),
    cuffChance: rng() < 0.3 ? 0 : Number((rng() * 0.7).toFixed(2)),
    clearanceMm: Number((rng() * 3).toFixed(1)),
    ringDensity: Number((0.35 + rng() * 0.6).toFixed(2)),
    ringCurve: Number((0.3 + rng() * 0.7).toFixed(2)),
    shading: rng() < 0.3 ? 0 : Number((0.25 + rng() * 0.6).toFixed(2)),
    lightAngleDeg: Math.round(rng() * 360),
    shadowHatch: rng() < 0.2 ? 0 : Number((0.3 + rng() * 0.6).toFixed(2)),
    weaveBias: Number((rng() * 0.8).toFixed(2)),
  };
}

/** Sidebar controls for the Vent Hoses generator. Primary knobs up top; the
 *  finer pile / ring / finish settings live in Advanced. */
export function VentHosesControls({ state, update }: ControlsProps<VentHosesState>) {
  const surprise = () => update({ ...randomVentHosesGenome(Math.random), seed: randomSeed() });

  return (
    <div className="controls">
      <h3 className="section-title">Vent Hoses</h3>

      <RandomiseButton
        onClick={surprise}
        hint="One roll for a whole new pile of ducts — or tune anything below."
      />

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} title="New random pile">
        <label className="label-text">
          Seed
          <InfoTip text="Every seed worms a different pile — same seed always redraws the same one." />
        </label>
      </SeedControl>

      <Slider
        labelNode={
          <span className="label-text">
            Hoses
            <InfoTip text="How many ducts worm across the page." />
          </span>
        }
        value={state.count}
        min={1}
        max={16}
        step={1}
        onChange={(v) => update({ count: v })}
      />

      <Slider
        label="Thinnest hose"
        value={state.radiusMinMm}
        min={2}
        max={8}
        step={0.5}
        onChange={(v) => update({ radiusMinMm: v, radiusMaxMm: Math.max(v, state.radiusMaxMm) })}
        format={(v) => `${v.toFixed(1)}mm`}
      />

      <Slider
        label="Fattest hose"
        value={state.radiusMaxMm}
        min={3}
        max={14}
        step={0.5}
        onChange={(v) => update({ radiusMaxMm: v, radiusMinMm: Math.min(v, state.radiusMinMm) })}
        format={(v) => `${v.toFixed(1)}mm`}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Wander
            <InfoTip text="How hard the hoses worm — gentle drifts at 0, tight coiling curls at 1." />
          </span>
        }
        value={state.wander}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ wander: v })}
        format={(v) => `${Math.round(v * 100)}%`}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Ring density
            <InfoTip text="Corrugation pitch. Rings space in proportion to each hose's diameter, so thick and thin read as the same material." />
          </span>
        }
        value={state.ringDensity}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ ringDensity: v })}
        format={(v) => `${Math.round(v * 100)}%`}
      />

      <AdvancedSection>
        <AdvGroup title="Pile">
          <Slider
            labelNode={
              <span className="label-text">
                Open ends
                <InfoTip text="Chance a hose end terminates on-page with an open cuff mouth instead of running off the frame." />
              </span>
            }
            value={state.cuffChance}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update({ cuffChance: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            labelNode={
              <span className="label-text">
                Clearance
                <InfoTip text="Extra paper kept between hoses running side by side." />
              </span>
            }
            value={state.clearanceMm}
            min={0}
            max={5}
            step={0.1}
            onChange={(v) => update({ clearanceMm: v })}
            format={(v) => `${v.toFixed(1)}mm`}
          />
          <Slider
            labelNode={
              <span className="label-text">
                Gravity bias
                <InfoTip text="0 weaves strictly over-under-over like a basket; higher lets fat ducts simply lie on top of thinner ones." />
              </span>
            }
            value={state.weaveBias}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update({ weaveBias: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </AdvGroup>

        <AdvGroup title="Rings & shading">
          <Slider
            labelNode={
              <span className="label-text">
                Ring curve
                <InfoTip text="How much each corrugation ring bulges along the tube — the wrap-the-cylinder cue. 0 = flat ticks." />
              </span>
            }
            value={state.ringCurve}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update({ ringCurve: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            labelNode={
              <span className="label-text">
                Shading
                <InfoTip text="Longitudinal hatch hugging each hose's shadow side, in hand-sized patches. 0 = pure line art." />
              </span>
            }
            value={state.shading}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update({ shading: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            labelNode={
              <span className="label-text">
                Contact shadows
                <InfoTip text="Short cross-ticks where a hose emerges from under another — the pile reads as stacked tubes." />
              </span>
            }
            value={state.shadowHatch}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update({ shadowHatch: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          {(state.shading > 0 || state.shadowHatch > 0) && (
            <Slider
              label="Light direction"
              value={state.lightAngleDeg}
              min={0}
              max={360}
              step={5}
              onChange={(v) => update({ lightAngleDeg: v })}
              format={(v) => `${v.toFixed(0)}°`}
            />
          )}
          <Slider
            labelNode={
              <span className="label-text">
                Crossing gap
                <InfoTip text="Reserved paper around a hose where another passes beneath it — the sliver that makes over/under read." />
              </span>
            }
            value={state.gapMm}
            min={0.2}
            max={2.5}
            step={0.1}
            onChange={(v) => update({ gapMm: v })}
            format={(v) => `${v.toFixed(1)}mm`}
          />
        </AdvGroup>

        <AdvGroup title="Pen & ink">
          <Slider label="Pen width" value={state.penWidthMm} min={0.15} max={1} step={0.05} onChange={(v) => update({ penWidthMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <Slider label="Wobble" value={state.wobbleMm} min={0} max={1} step={0.02} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <ColorField label="Ink" value={state.strokeColor} onChange={(v) => update({ strokeColor: v })} />
        </AdvGroup>
      </AdvancedSection>
    </div>
  );
}
