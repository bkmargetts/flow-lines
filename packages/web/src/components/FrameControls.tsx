import type { PaperFit, TextureStyle } from '@flow-lines/core';
import { useFrame } from '../FrameContext';
import { InfoTip } from './InfoTip';
import { PaperControls } from './PaperControls';

/** Paper-tone swatches shown behind the drawing in the preview (never plotted). */
const PAPER_TONES: Array<{ id: string; label: string }> = [
  { id: '#ffffff', label: 'Bright white' },
  { id: '#faf9f6', label: 'Soft white' },
  { id: '#f4efe2', label: 'Warm' },
  { id: '#ece3cf', label: 'Cream' },
  { id: '#e7e7e4', label: 'Cool grey' },
  { id: '#1c2230', label: 'Slate (dark)' },
  { id: '#0d0d12', label: 'Ink black' },
];

/** Texture ink swatches (its own pen layer). */
const TEXTURE_INKS = ['#c9c2b4', '#b06a3c', '#5b6e7a', '#9aa0a6', '#1a1a1a'];

const TEXTURE_STYLES: Array<{ id: TextureStyle; label: string }> = [
  { id: 'hatch', label: 'Hatch' },
  { id: 'grid', label: 'Grid' },
  { id: 'stipple', label: 'Stipple' },
  { id: 'contours', label: 'Contours' },
  { id: 'shapes', label: 'Shapes' },
];

/**
 * The shared page frame — paper, orientation, render density, fit and the
 * paper-border margin. Mounted once in the shell so every project tab plots
 * to the same physical sheet.
 */
