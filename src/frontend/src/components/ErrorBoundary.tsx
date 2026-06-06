import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
  resetLabel?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface in the console for debugging without crashing the UI.
    console.error("Editor error caught by boundary:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-background px-8 text-center">
          <p className="text-base font-semibold text-foreground">
            Something went wrong
          </p>
          <p className="text-sm text-muted-foreground">
            The editor hit a snag. Your photo is safe — just try again.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-6 py-2.5 rounded-2xl bg-primary text-primary-foreground font-semibold active:scale-95 transition-transform"
          >
            {this.props.resetLabel ?? "Retake"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
