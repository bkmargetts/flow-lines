import { ColorField } from '../../components/ColorField';
import { InfoTip } from '../../components/InfoTip';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { Slider } from '../../components/controls/Slider';
import { SeedControl } from '../../components/controls/SeedControl';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { TanglesState } from './types';

/** Roll a whole fresh tangle — material, every scene/mark knob within its
 *  slider range. Pen/ink aesthetic prefs are left alone. */
export function randomTanglesGenome(rng: () => number): Partial<TanglesState> {
  const radiusMinMm = Number((2 + rng() * 4).toFixed(1));
  return {
    material: rng() < 0.35 ? ('lace' as const) : ('hose' as const),
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
    twists: Number((rng() * 0.9).toFixed(2)),
  };
}

/** Sidebar controls for the Tangles generator. Primary knobs up top; the
 *  finer pile / ring / finish settings live in Advanced. */
export function TanglesControls({ state, update }: ControlsProps<TanglesState>) {
  const surprise = () => update({ ...randomTanglesGenome(Math.random), seed: randomSeed() });
  const lace = state.material === 'lace';

  return (
    <div className="controls">
      <h3 className="section-title">Tangles</h3>

      <RandomiseButton
        onClick={surprise}
        hint="One roll for a whole new tangle — or tune anything below."
      />

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} title="New random tangle">
        <label className="label-text">
          Seed
          <InfoTip text="Every seed worms a different tangle — same seed always redraws the same one." />
        </label>
      </SeedControl>

      <div className="control-group">
        <label className="label-text">
          Material
          <InfoTip text="What the tangle is made of: corrugated vent hoses, or flat shoelaces with twist flips and aglet tips." />
        </label>
        <select
          value={state.material}
          onChange={(e) => update({ material: e.target.value as TanglesState['material'] })}
        >
          <option value="hose">Vent hoses</option>
          <option value="lace">Shoelaces</option>
        </select>
      </div>

      <Slider
        labelNode={
          <span className="label-text">
            Strands
            <InfoTip text="How many strands worm across the page." />
          </span>
        }
        value={state.count}
        min={1}
        max={16}
        step={1}
        onChange={(v) => update({ count: v })}
      />

      <Slider
        label="Thinnest strand"
        value={state.radiusMinMm}
        min={2}
        max={8}
        step={0.5}
        onChange={(v) => update({ radiusMinMm: v, radiusMaxMm: Math.max(v, state.radiusMaxMm) })}
        format={(v) => `${v.toFixed(1)}mm`}
      />

      <Slider
        label="Fattest strand"
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

      {!lace && (
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
      )}

      {lace && (
        <Slider
          labelNode={
            <span className="label-text">
              Twists
              <InfoTip text="How often a lace turns over — the flat ribbon pinches into a bow-tie flip." />
            </span>
          }
          value={state.twists}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => update({ twists: v })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      )}

      <AdvancedSection>
        <AdvGroup title="Pile">
          <Slider
            labelNode={
              <span className="label-text">
                Open ends
                <InfoTip text="Chance a strand end terminates on-page — a hose gets an open cuff mouth, a lace gets an aglet tip — instead of running off the frame." />
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
                <InfoTip text="Extra paper kept between strands running side by side." />
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
                <InfoTip text="0 weaves strictly over-under-over like a basket; higher lets fat strands simply lie on top of thinner ones." />
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
          {!lace && (
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
          )}
          {!lace && (
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
          )}
          <Slider
            labelNode={
              <span className="label-text">
                Contact shadows
                <InfoTip text="Short cross-ticks where a strand emerges from under another — the pile reads as stacked." />
              </span>
            }
            value={state.shadowHatch}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update({ shadowHatch: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          {((!lace && state.shading > 0) || state.shadowHatch > 0) && (
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
                <InfoTip text="Reserved paper around a strand where another passes beneath it — the sliver that makes over/under read." />
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