export function FrameControls() {
  const { frame, updateFrame } = useFrame();
  return (
    <div className="frame-controls">
      <h3 className="section-title">Page</h3>

      <PaperControls
        paper={frame.paper}
        orientation={frame.orientation}
        resolution={frame.resolution}
        onChange={updateFrame}
      />

      <div className="control-group">
        <label>Fit to page</label>
        <div className="segmented">
          <button
            type="button"
            className={frame.fit === 'fit' ? 'active' : ''}
            onClick={() => updateFrame({ fit: 'fit' as PaperFit })}
          >
            Fit
          </button>
          <button
            type="button"
            className={frame.fit === 'fill' ? 'active' : ''}
            onClick={() => updateFrame({ fit: 'fill' as PaperFit })}
          >
            Fill
          </button>
        </div>
      </div>

      <div className="control-group">
        <label>
          Margin <span>{frame.marginMm}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="40"
          step="1"
          value={frame.marginMm}
          onChange={(e) => updateFrame({ marginMm: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={frame.borderEnabled}
            onChange={(e) => updateFrame({ borderEnabled: e.target.checked })}
          />
          Page border
          <InfoTip text="A ruled rectangle framing the page on its own pen layer, like a print plate. A pure overlay — it never moves the drawing, so the rest of the output is unchanged. The background texture holds its halo off it too." />
        </label>
      </div>

      {frame.borderEnabled && (
        <div className="control-group">
          <label>
            Border inset <span>{frame.borderInsetMm}mm</span>
            <InfoTip text="Where the rule sits relative to the margin. 0 sits it right at the margin (touching the art). Negative pushes it outward toward the paper edge, opening a clear gap between the art and the border. Positive pushes it inward, into the art." />
          </label>
          <input
            type="range"
            min={-frame.marginMm}
            max="20"
            step="1"
            value={frame.borderInsetMm}
            onChange={(e) => updateFrame({ borderInsetMm: parseInt(e.target.value, 10) })}
          />
        </div>
      )}

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={frame.densityEnabled}
            onChange={(e) => updateFrame({ densityEnabled: e.target.checked })}
          />
          Density protection
          <InfoTip text="Trims runs where lines coalesce and re-ink the same path. Caps how many passes may stack on one patch before further overlap is cut — 1 keeps each path inked once (clean flow diagrams), higher allows built-up texture. Lines that merely cross at a point are left whole. Bold outlines (deliberate multi-pass) are exempt. Trimmed runs show ghosted in red in the plot window. Applies to every tool." />
        </label>
      </div>

      {frame.densityEnabled && (
        <div className="control-group">
          <label>
            Max passes before trimming <span>{frame.densityMaxPasses}</span>
          </label>
          <input
            type="range"
            min="1"
            max="8"
            step="1"
            value={frame.densityMaxPasses}
            onChange={(e) => updateFrame({ densityMaxPasses: parseInt(e.target.value, 10) })}
          />
        </div>
      )}

      <div className="control-group">
        <label>Paper tone</label>
        <div className="paper-swatches">
          {PAPER_TONES.map((tone) => (
            <button
              key={tone.id}
              type="button"
              className={`paper-swatch ${frame.paperTone === tone.id ? 'active' : ''}`}
              title={tone.label}
              aria-label={tone.label}
              style={{ background: tone.id }}
              onClick={() => updateFrame({ paperTone: tone.id })}
            />
          ))}
        </div>
      </div>

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={frame.textureEnabled}
            onChange={(e) => updateFrame({ textureEnabled: e.target.checked })}
          />
          Background texture
          <InfoTip text="An optional field of plottable strokes laid behind the drawing on its own pen layer (exports as a separate SVG). Held a clean-paper halo off the art so it doesn't crowd it." />
        </label>
      </div>

      {frame.textureEnabled && (
        <details className="adv-group" open>
          <summary>Texture</summary>

          <div className="control-group">
            <label>Style</label>
            <select
              value={frame.textureStyle}
              onChange={(e) => updateFrame({ textureStyle: e.target.value as TextureStyle })}
            >
              {TEXTURE_STYLES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {(frame.textureStyle === 'hatch' ||
            frame.textureStyle === 'grid' ||
            frame.textureStyle === 'stipple' ||
            frame.textureStyle === 'shapes') && (
            <div className="control-group">
              <label>
                Spacing <span>{frame.textureSpacingMm.toFixed(1)}mm</span>
              </label>
              <input
                type="range"
                min="1"
                max="12"
                step="0.5"
                value={frame.textureSpacingMm}
                onChange={(e) => updateFrame({ textureSpacingMm: parseFloat(e.target.value) })}
              />
            </div>
          )}

          {(frame.textureStyle === 'hatch' ||
            frame.textureStyle === 'grid' ||
            frame.textureStyle === 'shapes') && (
            <div className="control-group">
              <label>
                Angle <span>{frame.textureAngleDeg}°</span>
              </label>
              <input
                type="range"
                min="0"
                max="180"
                step="1"
                value={frame.textureAngleDeg}
                onChange={(e) => updateFrame({ textureAngleDeg: parseInt(e.target.value, 10) })}
              />
            </div>
          )}

          {frame.textureStyle === 'hatch' && (
            <div className="control-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={frame.textureCrossHatch}
                  onChange={(e) => updateFrame({ textureCrossHatch: e.target.checked })}
                />
                Cross-hatch
              </label>
            </div>
          )}

          {(frame.textureStyle === 'stipple' || frame.textureStyle === 'contours') && (
            <div className="control-group">
              <label>
                Density <span>{frame.textureDensity.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={frame.textureDensity}
                onChange={(e) => updateFrame({ textureDensity: parseFloat(e.target.value) })}
              />
            </div>
          )}

          {frame.textureStyle !== 'shapes' && (
            <div className="control-group">
              <label>
                {frame.textureStyle === 'contours' ? 'Scale' : 'Mark size'}{' '}
                <span>{frame.textureScale.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0.2"
                max="3"
                step="0.1"
                value={frame.textureScale}
                onChange={(e) => updateFrame({ textureScale: parseFloat(e.target.value) })}
              />
            </div>
          )}

          {frame.textureStyle !== 'grid' && (
            <div className="control-group">
              <label>
                Jitter <span>{frame.textureJitter.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={frame.textureJitter}
                onChange={(e) => updateFrame({ textureJitter: parseFloat(e.target.value) })}
              />
            </div>
          )}

          {frame.textureStyle === 'shapes' && (
            <div className="control-group">
              <label>Shape</label>
              <div className="segmented">
                {(['square', 'circle', 'line'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={frame.textureShapes.kind === k ? 'active' : ''}
                    onClick={() => updateFrame({ textureShapes: { ...frame.textureShapes, kind: k } })}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          {frame.textureStyle === 'shapes' && (
            <div className="control-group">
              <label>
                Shape size <span>{frame.textureShapes.sizeMm.toFixed(1)}mm</span>
              </label>
              <input
                type="range"
                min="1"
                max="20"
                step="0.5"
                value={frame.textureShapes.sizeMm}
                onChange={(e) =>
                  updateFrame({ textureShapes: { ...frame.textureShapes, sizeMm: parseFloat(e.target.value) } })
                }
              />
            </div>
          )}

          {frame.textureStyle === 'shapes' && (
            <div className="control-group">
              <label>
                Overlap <span>{frame.textureShapes.overlap.toFixed(2)}</span>
                <InfoTip text="Compresses the lattice below the spacing so shapes overlap. 0 keeps them on the spacing grid; higher packs them together." />
              </label>
              <input
                type="range"
                min="0"
                max="0.9"
                step="0.05"
                value={frame.textureShapes.overlap}
                onChange={(e) =>
                  updateFrame({ textureShapes: { ...frame.textureShapes, overlap: parseFloat(e.target.value) } })
                }
              />
            </div>
          )}

          <div className="control-group">
            <label>
              Halo <span>{frame.textureHaloMm.toFixed(1)}mm</span>
              <InfoTip text="Clean-paper sliver reserved around the drawing where the texture holds off, so the art reads off the textured ground. 0 lets the texture run under the drawing." />
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={frame.textureHaloMm}
              onChange={(e) => updateFrame({ textureHaloMm: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>Texture ink</label>
            <div className="paper-swatches">
              {TEXTURE_INKS.map((ink) => (
                <button
                  key={ink}
                  type="button"
                  className={`paper-swatch ${frame.textureColor === ink ? 'active' : ''}`}
                  title={ink}
                  aria-label={ink}
                  style={{ background: ink }}
                  onClick={() => updateFrame({ textureColor: ink })}
                />
              ))}
            </div>
          </div>

          <div className="control-group">
            <label>Texture seed</label>
            <div className="seed-input">
              <input
                type="number"
                value={frame.textureSeed}
                onChange={(e) => updateFrame({ textureSeed: parseInt(e.target.value, 10) || 0 })}
              />
              <button
                type="button"
                className="secondary"
                title="New texture seed"
                onClick={() => updateFrame({ textureSeed: Math.floor(Math.random() * 1000000) })}
              >
                🎲
              </button>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
