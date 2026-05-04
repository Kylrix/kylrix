'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
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
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { AuthenticationFactor, AuthenticatorType } from 'appwrite';
import { account, avatars } from '@/lib/appwrite';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import toast from 'react-hot-toast';

type LoginMethod = 'email-otp' | 'oauth2' | 'password' | 'unknown';

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  emailVerified?: boolean;
  loginMethod: LoginMethod;
  onEnabled?: () => void;
  mode?: 'setup' | 'reminder';
};

type Step = 'summary' | 'email-init' | 'email-verify' | 'totp' | 'done';

const RECOVERY_COPY_HINT = 'Save these recovery codes in a secure place. They are shown once.';

export function TwoFactorDrawer({
  open,
  onClose,
  userId,
  emailVerified = true,
  loginMethod,
  onEnabled,
  mode = 'setup',
}: Props) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const [loading, setLoading] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [step, setStep] = useState<Step>('summary');
  const [emailChallengeId, setEmailChallengeId] = useState<string | null>(null);
  const [emailOtp, setEmailOtp] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [totpQr, setTotpQr] = useState('');
  const [totpOtp, setTotpOtp] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canUseEmailFactor = loginMethod !== 'email-otp' && emailVerified;
  const isTwoFactorOn = emailEnabled && totpEnabled;

  const refreshFactors = useCallback(async () => {
    try {
      const factors = await account.listMfaFactors();
      setEmailEnabled(Boolean((factors as any)?.email));
      setTotpEnabled(Boolean((factors as any)?.totp));
      return factors as any;
    } catch (_err) {
      setEmailEnabled(false);
      setTotpEnabled(false);
      return null;
    }
  }, []);

  const persistRecoveryCodes = useCallback(async (codes: string[]) => {
    if (!codes.length) return;
    await ecosystemSecurity.saveRecoveryIdentity(userId, codes, {
      source: 'appwrite-mfa',
      primaryFactor: 'totp',
      loginMethod,
    });
  }, [loginMethod, userId]);

  const copyToClipboard = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  };

  const stampMfaPrefs = useCallback(async () => {
    const currentPrefs = await account.getPrefs().catch(() => ({}));
    const now = new Date().toISOString();
    await account.updatePrefs({
      ...currentPrefs,
      mfaEnabledAt: now,
      mfaLastVerifiedAt: now,
      mfaPrimaryFactor: 'totp',
      mfaFactors: {
        email: true,
        totp: true,
      },
    });
  }, []);

  const finalizeTwoFactor = useCallback(async () => {
    await account.updateMFA({ mfa: true });
    await stampMfaPrefs();

    let recovery: string[] = [];
    try {
      const response = await account.createMfaRecoveryCodes();
      recovery = response.recoveryCodes || [];
    } catch (_err) {
      // Recovery codes are best-effort.
    }

    setRecoveryCodes(recovery);
    if (recovery.length > 0) {
      await persistRecoveryCodes(recovery);
      toast.success(RECOVERY_COPY_HINT);
    }

    setStep('done');
    onEnabled?.();
    await refreshFactors();
  }, [onEnabled, persistRecoveryCodes, refreshFactors, stampMfaPrefs]);

  const sendEmailCode = useCallback(async () => {
    if (!canUseEmailFactor) {
      throw new Error('Email verification is not available for this login method.');
    }

    setLoading(true);
    setError(null);
    try {
      if (!vaultUnlocked) {
        throw new Error('Unlock the vault before enabling 2FA so recovery codes can be saved.');
      }
      const response = await account.createMfaChallenge({
        factor: 'email' as AuthenticationFactor,
      });
      setEmailChallengeId((response as any).$id);
      setEmailOtp('');
      setStep('email-verify');
    } catch (_err) {
      const err = _err as any;
      setError(err?.message || 'Failed to send the email code.');
    } finally {
      setLoading(false);
    }
  }, [canUseEmailFactor, vaultUnlocked]);

  const verifyEmailChallenge = async () => {
    if (!emailChallengeId) {
      setError('Start the email challenge first.');
      return;
    }

    if (emailOtp.trim().length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (!vaultUnlocked) {
        throw new Error('Unlock the vault before continuing to TOTP setup.');
      }
      await account.updateMfaChallenge({
        challengeId: emailChallengeId,
        otp: emailOtp.trim(),
      });
      await refreshFactors();
      await startTotpSetup();
    } catch (_err) {
      const err = _err as any;
      setError(err?.message || 'Email verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const startTotpSetup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!vaultUnlocked) {
        throw new Error('Unlock the vault before setting up TOTP.');
      }
      if (!emailEnabled && !canUseEmailFactor) {
        throw new Error('Email factor must be available before TOTP can be enabled.');
      }
      if (totpEnabled) {
        await finalizeTwoFactor();
        return;
      }
      const { secret, uri } = await account.createMfaAuthenticator({ type: AuthenticatorType.Totp });
      setTotpSecret(secret);
      setTotpUri(uri);
      try {
        const qr = await avatars.getQR({ text: uri, size: 320, margin: 0, download: false });
        setTotpQr(qr.toString());
      } catch {
        setTotpQr('');
      }
      setTotpOtp('');
      setStep('totp');
    } catch (_err) {
      const err = _err as any;
      setError(err?.message || 'Failed to create TOTP setup.');
    } finally {
      setLoading(false);
    }
  }, [canUseEmailFactor, emailEnabled, finalizeTwoFactor, totpEnabled, vaultUnlocked]);

  const verifyTotpSetup = async () => {
    if (totpOtp.trim().length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (!vaultUnlocked) {
        throw new Error('Unlock the vault before saving recovery codes.');
      }
      await account.updateMfaAuthenticator({
        type: AuthenticatorType.Totp,
        otp: totpOtp.trim(),
      });
      await finalizeTwoFactor();
    } catch (_err) {
      const err = _err as any;
      setError(err?.message || 'TOTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const disableTwoFactor = async () => {
    setLoading(true);
    setError(null);
    try {
      if (totpEnabled) {
        await (account as any).deleteMfaAuthenticator({ type: 'totp' });
      }
      if (emailEnabled) {
        await (account as any).deleteMfaAuthenticator({ type: 'email' });
      }
      await account.updateMFA({ mfa: false });
      const currentPrefs = await account.getPrefs().catch(() => ({}));
      await account.updatePrefs({
        ...currentPrefs,
        mfaEnabledAt: null,
        mfaLastVerifiedAt: null,
        mfaPrimaryFactor: null,
        mfaFactors: {
          email: false,
          totp: false,
        },
      });
      setRecoveryCodes([]);
      setStep('summary');
      await refreshFactors();
      toast.success('2FA turned off.');
    } catch (_err) {
      const err = _err as any;
      setError(err?.message || 'Unable to disable 2FA.');
    } finally {
      setLoading(false);
    }
  };

  const startTwoFactorSetup = async () => {
    setError(null);
    setEmailChallengeId(null);
    setEmailOtp('');
    setTotpSecret('');
    setTotpUri('');
    setTotpQr('');
    setTotpOtp('');
    setRecoveryCodes([]);
    setStep('email-init');
  };

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    setStep('summary');
    setEmailChallengeId(null);
    setEmailOtp('');
    setTotpSecret('');
    setTotpUri('');
    setTotpQr('');
    setTotpOtp('');
    setRecoveryCodes([]);
    setError(null);
    setVaultUnlocked(ecosystemSecurity.status.isUnlocked);

    (async () => {
      const fresh = await refreshFactors();
      if (!mounted) return;

      if (fresh?.email && fresh?.totp) {
        setStep('done');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, refreshFactors]);

  useEffect(() => {
    if (!open) return;
    const interval = window.setInterval(() => {
      setVaultUnlocked(ecosystemSecurity.status.isUnlocked);
    }, 500);
    return () => window.clearInterval(interval);
  }, [open]);

  const primaryActionLabel = isTwoFactorOn ? 'Turn off 2FA' : 'Enable 2FA';

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
              {mode === 'reminder' ? 'Set up 2FA' : '2FA'}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem' }}>
              Email first, then TOTP.
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 3 }} />

        {step === 'summary' && (
          <Stack spacing={2.5}>
            {error && (
              <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#161514', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                <Typography sx={{ color: '#f87171' }}>{error}</Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={isTwoFactorOn ? disableTwoFactor : startTwoFactorSetup}
                disabled={loading || (!isTwoFactorOn && !canUseEmailFactor)}
                sx={{ bgcolor: '#6366F1', color: 'white', fontWeight: 800, textTransform: 'none' }}
              >
                {loading ? <CircularProgress size={18} sx={{ color: 'white', mr: 1 }} /> : null}
                {primaryActionLabel}
              </Button>
            </Box>
          </Stack>
        )}

        {step === 'email-init' && (
          <Stack spacing={2.5}>
            <Box sx={{ p: 2.5, borderRadius: '20px', bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography sx={{ color: 'white', fontWeight: 700, mb: 1 }}>1. Send email code</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.92rem', mb: 2, lineHeight: 1.6 }}>
                We need to send a verification code to your email before TOTP can be set up.
              </Typography>
              <Button
                variant="contained"
                onClick={sendEmailCode}
                disabled={loading || !canUseEmailFactor}
                sx={{ bgcolor: '#6366F1', color: 'white', fontWeight: 800, textTransform: 'none' }}
              >
                {loading ? <CircularProgress size={18} sx={{ color: 'white', mr: 1 }} /> : null}
                Send email code
              </Button>
            </Box>

            {error && (
              <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#161514', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                <Typography sx={{ color: '#f87171' }}>{error}</Typography>
              </Box>
            )}
          </Stack>
        )}

        {step === 'email-verify' && (
          <Stack spacing={2.5}>
            <Box sx={{ p: 2.5, borderRadius: '20px', bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography sx={{ color: 'white', fontWeight: 700, mb: 1 }}>1. Verify email</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.92rem', mb: 2, lineHeight: 1.6 }}>
                Confirm the code sent to your email, then we’ll move straight to TOTP setup.
              </Typography>
              <TextField
                value={emailOtp}
                onChange={(event) => setEmailOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    borderRadius: '16px',
                    bgcolor: '#161514',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                  },
                  mt: 1,
                }}
              />
              <Button
                variant="contained"
                onClick={verifyEmailChallenge}
                disabled={loading || emailOtp.trim().length !== 6 || !vaultUnlocked}
                sx={{ mt: 2, bgcolor: '#6366F1', color: 'white', fontWeight: 800, textTransform: 'none' }}
              >
                {loading ? <CircularProgress size={18} sx={{ color: 'white', mr: 1 }} /> : null}
                Verify email and continue
              </Button>
            </Box>

            {error && (
              <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#161514', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                <Typography sx={{ color: '#f87171' }}>{error}</Typography>
              </Box>
            )}
          </Stack>
        )}

        {step === 'totp' && (
          <Stack spacing={2.5}>
            <Box sx={{ p: 2.5, borderRadius: '20px', bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography sx={{ color: 'white', fontWeight: 700, mb: 1 }}>2. Set up TOTP</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.92rem', mb: 2 }}>
                Add this account to your authenticator app, then enter the 6-digit code to finish.
              </Typography>
              {totpQr ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <Box component="img" src={totpQr} alt="TOTP QR code" sx={{ width: 220, height: 220, borderRadius: 4, bgcolor: 'white', p: 1 }} />
                </Box>
              ) : null}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography sx={{ fontFamily: 'var(--font-mono)', color: 'white', wordBreak: 'break-all', fontSize: '0.82rem' }}>
                  {totpUri || totpSecret}
                </Typography>
                <IconButton onClick={() => copyToClipboard(totpUri || totpSecret, 'Copied setup secret.')} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>

            <Box sx={{ p: 2.5, borderRadius: '20px', bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography sx={{ color: 'white', fontWeight: 700, mb: 1 }}>3. Verify TOTP</Typography>
              <TextField
                value={totpOtp}
                onChange={(event) => setTotpOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    borderRadius: '16px',
                    bgcolor: '#161514',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                  },
                  mt: 1,
                }}
              />
              <Button
                variant="contained"
                onClick={verifyTotpSetup}
                disabled={loading || totpOtp.trim().length !== 6 || !vaultUnlocked}
                sx={{ mt: 2, bgcolor: '#6366F1', color: 'white', fontWeight: 800, textTransform: 'none' }}
              >
                {loading ? <CircularProgress size={18} sx={{ color: 'white', mr: 1 }} /> : null}
                Verify and enable 2FA
              </Button>
            </Box>

            {error && (
              <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#161514', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                <Typography sx={{ color: '#f87171' }}>{error}</Typography>
              </Box>
            )}
          </Stack>
        )}

        {step === 'done' && (
          <Stack spacing={2.5}>
            <Box sx={{ p: 2.5, borderRadius: '20px', bgcolor: '#1F1D1B', border: '1px solid rgba(16,185,129,0.18)' }}>
              <Typography sx={{ color: 'white', fontWeight: 800, mb: 1 }}>2FA is active</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.92rem' }}>
                Email and TOTP are both enabled.
              </Typography>
            </Box>

            {recoveryCodes.length > 0 && (
              <Box sx={{ p: 2.5, borderRadius: '20px', bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography sx={{ color: 'white', fontWeight: 700, mb: 1 }}>Recovery codes</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', mb: 2 }}>
                  {RECOVERY_COPY_HINT}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                  {recoveryCodes.map((code) => (
                    <Box key={code} sx={{ p: 1.25, borderRadius: '12px', bgcolor: '#161514', fontFamily: 'var(--font-mono)', color: 'white', fontSize: '0.82rem' }}>
                      {code}
                    </Box>
                  ))}
                </Box>
                <Button
                  onClick={() => copyToClipboard(recoveryCodes.join('\n'), 'Recovery codes copied.')}
                  variant="outlined"
                  sx={{ mt: 2, color: 'white', borderColor: 'rgba(255,255,255,0.12)', textTransform: 'none' }}
                >
                  Copy recovery codes
                </Button>
              </Box>
            )}

            <Button
              variant="contained"
              onClick={onClose}
              sx={{ bgcolor: '#6366F1', color: 'white', fontWeight: 800, textTransform: 'none', alignSelf: 'flex-start' }}
            >
              Done
            </Button>
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
