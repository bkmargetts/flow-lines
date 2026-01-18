import type { AppState, BrushType } from '../App';

interface PaintControlsProps {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
  onClearPoints: () => void;
  onClearAttractors: () => void;
}

export function PaintControls({
  state,
  updateState,
  onClearPoints,
  onClearAttractors,
}: PaintControlsProps) {
  if (state.paintMode) {
    return (
      <div className="paint-controls-bar">
        <span className="paint-label">
          {state.paintedPoints.length} points
        </span>
        {state.paintedPoints.length > 0 && (
          <>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={state.showDots}
                onChange={(e) => updateState({ showDots: e.target.checked })}
              />
              Show
            </label>
            <button type="button" className="clear-btn" onClick={onClearPoints}>
              Clear
            </button>
          </>
        )}
      </div>
    );
  }

  if (state.attractorMode) {
    return (
      <div className="paint-controls-bar">
        <div className="brush-toggle">
          <button
            type="button"
            className={state.attractorBrushType === 'attractor' ? 'active attract' : 'attract'}
            onClick={() => updateState({ attractorBrushType: 'attractor' })}
          >
            Pull
          </button>
          <button
            type="button"
            className={state.attractorBrushType === 'repeller' ? 'active repel' : 'repel'}
            onClick={() => updateState({ attractorBrushType: 'repeller' })}
          >
            Push
          </button>
        </div>

        <div className="slider-compact">
          <label>R</label>
          <input
            type="range"
            min="20"
            max="150"
            step="5"
            value={state.attractorRadius}
            onChange={(e) => updateState({ attractorRadius: parseInt(e.target.value, 10) })}
          />
        </div>

        <div className="slider-compact">
          <label>S</label>
          <input
            type="range"
            min="0.2"
            max="3"
            step="0.1"
            value={state.attractorStrength}
            onChange={(e) => updateState({ attractorStrength: parseFloat(e.target.value) })}
          />
        </div>

        {state.attractors.length > 0 && (
          <button type="button" className="clear-btn" onClick={onClearAttractors}>
            Clear ({state.attractors.length})
          </button>
        )}
      </div>
    );
  }

  return null;
}
