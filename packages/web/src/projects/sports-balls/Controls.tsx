import type { BallType } from '@flow-lines/core';
import { ColorField } from '../../components/ColorField';
import { InfoTip } from '../../components/InfoTip';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { Slider } from '../../components/controls/Slider';
import { Toggle } from '../../components/controls/Toggle';
import { SeedControl } from '../../components/controls/SeedControl';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { RegionShape, SportsBallsState } from './types';

const BALL_LABELS: { id: BallType; label: string }[] = [
  { id: 'soccer', label: 'Footballs' },
  { id: 'basketball', label: 'Basketballs' },
  { id: 'volleyball', label: 'Volleyballs' },
  { id: 'baseball', label: 'Baseballs' },
  { id: 'tennis', label: 'Tennis balls' },
  { id: 'pingpong', label: 'Ping pong balls' },
];

const SHAPE_LABELS: { id: RegionShape; label: string }[] = [
  { id: 'full', label: 'Whole page' },
  { id: 'ellipse', label: 'Oval' },
  { id: 'ring', label: 'Ring' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'star', label: 'Star' },
  { id: 'heart', label: 'Heart' },
  { id: 'blob', label: 'Blob' },
];

const SHAPES: RegionShape[] = ['full', 'ellipse', 'ring', 'diamond', 'star', 'heart', 'blob'];

/** Roll a whole fresh pile — every scene/ball knob within its slider range.
 *  The ball mix is left alone (which sports are in play is a deliberate
 *  choice); the pen/ink aesthetic prefs too. */
function randomSportsBallsGenome(rng: () => number): Partial<SportsBallsState> {
  // ~40% of rolls confine the pile to a shape (never 'full' via this pick).
  const shaped = rng() < 0.4;
  const shape = SHAPES[1 + Math.floor(rng() * (SHAPES.length - 1))];
  return {
    count: 15 + Math.floor(rng() * 200),
    clustering: Number(rng().toFixed(2)),
    spacingMm: Number((rng() * 20).toFixed(1)),
    ballSizeMm: Number((10 + rng() * 24).toFixed(1)),
    sizeVariance: Number((rng() * 0.5).toFixed(2)),
    trueSizes: Number(rng().toFixed(2)),
    depthGrade: Number((rng() * 0.3).toFixed(2)),
    spin: Number((0.4 + rng() * 0.6).toFixed(2)),
    shading: rng() < 0.5 ? 0 : Number((0.3 + rng() * 0.6).toFixed(2)),
    castShadows: rng() < 0.25 ? 0 : Number((0.25 + rng() * 0.6).toFixed(2)),
    lightAngleDeg: Math.round(rng() * 360),
    regionShape: shaped ? shape : 'full',
    regionSize: Number((0.5 + rng() * 0.45).toFixed(2)),
    regionX: Number((0.35 + rng() * 0.3).toFixed(2)),
    regionY: Number((0.35 + rng() * 0.3).toFixed(2)),
    regionInner: Number((0.3 + rng() * 0.4).toFixed(2)),
    occlude: rng() < 0.9,
  };
}

/** Sidebar controls for the Sports Balls generator. Primary knobs up top; the
 *  finer scene / ball / finish settings live in Advanced. */
export function SportsBallsControls({ state, update }: ControlsProps<SportsBallsState>) {
  const shaped = state.regionShape !== 'full';
  const hasInner = state.regionShape === 'ring' || state.regionShape === 'star';
  const surprise = () => update({ ...randomSportsBallsGenome(Math.random), seed: randomSeed() });
  const setMix = (type: BallType, on: boolean) => update({ mix: { ...state.mix, [type]: on } });

  return (
    <div className="controls">
      <h3 className="section-title">Sports Balls</h3>

      <div className="control-group">
        <button type="button" className="secondary" onClick={surprise} title="Randomize everything" style={{ width: '100%' }}>
          🎲 Randomize everything
        </button>
        <p className="paint-hint">One roll for a whole new pile — or tune anything below.</p>
      </div>

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} title="New random pile">
        <label className="label-text">
          Seed
          <InfoTip text="Every seed is a different pile — same seed always redraws the same one." />
        </label>
      </SeedControl>

      <Slider
        labelNode={
          <span className="label-text">
            Density
            <InfoTip text="How many balls fill the page. Crank it up and the pile packs solid." />
          </span>
        }
        value={state.count}
        min={1}
        max={400}
        step={1}
        onChange={(v) => update({ count: v })}
      />

      <Slider
        label="Ball size"
        value={state.ballSizeMm}
        min={6}
        max={60}
        step={0.5}
        onChange={(v) => update({ ballSizeMm: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />

      <div className="control-group">
        <label className="label-text">
          Ball mix
          <InfoTip text="Which sports are in play. Turn them all off and the whole line-up comes back." />
        </label>
        {BALL_LABELS.map((b) => (
          <Toggle key={b.id} label={b.label} checked={state.mix[b.id]} onChange={(v) => setMix(b.id, v)} />
        ))}
      </div>

      <Slider
        labelNode={
          <span className="label-text">
            Shading
            <InfoTip text="Hatch the shadow side of each ball — one shared light for the whole pile. 0 = pure line art." />
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
            <InfoTip text="Where a nearer ball overlaps a farther one, hatch a shadow crescent along the crossing edge — the pile reads as stacked spheres." />
          </span>
        }
        value={state.castShadows}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ castShadows: v })}
        format={(v) => `${Math.round(v * 100)}%`}
      />

      <div className="control-group">
        <label className="label-text">
          Fill shape
          <InfoTip text="Confine the pile to a shape on the page — or fill the whole sheet." />
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

      <AdvancedSection>
        <AdvGroup title="Scene">
          <Slider label="Clustering" value={state.clustering} min={0} max={1} step={0.05} onChange={(v) => update({ clustering: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider
            labelNode={
              <span className="label-text">
                Min spacing
                <InfoTip text="Soft gap between ball centres. Below the ball size, balls overlap into a pile." />
              </span>
            }
            value={state.spacingMm}
            min={0}
            max={40}
            step={0.5}
            onChange={(v) => update({ spacingMm: v })}
            format={(v) => `${v.toFixed(1)}mm`}
          />
          <Slider
            labelNode={
              <span className="label-text">
                Depth size grading
                <InfoTip text="Balls lower on the page (nearer) grow, higher ones shrink — a perspective cue." />
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
          <AdvGroup title="Fill shape">
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

        <AdvGroup title="Balls">
          <Slider label="Size variety" value={state.sizeVariance} min={0} max={0.8} step={0.02} onChange={(v) => update({ sizeVariance: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider
            labelNode={
              <span className="label-text">
                True sizes
                <InfoTip text="Blend toward real-world relative sizes — a ping pong ball is a fifth of a basketball." />
              </span>
            }
            value={state.trueSizes}
            min={0}
            max={1}
            step={0.02}
            onChange={(v) => update({ trueSizes: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            labelNode={
              <span className="label-text">
                Spin
                <InfoTip text="How much each ball is turned in 3D. 0 = every ball shows its upright face." />
              </span>
            }
            value={state.spin}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update({ spin: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </AdvGroup>

        {(state.shading > 0 || state.castShadows > 0) && (
          <AdvGroup title="Light">
            <Slider label="Light direction" value={state.lightAngleDeg} min={0} max={360} step={5} onChange={(v) => update({ lightAngleDeg: v })} format={(v) => `${v.toFixed(0)}°`} />
          </AdvGroup>
        )}

        <AdvGroup title="Overlap">
          <Toggle label="Hide lines behind nearer balls" checked={state.occlude} onChange={(v) => update({ occlude: v })} />
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
