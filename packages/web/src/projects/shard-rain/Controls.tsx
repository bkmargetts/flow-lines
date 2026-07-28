import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import { Toggle } from '../../components/controls/Toggle';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import { INK_PALETTES, SHARD_RAIN_LOOKS, type ShardRainLook } from './presets';
import { randomShardRainGenome, type ShardRainState } from './types';

const LAYOUT_LABELS: Record<ShardRainState['layout'], string> = {
  mosaic: 'Mosaic',
  grid: 'Grid',
  frame: 'Frame',
  bars: 'Bars',
};

const LOOK_LABELS = Object.fromEntries(
  Object.entries(SHARD_RAIN_LOOKS).map(([id, l]) => [id, l.label])
) as Record<ShardRainLook, string>;

const PANE_LABELS: Record<ShardRainState['paneShape'], string> = {
  slab: 'Slab',
  disc: 'Disc',
};

const INK_MODE_LABELS: Record<ShardRainState['inkMode'], string> = {
  regions: 'Swaths',
  damage: 'Follows damage',
};

const PALETTE_LABELS = Object.fromEntries(
  Object.entries(INK_PALETTES).map(([id, p]) => [id, p.label])
) as Record<string, string>;

/** A colour the next added pen probably wants — cycles through hues the
 *  current set doesn't have yet. */
const NEXT_INKS = ['#c8102e', '#f2b705', '#2c7a5b', '#7a4ba8', '#e2571b', '#26282e'];

const FILL_STYLE_LABELS: Record<ShardRainState['fillStyle'], string> = {
  texture: 'Textures',
  none: 'None',
  hatch: 'Hatch',
  concentric: 'Concentric',
};

/** Sidebar controls for Shard Rain: place the pins by seed or draw them on
 *  the canvas, then scrub the moment the falling plate is frozen at. */
