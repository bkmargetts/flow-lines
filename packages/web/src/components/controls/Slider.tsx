import type { ReactNode } from 'react';
import { EditableValue } from '../EditableValue';

/** One labelled range slider + its click-to-type value badge. */
export function Slider(props: {
  /** Plain label text (rendered with a trailing space before the badge). */
  label?: string;
  /** Rendered in place of the plain label — e.g. a span.label-text with an InfoTip. */
  labelNode?: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => ReactNode;
  disabled?: boolean;
  /** Extra content after the range input, inside the control group (e.g. a paint-hint). */
  children?: ReactNode;
}) {
  const { label, labelNode, value, min, max, step, onChange, format, disabled, children } = props;
  return (
    <div className="control-group">
      <label>
        {labelNode ?? <>{label}{' '}</>}
        <EditableValue value={value} min={min} max={max} step={step} onChange={onChange} disabled={disabled}>
          {format ? format(value) : value}
        </EditableValue>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {children}
    </div>
  );
}
