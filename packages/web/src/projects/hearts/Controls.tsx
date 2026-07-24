import type { HeartStyle } from '@flow-lines/core';
import { ColorField } from '../../components/ColorField';
import { InfoTip } from '../../components/InfoTip';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { Slider } from '../../components/controls/Slider';
import { Toggle } from '../../components/controls/Toggle';
import { SeedControl } from '../../components/controls/SeedControl';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { RegionShape, HeartsState } from './types';

const STYLE_LABELS: { id: HeartStyle; label: string }[] = [
  { id: 'outline', label: 'Outlined' },
  { id: 'solid', label: 'Solid (nested)' },
  { id: 'hatched', label: 'Hatched' },
  { id: 'broken', label: 'Broken' },
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

/** Roll a whole fresh shower of hearts — every scene/heart knob within its
 *  slider range. The style mix is left alone (which looks are in play is a
 *  deliberate choice); the pen/ink aesthetic prefs too. */
export function randomHeartsGenome(rng: () => number): Partial<HeartsState> {
  // ~40% of rolls confine the shower to a shape (never 'full' via this pick).
  const shaped = rng() < 0.4;
  const shape = SHAPES[1 + Math.floor(rng() * (SHAPES.length - 1))];
  return {
    count: 15 + Math.floor(rng() * 200),
    clustering: Number(rng().toFixed(2)),
    spacingMm: Number((rng() * 20).toFixed(1)),
    heartSizeMm: Number((8 + rng() * 22).toFixed(1)),
    sizeVariance: Number((rng() * 0.5).toFixed(2)),
    depthGrade: Number((rng() * 0.3).toFixed(2)),
    plumpness: Number((0.2 + rng() * 0.6).toFixed(2)),
    plumpVariance: Number((rng() * 0.5).toFixed(2)),
    tilt: Number((rng() * 0.8).toFixed(2)),
    age: rng() < 0.7 ? 18 : 3 + Math.floor(rng() * 16),
    fillDensity: Number((0.25 + rng() * 0.6).toFixed(2)),
    hatchAngleDeg: Math.round((rng() * 2 - 1) * 60),
    hatchJitter: Number((rng() * 0.7).toFixed(2)),
    arrows: rng() < 0.5 ? 0 : Number((rng() * 0.5).toFixed(2)),
    boldOutline: Number((rng() * 0.7).toFixed(2)),
    shading: rng() < 0.5 ? 0 : Number((0.3 + rng() * 0.6).toFixed(2)),
    lightAngleDeg: Math.round(rng() * 360),
    regionShape: shaped ? shape : 'full',
    regionSize: Number((0.5 + rng() * 0.45).toFixed(2)),
    regionX: Number((0.35 + rng() * 0.3).toFixed(2)),
    regionY: Number((0.35 + rng() * 0.3).toFixed(2)),
    regionInner: Number((0.3 + rng() * 0.4).toFixed(2)),
    regionSoftEdge: rng() < 0.3,
    occlude: rng() < 0.9,
  };
}

/** Sidebar controls for the Hearts generator. Primary knobs up top; the
 *  finer scene / heart / finish settings live in Advanced. */
export function HeartsControls({ state, update }: ControlsProps<HeartsState>) {
  const shaped = state.regionShape !== 'full';
  const hasInner = state.regionShape === 'ring' || state.regionShape === 'star';
  const surprise = () => update({ ...randomHeartsGenome(Math.random), seed: randomSeed() });
  const setMix = (style: HeartStyle, on: boolean) => update({ mix: { ...state.mix, [style]: on } });

  return (
    <div className="controls">
      <h3 className="section-title">Hearts</h3>

      <RandomiseButton onClick={surprise} hint="One roll for a whole new shower of hearts — or tune anything below." />

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} title="New random shower">
        <label className="label-text">
          Seed
          <InfoTip text="Every seed is a different shower — same seed always redraws the same one." />
        </label>
      </SeedControl>

      <Slider
        labelNode={
          <span className="label-text">
            Density
            <InfoTip text="How many hearts fill the page. Crank it up and they pack into a pile." />
          </span>
        }
        value={state.count}
        min={1}
        max={300}
        step={1}
        onChange={(v) => update({ count: v })}
      />

      <Slider
        label="Heart size"
        value={state.heartSizeMm}
        min={6}
        max={50}
        step={0.5}
        onChange={(v) => update({ heartSizeMm: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Plumpness
            <InfoTip text="The heart shape itself — low is tall and pointy, high is wide and chubby." />
          </span>
        }
        value={state.plumpness}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ plumpness: v })}
        format={(v) => `${Math.round(v * 100)}%`}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Artist age
            <InfoTip text="Who's holding the pen — young kids draw simpler hearts: a few straight strokes, lopsided lobes, scribbled-in colour, no shading, outlines that don't quite close. 18 is today's practised adult hand." />
          </span>
        }
        value={state.age}
        min={3}
        max={18}
        step={1}
        onChange={(v) => update({ age: v })}
        format={(v) => (v >= 18 ? '18 (adult)' : `${v.toFixed(0)} yrs`)}
      />

      <div className="control-group">
        <label className="label-text">
          Heart styles
          <InfoTip text="Which looks are in the mix. Turn them all off and the whole set comes back." />
        </label>
        {STYLE_LABELS.map((s) => (
          <Toggle key={s.id} label={s.label} checked={state.mix[s.id]} onChange={(v) => setMix(s.id, v)} />
        ))}
      </div>

      <Slider
        labelNode={
          <span className="label-text">
            Shading
            <InfoTip text="Hatch a band along the shadow side of each heart — one shared light for the whole shower. 0 = pure line art." />
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
            Cupid's arrows
            <InfoTip text="The share of hearts pierced by an arrow — shaft hidden behind the heart, barbs and fletching showing." />
          </span>
        }
        value={state.arrows}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ arrows: v })}
        format={(v) => `${Math.round(v * 100)}%`}
      />

      <div className="control-group">
        <label className="label-text">
          Fill shape
          <InfoTip text="Confine the shower to a shape on the page — or fill the whole sheet." />
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
                <InfoTip text="Soft gap between heart centres. Below the heart size, hearts overlap into a pile." />
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
                <InfoTip text="Hearts lower on the page (nearer) grow, higher ones shrink — a perspective cue." />
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
            <Toggle
              label="Soft edge (hearts poke past the outline)"
              checked={state.regionSoftEdge}
              onChange={(v) => update({ regionSoftEdge: v })}
            />
          </AdvGroup>
        )}

        <AdvGroup title="Hearts">
          <Slider label="Size variety" value={state.sizeVariance} min={0} max={0.8} step={0.02} onChange={(v) => update({ sizeVariance: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider
            labelNode={
              <span className="label-text">
                Plump variety
                <InfoTip text="How much each heart's shape strays from the plumpness above." />
              </span>
            }
            value={state.plumpVariance}
            min={0}
            max={0.6}
            step={0.02}
            onChange={(v) => update({ plumpVariance: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            labelNode={
              <span className="label-text">
                Tilt
                <InfoTip text="How far hearts lean off upright. 0 = every heart stands straight." />
              </span>
            }
            value={state.tilt}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update({ tilt: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            labelNode={
              <span className="label-text">
                Bold outlines
                <InfoTip text="The share of hearts drawn with extra outline passes — same pen, more commitment." />
              </span>
            }
            value={state.boldOutline}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update({ boldOutline: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </AdvGroup>

        <AdvGroup title="Fill & hatch">
          <Slider
            labelNode={
              <span className="label-text">
                Fill density
                <InfoTip text="Line spacing of the solid and hatched fills — high is tight, inky hearts." />
              </span>
            }
            value={state.fillDensity}
            min={0.1}
            max={1}
            step={0.01}
            onChange={(v) => update({ fillDensity: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider label="Hatch angle" value={state.hatchAngleDeg} min={-90} max={90} step={1} onChange={(v) => update({ hatchAngleDeg: v })} format={(v) => `${v.toFixed(0)}°`} />
          <Slider label="Hatch jitter" value={state.hatchJitter} min={0} max={1} step={0.01} onChange={(v) => update({ hatchJitter: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </AdvGroup>

        {state.shading > 0 && (
          <AdvGroup title="Light">
            <Slider label="Light direction" value={state.lightAngleDeg} min={0} max={360} step={5} onChange={(v) => update({ lightAngleDeg: v })} format={(v) => `${v.toFixed(0)}°`} />
          </AdvGroup>
        )}

        <AdvGroup title="Overlap">
          <Toggle label="Hide lines behind nearer hearts" checked={state.occlude} onChange={(v) => update({ occlude: v })} />
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
