import { InfoTip } from '../../components/InfoTip';
import { useConway } from './context';
import type { ConwayState } from './types';

/** Sidebar controls for the Conway Long Exposure project. */
export function ConwayControls() {
  const { state, updateState, randomizeSeed, downloadSVG, downloadLayers } = useConway();

  return (
    <div className="controls">
      <h3 className="section-title">Render</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Style
            <InfoTip text="Marks: discrete per-cell strokes. Contour ridges: nested smooth contours of the light field — organic, topographic. Comet streaks: each glider's path traced as one continuous flowing line, the core left as soft contours." />
          </span>
        </label>
        <select
          value={state.style}
          onChange={(e) => updateState({ style: e.target.value as ConwayState['style'] })}
        >
          <option value="marks">Marks (discrete)</option>
          <option value="contour">Contour ridges (organic)</option>
          <option value="streaks">Comet streaks (organic)</option>
        </select>
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Trail halo
            <InfoTip text="A sliver of clean paper reserved around the crisp present — history marks and trails hold back from it, so the 'now' reads with a glow. 0 lets them crowd right up to it." />
          </span>
          <span>{state.haloMm.toFixed(1)}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="4"
          step="0.1"
          value={state.haloMm}
          onChange={(e) => updateState({ haloMm: parseFloat(e.target.value) })}
        />
      </div>

      {state.style === 'contour' && (
        <div className="control-group">
          <label>
            <span className="label-text">
              Contour levels
              <InfoTip text="How many nested iso-contours trace the light field. More levels give a finer tonal gradient (denser shading); fewer give bold, sparse rings." />
            </span>
            <span>{state.contourLevels}</span>
          </label>
          <input
            type="range"
            min="2"
            max="10"
            step="1"
            value={state.contourLevels}
            onChange={(e) => updateState({ contourLevels: parseInt(e.target.value, 10) })}
          />
        </div>
      )}

      <h3 className="section-title">Exposure</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Generations
            <InfoTip text="How long the colony runs before the shutter closes. The R-pentomino stays chaotic until it burns out around generation 1100, then settles into static debris — so higher values streak the gliders further out, but past ~1100 the life goes out of the frame." />
          </span>
          <span>{state.generations}</span>
        </label>
        <input
          type="range"
          min="20"
          max="1200"
          step="20"
          value={state.generations}
          onChange={(e) => updateState({ generations: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Trail length (decay)
            <InfoTip text="How slowly the past fades. Each generation multiplies every cell's exposure by this, so higher keeps more history visible — longer comet tails — while lower leaves only the most recent moments." />
          </span>
          <span>{state.decay.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0.8"
          max="0.98"
          step="0.01"
          value={state.decay}
          onChange={(e) => updateState({ decay: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Grid cell size
            <InfoTip text="Physical size of one Life cell on the page. Smaller cells mean a finer, denser grid (more marks, longer plot); larger cells make a coarser, bolder composition." />
          </span>
          <span>{state.cellSize.toFixed(1)}mm</span>
        </label>
        <input
          type="range"
          min="1"
          max="4"
          step="0.1"
          value={state.cellSize}
          onChange={(e) => updateState({ cellSize: parseFloat(e.target.value) })}
        />
      </div>

      <h3 className="section-title">Style</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Pen Width
            <InfoTip text="Plotted line weight in millimetres — match it to the pen you'll draw with so the solid cores fill in cleanly." />
          </span>
          <span>{state.penWidthMm}mm</span>
        </label>
        <input
          type="range"
          min="0.1"
          max="1.5"
          step="0.05"
          value={state.penWidthMm}
          onChange={(e) => updateState({ penWidthMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Stroke Color
            <InfoTip text="Ink colour of the preview and exported SVG. Plotting still uses a single pen — colour is just for on-screen and paper choice." />
          </span>
        </label>
        <input
          type="text"
          value={state.strokeColor}
          onChange={(e) => updateState({ strokeColor: e.target.value })}
        />
      </div>

      <h3 className="section-title">Seed</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Seed
            <InfoTip text="The Game of Life is deterministic — the seed only sets where the R-pentomino sits and how it's rotated, giving a different composition without changing the rules." />
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

        <details className="adv-group">
          <summary>Fade &amp; tiers</summary>

          <div className="control-group">
            <label>
              <span className="label-text">
                Trail brightness (gamma)
                <InfoTip text="Lifts the faint trails so they read against the solid core. A moving cell deposits little exposure, so values below 1 brighten the comet tails; 1 leaves the raw, dimmer falloff." />
              </span>
              <span>{state.gamma.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.05"
              value={state.gamma}
              onChange={(e) => updateState({ gamma: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Faint cutoff
                <InfoTip text="Exposure below this leaves blank paper. Raise it to silence the dimmest ghosts and keep more open space; lower it to let even faint, ancient tracks register." />
              </span>
              <span>{state.faintThreshold.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="0.4"
              step="0.02"
              value={state.faintThreshold}
              onChange={(e) => updateState({ faintThreshold: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Faint → medium
                <InfoTip text="Tone at which a single comet dash gives way to a few hatch strokes — the boundary between the faintest tracks and the mid-tone ghosts." />
              </span>
              <span>{state.mediumThreshold.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0.1"
              max="0.6"
              step="0.02"
              value={state.mediumThreshold}
              onChange={(e) => updateState({ mediumThreshold: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Medium → solid
                <InfoTip text="Tone at which hatching gives way to a solid filled cell — how bright a region must be before it reads as part of the crisp present rather than a ghost." />
              </span>
              <span>{state.solidThreshold.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0.4"
              max="0.9"
              step="0.02"
              value={state.solidThreshold}
              onChange={(e) => updateState({ solidThreshold: parseFloat(e.target.value) })}
            />
          </div>
        </details>

        <details className="adv-group">
          <summary>Forms &amp; hand</summary>

          <div className="control-group">
            <label>
              <span className="label-text">
                Residue cluster size
                <InfoTip text="A surviving clump this size or smaller is drawn as a crisp hollow outline (the quiet still-lifes and glider heads); anything larger is the turbulent core and fills solid." />
              </span>
              <span>{state.residueMaxCells}</span>
            </label>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={state.residueMaxCells}
              onChange={(e) => updateState({ residueMaxCells: parseInt(e.target.value, 10) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Wobble
                <InfoTip text="Hand-drawn shake on the strokes. Faint old marks wobble most (haunted); the crisp final cells stay steady. 0 is ruler-straight." />
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
        </details>
      </details>

      <div className="button-group">
        <button type="button" className="primary" onClick={downloadSVG}>
          Download SVG
        </button>
        <button
          type="button"
          className="secondary"
          onClick={downloadLayers}
          title="One SVG per layer (present / ghost / trail), zipped — plot each with a different pen"
        >
          Download layers (.zip)
        </button>
      </div>
    </div>
  );
}
