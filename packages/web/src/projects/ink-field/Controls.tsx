import { InfoTip } from '../../components/InfoTip';
import { PalettePicker } from '../../components/ColorField';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { InkFieldState, InkFieldStyle, WearOrder } from './types';

function labelWithTip(label: string, info?: string) {
  return (
    <span className="label-text">
      {label}
      {info && <InfoTip text={info} />}
    </span>
  );
}

const STYLE_LABELS: Record<InkFieldStyle, string> = {
  ribbon: 'Ribbon — drafted band, braided inks',
  lattice: 'Lattice — colour planes in one grid',
  stripes: 'Stripes — drifting colour bands',
};

const WEAR_LABELS: Record<WearOrder, string> = {
  none: 'Off (least pen travel)',
  sweep: 'Sweep — along a direction',
  centerOut: 'Centre outward',
  centerIn: 'Edges inward',
};

/** Roll a fresh field — style, geometry and ink-separation physics land inside
 *  their slider ranges. The inks/palette, pen prefs, pen-test dots, blend
 *  preview and wear order are left alone. Exported for the genome test. */
export function randomInkFieldGenome(rng: () => number): Partial<InkFieldState> {
  const styles: InkFieldStyle[] = ['ribbon', 'lattice', 'stripes'];
  return {
    style: styles[Math.floor(rng() * styles.length)],
    pitchMm: Number((0.5 + 0.1 * Math.floor(rng() * 16)).toFixed(1)),
    angleDeg: 15 * Math.floor(rng() * 13),
    inkPhase: (10 + 5 * Math.floor(rng() * 15)) / 100,
    inkPitchDelta: Number((0.01 * Math.floor(rng() * 9)).toFixed(2)),
    phaseDrift: Number((0.2 * Math.floor(rng() * 16)).toFixed(1)),
    misregisterMm: Number((0.1 * Math.floor(rng() * 11)).toFixed(1)),
    wobbleAmpMm: Number((0.05 * Math.floor(rng() * 7)).toFixed(2)),
    bandWidthMm: 10 + 2 * Math.floor(rng() * 31),
    ribbonSegments: 3 + Math.floor(rng() * 5),
    planeCount: 1 + Math.floor(rng() * 4),
    insetPatches: Math.floor(rng() * 3),
    baseDensity: (25 + 5 * Math.floor(rng() * 11)) / 100,
    planeDensity: (70 + 5 * Math.floor(rng() * 7)) / 100,
    stripeCount: 3 + Math.floor(rng() * 14),
    stripeSoftness: (10 + 5 * Math.floor(rng() * 15)) / 100,
    stripeBlocks: rng() < 0.4,
    blockDuty: (30 + 5 * Math.floor(rng() * 9)) / 100,
  };
}

