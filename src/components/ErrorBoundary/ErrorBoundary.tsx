import React from 'react';

export interface ErrorInfo {
  id: string;
  timestamp: Date;
  error: Error;
  errorInfo: React.ErrorInfo;
  componentStack: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (errorInfo: ErrorInfo) => void;
  fallback?: React.ComponentType<{error: Error; errorInfo: React.ErrorInfo}>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Create error info object
    const capturedError: ErrorInfo = {
      id: `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      error,
      errorInfo,
      componentStack: errorInfo.componentStack || 'Unknown component stack',
    };

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(capturedError);
    }

    // Log to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback && this.state.error && this.state.errorInfo) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error}
            errorInfo={this.state.errorInfo}
          />
        );
      }

      // Don't show error UI - just continue rendering the children
      // The error has been logged to the store and will appear in HUD logs
      // Reset the error state so the app continues to function
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
    }

    return this.props.children;
  }
}
