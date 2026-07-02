import { InfoTip } from '../InfoTip';

/** A labelled select over a record of preset ids → display labels. */
export function PresetPicker<T extends string>(props: {
  label: string;
  info?: string;
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
}) {
  const { label, info, labels, value, onChange } = props;
  return (
    <div className="control-group">
      <label>
        <span className="label-text">
          {label}
          {info && <InfoTip text={info} />}
        </span>
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {(Object.keys(labels) as T[]).map((id) => (
          <option key={id} value={id}>
            {labels[id]}
          </option>
        ))}
      </select>
    </div>
  );
}
