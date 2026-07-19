import type { TextureStyle } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';
import { InfoTip } from '../../components/InfoTip';
import { EditableValue } from '../../components/EditableValue';
import { ColorField } from '../../components/ColorField';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import type { ControlsProps } from '../../modules/types';
import type { ClassicParams } from './types';

const TEXTURE_STYLES: Array<{ id: TextureStyle; label: string }> = [
  { id: 'hatch', label: 'Hatch' },
  { id: 'grid', label: 'Grid' },
  { id: 'stipple', label: 'Stipple' },
  { id: 'contours', label: 'Contours' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'dashes', label: 'Dashes' },
];

const TEXTURE_INKS = ['#c9c2b4', '#b06a3c', '#5b6e7a', '#9aa0a6', '#1a1a1a'];

/** Roll fresh values for every knob the current style shows — the style itself
 *  and the ink colour are the user's choices and stay put. Ranges sit inside
 *  the slider bounds, biased away from the extremes so a surprise never lands
 *  unreadably dense or nearly blank. */
export function randomClassicGenome(
  style: TextureStyle,
  rng: () => number
): Partial<ClassicParams> {
  const genome: Partial<ClassicParams> = {};
  if (style === 'hatch' || style === 'grid' || style === 'stipple' || style === 'shapes' || style === 'dashes') {
    genome.spacingMm = Number((2 + rng() * 8).toFixed(1));
  }
  if (style === 'hatch' || style === 'grid' || style === 'shapes' || style === 'dashes') {
    genome.angleDeg = Math.round(rng() * 180);
  }
  if (style === 'hatch') {
    genome.crossHatch = rng() < 0.35;
  }
  if (style === 'stipple' || style === 'contours') {
    genome.density = Number((0.2 + rng() * 0.7).toFixed(2));
  }
  if (style !== 'shapes' && style !== 'dashes') {
    genome.scale = Number((0.4 + rng() * 2).toFixed(2));
  }
  if (style !== 'grid') {
    genome.jitter = Number((rng() * 0.8).toFixed(2));
  }
  if (style === 'shapes') {
    const kinds = ['square', 'circle', 'line'] as const;
    genome.shapes = {
      kind: kinds[Math.floor(rng() * kinds.length)],
      sizeMm: Number((2 + rng() * 10).toFixed(1)),
      overlap: Number((rng() * 0.7).toFixed(2)),
    };
  }
  if (style === 'dashes') {
    genome.dashes = {
      dashLengthMm: Number((2 + rng() * 12).toFixed(1)),
      gapMm: Number((1 + rng() * 6).toFixed(1)),
      wobbleMm: Number((rng() * 1).toFixed(2)),
      curvatureMm: Number((rng() * 2.5).toFixed(1)),
      sparsity: Number((rng() * 0.6).toFixed(2)),
      flowDeg: Math.round(rng() * 60),
      turbulence: Number((rng() * 0.8).toFixed(2)),
      gradient: Number(((rng() - 0.5) * 1.6).toFixed(2)),
    };
  }
  return genome;
}

