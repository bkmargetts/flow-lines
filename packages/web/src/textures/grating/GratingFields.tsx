import type { ReactNode } from 'react';
import { InfoTip } from '../../components/InfoTip';
import { PalettePicker } from '../../components/ColorField';
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

      <div className="control-group">
        <label>
          <span className="label-text">
            Spacing
            <InfoTip text="Gap between adjacent lines within one ink, mm. The other inks interleave into this gap, so the combined line pitch is this divided by the number of colours." />
          </span>
          <span>{params.spacingMm.toFixed(1)}mm</span>
        </label>
        <input
          type="range"
          min="0.5"
          max="8"
          step="0.1"
          value={params.spacingMm}
          onChange={(e) => update({ spacingMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Angle
            <InfoTip text="Line direction. 0° is vertical (lines run down the page)." />
          </span>
          <span>{params.angleDeg}°</span>
        </label>
        <input
          type="range"
          min="0"
          max="180"
          step="5"
          value={params.angleDeg}
          onChange={(e) => update({ angleDeg: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Length
            <InfoTip text="Line length as a fraction of the usable page. Lines are centred and clipped to the margin." />
          </span>
          <span>{Math.round(params.lineLengthPct * 100)}%</span>
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

      <div className="control-group">
        <label>
          <span className="label-text">
            Colours (pens)
            <InfoTip text="How many inks interleave. Each is the same grating phase-shifted by spacing ÷ colours so they fill each other's gaps, sampled from the palette." />
          </span>
          <span>{params.colorCount}</span>
        </label>
        <input
          type="range"
          min="1"
          max="6"
          step="1"
          value={params.colorCount}
          onChange={(e) => update({ colorCount: parseInt(e.target.value, 10) })}
        />
      </div>

      <h3 className="section-title">Offset drift</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Across block
            <InfoTip text="Gradually alters the inter-colour offset from one side of the block to the other, mm. Lines stay straight while the interleave opens and closes across the page." />
          </span>
          <span>{params.phaseDriftAcrossMm.toFixed(1)}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="6"
          step="0.1"
          value={params.phaseDriftAcrossMm}
          onChange={(e) => update({ phaseDriftAcrossMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Along lines
            <InfoTip text="Gradually alters the inter-colour offset down the length of each line, mm. Non-zero bends the lines and weaves the colours along the trajectory." />
          </span>
          <span>{params.phaseDriftAlongMm.toFixed(1)}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="6"
          step="0.1"
          value={params.phaseDriftAlongMm}
          onChange={(e) => update({ phaseDriftAlongMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Noise amount
            <InfoTip text="Drives the inter-colour offset with smooth noise, mm — organic patches where the colours pile up or spread apart." />
          </span>
          <span>{params.phaseNoiseAmpMm.toFixed(1)}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="4"
          step="0.1"
          value={params.phaseNoiseAmpMm}
          onChange={(e) => update({ phaseNoiseAmpMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Noise scale
            <InfoTip text="Spatial frequency of the offset noise. Higher breaks the pattern into smaller, busier patches." />
          </span>
          <span>{params.phaseNoiseScale.toFixed(3)}</span>
        </label>
        <input
          type="range"
          min="0.001"
          max="0.05"
          step="0.001"
          value={params.phaseNoiseScale}
          onChange={(e) => update({ phaseNoiseScale: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Edge smoothing
            <InfoTip text="Relaxes the offset back to a clean even interleave over this distance at the block edges, mm — smooths the ragged silhouette the drift leaves. 0 = off." />
          </span>
          <span>{params.edgeSmoothMm.toFixed(1)}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="40"
          step="1"
          value={params.edgeSmoothMm}
          onChange={(e) => update({ edgeSmoothMm: parseFloat(e.target.value) })}
        />
      </div>

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
          <div className="control-group">
            <label>
              <span className="label-text">Strip angle</span>
              <span>{params.stripAngleDeg}°</span>
            </label>
            <input
              type="range"
              min="0"
              max="180"
              step="5"
              value={params.stripAngleDeg}
              onChange={(e) => update({ stripAngleDeg: parseInt(e.target.value, 10) })}
            />
          </div>
          <div className="control-group">
            <label>
              <span className="label-text">Strip width</span>
              <span>{params.stripWidthMm.toFixed(0)}mm</span>
            </label>
            <input
              type="range"
              min="1"
              max="40"
              step="1"
              value={params.stripWidthMm}
              onChange={(e) => update({ stripWidthMm: parseFloat(e.target.value) })}
            />
          </div>
          <div className="control-group">
            <label>
              <span className="label-text">Strip gap</span>
              <span>{params.stripGapMm.toFixed(0)}mm</span>
            </label>
            <input
              type="range"
              min="0"
              max="40"
              step="1"
              value={params.stripGapMm}
              onChange={(e) => update({ stripGapMm: parseFloat(e.target.value) })}
            />
          </div>
        </>
      )}

      {params.maskMode === 'band' && (
        <>
          {bandControls}
          <div className="control-group">
            <label>
              <span className="label-text">Band width (either side)</span>
              <span>{params.bandWidthMm.toFixed(0)}mm</span>
            </label>
            <input
              type="range"
              min="1"
              max="60"
              step="1"
              value={params.bandWidthMm}
              onChange={(e) => update({ bandWidthMm: parseFloat(e.target.value) })}
            />
          </div>
        </>
      )}

      {(params.maskMode === 'rect' || params.maskMode === 'ellipse') && (
        <>
          <div className="control-group">
            <label>
              <span className="label-text">Width</span>
              <span>{Math.round(params.maskWidthPct * 100)}%</span>
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
              <span>{Math.round(params.maskHeightPct * 100)}%</span>
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

      <div className="control-group">
        <label>
          <span className="label-text">
            Jitter
            <InfoTip text="Random per-point shake on each line, mm. A little roughens the grating so it reads as inked, not printed." />
          </span>
          <span>{params.jitterMm.toFixed(2)}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={params.jitterMm}
          onChange={(e) => update({ jitterMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Wobble
            <InfoTip text="Low-frequency hand-drawn wander of each line, mm. 0 keeps the lines mechanically straight." />
          </span>
          <span>{params.wobbleAmpMm.toFixed(2)}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="3"
          step="0.1"
          value={params.wobbleAmpMm}
          onChange={(e) => update({ wobbleAmpMm: parseFloat(e.target.value) })}
        />
      </div>

      <h3 className="section-title">Seed</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Seed
            <InfoTip text="Sets the offset noise, jitter and wobble. Same seed → identical pattern." />
          </span>
        </label>
        <div className="seed-input">
          <input
            type="number"
            value={params.seed}
            onChange={(e) => update({ seed: parseInt(e.target.value, 10) || 0 })}
          />
          <button
            type="button"
            className="secondary"
            title="New random seed"
            onClick={() => update({ seed: Math.floor(Math.random() * 1000000) })}
          >
            🎲
          </button>
        </div>
      </div>
    </>
  );
}
