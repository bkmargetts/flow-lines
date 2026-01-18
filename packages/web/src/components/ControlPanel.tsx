import { useState, type ReactNode } from 'react';

interface ControlPanelProps {
  children: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

export function ControlPanel({ children, isOpen, onToggle }: ControlPanelProps) {
  return (
    <>
      {/* Toggle button - always visible */}
      <button
        type="button"
        className={`panel-toggle ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
        aria-label={isOpen ? 'Hide controls' : 'Show controls'}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {isOpen ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Backdrop for mobile */}
      {isOpen && <div className="panel-backdrop" onClick={onToggle} />}

      {/* Panel */}
      <aside className={`control-panel ${isOpen ? 'open' : ''}`}>
        <div className="panel-header">
          <h1>Flow Lines</h1>
          <p className="subtitle">Generative Art for Pen Plotters</p>
        </div>
        <div className="panel-content">
          {children}
        </div>
      </aside>
    </>
  );
}

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`accordion ${isOpen ? 'open' : ''}`}>
      <button
        type="button"
        className="accordion-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{title}</span>
        <svg
          className="accordion-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && <div className="accordion-content">{children}</div>}
    </div>
  );
}