/** Controls for the classic single-pen texture styles. */
export function ClassicControls({ state, update }: ControlsProps<ClassicParams>) {
  const surprise = () =>
    update({ ...randomClassicGenome(state.style, Math.random), seed: randomSeed() });

  return (
    <>
      <div className="control-group">
        <label>Style</label>
        <select
          value={state.style}
          onChange={(e) => update({ style: e.target.value as TextureStyle })}
        >
          {TEXTURE_STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <RandomiseButton onClick={surprise} hint="One roll for a fresh take on this style — or tune anything below." />

      {(state.style === 'hatch' ||
        state.style === 'grid' ||
        state.style === 'stipple' ||
        state.style === 'shapes' ||
        state.style === 'dashes') && (
        <Slider
          label="Spacing"
          value={state.spacingMm}
          min={1}
          max={12}
          step={0.5}
          onChange={(v) => update({ spacingMm: v })}
          format={(v) => `${v.toFixed(1)}mm`}
        />
      )}

      {(state.style === 'hatch' ||
        state.style === 'grid' ||
        state.style === 'shapes' ||
        state.style === 'dashes') && (
        <Slider
          label="Angle"
          value={state.angleDeg}
          min={0}
          max={180}
          step={1}
          onChange={(v) => update({ angleDeg: v })}
          format={(v) => `${v}°`}
        />
      )}

      {state.style === 'hatch' && (
        <div className="control-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={state.crossHatch}
              onChange={(e) => update({ crossHatch: e.target.checked })}
            />
            Cross-hatch
          </label>
        </div>
      )}

      {(state.style === 'stipple' || state.style === 'contours') && (
        <Slider
          label="Density"
          value={state.density}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ density: v })}
          format={(v) => v.toFixed(2)}
        />
      )}

      {state.style !== 'shapes' && state.style !== 'dashes' && (
        <Slider
          label={state.style === 'contours' ? 'Scale' : 'Mark size'}
          value={state.scale}
          min={0.2}
          max={3}
          step={0.1}
          onChange={(v) => update({ scale: v })}
          format={(v) => v.toFixed(2)}
        />
      )}

      {state.style !== 'grid' && (
        <Slider
          label="Jitter"
          value={state.jitter}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ jitter: v })}
          format={(v) => v.toFixed(2)}
        />
      )}

      {state.style === 'shapes' && (
        <div className="control-group">
          <label>Shape</label>
          <div className="segmented">
            {(['square', 'circle', 'line'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={state.shapes.kind === k ? 'active' : ''}
                onClick={() => update({ shapes: { ...state.shapes, kind: k } })}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}

      {state.style === 'shapes' && (
        <Slider
          label="Shape size"
          value={state.shapes.sizeMm}
          min={1}
          max={20}
          step={0.5}
          onChange={(v) => update({ shapes: { ...state.shapes, sizeMm: v } })}
          format={(v) => `${v.toFixed(1)}mm`}
        />
      )}

      {state.style === 'shapes' && (
        <div className="control-group">
          <label>
            Overlap{" "}
            <EditableValue value={state.shapes.overlap} min={0} max={0.9} step={0.05} onChange={(v) => update({ shapes: { ...state.shapes, overlap: v } })}>
              {state.shapes.overlap.toFixed(2)}
            </EditableValue>
            <InfoTip text="Compresses the lattice below the spacing so shapes overlap. 0 keeps them on the spacing grid; higher packs them together." />
          </label>
          <input
            type="range"
            min="0"
            max="0.9"
            step="0.05"
            value={state.shapes.overlap}
            onChange={(e) => update({ shapes: { ...state.shapes, overlap: parseFloat(e.target.value) } })}
          />
        </div>
      )}

      {state.style === 'dashes' && (
        <>
          <Slider
            label="Dash length"
            value={state.dashes.dashLengthMm}
            min={1}
            max={20}
            step={0.5}
            onChange={(v) => update({ dashes: { ...state.dashes, dashLengthMm: v } })}
            format={(v) => `${v.toFixed(1)}mm`}
          />
          <Slider
            label="Gap"
            value={state.dashes.gapMm}
            min={0.5}
            max={15}
            step={0.5}
            onChange={(v) => update({ dashes: { ...state.dashes, gapMm: v } })}
            format={(v) => `${v.toFixed(1)}mm`}
          />
          <Slider
            label="Wobble"
            value={state.dashes.wobbleMm}
            min={0}
            max={2}
            step={0.05}
            onChange={(v) => update({ dashes: { ...state.dashes, wobbleMm: v } })}
            format={(v) => `${v.toFixed(2)}mm`}
          />
          <Slider
            label="Curvature"
            value={state.dashes.curvatureMm}
            min={0}
            max={4}
            step={0.1}
            onChange={(v) => update({ dashes: { ...state.dashes, curvatureMm: v } })}
            format={(v) => `${v.toFixed(1)}mm`}
          />
          <Slider
            labelNode={
              <span className="label-text">
                Sparsity
                <InfoTip text="Noise-gated dropout — coverage thins in organic hand-sized patches rather than uniformly." />
              </span>
            }
            value={state.dashes.sparsity}
            min={0}
            max={0.9}
            step={0.05}
            onChange={(v) => update({ dashes: { ...state.dashes, sparsity: v } })}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            labelNode={
              <span className="label-text">
                Flow
                <InfoTip text="Dash direction drifts across the page following a slow noise field — like wind-combed grass. 0 keeps every dash on the base angle; the value is the maximum drift." />
              </span>
            }
            value={state.dashes.flowDeg ?? 0}
            min={0}
            max={90}
            step={1}
            onChange={(v) => update({ dashes: { ...state.dashes, flowDeg: v } })}
            format={(v) => `${v}°`}
          />
          <Slider
            labelNode={
              <span className="label-text">
                Turbulence
                <InfoTip text="Calm patches of long, even dashes against choppy patches of short, dense, agitated ones. 0 keeps the sheet uniform." />
              </span>
            }
            value={state.dashes.turbulence ?? 0}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => update({ dashes: { ...state.dashes, turbulence: v } })}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            labelNode={
              <span className="label-text">
                Gradient
                <InfoTip text="Sweeps dash length down the page — positive grows toward the bottom, negative toward the top, 0 is even." />
              </span>
            }
            value={state.dashes.gradient ?? 0}
            min={-1}
            max={1}
            step={0.05}
            onChange={(v) => update({ dashes: { ...state.dashes, gradient: v } })}
            format={(v) => v.toFixed(2)}
          />
        </>
      )}

      <div className="control-group">
        <label>Texture ink</label>
        <div className="paper-swatches">
          {TEXTURE_INKS.map((ink) => (
            <button
              key={ink}
              type="button"
              className={`paper-swatch ${state.color === ink ? 'active' : ''}`}
              title={ink}
              aria-label={ink}
              style={{ background: ink }}
              onClick={() => update({ color: ink })}
            />
          ))}
        </div>
      </div>
      <ColorField label="Texture ink (custom)" value={state.color} onChange={(color) => update({ color })} />

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} title="New texture seed">
        <label>Texture seed</label>
      </SeedControl>
    </>
  );
}
