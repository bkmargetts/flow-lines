import { PAPER_SIZES, CUSTOM_PAPER_ID, resolvePaperSize, type Orientation } from '@flow-lines/core';

/** Render-density presets (pixels per millimetre). */
export const RESOLUTION_PRESETS: { label: string; value: number }[] = [
  { label: 'Draft', value: 2 },
  { label: 'Standard', value: 3 },
  { label: 'Fine', value: 4 },
];

/** Bounds for custom sheet edges, in mm (matches core's resolver clamp). */
const CUSTOM_MIN_MM = 50;
const CUSTOM_MAX_MM = 3000;

const clampCustom = (v: number): number =>
  Math.min(CUSTOM_MAX_MM, Math.max(CUSTOM_MIN_MM, Math.round(v)));

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
 * The size list ends in a Custom… entry that opens free W×H mm inputs
 * (stored in the frame as 'custom:WxH'), so any sheet a plotter can hold —
 * A0 and beyond — is reachable.
 */
export function PaperControls({ paper, orientation, resolution, onChange }: PaperControlsProps) {
  const isCustom = paper.startsWith(`${CUSTOM_PAPER_ID}:`);
  const dims = resolvePaperSize(paper);
  return (
    <>
      <div className="control-group">
        <label>Paper size</label>
        <select
          value={isCustom ? CUSTOM_PAPER_ID : paper}
          onChange={(e) =>
            onChange({
              paper:
                e.target.value === CUSTOM_PAPER_ID
                  ? // Seed the custom sheet from whatever was selected before.
                    `${CUSTOM_PAPER_ID}:${clampCustom(dims.widthMm)}x${clampCustom(dims.heightMm)}`
                  : e.target.value,
            })
          }
        >
          {PAPER_SIZES.map((size) => (
            <option key={size.id} value={size.id}>
              {size.name} ({size.widthMm}×{size.heightMm}mm)
            </option>
          ))}
          <option value={CUSTOM_PAPER_ID}>Custom…</option>
        </select>
      </div>

      {isCustom && (
        <div className="control-group">
          <label>Custom size (mm)</label>
          <div className="segmented">
            <input
              type="number"
              aria-label="Custom sheet width in mm"
              min={CUSTOM_MIN_MM}
              max={CUSTOM_MAX_MM}
              step={1}
              value={Math.round(dims.widthMm)}
              onChange={(e) => {
                const w = clampCustom(parseFloat(e.target.value) || CUSTOM_MIN_MM);
                onChange({ paper: `${CUSTOM_PAPER_ID}:${w}x${Math.round(dims.heightMm)}` });
              }}
            />
            <span aria-hidden>×</span>
            <input
              type="number"
              aria-label="Custom sheet height in mm"
              min={CUSTOM_MIN_MM}
              max={CUSTOM_MAX_MM}
              step={1}
              value={Math.round(dims.heightMm)}
              onChange={(e) => {
                const h = clampCustom(parseFloat(e.target.value) || CUSTOM_MIN_MM);
                onChange({ paper: `${CUSTOM_PAPER_ID}:${Math.round(dims.widthMm)}x${h}` });
              }}
            />
          </div>
        </div>
      )}

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