export function ShardRainControls({ state, update }: ControlsProps<ShardRainState>) {
  return (
    <div className="controls">
      <h3 className="section-title">Shard Rain</h3>

      <RandomiseButton
        onClick={() => update({ ...randomShardRainGenome(Math.random), seed: randomSeed() })}
        hint="One roll for a fresh plate and drop — your drawn pins and inks stay."
      />

      <div className="control-group">
        <div className="paint-controls">
          <button
            type="button"
            className={state.drawMode ? 'primary active' : 'primary'}
            onClick={() => update({ drawMode: !state.drawMode })}
          >
            {state.drawMode ? 'Stop drawing' : 'Draw pins'}
          </button>
          {state.maskPath.length > 0 && (
            <button type="button" className="secondary" onClick={() => update({ maskPath: [] })}>
              Clear ({state.maskPath.length})
            </button>
          )}
        </div>
        <p className="paint-hint">
          {state.drawMode
            ? 'Drag below the plate to place the invisible pins it lands on.'
            : 'Tap “Draw pins”, then drag under the plate. Clear to go back to seeded pins.'}
        </p>
      </div>

      <PresetPicker
        label="Look"
        info="Where in the drop the pen freezes — each look retunes the knobs below."
        labels={LOOK_LABELS}
        value={state.look}
        onChange={(look) => update({ ...SHARD_RAIN_LOOKS[look].state, look })}
      />

      <PresetPicker
        label="Plate"
        info="The shape of the dropped plate — a floating slab or a disc."
        labels={PANE_LABELS}
        value={state.paneShape}
        onChange={(paneShape) => update({ paneShape })}
      />

      <PresetPicker
        label="Layout"
        info="Grid packs the plate; Frame keeps a border band; Bars stacks tall columns."
        labels={LAYOUT_LABELS}
        value={state.layout}
        onChange={(layout) => update({ layout })}
      />

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} />

      <Slider label="Moment" value={state.moment} min={0} max={1} step={0.01} onChange={(v) => update({ moment: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Plate size" value={state.paneScale} min={0.2} max={0.7} step={0.01} onChange={(v) => update({ paneScale: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Cell size" value={state.cellSizeMm} min={3} max={20} step={0.5} onChange={(v) => update({ cellSizeMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <Slider label="Pins" value={state.impacts} min={0} max={12} step={1} onChange={(v) => update({ impacts: v })} format={(v) => `${Math.round(v)}`} disabled={state.maskPath.length > 0} />
      <Slider label="Pin spread" value={state.pinSpread} min={0} max={1} step={0.01} onChange={(v) => update({ pinSpread: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.maskPath.length > 0} />
      <Slider label="Strike radius" value={state.impactRadiusMm} min={10} max={70} step={1} onChange={(v) => update({ impactRadiusMm: v })} format={(v) => `${Math.round(v)}mm`} />
      <Slider label="Energy" value={state.energy} min={0} max={1} step={0.01} onChange={(v) => update({ energy: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Crush" value={state.crush} min={0} max={1} step={0.01} onChange={(v) => update({ crush: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Shatter" value={state.shatter} min={0} max={1} step={0.01} onChange={(v) => update({ shatter: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Fill" value={state.fill} min={0} max={1} step={0.01} onChange={(v) => update({ fill: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Tone range" value={state.toneRange} min={0} max={1} step={0.01} onChange={(v) => update({ toneRange: v })} format={(v) => `${Math.round(v * 100)}%`} />

      <AdvancedSection>
        <AdvGroup title="Plate character">
          <Slider label="Granularity" value={state.granularity} min={0} max={1} step={0.01} onChange={(v) => update({ granularity: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.layout !== 'mosaic'} />
          <Slider label="Size variation" value={state.sizeVariation} min={0} max={1} step={0.01} onChange={(v) => update({ sizeVariation: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Position jitter" value={state.positionJitter} min={0} max={1} step={0.01} onChange={(v) => update({ positionJitter: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Rotation jitter" value={state.rotationJitter} min={0} max={1} step={0.01} onChange={(v) => update({ rotationJitter: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Gap" value={state.gap} min={0} max={0.6} step={0.01} onChange={(v) => update({ gap: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Frame depth" value={state.frameDepth} min={1} max={6} step={1} onChange={(v) => update({ frameDepth: v })} format={(v) => `${Math.round(v)}`} disabled={state.layout !== 'frame'} />
        </AdvGroup>
        <AdvGroup title="The fall">
          <Slider label="Scatter" value={state.scatter} min={0} max={1} step={0.01} onChange={(v) => update({ scatter: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Tilt" value={state.tilt} min={0} max={1} step={0.01} onChange={(v) => update({ tilt: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Debris" value={state.debris} min={0} max={1} step={0.01} onChange={(v) => update({ debris: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Sag" value={state.sag} min={0} max={1} step={0.01} onChange={(v) => update({ sag: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Radius variation" value={state.radiusVariation} min={0} max={1} step={0.01} onChange={(v) => update({ radiusVariation: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </AdvGroup>
        <AdvGroup title="Marks">
          <PresetPicker label="Fill style" labels={FILL_STYLE_LABELS} value={state.fillStyle} onChange={(fillStyle) => update({ fillStyle })} />
          <PresetPicker label="Ink mode" labels={INK_MODE_LABELS} value={state.inkMode} onChange={(inkMode) => update({ inkMode })} />
          <Slider label="Ink balance" value={state.inkBalance} min={0} max={1} step={0.01} onChange={(v) => update({ inkBalance: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Toggle label="Mark pins" checked={state.markImpacts} onChange={(markImpacts) => update({ markImpacts })} />
          <Toggle label="Hide covered lines" checked={state.occlude} onChange={(occlude) => update({ occlude })} />
          <Slider label="Wobble" value={state.wobbleMm} min={0} max={1} step={0.01} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
        </AdvGroup>
      </AdvancedSection>

      <Slider label="Pen width" value={state.penWidthMm} min={0.05} max={0.8} step={0.05} onChange={(v) => update({ penWidthMm: v })} format={(v) => `${v.toFixed(2)}mm`} />

      <PresetPicker
        label="Ink palette"
        info="A named pen set — as many pens as the palette carries. Edit any ink to go custom."
        labels={state.palette === 'custom' ? { ...PALETTE_LABELS, custom: 'Custom' } : PALETTE_LABELS}
        value={state.palette}
        onChange={(palette) => {
          const pal = INK_PALETTES[palette];
          if (pal) update({ palette, inkColors: [...pal.inks], pathColor: pal.path });
        }}
      />

      {state.inkColors.map((c, i) => (
        <div className="ink-row" key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <ColorField
              label={`Ink ${i + 1}`}
              value={c}
              onChange={(next) => {
                const inkColors = state.inkColors.slice();
                inkColors[i] = next;
                update({ inkColors, palette: 'custom' });
              }}
            />
          </div>
          {state.inkColors.length > 1 && (
            <button
              type="button"
              className="secondary"
              title="Remove this pen"
              onClick={() =>
                update({
                  inkColors: state.inkColors.filter((_, j) => j !== i),
                  palette: 'custom',
                })
              }
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        onClick={() =>
          update({
            inkColors: [
              ...state.inkColors,
              NEXT_INKS.find((c) => !state.inkColors.includes(c)) ?? '#26282e',
            ],
            palette: 'custom',
          })
        }
      >
        + Add ink
      </button>

      <ColorField label="Target ink" value={state.pathColor} onChange={(pathColor) => update({ pathColor })} />
    </div>
  );
}
