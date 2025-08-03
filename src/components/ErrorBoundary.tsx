import React from 'react';
import {Box, Button, Typography} from '@mui/material';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | undefined;
  errorInfo: React.ErrorInfo | undefined;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{error: Error; resetError: () => void}>;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {hasError: false, error: undefined, errorInfo: undefined};
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {hasError: true, error, errorInfo: undefined};
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console in development
    if (process.env['NODE_ENV'] === 'development') {
      console.error('Error caught by boundary:', error, errorInfo);
    }
  }

  resetError = () => {
    this.setState(prevState => ({
      ...prevState,
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    }));
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} resetError={this.resetError} />;
      }

      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
          p={3}
        >
          <Typography variant="h4" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            An unexpected error occurred. Please try refreshing the page.
          </Typography>
          <Button
            variant="contained"
            onClick={this.resetError}
            sx={{mt: 2}}
          >
            Try Again
          </Button>
          {process.env['NODE_ENV'] === 'development' && this.state.error && (
            <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
              <Typography variant="body2" fontFamily="monospace">
                {this.state.error.toString()}
              </Typography>
            </Box>
          )}
        </Box>
      );
    }

    return this.props.children;
  }
}

export {ErrorBoundary};
