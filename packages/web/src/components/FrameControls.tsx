import type { PaperFit } from '@flow-lines/core';
import { useFrame } from '../FrameContext';
import { PaperControls } from './PaperControls';

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
    </div>
  );
}
