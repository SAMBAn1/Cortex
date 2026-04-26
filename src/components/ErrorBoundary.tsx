import { Component, type ReactNode } from "react";

interface State { error: Error | null; }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: any) {
    console.error("Cortex crash:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-lg w-full panel p-6 space-y-3">
          <div className="text-base font-medium text-danger">Something broke.</div>
          <div className="text-sm text-fg-muted">An error occurred while rendering this view.</div>
          <pre className="text-[11px] p-3 rounded-md bg-bg-panel border border-border text-danger overflow-auto max-h-72 whitespace-pre-wrap">
            {this.state.error.message}{"\n\n"}{this.state.error.stack}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={() => { this.setState({ error: null }); }}
              className="text-sm px-3 py-1.5 rounded-md bg-accent text-white hover:opacity-90"
            >Try again</button>
            <button
              onClick={() => { window.location.hash = "#/"; this.setState({ error: null }); }}
              className="text-sm px-3 py-1.5 rounded-md bg-bg-panel hover:bg-border"
            >Go to dashboard</button>
          </div>
        </div>
      </div>
    );
  }
}
