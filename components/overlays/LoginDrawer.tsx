'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Typography, Button, Divider, IconButton, TextField, Stack, CircularProgress, alpha, useTheme, useMediaQuery, Drawer } from '@/lib/mui-tailwind/material';
import { X, Mail, ArrowLeft, Fingerprint } from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import OAuthButtons from '@/components/OAuthButtons';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import toast from 'react-hot-toast';

import Link from 'next/link';

type LoginStep = 'initial' | 'email' | 'otp' | 'mfa';
export function LoginDrawer() {
  const { activeContent, close } = useUnifiedDrawer();
  const { loginWithEmailOTP, verifyEmailOTP, verifyMFA, refreshUser } = useAuth();
  const { setIsDrawerOpen } = useDrawerState();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const [step, setStep] = useState<LoginStep>('initial');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [otp, setOtp] = useState('');
  const [mfaChallengeId, setMfaChallengeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const [lastUsedMethod, setLastUsedMethod] = useState<string | null>(null);

  const isOpen = activeContent === 'login';

  useEffect(() => {
    setIsDrawerOpen(isOpen);
    return () => setIsDrawerOpen(false);
  }, [isOpen, setIsDrawerOpen]);

  useEffect(() => {
...
    if (typeof window !== 'undefined') {
      setLastUsedMethod(localStorage.getItem('kylrix_last_auth_method'));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setCheckingSession(false);
      return;
    }

    let cancelled = false;

    const verifySession = async () => {
      setCheckingSession(true);
      try {
        const current = await refreshUser(true);
        if (!cancelled && current) {
          close();
        }
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    };

    void verifySession();

    return () => {
      cancelled = true;
    };
  }, [isOpen, close, refreshUser]);

  const handleSendOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email) return;
    setLoading(true);
    localStorage.setItem('kylrix_last_auth_method', 'email');
    setLastUsedMethod('email');

    try {
      const id = await loginWithEmailOTP(email);
      setUserId(id as any);
      setStep('otp');
      toast.success('Code sent to your email');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send login email');
    } finally {
      setLoading(false);
    }
  };

  const executeVerifyOTP = useCallback(async (code: string) => {
    if (!code || code.length < 6) return;
    setLoading(true);
    try {
      await verifyEmailOTP(email, userId, code); 
      close();
    } catch (err: any) {
      if (err.type === 'user_more_factors_required') {
          setMfaChallengeId(err.challengeId || 'totp');
          setStep('mfa');
          setOtp(''); 
      } else {
          toast.error(err.message || 'Invalid code');
          setOtp(''); 
      }
    } finally {
      setLoading(false);
    }
  }, [email, userId, verifyEmailOTP, close]);

  const executeVerifyMFA = useCallback(async (code: string) => {
      if (!code || code.length < 6) return;
      setLoading(true);
      try {
          await verifyMFA(mfaChallengeId, code);
          close();
      } catch (err: any) {
          toast.error(err.message || 'MFA verification failed');
          setOtp('');
      } finally {
          setLoading(false);
      }
  }, [mfaChallengeId, verifyMFA, close]);

  // Auto-submit effects for 6-digit completion
  useEffect(() => {
    if (step === 'otp' && otp.length === 6) {
        executeVerifyOTP(otp);
    }
  }, [otp, step, executeVerifyOTP]);

  useEffect(() => {
    if (step === 'mfa' && otp.length === 6) {
        executeVerifyMFA(otp);
    }
  }, [otp, step, executeVerifyMFA]);

  const handleBack = () => {
    if (step === 'email') setStep('initial');
    else if (step === 'otp') {
        setStep('email');
        setOtp('');
    }
    else if (step === 'mfa') {
        setStep('initial');
        setOtp('');
    }
  };

  const handleReset = () => {
    setStep('initial');
    setEmail('');
    setUserId('');
    setOtp('');
  };

  const handleClose = () => {
    handleReset();
    close();
  };

  const renderStep = () => {
    switch (step) {
      case 'initial':
        const isEmailLastUsed = lastUsedMethod === 'email';
        return (
          <Stack spacing={2}>
            {checkingSession ? (
              <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={20} />
              </Box>
            ) : (
              <OAuthButtons disabled={loading || checkingSession} lastUsed={lastUsedMethod} />
            )}
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setStep('email')}
              disabled={checkingSession}
              startIcon={<Mail size={18} />}
              sx={{
                position: 'relative',
                bgcolor: 'rgba(255,255,255,0.03)',
                color: 'white',
                border: '1px solid #34322F',
                height: isEmailLastUsed ? 60 : 52,
                borderRadius: '16px',
                fontWeight: 800,
                textTransform: 'none',
                fontSize: isEmailLastUsed ? '0.95rem' : '0.9rem',
                fontFamily: 'var(--font-satoshi)',
                ...(isEmailLastUsed && {
                  boxShadow: `0 8px 24px rgba(255,255,255,0.05)`,
                  borderColor: 'rgba(255,255,255,0.3)'
                }),
                '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)', transform: isEmailLastUsed ? 'translateY(-2px)' : 'none' }
              }}
            >
              <Box sx={{ flexGrow: 1, textAlign: 'left', pl: 1 }}>Continue with Email</Box>
              {isEmailLastUsed && (
                <Typography variant="caption" sx={{ position: 'absolute', right: 16, fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'white', opacity: 0.6 }}>
                  Last Used
                </Typography>
              )}
            </Button>
          </Stack>
        );

      case 'email':
        return (
          <form onSubmit={handleSendOTP}>
            <Stack spacing={2}>
              <TextField
                fullWidth
                autoFocus
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                variant="standard"
                InputProps={{
                  disableUnderline: true,
                  startAdornment: <Mail size={18} style={{ color: '#9B9691', marginRight: 12 }} />,
                  sx: {
                    bgcolor: '#0A0908',
                    color: 'white',
                    p: 2,
                    borderRadius: '16px',
                    border: '1px solid #34322F',
                    fontFamily: 'var(--font-satoshi)',
                    fontWeight: 500,
                  }
                }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading || !email}
                sx={{
                  bgcolor: '#FFFFFF',
                  color: '#000',
                  height: 52,
                  borderRadius: '16px',
                  fontWeight: 900,
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#F2F2F2' }
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Send Login Code'}
              </Button>
            </Stack>
          </form>
        );

      case 'otp':
        return (
          <Box>
            <Stack spacing={2}>
              <Typography variant="body2" sx={{ color: '#9B9691', textAlign: 'center', mb: 1 }}>
                We sent a 6-digit code to <strong>{email}</strong>
              </Typography>
              <TextField
                fullWidth
                autoFocus
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                disabled={loading}
                variant="standard"
                inputProps={{ style: { textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.5rem', fontWeight: 900 } }}
                InputProps={{
                  disableUnderline: true,
                  sx: {
                    bgcolor: '#0A0908',
                    color: 'white',
                    p: 2,
                    borderRadius: '16px',
                    border: '1px solid #34322F',
                  }
                }}
              />
              {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <CircularProgress size={24} color="primary" />
                </Box>
              )}
            </Stack>
          </Box>
        );

      case 'mfa':
        return (
          <Box>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Fingerprint size={48} color="#6366F1" />
                  <Typography variant="h6" sx={{ color: 'white', fontWeight: 900 }}>Two-Factor Auth</Typography>
                  <Typography variant="body2" sx={{ color: '#9B9691', textAlign: 'center' }}>
                      Enter the code from your authenticator app to continue.
                  </Typography>
              </Box>
              <TextField
                fullWidth
                autoFocus
                placeholder="Enter 2FA code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                disabled={loading}
                variant="standard"
                inputProps={{ style: { textAlign: 'center', letterSpacing: '0.2em', fontSize: '1.2rem', fontWeight: 900 } }}
                InputProps={{
                  disableUnderline: true,
                  sx: {
                    bgcolor: '#0A0908',
                    color: 'white',
                    p: 2,
                    borderRadius: '16px',
                    border: '1px solid #34322F',
                  }
                }}
              />
              {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <CircularProgress size={24} color="primary" />
                </Box>
              )}
            </Stack>
          </Box>
        );
      
      default: return null;
    }
  };

  return (
    <Drawer 
      anchor={isDesktop ? 'right' : 'bottom'} 
      open={isOpen} 
      onClose={handleClose}
      PaperProps={{
        sx: {
          bgcolor: '#161412',
          backgroundImage: 'none',
          maxWidth: 480,
          width: '100%',
          ...(isDesktop ? {
            height: '100%',
            borderLeft: '1px solid #34322F',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
          } : {
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            borderTop: '1px solid #34322F',
            mx: 'auto'
          })
        }
      }}
      ModalProps={{
        keepMounted: false,
        disableScrollLock: false,
        disablePortal: true,
        hideBackdrop: false,
      }}
    >
      <Box sx={{ p: 3, pb: 'calc(24px + env(safe-area-inset-bottom))' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {step !== 'initial' && (
              <IconButton onClick={handleBack} size="small" sx={{ color: '#9B9691', ml: -1 }}>
                <ArrowLeft size={20} />
              </IconButton>
            )}
            <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', color: '#fff', fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
              {step === 'mfa' ? 'Security Verification' : 'Continue to Kylrix'}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} sx={{ color: '#9B9691' }}>
            <X size={20} />
          </IconButton>
        </Box>

        {renderStep()}

        <Typography sx={{ color: '#9B9691', fontSize: '0.75rem', textAlign: 'center', mt: 4, fontWeight: 500 }}>
          By continuing, you agree to our{' '}
          <Link
            href="/terms-of-service"
            onClick={handleClose}
            style={{ color: '#FFFFFF', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy-policy"
            onClick={handleClose}
            style={{ color: '#FFFFFF', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Privacy Policy
          </Link>.
        </Typography>
      </Box>
    </Drawer>
  );
}