export function InkFieldControls({ state, update }: ControlsProps<InkFieldState>) {
  const u = update;
  const surprise = () => u({ ...randomInkFieldGenome(Math.random), seed: randomSeed() });

  return (
    <div className="controls">
      <RandomiseButton
        onClick={surprise}
        hint="Roll a fresh field — style, band geometry and ink separation; your inks and pen stay."
      />

      <PresetPicker
        label="Style"
        info="Ribbon: one drafted band, every ink drawing all of it. Lattice: colour planes carried by density inside one grid. Stripes: colour bands drifting along the strokes."
        labels={STYLE_LABELS}
        value={state.style}
        onChange={(style) => u({ style })}
      />

      <h3 className="section-title">Inks</h3>
      <PalettePicker
        palette={state.palette}
        customRamp={state.customRamp}
        colorCount={state.colorCount}
        onChange={u}
        info="Each ink is its own pen layer (band-NN) for multi-pen plotting."
      />
      <Slider
        labelNode={labelWithTip('Inks', 'Pens in the field — each plots as its own layer.')}
        value={state.colorCount}
        min={1}
        max={4}
        step={1}
        onChange={(v) => u({ colorCount: v })}
      />
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={state.blendInks}
          onChange={(e) => u({ blendInks: e.target.checked })}
        />
        Blend inks in preview (overprint)
      </label>

      <h3 className="section-title">Field</h3>
      <Slider
        labelNode={labelWithTip('Line pitch', 'Gap between neighbouring lines within one ink.')}
        value={state.pitchMm}
        min={0.4}
        max={2}
        step={0.1}
        onChange={(v) => u({ pitchMm: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />
      {state.style === 'ribbon' ? (
        <>
          <Slider
            labelNode={labelWithTip('Band width')}
            value={state.bandWidthMm}
            min={10}
            max={70}
            step={1}
            onChange={(v) => u({ bandWidthMm: v })}
            format={(v) => `${v}mm`}
          />
          <Slider
            labelNode={labelWithTip('Segments', 'Drafted path complexity — straight runs between filleted corners.')}
            value={state.ribbonSegments}
            min={2}
            max={8}
            step={1}
            onChange={(v) => u({ ribbonSegments: v })}
          />
        </>
      ) : (
        <Slider
          labelNode={labelWithTip('Angle', 'Stroke direction; 0 runs the lines down the page.')}
          value={state.angleDeg}
          min={0}
          max={180}
          step={5}
          onChange={(v) => u({ angleDeg: v })}
          format={(v) => `${v}°`}
        />
      )}

      {state.style === 'lattice' && (
        <>
          <Slider
            labelNode={labelWithTip('Colour planes', 'Large committed masses — wedges and rectangles — carried purely by ink density.')}
            value={state.planeCount}
            min={0}
            max={4}
            step={1}
            onChange={(v) => u({ planeCount: v })}
          />
          <Slider
            labelNode={labelWithTip('Light patches', 'Near-paper inset rectangles punched out of the field.')}
            value={state.insetPatches}
            min={0}
            max={2}
            step={1}
            onChange={(v) => u({ insetPatches: v })}
          />
          <Slider
            labelNode={labelWithTip('Field density')}
            value={Math.round(state.baseDensity * 100)}
            min={10}
            max={80}
            step={5}
            onChange={(v) => u({ baseDensity: v / 100 })}
            format={(v) => `${v}%`}
          />
          <Slider
            labelNode={labelWithTip('Plane density')}
            value={Math.round(state.planeDensity * 100)}
            min={50}
            max={100}
            step={5}
            onChange={(v) => u({ planeDensity: v / 100 })}
            format={(v) => `${v}%`}
          />
        </>
      )}

      {state.style === 'stripes' && (
        <>
          <Slider
            labelNode={labelWithTip('Stripes', 'Colour bands along the stroke direction.')}
            value={state.stripeCount}
            min={2}
            max={16}
            step={1}
            onChange={(v) => u({ stripeCount: v })}
          />
          <Slider
            labelNode={labelWithTip('Softness', 'How far neighbouring bands bleed into each other.')}
            value={Math.round(state.stripeSoftness * 100)}
            min={10}
            max={80}
            step={5}
            onChange={(v) => u({ stripeSoftness: v / 100 })}
            format={(v) => `${v}%`}
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={state.stripeBlocks}
              onChange={(e) => u({ stripeBlocks: e.target.checked })}
            />
            Hard blocks (ruled dark/light bands)
          </label>
          {state.stripeBlocks && (
            <Slider
              labelNode={labelWithTip('Block duty', 'Dark fraction of each block period.')}
              value={Math.round(state.blockDuty * 100)}
              min={30}
              max={70}
              step={5}
              onChange={(v) => u({ blockDuty: v / 100 })}
              format={(v) => `${v}%`}
            />
          )}
        </>
      )}

      <h3 className="section-title">Ink separation</h3>
      <Slider
        labelNode={labelWithTip('Ink phase', 'Lateral offset between successive inks, as a fraction of the pitch.')}
        value={Math.round(state.inkPhase * 100)}
        min={0}
        max={80}
        step={5}
        onChange={(v) => u({ inkPhase: v / 100 })}
        format={(v) => `${v}%`}
      />
      {state.style === 'ribbon' && (
        <>
          <Slider
            labelNode={labelWithTip('Vernier', 'Pitch differential between inks — the beat that braids the foreground colour along the band.')}
            value={Math.round(state.inkPitchDelta * 100)}
            min={0}
            max={8}
            step={1}
            onChange={(v) => u({ inkPitchDelta: v / 100 })}
            format={(v) => `${v}%`}
          />
          <Slider
            labelNode={labelWithTip('Drift', 'Slides each ink along the band, moving the braid.')}
            value={state.phaseDrift}
            min={0}
            max={3}
            step={0.1}
            onChange={(v) => u({ phaseDrift: v })}
            format={(v) => v.toFixed(1)}
          />
        </>
      )}
      <Slider
        labelNode={labelWithTip('Misregistration', 'Whole-ink offset between pen passes — the paper never re-registers perfectly.')}
        value={state.misregisterMm}
        min={0}
        max={1}
        step={0.1}
        onChange={(v) => u({ misregisterMm: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />

      <AdvancedSection>
        <AdvGroup title="Line character">
          <Slider
            labelNode={labelWithTip('Wobble')}
            value={state.wobbleAmpMm}
            min={0}
            max={0.3}
            step={0.05}
            onChange={(v) => u({ wobbleAmpMm: v })}
            format={(v) => `${v.toFixed(2)}mm`}
          />
          <Slider
            labelNode={labelWithTip('Jitter')}
            value={state.jitterMm}
            min={0}
            max={0.2}
            step={0.05}
            onChange={(v) => u({ jitterMm: v })}
            format={(v) => `${v.toFixed(2)}mm`}
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={state.penTests}
              onChange={(e) => u({ penTests: e.target.checked })}
            />
            Pen-test dots in the margin
          </label>
        </AdvGroup>
        <AdvGroup title="Plot order (wear)">
          <PresetPicker
            label="Wear order"
            info="Pen wear follows stroke order. A spatial ramp turns pencil dulling or fountain-pen depletion into a composed gradient across the sheet — at the cost of pen travel."
            labels={WEAR_LABELS}
            value={state.wearOrder}
            onChange={(wearOrder) => u({ wearOrder })}
          />
          <Slider
            labelNode={labelWithTip('Sweep angle', '0° plots top to bottom, 90° left to right.')}
            value={state.wearAngleDeg}
            min={0}
            max={180}
            step={15}
            onChange={(v) => u({ wearAngleDeg: v })}
            format={(v) => `${v}°`}
            disabled={state.wearOrder !== 'sweep'}
          />
        </AdvGroup>
        <AdvGroup title="Pen">
          <Slider
            labelNode={labelWithTip('Pen width')}
            value={state.penWidthMm}
            min={0.1}
            max={1}
            step={0.05}
            onChange={(v) => u({ penWidthMm: v })}
            format={(v) => `${v.toFixed(2)}mm`}
          />
          <Slider
            labelNode={labelWithTip('Min segment', 'Drop fragments shorter than this.')}
            value={state.minSegmentLengthMm}
            min={0}
            max={5}
            step={0.5}
            onChange={(v) => u({ minSegmentLengthMm: v })}
            format={(v) => `${v.toFixed(1)}mm`}
          />
        </AdvGroup>
      </AdvancedSection>

      <h3 className="section-title">Seed</h3>
      <SeedControl seed={state.seed} onChange={(seed) => u({ seed })} />
    </div>
  );
}
