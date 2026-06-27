'use client';

import { useEffect, useState } from 'react';
import {
  beginMfaChallenge,
  completeMfaChallenge,
  getLoginChallengeFactors,
  getPreferredLoginChallengeFactor,
  listCurrentMfaFactors,
  type MfaChallengeFactor,
  type MfaFactorsLike,
  type MfaLoginMethod,
} from '@/lib/mfa';
import toast from 'react-hot-toast';
import { Close as CloseIcon } from '@/lib/openbricks/icons';
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
} from '@/lib/openbricks/primitives';

type Props = {
  open: boolean;
  onClose: () => void;
  loginMethod: MfaLoginMethod;
  onSuccess: () => void;
};

export function MfaChallengeDrawer({ open, onClose, loginMethod, onSuccess }: Props) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [loading, setLoading] = useState(false);
  const [factors, setFactors] = useState<MfaFactorsLike | null>(null);
  const [activeFactor, setActiveFactor] = useState<MfaChallengeFactor | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);

  const allowedFactors = getLoginChallengeFactors(loginMethod, factors);

  useEffect(() => {
    if (!open) return;
    setChallengeId(null);
    setActiveFactor(null);
    setOtp('');
    setError(null);
  }, [loginMethod, open]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;

    (async () => {
      try {
        const nextFactors = await listCurrentMfaFactors();
        if (!mounted) return;
        setFactors(nextFactors);
        const preferred = getPreferredLoginChallengeFactor(loginMethod, nextFactors);
        setActiveFactor(preferred);
      } catch {
        if (mounted) setFactors(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loginMethod, open]);

  const startChallenge = async (picked: MfaChallengeFactor) => {
    setLoading(true);
    setError(null);
    try {
      const id = await beginMfaChallenge(picked);
      setActiveFactor(picked);
      setChallengeId(id);
      setOtp('');
    } catch (err) {
      const message = (err as { message?: string })?.message || 'Failed to start MFA challenge.';
      setError(message);
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
      await completeMfaChallenge(challengeId, otp.trim());
      toast.success('Second factor verified.');
      onSuccess();
    } catch (err) {
      const message = (err as { message?: string })?.message || 'MFA verification failed.';
      setError(message);
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
              Finish login with a second factor.
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mb: 3 }}>
          <Chip label={`Login: ${loginMethod}`} sx={{ bgcolor: '#1F1D1B', color: 'white' }} />
          {factors ? (
            <>
              <Chip label={`Email: ${factors.email ? 'on' : 'off'}`} sx={{ bgcolor: '#1F1D1B', color: 'white' }} />
              <Chip label={`TOTP: ${factors.totp ? 'on' : 'off'}`} sx={{ bgcolor: '#1F1D1B', color: 'white' }} />
            </>
          ) : null}
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 3 }} />

        {!challengeId ? (
          <Stack spacing={2.25}>
            <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              {loginMethod === 'email-otp'
                ? 'Email already handled your first factor. Use TOTP or a recovery code.'
                : 'Pick the factor enabled on this account.'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {allowedFactors.includes('email') && (
                <Button variant="outlined" onClick={() => startChallenge('email')} disabled={loading} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.12)', textTransform: 'none' }}>
                  Email challenge
                </Button>
              )}
              {allowedFactors.includes('totp') && (
                <Button variant="contained" onClick={() => startChallenge('totp')} disabled={loading} sx={{ bgcolor: '#6366F1', color: 'white', textTransform: 'none', fontWeight: 800 }}>
                  {loading && activeFactor === 'totp' ? <CircularProgress size={18} sx={{ color: 'white', mr: 1 }} /> : null}
                  TOTP
                </Button>
              )}
              {allowedFactors.includes('recoverycode') && (
                <Button variant="outlined" onClick={() => startChallenge('recoverycode')} disabled={loading} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.12)', textTransform: 'none' }}>
                  Recovery code
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
              <Typography sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
                Enter the {activeFactor === 'recoverycode' ? 'recovery' : activeFactor} code
              </Typography>
              <TextField
                value={otp}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  const raw = event.target.value.trim();
                  if (activeFactor === 'recoverycode') {
                    setOtp(raw.replace(/\s+/g, '').slice(0, 20));
                    return;
                  }
                  setOtp(raw.replace(/\D/g, '').slice(0, 6));
                }}
                placeholder={activeFactor === 'recoverycode' ? 'Recovery code' : '6-digit code'}
                fullWidth
                autoFocus
                sx={{
                  '& .ob-input-root': {
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
                disabled={loading || (activeFactor === 'recoverycode' ? otp.trim().length < 8 : otp.trim().length < 6)}
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
