'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import React, { Component, type ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { logAPIError } from '@/lib/logger';

interface ErrorInfo {
  componentStack: string;
  digest?: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: 'page' | 'section' | 'component';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private previousResetKeys: Array<string | number> = [];

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = 'component' } = this.props;

    // Log error
    logAPIError(`ErrorBoundary-${level}`, error, {
      componentStack: errorInfo.componentStack,
      digest: errorInfo.digest,
      level,
    });

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Update state with error info
    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Auto-reset after multiple errors (circuit breaker pattern)
    if (this.state.errorCount >= 3) {
      this.scheduleReset(5000); // Reset after 5 seconds
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset on prop changes if enabled
    if (
      hasError &&
      resetOnPropsChange &&
      prevProps.children !== this.props.children
    ) {
      this.resetErrorBoundary();
    }

    // Reset when resetKeys change
    if (hasError && resetKeys && this.hasResetKeysChanged(resetKeys)) {
      this.resetErrorBoundary();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  hasResetKeysChanged = (resetKeys: Array<string | number>): boolean => {
    if (resetKeys.length !== this.previousResetKeys.length) {
      this.previousResetKeys = resetKeys;
      return true;
    }

    for (let i = 0; i < resetKeys.length; i++) {
      if (resetKeys[i] !== this.previousResetKeys[i]) {
        this.previousResetKeys = resetKeys;
        return true;
      }
    }

    return false;
  };

  scheduleReset = (delay: number) => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = setTimeout(() => {
      this.resetErrorBoundary();
    }, delay);
  };

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback, isolate, level = 'component' } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return <>{fallback}</>;
      }

      // Different error UI based on level
      switch (level) {
        case 'page':
          return (
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="w-full max-w-md">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Page Error</AlertTitle>
                  <AlertDescription className="mt-2">
                    <p className="mb-4">
                      Something went wrong loading this page.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={this.resetErrorBoundary}
                        size="sm"
                        variant="outline"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Try Again
                      </Button>
                      <Button
                        onClick={() => (window.location.href = '/')}
                        size="sm"
                        variant="outline"
                      >
                        Go Home
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
                {process.env.NODE_ENV === 'development' && (
                  <details className="mt-4 rounded-lg bg-muted p-4">
                    <summary className="cursor-pointer font-medium">
                      Error Details
                    </summary>
                    <pre className="mt-2 overflow-auto text-xs">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          );

        case 'section':
          return (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <Alert className="mb-0" variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Section Error</AlertTitle>
                <AlertDescription>
                  <p className="mb-2">This section couldn't be loaded.</p>
                  <Button
                    onClick={this.resetErrorBoundary}
                    size="sm"
                    variant="outline"
                  >
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          );

        default:
          // Component level - minimal UI
          if (isolate) {
            return (
              <div className="inline-flex items-center gap-2 text-muted-foreground text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>Component error</span>
                <button
                  className="text-primary hover:underline"
                  onClick={this.resetErrorBoundary}
                >
                  retry
                </button>
              </div>
            );
          }

          // Re-throw if not isolated
          throw error;
      }
    }

    return children;
  }
}

// Async Error Boundary for handling promise rejections
export function AsyncErrorBoundary({ children, ...props }: ErrorBoundaryProps) {
  return (
    <ErrorBoundary {...props}>
      <AsyncErrorHandler>{children}</AsyncErrorHandler>
    </ErrorBoundary>
  );
}

// Handle unhandled promise rejections
function AsyncErrorHandler({ children }: { children: ReactNode }) {
  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      // Could throw here to trigger parent error boundary
      // throw new Error(event.reason)
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection
      );
    };
  }, []);

  return <>{children}</>;
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = React.forwardRef<any, P>((props, ref) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...(props as any)} ref={ref} />
    </ErrorBoundary>
  ));

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
