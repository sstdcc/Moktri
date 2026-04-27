import { Component, ErrorInfo, ReactNode } from "react";
import { logError } from "@/lib/errorLogger";

interface Props {
  children: ReactNode;
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

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError("react_error_boundary", error, {
      componentStack: info.componentStack,
    });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen flex items-center justify-center bg-background p-6"
        >
          <div className="max-w-md w-full text-center space-y-4">
            <h1 className="text-2xl font-bold text-foreground">
              حدث خطأ غير متوقع
            </h1>
            <p className="text-muted-foreground">
              نعتذر عن هذا الخلل، يرجى المحاولة مرة أخرى.
            </p>
            <button
              onClick={this.handleReload}
              className="px-6 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              العودة للرئيسية
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
