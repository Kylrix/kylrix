'use client';

import { useEffect } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { ErrorOutline as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';

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
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        backgroundColor: 'background.default',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          textAlign: 'center',
          maxWidth: 500,
          width: '100%',
          borderRadius: 2,
        }}
      >
        <ErrorIcon
          sx={{
            fontSize: 64,
            color: 'error.main',
            mb: 2,
          }}
        />
        
        <Typography variant="h4" component="h1" gutterBottom>
          Something went wrong
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
        </Typography>
        
        {process.env.NODE_ENV === 'development' && (
          <Typography
            variant="caption"
            component="pre"
            sx={{
              backgroundColor: 'grey.100',
              p: 2,
              borderRadius: 1,
              mb: 3,
              textAlign: 'left',
              overflow: 'auto',
              fontSize: '0.75rem',
            }}
          >
            {error.message}
          </Typography>
        )}
        
        <Button
          variant="contained"
          onClick={reset}
          startIcon={<RefreshIcon />}
          size="large"
          sx={{
            background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
            },
          }}
        >
          Try Again
        </Button>
      </Paper>
    </Box>
  );
}