'use client';

import { useEffect } from 'react';
import { Box, Typography, Button, Paper, Container, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { Refresh, Home, ErrorOutline, ExpandMore } from '@mui/icons-material';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <Box
          sx={{
            minHeight: '100vh',
            bgcolor: 'background.default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
          }}
        >
          <Container maxWidth="xs">
            <Paper
              sx={{
                p: 4,
                borderRadius: 6,
                textAlign: 'center',
                bgcolor: 'rgba(15, 13, 12, 0.95)',
                backdropFilter: 'blur(25px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              {/* Logo */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
                <Box
                  component="img"
                  src="/logo/kylrixnote.png"
                  alt="Kylrix Note Logo"
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 4,
                    boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
                  }}
                />
              </Box>

              {/* Error Icon */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                <ErrorOutline sx={{ fontSize: 64, color: 'error.main' }} />
              </Box>

              {/* Header */}
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 900 }}>
                Application Error
              </Typography>

              {/* Error Message */}
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
                A critical error occurred in the application. Please refresh the page or contact support if the problem persists.
              </Typography>

              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === 'development' && (
                <Box sx={{ mb: 4, textAlign: 'left' }}>
                  <Accordion
                    sx={{
                      bgcolor: 'transparent',
                      backgroundImage: 'none',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      '&:before': { display: 'none' },
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMore sx={{ color: 'primary.main' }} />}>
                      <Typography variant="caption" sx={{ color: 'primary.main' }}>
                        Error Details
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box
                        component="pre"
                        sx={{
                          fontSize: '0.75rem',
                          bgcolor: 'rgba(0,0,0,0.3)',
                          p: 2,
                          borderRadius: 2,
                          overflow: 'auto',
                          maxHeight: 128,
                          whiteSpace: 'pre-wrap',
                          color: 'text.secondary',
                        }}
                      >
                        {error.message}
                        {error.stack && `\n\n${error.stack}`}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              )}

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<Refresh />}
                  onClick={reset}
                  sx={{
                    py: 1.5,
                    borderRadius: 3,
                  }}
                >
                  Reload Application
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Home />}
                  onClick={() => window.location.href = '/'}
                  sx={{
                    py: 1.5,
                    borderRadius: 3,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'text.primary',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'rgba(99, 102, 241, 0.05)',
                    },
                  }}
                >
                  Go to Home
                </Button>
              </Box>
            </Paper>
          </Container>
        </Box>
      </body>
    </html>
  );
}
