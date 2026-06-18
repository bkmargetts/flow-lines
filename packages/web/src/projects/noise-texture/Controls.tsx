import { InfoTip } from '../../components/InfoTip';
import { PALETTES } from '../../lib/palette';
import { useNoiseTexture } from './context';

/** Sidebar controls for the Noise Texture project. */
export function NoiseTextureControls() {
  const { state, updateState, randomizeSeed, downloadSVG, downloadLayers } = useNoiseTexture();

  return (
    <div className="controls">
      <h3 className="section-title">Swatches</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Lines
            <InfoTip text="How many straight swatch lines are stacked across the page. Each is plotted as a band of overlapped passes." />
          </span>
          <span>{state.lineCount}</span>
        </label>
        <input
          type="range"
          min="1"
          max="40"
          step="1"
          value={state.lineCount}
          onChange={(e) => updateState({ lineCount: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Angle
            <InfoTip text="Orientation of every swatch line. 0° is horizontal." />
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
            <InfoTip text="Swatch length as a fraction of the usable page. Lines are centred and clipped to the margin." />
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

      <h3 className="section-title">Thickness</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Max thickness
            <InfoTip text="Widest the overlapped band swells, in mm. Built from repeated offset passes of the pen — not stroke width — so it stays plottable." />
          </span>
          <span>{state.maxThicknessMm.toFixed(1)}mm</span>
        </label>
        <input
          type="range"
          min="0.5"
          max="30"
          step="0.5"
          value={state.maxThicknessMm}
          onChange={(e) => updateState({ maxThicknessMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Min thickness
            <InfoTip text="Narrowest the band thins to, in mm. The swell between min and max is what gives the swatch its variable weight." />
          </span>
          <span>{state.minThicknessMm.toFixed(1)}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="15"
          step="0.5"
          value={state.minThicknessMm}
          onChange={(e) => updateState({ minThicknessMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Pass spacing
            <InfoTip text="Perpendicular gap between neighbouring offset passes, mm. Tighter packs more overlapping strokes into the band (denser texture)." />
          </span>
          <span>{state.passSpacingMm.toFixed(2)}mm</span>
        </label>
        <input
          type="range"
          min="0.1"
          max="2"
          step="0.05"
          value={state.passSpacingMm}
          onChange={(e) => updateState({ passSpacingMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Thickness variation
            <InfoTip text="Spatial frequency of the noise that drives the swell. Higher makes the band swell and thin more often along its length." />
          </span>
          <span>{state.thicknessNoiseScale.toFixed(3)}</span>
        </label>
        <input
          type="range"
          min="0.001"
          max="0.05"
          step="0.001"
          value={state.thicknessNoiseScale}
          onChange={(e) => updateState({ thicknessNoiseScale: parseFloat(e.target.value) })}
        />
      </div>

      <h3 className="section-title">Colour</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Palette
            <InfoTip text="Passes are grouped into colour bands; each band plots as its own pen. The per-layer SVG export keeps them separate — a genuine multi-pen plot, not a colour trick. 'Mono' maps every band to one ink." />
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
            <InfoTip text="How many ink bands / pen layers the passes split into, sampled from the palette." />
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

      <div className="control-group">
        <label>
          <span className="label-text">
            Colour patches
            <InfoTip text="Spatial frequency of the noise that assigns each pass its colour. Higher breaks the inks into smaller, more mixed patches." />
          </span>
          <span>{state.colorNoiseScale.toFixed(3)}</span>
        </label>
        <input
          type="range"
          min="0.001"
          max="0.08"
          step="0.001"
          value={state.colorNoiseScale}
          onChange={(e) => updateState({ colorNoiseScale: parseFloat(e.target.value) })}
        />
      </div>

      <p className="paint-hint">
        Background colour is the shared <strong>Paper tone</strong> in the Page section.
      </p>

      <h3 className="section-title">Style</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Pen width
            <InfoTip text="Plotted line weight in millimetres. Thin pens let the overlapped passes build texture without going muddy." />
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
            <InfoTip text="Random per-point shake on each pass, mm. A little roughens the overlap so it reads as inked, not printed." />
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
            <InfoTip text="Low-frequency hand-drawn wander of each pass, mm. The passes drift together so the band stays coherent while reading as drawn." />
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
            <InfoTip text="Sets the thickness, colour-patch, jitter and wobble noise. Same seed → identical drawing." />
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
          title="One SVG per colour band, zipped — plot each with a different pen"
        >
          Download layers (.zip)
        </button>
      </div>
    </div>
  );
}
