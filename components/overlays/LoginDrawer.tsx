'use client';

import React, { useState } from 'react';
import { Box, Typography, Button, Divider, IconButton, TextField, Stack, CircularProgress, Alert } from '@mui/material';
import { X, Mail } from 'lucide-react';
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

export function LoginDrawer() {
  const { activeContent, close } = useUnifiedDrawer();
  const { loginWithEmailOTP, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const isOpen = activeContent === 'login';

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      // In Kylrix, email auth is often a single-step token or OTP request via Server SDK
      // We'll use the existing useAuth hook method
      await loginWithEmailOTP(email);
      setOtpSent(true);
      toast.success('Magic link sent to your email');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send login email');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setOtpSent(false);
    setEmail('');
    setOtp('');
  };

  const handleClose = () => {
    handleReset();
    close();
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
          <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', color: '#fff', fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
            {otpSent ? 'Check your email' : 'Continue to Kylrix'}
          </Typography>
          <IconButton onClick={handleClose} sx={{ color: '#9B9691' }}>
            <X size={20} />
          </IconButton>
        </Box>

        {!otpSent ? (
          <Stack spacing={2.5}>
            <OAuthButtons disabled={loading} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 1 }}>
              <Divider sx={{ flex: 1, borderColor: '#34322F' }} />
              <Typography variant="caption" sx={{ color: '#9B9691', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                or
              </Typography>
              <Divider sx={{ flex: 1, borderColor: '#34322F' }} />
            </Box>

            <form onSubmit={handleSendOTP}>
              <Stack spacing={1.5}>
                <TextField
                  fullWidth
                  placeholder="Email address"
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
                    fontSize: '0.95rem',
                    textTransform: 'none',
                    fontFamily: 'var(--font-satoshi)',
                    '&:hover': { bgcolor: '#F2F2F2' },
                    '&:disabled': { bgcolor: '#34322F', color: '#9B9691' }
                  }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Continue with Email'}
                </Button>
              </Stack>
            </form>
          </Stack>
        ) : (
          <Stack spacing={3} alignItems="center" sx={{ textAlign: 'center', py: 2 }}>
            <Box sx={{ 
                width: 64, 
                height: 64, 
                borderRadius: '20px', 
                bgcolor: alpha('#6366F1', 0.1), 
                display: 'grid', 
                placeItems: 'center',
                color: '#6366F1',
                mb: 1
            }}>
                <Mail size={32} />
            </Box>
            <Box>
                <Typography variant="body1" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
                    We sent a magic link to {email}
                </Typography>
                <Typography variant="body2" sx={{ color: '#9B9691' }}>
                    Click the link in the email to sign in instantly.
                </Typography>
            </Box>
            <Button 
                onClick={handleReset} 
                sx={{ color: '#6366F1', fontWeight: 800, textTransform: 'none' }}
            >
                Use a different method
            </Button>
          </Stack>
        )}

        <Typography sx={{ color: '#9B9691', fontSize: '0.75rem', textAlign: 'center', mt: 4, fontWeight: 500 }}>
          By continuing, you agree to our Terms and Privacy Policy.
        </Typography>
      </Box>
    </Drawer>
  );
}
