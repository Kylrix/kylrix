'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';
import { Box, Typography, Paper, Stack } from '@/lib/openbricks/primitives';
import { Warning as WarningIcon, Description as DescriptionIcon } from '@/lib/openbricks/icons';

const MUTED = '#9B9691';
const ACCENT = '#6366F1';

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
        <Box sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          backdropFilter: 'blur(20px)',
          bgcolor: 'rgba(0, 0, 0, 0.75)',
          p: { xs: 0, sm: 3 },
          margin: 0
        }}>
          {/* Bottom Drawer Card */}
          <Box sx={{
            width: '100%',
            maxWidth: '520px',
            bgcolor: '#000000',
            borderTop: '1px solid #34322F',
            borderLeft: { xs: 'none', sm: '1px solid #34322F' },
            borderRight: { xs: 'none', sm: '1px solid #34322F' },
            borderBottom: { xs: 'none', sm: '1px solid #34322F' },
            borderRadius: { xs: '28px 28px 0 0', sm: '28px' },
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            boxShadow: '0 -16px 48px rgba(0,0,0,0.7)',
            mb: { xs: 0, sm: 2 },
            textAlign: 'left'
          }}>
            <Stack direction="row" alignItems="center" gap={2}>
              <Box sx={{
                width: 48,
                height: 48,
                borderRadius: '16px',
                bgcolor: '#220505',
                border: '1px solid #ef4444',
                color: '#ef4444',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}>
                <WarningIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', color: 'white', lineHeight: 1.2 }}>
                  System Recovery Required
                </Typography>
                <Typography variant="caption" sx={{ color: MUTED, fontFamily: 'var(--font-satoshi)', fontWeight: 700 }}>
                  An unexpected interruption occurred
                </Typography>
              </Box>
            </Stack>

            <Typography variant="body2" sx={{ color: MUTED, fontFamily: 'var(--font-satoshi)', lineHeight: 1.5 }}>
              The system experienced a temporary interruption. We have prepared an automatic recovery path to restore your session safely.
            </Typography>

            {this.state.error && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: ACCENT, display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-satoshi)' }}>
                  Interruption Details
                </Typography>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 2, 
                    bgcolor: '#1C1A18', 
                    borderColor: '#34322F',
                    borderRadius: '16px',
                    maxHeight: 120,
                    overflow: 'auto'
                  }}
                >
                  <Typography component="pre" sx={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'white', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                    {this.state.error.message}
                  </Typography>
                </Paper>
              </Box>
            )}

            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <Button onClick={this.handleRetry} style={{ flex: 1, height: 48, borderRadius: 14, fontWeight: 900, textTransform: 'none' }}>
                Restore Session
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outlined"
                style={{ flex: 1, height: 48, borderRadius: 14, fontWeight: 800, borderColor: '#34322F', color: 'white', textTransform: 'none' }}
              >
                Refresh App
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
  <ErrorBoundary
    onError={(error, errorInfo) => {
      console.error('Authentication section error:', error, errorInfo);
    }}
  >
    {children}
  </ErrorBoundary>
);

export const useErrorHandler = () => {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    console.error('Error caught by hook:', error, errorInfo);
  };
};
