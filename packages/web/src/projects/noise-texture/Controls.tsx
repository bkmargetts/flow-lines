import { InfoTip } from '../../components/InfoTip';
import { PALETTES } from '../../lib/palette';
import { useNoiseTexture } from './context';

/** Sidebar controls for the Noise Texture project. */
export function NoiseTextureControls() {
  const { state, updateState, randomizeSeed, downloadSVG, downloadLayers } = useNoiseTexture();

  return (
    <div className="controls">
      <h3 className="section-title">Grating</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Spacing
            <InfoTip text="Gap between adjacent lines within one ink, mm. The other inks interleave into this gap, so the combined line pitch is this divided by the number of colours." />
          </span>
          <span>{state.spacingMm.toFixed(1)}mm</span>
        </label>
        <input
          type="range"
          min="0.5"
          max="8"
          step="0.1"
          value={state.spacingMm}
          onChange={(e) => updateState({ spacingMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Angle
            <InfoTip text="Line direction. 0° is vertical (lines run down the page)." />
          </span>
          <span>{state.angleDeg}°</span>
        </label>
        <input
          type="range"
          min="0"
          max="180"
          step="5"
          value={state.angleDeg}
          onChange={(e) => updateState({ angleDeg: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Length
            <InfoTip text="Line length as a fraction of the usable page. Lines are centred and clipped to the margin." />
          </span>
          <span>{Math.round(state.lineLengthPct * 100)}%</span>
        </label>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={state.lineLengthPct}
          onChange={(e) => updateState({ lineLengthPct: parseFloat(e.target.value) })}
        />
      </div>

      <h3 className="section-title">Colour</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Palette
            <InfoTip text="Each ink is an interleaved grating plotted as its own pen. The per-layer SVG export keeps them separate — a genuine multi-pen plot, not a colour trick. 'Mono' maps every ink to one pen." />
          </span>
        </label>
        <select value={state.palette} onChange={(e) => updateState({ palette: e.target.value })}>
          {PALETTES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Colours (pens)
            <InfoTip text="How many inks interleave. Each is the same grating phase-shifted by spacing ÷ colours so they fill each other's gaps, sampled from the palette." />
          </span>
          <span>{state.colorCount}</span>
        </label>
        <input
          type="range"
          min="1"
          max="6"
          step="1"
          value={state.colorCount}
          onChange={(e) => updateState({ colorCount: parseInt(e.target.value, 10) })}
        />
      </div>

      <p className="paint-hint">
        Background colour is the shared <strong>Paper tone</strong> in the Page section.
      </p>

      <h3 className="section-title">Offset drift</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Across block
            <InfoTip text="Gradually alters the inter-colour offset from one side of the block to the other, mm. Lines stay straight while the interleave opens and closes across the page — the colours weave between coincident and evenly spread." />
          </span>
          <span>{state.phaseDriftAcrossMm.toFixed(1)}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="6"
          step="0.1"
          value={state.phaseDriftAcrossMm}
          onChange={(e) => updateState({ phaseDriftAcrossMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Along lines
            <InfoTip text="Gradually alters the inter-colour offset down the length of each line, mm. Non-zero bends the lines and weaves the colours along the trajectory." />
          </span>
          <span>{state.phaseDriftAlongMm.toFixed(1)}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="6"
          step="0.1"
          value={state.phaseDriftAlongMm}
          onChange={(e) => updateState({ phaseDriftAlongMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Noise amount
            <InfoTip text="Drives the inter-colour offset with smooth noise, mm — organic patches where the colours pile up or spread apart." />
          </span>
          <span>{state.phaseNoiseAmpMm.toFixed(1)}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="4"
          step="0.1"
          value={state.phaseNoiseAmpMm}
          onChange={(e) => updateState({ phaseNoiseAmpMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Noise scale
            <InfoTip text="Spatial frequency of the offset noise. Higher breaks the pattern into smaller, busier patches." />
          </span>
          <span>{state.phaseNoiseScale.toFixed(3)}</span>
        </label>
        <input
          type="range"
          min="0.001"
          max="0.05"
          step="0.001"
          value={state.phaseNoiseScale}
          onChange={(e) => updateState({ phaseNoiseScale: parseFloat(e.target.value) })}
        />
      </div>

      <h3 className="section-title">Style</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Pen width
            <InfoTip text="Plotted line weight in millimetres. Thin pens keep the interleaved grating crisp." />
          </span>
          <span>{state.penWidthMm.toFixed(2)}mm</span>
        </label>
        <input
          type="range"
          min="0.05"
          max="0.8"
          step="0.05"
          value={state.penWidthMm}
          onChange={(e) => updateState({ penWidthMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Jitter
            <InfoTip text="Random per-point shake on each line, mm. A little roughens the grating so it reads as inked, not printed." />
          </span>
          <span>{state.jitterMm.toFixed(2)}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.jitterMm}
          onChange={(e) => updateState({ jitterMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Wobble
            <InfoTip text="Low-frequency hand-drawn wander of each line, mm. 0 keeps the lines mechanically straight." />
          </span>
          <span>{state.wobbleAmpMm.toFixed(2)}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="3"
          step="0.1"
          value={state.wobbleAmpMm}
          onChange={(e) => updateState({ wobbleAmpMm: parseFloat(e.target.value) })}
        />
      </div>

      <h3 className="section-title">Seed</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Seed
            <InfoTip text="Sets the offset noise, jitter and wobble. Same seed → identical drawing." />
          </span>
        </label>
        <div className="seed-input">
          <input
            type="number"
            value={state.seed}
            onChange={(e) => updateState({ seed: parseInt(e.target.value, 10) || 0 })}
          />
          <button type="button" className="secondary" onClick={randomizeSeed} title="New random seed">
            🎲
          </button>
        </div>
      </div>

      <div className="button-group">
        <button type="button" className="primary" onClick={downloadSVG}>
          Download SVG
        </button>
        <button
          type="button"
          className="secondary"
          onClick={downloadLayers}
          title="One SVG per colour, zipped — plot each with a different pen"
        >
          Download layers (.zip)
        </button>
      </div>
    </div>
  );
}
