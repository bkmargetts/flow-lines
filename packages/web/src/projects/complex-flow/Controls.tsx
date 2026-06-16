import { InfoTip } from '../../components/InfoTip';
import { PALETTES } from '../../lib/palette';
import { useComplexFlow } from './context';
import type { SingularityLayout, SeedLayout, LayerBy } from '@flow-lines/core';

const SINGULARITY_LAYOUTS: { id: SingularityLayout; label: string }[] = [
  { id: 'ring', label: 'Ring' },
  { id: 'grid', label: 'Grid' },
  { id: 'parabola', label: 'Parabola' },
  { id: 'random', label: 'Random' },
];

const SEED_LAYOUTS: { id: SeedLayout; label: string }[] = [
  { id: 'multiRing', label: 'Concentric rings' },
  { id: 'rings', label: 'Single ring' },
  { id: 'random', label: 'Random' },
  { id: 'lines', label: 'Scan lines' },
  { id: 'grid', label: 'Grid' },
];

const LAYER_BY: { id: LayerBy; label: string }[] = [
  { id: 'seedBand', label: 'Seed band' },
  { id: 'speed', label: 'Flow speed' },
  { id: 'angle', label: 'Flow angle' },
];

/** Sidebar controls for the Complex Flow project. */
export function ComplexFlowControls() {
  const {
    state,
    updateState,
    randomizeSeed,
    togglePlaceMode,
    clearSingularities,
    downloadSVG,
    downloadLayers,
  } = useComplexFlow();

  const manualCount = state.manualZeros.length + state.manualPoles.length;

  return (
    <div className="controls">
      <h3 className="section-title">Field</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Zeros (sinks/sources)
            <InfoTip text="Numerator roots of f(z)=Π(z-zero)/Π(z-pole). The flow streams out of (or into) each zero — they read as the bright centres the streamlines spiral around." />
          </span>
          <span>{state.zeroCount}</span>
        </label>
        <input
          type="range"
          min="0"
          max="8"
          step="1"
          value={state.zeroCount}
          onChange={(e) => updateState({ zeroCount: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Poles (saddles)
            <InfoTip text="Denominator roots of f(z). The flow curves around each pole like a saddle, the structural counterweight to the zeros." />
          </span>
          <span>{state.poleCount}</span>
        </label>
        <input
          type="range"
          min="0"
          max="8"
          step="1"
          value={state.poleCount}
          onChange={(e) => updateState({ poleCount: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">Zero arrangement</span>
        </label>
        <select
          value={state.zeroLayout}
          onChange={(e) => updateState({ zeroLayout: e.target.value as SingularityLayout })}
        >
          {SINGULARITY_LAYOUTS.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">Pole arrangement</span>
        </label>
        <select
          value={state.poleLayout}
          onChange={(e) => updateState({ poleLayout: e.target.value as SingularityLayout })}
        >
          {SINGULARITY_LAYOUTS.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Spread
            <InfoTip text="How far the zeros and poles sit from the centre. Tight spreads knot the flow into a dense core; wide spreads spread the topology across the page." />
          </span>
          <span>{state.singularitySpread.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={state.singularitySpread}
          onChange={(e) => updateState({ singularitySpread: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Field rotation
            <InfoTip text="Spin the whole vector field. At 90° sources become swirls (the flow circulates instead of radiating), so it's a quick way to turn explosions into vortices." />
          </span>
          <span>{state.fieldRotationDeg}°</span>
        </label>
        <input
          type="range"
          min="0"
          max="360"
          step="5"
          value={state.fieldRotationDeg}
          onChange={(e) => updateState({ fieldRotationDeg: parseInt(e.target.value, 10) })}
        />
      </div>

      <h3 className="section-title">Place singularities</h3>

      <div className="control-group">
        <div className="paint-controls">
          <button
            type="button"
            className={state.placeMode ? 'primary active' : 'primary'}
            onClick={togglePlaceMode}
          >
            {state.placeMode ? 'Stop placing' : 'Tap to place'}
          </button>
          {manualCount > 0 && (
            <button type="button" className="secondary" onClick={clearSingularities}>
              Clear ({manualCount})
            </button>
          )}
        </div>
        {state.placeMode && (
          <div className="segmented">
            <button
              type="button"
              className={state.placeBrush === 'zero' ? 'active' : ''}
              onClick={() => updateState({ placeBrush: 'zero' })}
            >
              Zero ●
            </button>
            <button
              type="button"
              className={state.placeBrush === 'pole' ? 'active' : ''}
              onClick={() => updateState({ placeBrush: 'pole' })}
            >
              Pole ◌
            </button>
          </div>
        )}
        {manualCount > 0 && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={state.showSingularities}
              onChange={(e) => updateState({ showSingularities: e.target.checked })}
            />
            Show markers
          </label>
        )}
        <p className="paint-hint">
          {state.placeMode
            ? 'Tap the canvas to drop a ' + state.placeBrush + '. They add to the arrangement above (set the counts to 0 for a purely hand-placed field).'
            : 'Place your own zeros and poles by tapping the canvas — on top of the laid-out ones.'}
        </p>
      </div>

      <h3 className="section-title">Streamlines</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Seeding
            <InfoTip text="Where the streamlines start. Concentric rings give the layered, colour-banded look of the blog's final pieces; random fills the page evenly; scan lines and grid give a more even sweep." />
          </span>
        </label>
        <select
          value={state.seedLayout}
          onChange={(e) => updateState({ seedLayout: e.target.value as SeedLayout })}
        >
          {SEED_LAYOUTS.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Line count
            <InfoTip text="How many streamlines are traced. The blog's pieces layer many thousands of thin lines; more lines = denser, richer, longer to plot." />
          </span>
          <span>{state.seedCount}</span>
        </label>
        <input
          type="range"
          min="100"
          max="5000"
          step="100"
          value={state.seedCount}
          onChange={(e) => updateState({ seedCount: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Length (steps/dir)
            <InfoTip text="How far each streamline runs forward and backward from its seed. Higher draws long sweeping curves; lower keeps them as short directional dashes." />
          </span>
          <span>{state.stepsPerDir}</span>
        </label>
        <input
          type="range"
          min="20"
          max="400"
          step="10"
          value={state.stepsPerDir}
          onChange={(e) => updateState({ stepsPerDir: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Step length
            <InfoTip text="Distance per integration step (px). Smaller hugs the field more tightly (smoother curves, slower); larger is coarser and faster." />
          </span>
          <span>{state.stepLength.toFixed(1)}px</span>
        </label>
        <input
          type="range"
          min="0.5"
          max="6"
          step="0.5"
          value={state.stepLength}
          onChange={(e) => updateState({ stepLength: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Step jitter
            <InfoTip text="Randomises each step's length so neighbouring streamlines don't lock into visible banding moiré. 0 is perfectly even." />
          </span>
          <span>{state.stepJitter.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.stepJitter}
          onChange={(e) => updateState({ stepJitter: parseFloat(e.target.value) })}
        />
      </div>

      <h3 className="section-title">Colour</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Palette
            <InfoTip text="Streamlines are grouped into colour bands; each band plots as its own pen. The per-layer SVG export keeps them separate so it's a genuine multi-pen plot, not a colour trick. 'Mono' maps every band to one ink." />
          </span>
        </label>
        <select
          value={state.palette}
          onChange={(e) => updateState({ palette: e.target.value })}
        >
          {PALETTES.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Colour bands (pens)
            <InfoTip text="How many colour bands / pen layers the streamlines split into. With concentric-ring seeding, each band is one ring." />
          </span>
          <span>{state.layerCount}</span>
        </label>
        <input
          type="range"
          min="1"
          max="8"
          step="1"
          value={state.layerCount}
          onChange={(e) => updateState({ layerCount: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Colour by
            <InfoTip text="What decides a streamline's band: which seed group it came from, the local flow speed, or the flow direction. Speed and angle colour by the field itself rather than the seeding." />
          </span>
        </label>
        <select
          value={state.layerBy}
          onChange={(e) => updateState({ layerBy: e.target.value as LayerBy })}
        >
          {LAYER_BY.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </div>

      <p className="paint-hint">
        Background colour is the shared <strong>Paper tone</strong> in the Page
        section — pick a dark tone there for the blog's colours-on-black look.
      </p>

      <h3 className="section-title">Style</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Pen width
            <InfoTip text="Plotted line weight in millimetres. Thin pens (0.1–0.3mm) let the many layered lines build density without going muddy." />
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
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={state.handDrawn}
            onChange={(e) => updateState({ handDrawn: e.target.checked })}
          />
          Hand-drawn wobble
          <InfoTip text="Adds a low-frequency hand-drawn shake to every streamline so the field reads as drawn rather than computed." />
        </label>
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Wobble
            <InfoTip text="A decorative perpendicular ripple baked into each streamline as it's traced — a different texture from the hand-drawn shake. 0 is clean." />
          </span>
          <span>{state.wobble.toFixed(1)}px</span>
        </label>
        <input
          type="range"
          min="0"
          max="3"
          step="0.1"
          value={state.wobble}
          onChange={(e) => updateState({ wobble: parseFloat(e.target.value) })}
        />
      </div>

      <h3 className="section-title">Seed</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Seed
            <InfoTip text="Sets the random placement of 'random' arrangements and the per-step jitter. Same seed → identical drawing." />
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

      <details className="advanced">
        <summary>Advanced</summary>

        <div className="control-group">
          <label>
            <span className="label-text">
              Plane zoom
              <InfoTip text="How much of the complex plane the page shows. Larger zooms out (the singularities cluster toward the centre); smaller zooms in on the field." />
            </span>
            <span>{state.planeScale.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.1"
            value={state.planeScale}
            onChange={(e) => updateState({ planeScale: parseFloat(e.target.value) })}
          />
        </div>

        <div className="control-group">
          <label>
            <span className="label-text">
              Speed clamp
              <InfoTip text="A streamline that rockets off near a pole is cut when its raw speed exceeds this. Lower trims more aggressively around singularities." />
            </span>
            <span>{state.speedClampMax}</span>
          </label>
          <input
            type="range"
            min="100"
            max="10000"
            step="100"
            value={state.speedClampMax}
            onChange={(e) => updateState({ speedClampMax: parseInt(e.target.value, 10) })}
          />
        </div>

        <div className="control-group">
          <label>
            <span className="label-text">
              Min line length
              <InfoTip text="Streamlines shorter than this (px) are discarded — clears the stubs that form right on top of a singularity." />
            </span>
            <span>{state.minLineLength}px</span>
          </label>
          <input
            type="range"
            min="0"
            max="60"
            step="2"
            value={state.minLineLength}
            onChange={(e) => updateState({ minLineLength: parseInt(e.target.value, 10) })}
          />
        </div>
      </details>

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
