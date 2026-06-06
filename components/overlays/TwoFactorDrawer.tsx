'use client';

import { useCallback, useEffect, useState } from 'react';
import { AuthenticationFactor, AuthenticatorType } from 'appwrite';
import { account, avatars } from '@/lib/appwrite';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import toast from 'react-hot-toast';
import { 
  X, 
  Copy, 
  Mail, 
  Smartphone, 
  ShieldCheck, 
  Download, 
  CheckCircle2, 
  ArrowRight,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  AlertTriangle
} from 'lucide-react';
import { 
  Drawer, 
  useTheme, 
  useMediaQuery, 
  Box, 
  Typography, 
  Stack, 
  Button, 
  IconButton, 
  alpha,
  CircularProgress,
  Paper
} from '@/lib/mui-tailwind/material';

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

const RECOVERY_COPY_HINT = 'Save these recovery codes in a secure place. They are shown only once.';
const BRAND_INDIGO = '#6366F1';
const BRAND_EMERALD = '#10B981';

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

  const downloadRecoveryCodes = () => {
    if (!recoveryCodes.length) return;
    const blob = new Blob([`KYLRIX ECOSYSTEM RECOVERY CODES\nGenerated: ${new Date().toISOString()}\n\n${recoveryCodes.join('\n')}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kylrix-recovery-${userId.slice(0, 6)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Recovery codes downloaded.');
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
    if (!window.confirm("Are you sure you want to turn off 2FA? This will reduce your account security.")) return;
    
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

  if (!open) return null;

  return (
    <Drawer
      anchor={isDesktop ? 'right' : 'bottom'}
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: false }}
      PaperProps={{
        sx: {
          bgcolor: '#161412',
          backgroundImage: 'none',
          ...(isDesktop ? {
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            height: '100%',
            maxWidth: 480,
            width: '100%'
          } : {
            borderTop: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '32px 32px 0 0',
            maxHeight: '90dvh',
          }),
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      {/* Header */}
      <Box sx={{ px: 4, py: 3, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#161412', zIndex: 10 }}>
        <Box>
          <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '1.1rem', fontClash: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
            {mode === 'reminder' ? 'Secure Your Account' : '2FA Configuration'}
          </Typography>
          <Typography sx={{ color: 'white/40', fontSize: '0.75rem', fontWeight: 600 }}>
            Mandatory Flow: Email Verification → TOTP Setup
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white/30', '&:hover': { color: 'white', bgcolor: 'white/5' } }}>
          <X size={20} />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 4, flex: 1, overflowY: 'auto', bgcolor: '#0A0908' }}>
        {error && (
          <Box sx={{ mb: 4, p: 3, borderRadius: '16px', bgcolor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
            <Typography sx={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.5 }}>
              {error}
            </Typography>
          </Box>
        )}

        {step === 'summary' && (
          <Stack spacing={4} className="animate-fadeIn">
            <Box sx={{ p: 3, borderRadius: '24px', bgcolor: '#161412', border: '1px solid rgba(255,255,255,0.03)' }}>
              <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.9rem', mb: 1 }}>Ecosystem Security Protocol</Typography>
              <Typography sx={{ color: 'white/50', fontSize: '0.8rem', lineHeight: 1.6 }}>
                Enabling Two-Factor Authentication adds an extra layer of protection to your Kylrix identity. We require email verification as a fallback before setting up your primary TOTP factor.
              </Typography>
            </Box>

            <Button
              variant="contained"
              fullWidth
              onClick={isTwoFactorOn ? disableTwoFactor : startTwoFactorSetup}
              disabled={loading || (!isTwoFactorOn && !canUseEmailFactor)}
              sx={{
                py: 2,
                borderRadius: '16px',
                bgcolor: isTwoFactorOn ? 'rgba(239, 68, 68, 0.1)' : BRAND_INDIGO,
                color: isTwoFactorOn ? '#ef4444' : 'white',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                '&:hover': { bgcolor: isTwoFactorOn ? 'rgba(239, 68, 68, 0.2)' : '#4f46e5' }
              }}
            >
              {loading ? <CircularProgress size={20} color="inherit" /> : (isTwoFactorOn ? 'Deactivate 2FA' : 'Begin Setup')}
            </Button>
          </Stack>
        )}

        {step === 'email-init' && (
          <Stack spacing={4} className="animate-fadeIn">
            <Box sx={{ p: 4, borderRadius: '24px', bgcolor: '#161412', border: '1px solid rgba(255,255,255,0.03)', textAlign: 'center' }}>
              <Box sx={{ width: 64, height: 64, borderRadius: '20px', bgcolor: alpha(BRAND_INDIGO, 0.1), color: BRAND_INDIGO, display: 'grid', placeItems: 'center', mx: 'auto', mb: 3 }}>
                <Mail size={32} />
              </Box>
              <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '1.1rem', mb: 1 }}>1. Email Verification</Typography>
              <Typography sx={{ color: 'white/40', fontSize: '0.85rem', mb: 4 }}>
                We'll send a 6-digit code to verify your primary email relay.
              </Typography>
              <Button
                variant="contained"
                fullWidth
                onClick={sendEmailCode}
                disabled={loading}
                sx={{ py: 1.75, borderRadius: '14px', bgcolor: BRAND_INDIGO, fontWeight: 900 }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Send Code'}
              </Button>
            </Box>
          </Stack>
        )}

        {step === 'email-verify' && (
          <Stack spacing={4} className="animate-fadeIn">
            <Box sx={{ p: 4, borderRadius: '24px', bgcolor: '#161412', border: '1px solid rgba(255,255,255,0.03)' }}>
              <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '1rem', mb: 2 }}>Enter Verification Code</Typography>
              <Box 
                component="input"
                type="text"
                value={emailOtp}
                onChange={(e: any) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                sx={{
                  width: '100%',
                  bgcolor: '#0A0908',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  px: 3,
                  py: 2,
                  fontSize: '1.5rem',
                  fontWeight: 900,
                  textAlign: 'center',
                  letterSpacing: '0.25em',
                  mb: 4,
                  outline: 'none',
                  '&:focus': { borderColor: BRAND_INDIGO }
                }}
              />
              <Button
                variant="contained"
                fullWidth
                onClick={verifyEmailChallenge}
                disabled={loading || emailOtp.length !== 6 || !vaultUnlocked}
                sx={{ py: 1.75, borderRadius: '14px', bgcolor: BRAND_INDIGO, fontWeight: 900 }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Verify & Continue'}
              </Button>
              {!vaultUnlocked && (
                <Typography sx={{ color: '#F59E0B', fontSize: '0.75rem', mt: 2, fontWeight: 700, textAlign: 'center' }}>
                  Unlock your vault to enable 2FA.
                </Typography>
              )}
            </Box>
          </Stack>
        )}

        {step === 'totp' && (
          <Stack spacing={4} className="animate-fadeIn">
            <Box sx={{ p: 3, borderRadius: '24px', bgcolor: '#161412', border: '1px solid rgba(255,255,255,0.03)' }}>
              <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '1rem', mb: 1 }}>2. Authenticator Setup</Typography>
              <Typography sx={{ color: 'white/40', fontSize: '0.8rem', mb: 3 }}>
                Scan this QR code with your security app (e.g. Google Authenticator, Raivo).
              </Typography>
              
              {totpQr && (
                <Box sx={{ p: 2, bgcolor: 'white', borderRadius: '20px', display: 'flex', justifyContent: 'center', mb: 3 }}>
                  <Box component="img" src={totpQr} sx={{ width: 200, height: 200 }} />
                </Box>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: '#0A0908', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', mb: 3 }}>
                <Typography sx={{ color: 'white/70', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-mono)', flex: 1, wordBreak: 'break-all' }}>
                  {totpSecret}
                </Typography>
                <IconButton onClick={() => copyToClipboard(totpSecret, 'Secret copied.')} sx={{ color: 'white/30', '&:hover': { color: 'white' } }}>
                  <Copy size={16} />
                </IconButton>
              </Box>

              <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.9rem', mb: 2 }}>Verify Authenticator Code</Typography>
              <Box 
                component="input"
                type="text"
                value={totpOtp}
                onChange={(e: any) => setTotpOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                sx={{
                  width: '100%',
                  bgcolor: '#0A0908',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  px: 3,
                  py: 1.5,
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  textAlign: 'center',
                  letterSpacing: '0.2em',
                  mb: 3,
                  outline: 'none',
                  '&:focus': { borderColor: BRAND_EMERALD }
                }}
              />

              <Button
                variant="contained"
                fullWidth
                onClick={verifyTotpSetup}
                disabled={loading || totpOtp.length !== 6 || !vaultUnlocked}
                sx={{ py: 1.75, borderRadius: '14px', bgcolor: BRAND_EMERALD, color: 'black', fontWeight: 900, '&:hover': { bgcolor: '#0fa976' } }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Finalize 2FA'}
              </Button>
            </Box>
          </Stack>
        )}

        {step === 'done' && (
          <Stack spacing={4} className="animate-fadeIn">
            <Box sx={{ p: 4, borderRadius: '32px', bgcolor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', textAlign: 'center' }}>
              <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: BRAND_EMERALD, color: 'black', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2 }}>
                <CheckCircle2 size={32} />
              </Box>
              <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '1.2rem' }}>Identity Secured</Typography>
              <Typography sx={{ color: '#10B981', fontSize: '0.85rem', fontWeight: 700, mt: 0.5 }}>2FA Protocol Fully Active</Typography>
            </Box>

            {recoveryCodes.length > 0 && (
              <Box sx={{ p: 4, borderRadius: '28px', bgcolor: '#161412', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.9rem', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShieldCheck size={18} style={{ color: BRAND_EMERALD }} />
                  Recovery Protocols
                </Typography>
                <Typography sx={{ color: 'white/40', fontSize: '0.75rem', mb: 3, lineHeight: 1.5 }}>
                  {RECOVERY_COPY_HINT}
                </Typography>
                
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5, mb: 4 }}>
                  {recoveryCodes.map((code) => (
                    <Box key={code} sx={{ p: 2, borderRadius: '12px', bgcolor: '#0A0908', border: '1px solid rgba(255,255,255,0.03)', color: 'white', fontSize: '0.7rem', fontWeight: 800, fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                      {code}
                    </Box>
                  ))}
                </Box>

                <Stack direction="row" spacing={2}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Copy size={16} />}
                    onClick={() => copyToClipboard(recoveryCodes.join('\n'), 'Codes copied.')}
                    sx={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 800, fontSize: '0.75rem', py: 1.25 }}
                  >
                    Copy
                  </Button>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<Download size={16} />}
                    onClick={downloadRecoveryCodes}
                    sx={{ borderRadius: '12px', bgcolor: 'white', color: 'black', fontWeight: 900, fontSize: '0.75rem', py: 1.25, '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}
                  >
                    Download
                  </Button>
                </Stack>
              </Box>
            )}

            <Button
              fullWidth
              onClick={onClose}
              sx={{ py: 2, borderRadius: '16px', color: 'white/40', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', '&:hover': { bgcolor: 'white/5', color: 'white' } }}
            >
              Exit Configuration
            </Button>
          </Stack>
        )}
      </Box>

      {/* Sticky Footer Info */}
      <Box sx={{ p: 3, borderTop: '1px solid rgba(255,255,255,0.03)', bgcolor: '#161412', display: 'flex', alignItems: 'center', gap: 1.5 }}>
         <Box className={`w-2 h-2 rounded-full ${isTwoFactorOn ? 'bg-[#10B981] animate-pulse' : 'bg-white/10'}`} />
         <Typography sx={{ color: 'white/30', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            System Integrity: {isTwoFactorOn ? 'SECURE' : 'ACTION REQUIRED'}
         </Typography>
      </Box>
    </Drawer>
  );
}
