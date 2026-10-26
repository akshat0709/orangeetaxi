import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TabErrorBoundaryProps {
  children: ReactNode;
  tabName?: string;
  onRetry?: () => void;
}

interface TabErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class TabErrorBoundary extends Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
  constructor(props: TabErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): TabErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `[TabErrorBoundary:${this.props.tabName || "unknown"}] caught error:`,
      error,
      errorInfo,
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-4 my-4">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-foreground">
              Unable to load {this.props.tabName || "this section"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5">
              {this.state.error?.message || "An unexpected error occurred while rendering."}
            </p>
          </div>
          <div className="pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={this.handleReset}
              className="text-xs gap-1.5 border-destructive/30 hover:bg-destructive/10"
            >
              <RefreshCw className="size-3.5" />
              <span>Retry Tab</span>
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
