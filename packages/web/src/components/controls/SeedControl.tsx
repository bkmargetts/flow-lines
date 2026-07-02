import type { ReactNode } from 'react';
import { randomSeed } from '../../lib/random';

/** The standard seed row: a number input plus a 🎲 randomize button. */
export function SeedControl(props: {
  seed: number;
  onChange: (seed: number) => void;
  /** Tooltip on the 🎲 button. */
  title?: string;
  /** Optional content above the input row (e.g. a label with an InfoTip). */
  children?: ReactNode;
}) {
  const { seed, onChange, title = 'New random seed', children } = props;
  return (
    <div className="control-group">
      {children}
      <div className="seed-input">
        <input
          type="number"
          value={seed}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        />
        <button type="button" className="secondary" onClick={() => onChange(randomSeed())} title={title}>
          🎲
        </button>
      </div>
    </div>
  );
}
