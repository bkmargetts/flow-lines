/**
 * The shared full-width 🎲 "Randomize everything" row: a control-group with a
 * secondary button and an optional paint-hint line. The caller owns the roll
 * itself (genome spread + fresh seed) — this atom is presentation only.
 */
export function RandomiseButton({
  onClick,
  hint,
  title = 'Randomize everything',
}: {
  onClick: () => void;
  hint?: string;
  title?: string;
}) {
  return (
    <div className="control-group">
      <button
        type="button"
        className="secondary"
        onClick={onClick}
        title={title}
        style={{ width: '100%' }}
      >
        🎲 Randomize everything
      </button>
      {hint && <p className="paint-hint">{hint}</p>}
    </div>
  );
}
