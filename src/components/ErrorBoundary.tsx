// src/components/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="appRoot" style={{ padding: 24, textAlign: "center" }}>
          <div className="glass card" style={{ maxWidth: 360, margin: "auto" }}>
            <div className="cardTitle" style={{ marginBottom: 12 }}>
              Что-то пошло не так
            </div>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>
              {this.state.error.message}
            </p>
            <button
              className="btnGhost"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Попробовать снова
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
