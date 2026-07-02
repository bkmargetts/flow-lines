import type { ReactNode } from 'react';

/** The collapsed Advanced drawer at the bottom of a controls panel. */
export function AdvancedSection({ children }: { children: ReactNode }) {
  return (
    <details className="advanced">
      <summary>Advanced</summary>
      {children}
    </details>
  );
}

/** One titled sub-group inside the Advanced drawer. */
export function AdvGroup({ title, open, children }: { title: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details className="adv-group" open={open}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}
