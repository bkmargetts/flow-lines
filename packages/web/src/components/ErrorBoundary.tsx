import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Shown above the error, e.g. "the Coral layer". Defaults to "the app". */
  label?: string;
  /** Called when the user chooses to recover, so a host can reset state. */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time throws so a bad layer, preset or worker message shows a
 * recoverable panel instead of unmounting the tree to a blank page.
 *
 * This app does heavy work — ML in workers, generated geometry, user-supplied
 * photos — and had no boundary at all, so any throw during render took the
 * whole page with it and lost the user's unsaved stack.
 *
 * "Try again" clears the error and re-renders the same subtree, which is the
 * right move for a transient failure (a worker hiccup, a one-off bad frame).
 * A deterministic failure will throw again immediately and land back here, so
 * the panel also offers a reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the stack in the console — the panel deliberately shows only the
    // message, but a bug report needs the component trace.
    console.error('flow-lines: render error', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="error-boundary" role="alert">
        <h3>Something broke in {this.props.label ?? 'the app'}</h3>
        <p className="error-boundary-message">{error.message || String(error)}</p>
        <p className="error-boundary-hint">
          Your other layers are untouched. If this keeps happening, reloading starts
          from a clean sheet — note that an unsaved stack is not restored.
        </p>
        <div className="button-group">
          <button type="button" className="primary" onClick={this.reset}>
            Try again
          </button>
          <button type="button" className="secondary" onClick={() => window.location.reload()}>
            Reload the page
          </button>
        </div>
      </div>
    );
  }
}
