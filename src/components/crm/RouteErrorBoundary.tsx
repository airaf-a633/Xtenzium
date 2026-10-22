import { Component, type ErrorInfo, type ReactNode } from 'react';

/* A render crash on one screen must never leave the rep staring at a blank
   page. This catches it, says what happened in plain words, and offers the
   one thing that usually fixes it (a reload) — the rest of the app, the
   header and the login, stay up. */
interface State {
  error: Error | null;
}

export default class RouteErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[crm] screen crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-10 flex max-w-[520px] flex-col gap-3 rounded-crm-md border border-crm-line bg-crm-surface p-6 text-[14px] text-crm-ink-2">
        <h2 className="m-0 text-[16px] font-semibold text-crm-ink">This screen hit a problem</h2>
        <p className="m-0">
          Nothing you logged has been lost. Reload to carry on; if it happens again, tell the team what you were doing.
        </p>
        <p className="m-0 break-words font-crm-mono text-[12px] text-crm-ink-3">{this.state.error.message}</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="h-9 cursor-pointer rounded-crm-md border-0 bg-crm-copper px-4 text-[13px] font-medium text-crm-copper-ink"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          <button
            type="button"
            className="h-9 cursor-pointer rounded-crm-md border border-crm-line-hi bg-transparent px-4 text-[13px] text-crm-ink"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
