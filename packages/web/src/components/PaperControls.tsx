import { PAPER_SIZES, type Orientation } from '@flow-lines/core';

/** Render-density presets (pixels per millimetre). */
export const RESOLUTION_PRESETS: { label: string; value: number }[] = [
  { label: 'Draft', value: 2 },
  { label: 'Standard', value: 3 },
  { label: 'Fine', value: 4 },
];

interface PaperControlsProps {
  paper: string;
  orientation: Orientation;
  resolution: number;
  onChange: (updates: {
    paper?: string;
    orientation?: Orientation;
    resolution?: number;
  }) => void;
}

/**
 * Paper size + orientation + render density. Shared by both modes so the
 * canvas is always a physical sheet rather than an arbitrary pixel box.
 */
export function PaperControls({ paper, orientation, resolution, onChange }: PaperControlsProps) {
  return (
    <>
      <div className="control-group">
        <label>Paper size</label>
        <select value={paper} onChange={(e) => onChange({ paper: e.target.value })}>
          {PAPER_SIZES.map((size) => (
            <option key={size.id} value={size.id}>
              {size.name} ({size.widthMm}×{size.heightMm}mm)
            </option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <label>Orientation</label>
        <div className="segmented">
          <button
            type="button"
            className={orientation === 'portrait' ? 'active' : ''}
            onClick={() => onChange({ orientation: 'portrait' })}
          >
            Portrait
          </button>
          <button
            type="button"
            className={orientation === 'landscape' ? 'active' : ''}
            onClick={() => onChange({ orientation: 'landscape' })}
          >
            Landscape
          </button>
        </div>
      </div>

      <div className="control-group">
        <label>Resolution</label>
        <div className="segmented">
          {RESOLUTION_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={resolution === preset.value ? 'active' : ''}
              onClick={() => onChange({ resolution: preset.value })}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
