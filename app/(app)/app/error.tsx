'use client';

import { useEffect } from 'react';
import { Box, Typography, Button, Paper, Stack } from '@/lib/openbricks/primitives';
import { Warning as ErrorIcon } from '@/lib/openbricks/icons';

const MUTED = '#9B9691';
const ACCENT = '#6366F1';
const SURFACE = '#000000';
const EDGE = '#34322F';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

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
        bgcolor: SURFACE,
        borderTop: `1px solid ${EDGE}`,
        borderLeft: { xs: 'none', sm: `1px solid ${EDGE}` },
        borderRight: { xs: 'none', sm: `1px solid ${EDGE}` },
        borderBottom: { xs: 'none', sm: `1px solid ${EDGE}` },
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
            <ErrorIcon sx={{ fontSize: 24 }} />
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

        {error && (
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: ACCENT, display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-satoshi)' }}>
              Interruption Details
            </Typography>
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                bgcolor: '#1C1A18', 
                borderColor: EDGE,
                borderRadius: '16px',
                maxHeight: 120,
                overflow: 'auto'
              }}
            >
              <Typography component="pre" sx={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'white', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                {error.message}
              </Typography>
            </Paper>
          </Box>
        )}

        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
          <Button onClick={reset} style={{ flex: 1, height: 48, borderRadius: 14, fontWeight: 900, textTransform: 'none', bgcolor: 'white', color: 'black' }}>
            Restore Session
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="outlined"
            style={{ flex: 1, height: 48, borderRadius: 14, fontWeight: 800, borderColor: EDGE, color: 'white', textTransform: 'none' }}
          >
            Refresh App
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}