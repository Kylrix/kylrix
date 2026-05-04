'use client';

import React from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  IconButton, 
  Paper, 
  Fade,
  Alert,
  AlertTitle
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Info as InfoIcon 
} from '@mui/icons-material';
import { useAuth } from './AuthContext';
import { useRouter } from 'next/navigation';

export const EmailVerificationReminder: React.FC = () => {
  const { user, shouldShowEmailVerificationReminder, dismissEmailVerificationReminder } = useAuth();
  const router = useRouter();

  const handleVerifyEmail = () => {
    router.push('/verify');
  };

  const handleDismiss = () => {
    dismissEmailVerificationReminder();
  };

  if (!shouldShowEmailVerificationReminder() || !user) {
    return null;
  }

  return (
    <Fade in={true}>
      <Paper
        sx={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 1300,
          maxWidth: 360,
          bgcolor: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(25px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden'
        }}
      >
        <Alert
          severity="info"
          icon={<InfoIcon sx={{ color: '#6366F1' }} />}
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={handleDismiss}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
          sx={{
            bgcolor: 'transparent',
            color: 'text.primary',
            '& .MuiAlert-icon': {
              pt: 1.5
            }
          }}
        >
          <AlertTitle sx={{ 
            fontWeight: 900, 
            color: '#6366F1',
            fontFamily: '"Space Grotesk", sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Verify Your Email
          </AlertTitle>
          <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255, 255, 255, 0.7)', fontFamily: 'var(--font-satoshi), sans-serif' }}>
            Please verify your email address to ensure account security and access all features.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="contained"
              onClick={handleVerifyEmail}
              sx={{ 
                bgcolor: '#6366F1', 
                color: '#000',
                fontWeight: 900,
                fontFamily: '"Space Grotesk", sans-serif',
                textTransform: 'uppercase',
                px: 2,
                '&:hover': { bgcolor: '#00D1D9' }
              }}
            >
              Verify Now
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={handleDismiss}
              sx={{ 
                color: 'rgba(255, 255, 255, 0.5)',
                fontWeight: 700,
                fontFamily: '"Space Grotesk", sans-serif',
                textTransform: 'uppercase',
              }}
            >
              Later
            </Button>
          </Box>
        </Alert>
      </Paper>
    </Fade>
  );
};
