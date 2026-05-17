'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Typography, Button, Divider, IconButton, TextField, Stack, CircularProgress, alpha } from '@mui/material';
import { X, Mail, ArrowLeft, Fingerprint } from 'lucide-react';
import Drawer from '@mui/material/Drawer';
import { useAuth } from '@/context/auth/AuthContext';
import OAuthButtons from '@/components/OAuthButtons';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import toast from 'react-hot-toast';

const DRAWER_SX = {
  borderTopLeftRadius: '24px',
  borderTopRightRadius: '24px',
  bgcolor: '#161412',
  borderTop: '1px solid #34322F',
  backgroundImage: 'none',
  maxWidth: 480,
  width: '100%',
  mx: 'auto'
};

type LoginStep = 'initial' | 'email' | 'otp' | 'mfa';

export function LoginDrawer() {
  const { activeContent, close } = useUnifiedDrawer();
  const { loginWithEmailOTP, verifyEmailOTP, verifyMFA } = useAuth();
  
  const [step, setStep] = useState<LoginStep>('initial');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [otp, setOtp] = useState('');
  const [mfaChallengeId, setMfaChallengeId] = useState('');
  const [loading, setLoading] = useState(false);

  const isOpen = activeContent === 'login';

  const handleSendOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email) return;
    setLoading(true);
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
        return (
          <Stack spacing={2}>
            <OAuthButtons disabled={loading} />
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setStep('email')}
              startIcon={<Mail size={18} />}
              sx={{
                bgcolor: 'rgba(255,255,255,0.03)',
                color: 'white',
                border: '1px solid #34322F',
                height: 52,
                borderRadius: '16px',
                fontWeight: 800,
                textTransform: 'none',
                fontFamily: 'var(--font-satoshi)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' }
              }}
            >
              Continue with Email
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
      anchor="bottom" 
      open={isOpen} 
      onClose={handleClose}
      PaperProps={{ sx: DRAWER_SX }}
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
          By continuing, you agree to our Terms and Privacy Policy.
        </Typography>
      </Box>
    </Drawer>
  );
}
