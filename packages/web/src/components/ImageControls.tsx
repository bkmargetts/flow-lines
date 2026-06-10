import { useRef } from 'react';
import type { InkSettings } from '../App';

interface ImageControlsProps {
  settings: InkSettings;
  imageName: string | null;
  updateSettings: (updates: Partial<InkSettings>) => void;
  onImageFile: (file: File) => void;
  randomizeSeed: () => void;
  downloadSVG: () => void;
}

export function ImageControls({
  settings,
  imageName,
  updateSettings,
  onImageFile,
  randomizeSeed,
  downloadSVG,
}: ImageControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="controls">
      <div className="paint-section">
        <h3 className="section-title">Source Image</h3>

        <div className="control-group">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImageFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="primary"
            onClick={() => fileInputRef.current?.click()}
          >
            {imageName ? 'Choose Another Image' : 'Choose Image…'}
          </button>
          <p className="paint-hint">
            {imageName
              ? `Rendering: ${imageName}`
              : 'Upload a photo or drawing to render it as pen-and-ink hatching for plotting.'}
          </p>
        </div>
      </div>

      <h3 className="section-title">Canvas</h3>

      <div className="control-group">
        <label>
          Width <span>{settings.width}px</span>
        </label>
        <input
          type="range"
          min="200"
          max="1200"
          step="50"
          value={settings.width}
          onChange={(e) => updateSettings({ width: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          Margin <span>{settings.margin}px</span>
        </label>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={settings.margin}
          onChange={(e) => updateSettings({ margin: parseInt(e.target.value, 10) })}
        />
      </div>

      <h3 className="section-title">Hatching</h3>

      <div className="control-group">
        <label>
          Layers <span>{settings.layers}</span>
        </label>
        <input
          type="range"
          min="1"
          max="4"
          step="1"
          value={settings.layers}
          onChange={(e) => updateSettings({ layers: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          Shadow Spacing <span>{settings.minSpacing.toFixed(1)}px</span>
        </label>
        <input
          type="range"
          min="1.5"
          max="8"
          step="0.5"
          value={settings.minSpacing}
          onChange={(e) => updateSettings({ minSpacing: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          Highlight Spacing <span>{settings.maxSpacing.toFixed(0)}px</span>
        </label>
        <input
          type="range"
          min="6"
          max="30"
          step="1"
          value={settings.maxSpacing}
          onChange={(e) => updateSettings({ maxSpacing: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          White Cutoff <span>{settings.whiteCutoff.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0"
          max="0.4"
          step="0.02"
          value={settings.whiteCutoff}
          onChange={(e) => updateSettings({ whiteCutoff: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          Hatch Angle <span>{settings.hatchAngle}°</span>
        </label>
        <input
          type="range"
          min="-90"
          max="90"
          step="5"
          value={settings.hatchAngle}
          onChange={(e) => updateSettings({ hatchAngle: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.followTone}
            onChange={(e) => updateSettings({ followTone: e.target.checked })}
          />
          Strokes follow image contours
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.drawOutlines}
            onChange={(e) => updateSettings({ drawOutlines: e.target.checked })}
          />
          Trace edges as outlines
        </label>
      </div>

      <h3 className="section-title">Hand-Drawn Feel</h3>

      <div className="control-group">
        <label>
          Wobble <span>{settings.wobble.toFixed(1)}px</span>
        </label>
        <input
          type="range"
          min="0"
          max="3"
          step="0.1"
          value={settings.wobble}
          onChange={(e) => updateSettings({ wobble: parseFloat(e.target.value) })}
        />
      </div>

      <h3 className="section-title">Style</h3>

      <div className="control-group">
        <label>
          Stroke Width <span>{settings.strokeWidth}px</span>
        </label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.25"
          value={settings.strokeWidth}
          onChange={(e) => updateSettings({ strokeWidth: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>Stroke Color</label>
        <input
          type="text"
          value={settings.strokeColor}
          onChange={(e) => updateSettings({ strokeColor: e.target.value })}
        />
      </div>

      <h3 className="section-title">Seed</h3>

      <div className="control-group">
        <div className="seed-input">
          <input
            type="number"
            value={settings.seed}
            onChange={(e) => updateSettings({ seed: parseInt(e.target.value, 10) || 0 })}
          />
          <button type="button" className="secondary" onClick={randomizeSeed}>
            🎲
          </button>
        </div>
      </div>

      <div className="button-group">
        <button type="button" className="primary" onClick={downloadSVG} disabled={!imageName}>
          Download SVG
        </button>
      </div>
    </div>
  );
}
