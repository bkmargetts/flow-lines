import { InfoTip } from './InfoTip';
import { PALETTES, padRamp, CUSTOM_PALETTE_ID } from '../lib/palette';

/** Coerce any colour string to the `#rrggbb` the native picker requires. */
function toHex6(value: string): string {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return '#' + v.slice(1).split('').map((c) => c + c).join('');
  }
  return '#000000';
}

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  info?: string;
}

/**
 * A single colour control: a native swatch picker plus a hex text field kept
 * in sync. The shared colour input across every project and the page frame.
 */
export function ColorField({ label, value, onChange, info }: ColorFieldProps) {
  return (
    <div className="control-group">
      <label className="label-text">
        {label}
        {info && <InfoTip text={info} />}
      </label>
      <div className="color-field">
        <input
          type="color"
          value={toHex6(value)}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} swatch`}
        />
        <input
          type="text"
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} hex`}
        />
      </div>
    </div>
  );
}

interface PalettePickerProps {
  palette: string;
  customRamp: string[];
  /** How many inks the project plots — drives how many custom pickers show. */
  colorCount: number;
  onChange: (updates: { palette?: string; customRamp?: string[] }) => void;
  info?: string;
}

/**
 * Palette dropdown plus, when 'Custom…' is chosen, one ColorField per ink so
 * the user picks the whole ramp. Projects keep their own `palette` +
 * `customRamp` state and feed both to `buildPaletteLayerColors`.
 */
export function PalettePicker({ palette, customRamp, colorCount, onChange, info }: PalettePickerProps) {
  const ramp = padRamp(customRamp, colorCount);
  return (
    <>
      <div className="control-group">
        <label className="label-text">
          Palette
          {info && <InfoTip text={info} />}
        </label>
        <select value={palette} onChange={(e) => onChange({ palette: e.target.value })}>
          {PALETTES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {palette === CUSTOM_PALETTE_ID &&
        ramp.map((hex, i) => (
          <ColorField
            key={i}
            label={`Ink ${i + 1}`}
            value={hex}
            onChange={(next) => {
              const updated = [...ramp];
              updated[i] = next;
              onChange({ customRamp: updated });
            }}
          />
        ))}
    </>
  );
}
