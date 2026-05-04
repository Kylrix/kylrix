'use client';

import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  Typography,
  Stack,
  Alert,
  CircularProgress,
} from '@mui/material';

type Props = {
  email: string;
  onEmailChangeAction: (value: string) => void;
  onPasskeyAction: () => Promise<void> | void;
  onRegisterAction?: () => Promise<void> | void;
  loading?: boolean;
  message?: string | null;
};

export default function AuthForm({
  email,
  onEmailChangeAction,
  onPasskeyAction,
  onRegisterAction,
  loading = false,
  message,
}: Props) {
  const [mode, setMode] = useState<'signin' | 'register'>(onRegisterAction ? 'signin' : 'signin');
  const singleMode = !onRegisterAction;

  const primaryAction = async () => {
    if (mode === 'register' && onRegisterAction) return onRegisterAction();
    return onPasskeyAction();
  };

  const primaryLabel = singleMode
    ? 'Continue with Passkey'
    : mode === 'register'
      ? 'Register Passkey'
      : 'Sign In with Passkey';
  const switchLabel = mode === 'register' ? 'Have a passkey? Sign in' : 'Need a passkey? Register';

  const isError = message?.toLowerCase().includes('error') || message?.toLowerCase().includes('fail');

  return (
    <Box sx={{ width: '100%', maxWidth: 400 }}>
      <Card sx={{ boxShadow: 2 }}>
        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              {singleMode ? 'Passkey Authentication' : mode === 'register' ? 'Register Passkey' : 'Sign In'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              {singleMode
                ? 'Continue with your device passkey'
                : mode === 'register'
                  ? 'Create a passkey bound to your device'
                  : 'Authenticate with an existing passkey'}
            </Typography>
          </Box>

          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Email (User ID)
              </Typography>
              <TextField
                type="email"
                value={email}
                onChange={(e) => onEmailChangeAction(e.target.value.trim())}
                placeholder="you@example.com"
                autoComplete="username"
                disabled={loading}
                fullWidth
                variant="outlined"
                size="small"
              />
            </Box>

            <Stack spacing={1}>
              <Button
                onClick={primaryAction}
                disabled={loading || (mode === 'register' && !onRegisterAction)}
                variant="contained"
                fullWidth
                sx={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                  fontWeight: 600,
                  textTransform: 'none',
                  py: 1.5,
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #4338ca 100%)',
                  },
                }}
              >
                {loading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                    Please wait...
                  </>
                ) : (
                  primaryLabel
                )}
              </Button>

              {onRegisterAction && (
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => setMode(mode === 'register' ? 'signin' : 'register')}
                  variant="outlined"
                  fullWidth
                  sx={{
                    color: '#334155',
                    borderColor: '#cbd5e1',
                    textTransform: 'none',
                    '&:hover': {
                      backgroundColor: '#f1f5f9',
                    },
                  }}
                >
                  {switchLabel}
                </Button>
              )}
            </Stack>

            <Alert severity="info">
              <Typography variant="caption">
                <strong>How it works:</strong>
              </Typography>
              <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                {mode === 'register'
                  ? 'Your browser will generate a secure digital key stored safely on your device. This key is used for future authentication.'
                  : 'Your device will verify ownership of your passkey through biometric or PIN authentication, creating a secure verification.'}
              </Typography>
            </Alert>

            {message && (
              <Alert severity={isError ? 'error' : 'success'}>
                <Typography variant="body2">{message}</Typography>
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
