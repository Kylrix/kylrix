'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { AuthenticationFactor } from 'appwrite';
import { account } from '@/lib/appwrite';
import toast from 'react-hot-toast';

type LoginMethod = 'email-otp' | 'oauth2' | 'password' | 'unknown';
type Factor = 'email' | 'totp' | 'recoverycode';

type Props = {
  open: boolean;
  onClose: () => void;
  loginMethod: LoginMethod;
  onSuccess: () => void;
};

export function MfaChallengeDrawer({ open, onClose, loginMethod, onSuccess }: Props) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<{ email: boolean; totp: boolean; phone: boolean } | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);

  const allowedFactors = useMemo(() => {
    const canUseEmail = loginMethod !== 'email-otp';
    return [
      ...(canUseEmail ? (['email'] as Factor[]) : []),
      'totp' as Factor,
    ];
  }, [loginMethod]);

  useEffect(() => {
    if (!open) return;
    setChallengeId(null);
    setOtp('');
    setError(null);
  }, [loginMethod, open]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      try {
        const factors = await account.listMfaFactors();
        if (mounted) setAvailable(factors as any);
      } catch (_err) {
        if (mounted) setAvailable(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open]);

  const beginChallenge = async (picked: Factor) => {
    setLoading(true);
    setError(null);
    try {
      const response = await account.createMfaChallenge({ factor: picked as unknown as AuthenticationFactor });
      setChallengeId((response as any).$id);
    } catch (_err) {
      const err = _err as any;
      setError(err?.message || 'Failed to start MFA challenge.');
    } finally {
      setLoading(false);
    }
  };

  const verifyChallenge = async () => {
    if (!challengeId) {
      setError('Start the challenge first.');
      return;
    }
    if (otp.trim().length < 6) {
      setError('Enter the code from your second factor.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await account.updateMfaChallenge({
        challengeId,
        otp: otp.trim(),
      });
      const currentPrefs = await account.getPrefs().catch(() => ({}));
      await account.updatePrefs({
        ...currentPrefs,
        mfaLastVerifiedAt: new Date().toISOString(),
      });
      toast.success('Second factor verified.');
      onSuccess();
    } catch (_err) {
      const err = _err as any;
      setError(err?.message || 'MFA verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      anchor={isDesktop ? 'right' : 'bottom'}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: isDesktop ? 'min(480px, 90vw)' : '100%',
          maxWidth: '100%',
          borderTopLeftRadius: isDesktop ? 0 : '28px',
          borderTopRightRadius: isDesktop ? 0 : '28px',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          backgroundColor: 'rgba(10, 10, 10, 0.98)',
          backdropFilter: 'blur(28px) saturate(180%)',
          borderTop: isDesktop ? 0 : '1px solid rgba(255, 255, 255, 0.08)',
          borderLeft: isDesktop ? '1px solid rgba(255, 255, 255, 0.08)' : 0,
          backgroundImage: 'none',
          p: 0,
        },
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 620, mx: 'auto', px: { xs: 2, md: 4 }, py: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
          <Box>
            <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '1.2rem', letterSpacing: '-0.03em' }}>
              Complete MFA
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem' }}>
              Use the factor you already set up to finish login.
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mb: 3 }}>
          <Chip label={`Login: ${loginMethod}`} sx={{ bgcolor: '#1F1D1B', color: 'white' }} />
          {available ? (
            <>
              <Chip
                label={`Email: ${available.email ? 'available' : 'off'}`}
                sx={{ bgcolor: '#1F1D1B', color: 'white' }}
              />
              <Chip
                label={`TOTP: ${available.totp ? 'enabled' : 'off'}`}
                sx={{ bgcolor: '#1F1D1B', color: 'white' }}
              />
            </>
          ) : null}
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 3 }} />

        {!challengeId ? (
          <Stack spacing={2.25}>
            <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              {loginMethod === 'email-otp'
                ? 'Only TOTP is available here because email OTP already handled your first factor.'
                : 'Pick the factor that is actually enabled on this account.'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {(available?.email || (!available && loginMethod !== 'email-otp')) && allowedFactors.includes('email') && (
                <Button variant="outlined" onClick={() => beginChallenge('email')} disabled={loading} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.12)', textTransform: 'none' }}>
                  Email challenge
                </Button>
              )}
              {(available?.totp !== false || !available) && (
                <Button variant="contained" onClick={() => beginChallenge('totp')} disabled={loading} sx={{ bgcolor: '#6366F1', color: 'white', textTransform: 'none', fontWeight: 800 }}>
                {loading ? <CircularProgress size={18} sx={{ color: 'white', mr: 1 }} /> : null}
                TOTP
                </Button>
              )}
            </Box>
            {error && (
              <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#161514', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                <Typography sx={{ color: '#f87171' }}>{error}</Typography>
              </Box>
            )}
          </Stack>
        ) : (
          <Stack spacing={2.25}>
            <Box sx={{ p: 2.5, borderRadius: '20px', bgcolor: '#161514', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <Typography sx={{ color: 'white', fontWeight: 700, mb: 1 }}>Enter the code</Typography>
              <TextField
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                fullWidth
                autoFocus
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    borderRadius: '16px',
                    bgcolor: '#161514',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                  },
                }}
              />
              <Button
                variant="contained"
                onClick={verifyChallenge}
                disabled={loading || otp.trim().length < 6}
                sx={{ mt: 2, bgcolor: '#6366F1', color: 'white', fontWeight: 800, textTransform: 'none' }}
              >
                {loading ? <CircularProgress size={18} sx={{ color: 'white', mr: 1 }} /> : null}
                Verify
              </Button>
            </Box>
            {error && (
              <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#161514', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                <Typography sx={{ color: '#f87171' }}>{error}</Typography>
              </Box>
            )}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}

