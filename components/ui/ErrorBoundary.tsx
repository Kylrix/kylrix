'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';
import { Box, Typography, Paper, Stack } from '@/lib/openbricks/primitives';
import { Warning as WarningIcon, Description as DescriptionIcon } from '@/lib/openbricks/icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // Auto-Recovery Strategy: Bust caches and reload if it looks like a build chunk load error
    const isChunkError = /loading.*chunk|failed to fetch.*dynamically|import.*failed/i.test(error?.message || '');
    if (isChunkError && typeof window !== 'undefined') {
      try {
        // Clear caches to force fetch of fresh assets
        if ('caches' in window) {
          caches.keys().then((keys) => {
            keys.forEach((key) => caches.delete(key));
          });
        }
        // Force full reload bypassing cache
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } catch (e) {
        console.error('Failed auto-recovery cache bust:', e);
      }
    }

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    // Clear storage cache items on retry click to guarantee recoverability
    try {
      localStorage.removeItem('kylrix:draft:note');
    } catch {}
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Box sx={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
          <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
            <WarningIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />

            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              Something went wrong
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              We encountered an unexpected error. You can try refreshing this section or contact support if the problem persists.
            </Typography>

            {this.props.showDetails && this.state.error && (
              <Box sx={{ mb: 3, textAlign: 'left' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', cursor: 'pointer', display: 'block', mb: 1 }}>
                  Error Details
                </Typography>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 1.5, 
                    bgcolor: 'rgba(255, 255, 255, 0.03)', 
                    borderRadius: '12px',
                    maxHeight: 128,
                    overflow: 'auto'
                  }}
                >
                  <Typography component="pre" sx={{ fontSize: '0.7rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {this.state.error.message}
                    {this.state.errorInfo?.componentStack}
                  </Typography>
                </Paper>
              </Box>
            )}

            <Stack direction="row" spacing={2} justifyContent="center">
              <Button onClick={this.handleRetry} size="small">
                Try Again
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outlined"
                size="small"
              >
                Reload Page
              </Button>
            </Stack>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Specialized error boundary for notes section
export const NotesErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    onError={(error, errorInfo) => {
      console.error('Notes section error:', error, errorInfo);
    }}
    fallback={
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <DescriptionIcon sx={{ fontSize: 32, color: 'warning.main', mb: 2 }} />
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Notes Unavailable</Typography>
        <Typography variant="body2" color="text.secondary">
          We&apos;re having trouble loading your notes. This might be a temporary issue.
        </Typography>
      </Box>
    }
  >
    {children}
  </ErrorBoundary>
);

export const AuthErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <>{children}</>
);

export const useErrorHandler = () => {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    console.error('Error caught by hook:', error, errorInfo);
  };
};
