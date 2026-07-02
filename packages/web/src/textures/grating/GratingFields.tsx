import type { ReactNode } from 'react';
import { InfoTip } from '../../components/InfoTip';
import { EditableValue } from '../../components/EditableValue';
import { PalettePicker } from '../../components/ColorField';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import type { GratingMaskMode, GratingParams } from './shared';

const ALL_MASK_MODES: { id: GratingMaskMode; label: string }[] = [
  { id: 'none', label: 'None (full page)' },
  { id: 'strips', label: 'Diagonal strips' },
  { id: 'band', label: 'Drawn line + band' },
  { id: 'rect', label: 'Rectangle' },
  { id: 'ellipse', label: 'Ellipse' },
];

interface GratingFieldsProps {
  params: GratingParams;
  update: (updates: Partial<GratingParams>) => void;
  /** Which mask modes to offer (the texture module omits the drawn 'band'). */
  maskModes?: GratingMaskMode[];
  /** Project-supplied draw/clear UI shown when the 'band' mask is active. */
  bandControls?: ReactNode;
}

/**
 * The shared grating controls — every generative knob plus the parametric mask
 * picker — used by both the Noise Texture project and the grating background
 * texture. Pen width, downloads and the canvas band-draw stay with the caller.
 */
export function GratingFields({ params, update, maskModes, bandControls }: GratingFieldsProps) {
  const modes = ALL_MASK_MODES.filter((m) => !maskModes || maskModes.includes(m.id));
  return (
    <>
      <h3 className="section-title">Grating</h3>

      <Slider
        labelNode={
          <span className="label-text">
            Spacing
            <InfoTip text="Gap between adjacent lines within one ink, mm. The other inks interleave into this gap, so the combined line pitch is this divided by the number of colours." />
          </span>
        }
        value={params.spacingMm}
        min={0.5}
        max={8}
        step={0.1}
        onChange={(v) => update({ spacingMm: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Angle
            <InfoTip text="Line direction. 0° is vertical (lines run down the page)." />
          </span>
        }
        value={params.angleDeg}
        min={0}
        max={180}
        step={5}
        onChange={(v) => update({ angleDeg: v })}
        format={(v) => `${v}°`}
      />

      <div className="control-group">
        <label>
          <span className="label-text">
            Length
            <InfoTip text="Line length as a fraction of the usable page. Lines are centred and clipped to the margin." />
          </span>
          <EditableValue value={Math.round(params.lineLengthPct * 100)} min={10} max={100} step={5} onChange={(v) => update({ lineLengthPct: v / 100 })}>
            {Math.round(params.lineLengthPct * 100)}%
          </EditableValue>
        </label>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={params.lineLengthPct}
          onChange={(e) => update({ lineLengthPct: parseFloat(e.target.value) })}
        />
      </div>

      <h3 className="section-title">Colour</h3>

      <PalettePicker
        palette={params.palette}
        customRamp={params.customRamp}
        colorCount={params.colorCount}
        onChange={update}
        info="Each ink is an interleaved grating plotted as its own pen. The per-layer SVG export keeps them separate — a genuine multi-pen plot, not a colour trick. 'Mono' maps every ink to one pen; 'Custom…' lets you pick each ink."
      />

      <Slider
        labelNode={
          <span className="label-text">
            Colours (pens)
            <InfoTip text="How many inks interleave. Each is the same grating phase-shifted by spacing ÷ colours so they fill each other's gaps, sampled from the palette." />
          </span>
        }
        value={params.colorCount}
        min={1}
        max={6}
        step={1}
        onChange={(v) => update({ colorCount: v })}
      />

      <h3 className="section-title">Offset drift</h3>

      <Slider
        labelNode={
          <span className="label-text">
            Across block
            <InfoTip text="Gradually alters the inter-colour offset from one side of the block to the other, mm. Lines stay straight while the interleave opens and closes across the page." />
          </span>
        }
        value={params.phaseDriftAcrossMm}
        min={0}
        max={6}
        step={0.1}
        onChange={(v) => update({ phaseDriftAcrossMm: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Along lines
            <InfoTip text="Gradually alters the inter-colour offset down the length of each line, mm. Non-zero bends the lines and weaves the colours along the trajectory." />
          </span>
        }
        value={params.phaseDriftAlongMm}
        min={0}
        max={6}
        step={0.1}
        onChange={(v) => update({ phaseDriftAlongMm: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Noise amount
            <InfoTip text="Drives the inter-colour offset with smooth noise, mm — organic patches where the colours pile up or spread apart." />
          </span>
        }
        value={params.phaseNoiseAmpMm}
        min={0}
        max={4}
        step={0.1}
        onChange={(v) => update({ phaseNoiseAmpMm: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Noise scale
            <InfoTip text="Spatial frequency of the offset noise. Higher breaks the pattern into smaller, busier patches." />
          </span>
        }
        value={params.phaseNoiseScale}
        min={0.001}
        max={0.05}
        step={0.001}
        onChange={(v) => update({ phaseNoiseScale: v })}
        format={(v) => v.toFixed(3)}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Edge smoothing
            <InfoTip text="Relaxes the offset back to a clean even interleave over this distance at the block edges, mm — smooths the ragged silhouette the drift leaves. 0 = off." />
          </span>
        }
        value={params.edgeSmoothMm}
        min={0}
        max={40}
        step={1}
        onChange={(v) => update({ edgeSmoothMm: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />

      <h3 className="section-title">Mask</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Clip to
            <InfoTip text="Restrict the pattern to a shape — it shows inside, blank outside. Combine with a dark paper tone for cut-out lettering or panels." />
          </span>
        </label>
        <select
          value={params.maskMode}
          onChange={(e) => update({ maskMode: e.target.value as GratingMaskMode })}
        >
          {modes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {params.maskMode === 'strips' && (
        <>
          <Slider
            labelNode={<span className="label-text">Strip angle</span>}
            value={params.stripAngleDeg}
            min={0}
            max={180}
            step={5}
            onChange={(v) => update({ stripAngleDeg: v })}
            format={(v) => `${v}°`}
          />
          <Slider
            labelNode={<span className="label-text">Strip width</span>}
            value={params.stripWidthMm}
            min={1}
            max={40}
            step={1}
            onChange={(v) => update({ stripWidthMm: v })}
            format={(v) => `${v.toFixed(0)}mm`}
          />
          <Slider
            labelNode={<span className="label-text">Strip gap</span>}
            value={params.stripGapMm}
            min={0}
            max={40}
            step={1}
            onChange={(v) => update({ stripGapMm: v })}
            format={(v) => `${v.toFixed(0)}mm`}
          />
        </>
      )}

      {params.maskMode === 'band' && (
        <>
          {bandControls}
          <Slider
            labelNode={<span className="label-text">Band width (either side)</span>}
            value={params.bandWidthMm}
            min={1}
            max={60}
            step={1}
            onChange={(v) => update({ bandWidthMm: v })}
            format={(v) => `${v.toFixed(0)}mm`}
          />
        </>
      )}

      {(params.maskMode === 'rect' || params.maskMode === 'ellipse') && (
        <>
          <div className="control-group">
            <label>
              <span className="label-text">Width</span>
              <EditableValue value={Math.round(params.maskWidthPct * 100)} min={10} max={100} step={5} onChange={(v) => update({ maskWidthPct: v / 100 })}>
                {Math.round(params.maskWidthPct * 100)}%
              </EditableValue>
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={params.maskWidthPct}
              onChange={(e) => update({ maskWidthPct: parseFloat(e.target.value) })}
            />
          </div>
          <div className="control-group">
            <label>
              <span className="label-text">Height</span>
              <EditableValue value={Math.round(params.maskHeightPct * 100)} min={10} max={100} step={5} onChange={(v) => update({ maskHeightPct: v / 100 })}>
                {Math.round(params.maskHeightPct * 100)}%
              </EditableValue>
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={params.maskHeightPct}
              onChange={(e) => update({ maskHeightPct: parseFloat(e.target.value) })}
            />
          </div>
        </>
      )}

      <h3 className="section-title">Line style</h3>

      <Slider
        labelNode={
          <span className="label-text">
            Jitter
            <InfoTip text="Random per-point shake on each line, mm. A little roughens the grating so it reads as inked, not printed." />
          </span>
        }
        value={params.jitterMm}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => update({ jitterMm: v })}
        format={(v) => `${v.toFixed(2)}mm`}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Wobble
            <InfoTip text="Low-frequency hand-drawn wander of each line, mm. 0 keeps the lines mechanically straight." />
          </span>
        }
        value={params.wobbleAmpMm}
        min={0}
        max={3}
        step={0.1}
        onChange={(v) => update({ wobbleAmpMm: v })}
        format={(v) => `${v.toFixed(2)}mm`}
      />

      <h3 className="section-title">Seed</h3>

      <SeedControl seed={params.seed} onChange={(seed) => update({ seed })}>
        <label>
          <span className="label-text">
            Seed
            <InfoTip text="Sets the offset noise, jitter and wobble. Same seed → identical pattern." />
          </span>
        </label>
      </SeedControl>
    </>
  );
}
