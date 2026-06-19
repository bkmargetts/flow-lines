import { useEffect, useRef, useState, type ReactNode } from "react";

interface EditableValueProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  children: ReactNode; // formatted display, e.g. "2.5mm" / "off"
  disabled?: boolean; // mirror a disabled slider — render the value but block editing
}

/**
 * Renders a slider's value badge that can be clicked (or focused + Enter/Space)
 * to type an exact value. Enter/blur commits the typed number — clamped to
 * [min, max] and snapped to the slider's `step` grid so integer sliders stay
 * integer — and Escape cancels. At rest it looks like the plain value span.
 */
export function EditableValue({ value, min, max, step, onChange, children, disabled }: EditableValueProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const begin = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commit = () => {
    const parsed = parseFloat(draft);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      // snap to the slider's step grid (relative to min) so integer steps
      // yield integers and float steps land on valid stops
      const snapped = Math.round((clamped - min) / step) * step + min;
      const decimals = (String(step).split(".")[1] ?? "").length;
      onChange(Number(snapped.toFixed(decimals)));
    }
    setEditing(false);
  };

  if (disabled) {
    return <span>{children}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        className="editable-value-input"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <span
      className="editable-value"
      role="button"
      tabIndex={0}
      onClick={begin}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          begin();
        }
      }}
    >
      {children}
    </span>
  );
}
