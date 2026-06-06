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
  ShieldAlert,
  AlertTriangle,
  Lock,
  ArrowDown
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
  Paper,
  Card,
  CardHeader,
  CardContent
} from '@/lib/mui-tailwind/material';
import { motion, AnimatePresence } from 'framer-motion';

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
const NAV_SURFACE = '#161412';
const PITCH_BLACK = '#0A0908';

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
          bgcolor: NAV_SURFACE,
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
      {/* Header Panel */}
      <Box sx={{ p: 0, borderBottom: '1px solid rgba(255,255,255,0.05)', bgcolor: NAV_SURFACE, zIndex: 10 }}>
        <Box sx={{ px: 3, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: isTwoFactorOn ? BRAND_EMERALD : BRAND_INDIGO, shadow: `0 0 10px ${isTwoFactorOn ? BRAND_EMERALD : BRAND_INDIGO}` }} />
            <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Typography component="span" sx={{ color: 'white', fontWeight: 900, fontSize: '1rem', fontClash: 'var(--font-clash)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                    {mode === 'reminder' ? 'SECURITY UPGRADE' : '2FA PROTOCOL'}
                </Typography>
                <Typography component="span" sx={{ color: 'white/40', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>
                    Mandatory: Email → App Authenticator
                </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'white/30', '&:hover': { color: 'white', bgcolor: 'white/5' }, width: 36, height: 36 }}>
            <X size={18} />
          </IconButton>
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ p: 0, flex: 1, overflowY: 'auto', bgcolor: PITCH_BLACK }}>
        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
            
            {/* Context Header */}
            {step !== 'done' && (
                <Box sx={{ p: 2.5, borderRadius: '24px', bgcolor: NAV_SURFACE, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <Typography component="span" sx={{ display: 'block', color: 'white', fontWeight: 800, fontSize: '0.85rem', mb: 0.75, lineHeight: 1.3 }}>Ecosystem Integrity Check</Typography>
                    <Typography component="span" sx={{ display: 'block', color: 'white/50', fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.5 }}>
                        To mathematically prevent lockout, we verify your email relay as a secure backup before establishing TOTP as your primary factor.
                    </Typography>
                </Box>
            )}

            {error && (
            <Box sx={{ p: 2.5, borderRadius: '18px', bgcolor: alpha('#ef4444', 0.08), border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', gap: 1.75, alignItems: 'flex-start' }}>
                <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Typography component="span" sx={{ color: '#ef4444', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase' }}>Protocol Error</Typography>
                    <Typography component="span" sx={{ color: '#ef4444', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.45 }}>{error}</Typography>
                </Box>
            </Box>
            )}

            <AnimatePresence mode="wait">
            {step === 'summary' && (
                <motion.div key="summary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                    <Box component="button" onClick={isTwoFactorOn ? disableTwoFactor : startTwoFactorSetup} disabled={loading || (!isTwoFactorOn && !canUseEmailFactor)}
                        sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 2.25, borderRadius: '24px', bgcolor: NAV_SURFACE, border: '1px solid', borderColor: isTwoFactorOn ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)', textAlign: 'left', transition: 'all 0.2s', '&:hover': { bgcolor: isTwoFactorOn ? alpha('#ef4444', 0.05) : 'rgba(255,255,255,0.03)' } }}>
                        <Box sx={{ width: 44, height: 44, borderRadius: '14px', bgcolor: isTwoFactorOn ? alpha('#ef4444', 0.1) : alpha(BRAND_INDIGO, 0.1), display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            {loading ? <CircularProgress size={20} sx={{ color: isTwoFactorOn ? '#ef4444' : BRAND_INDIGO }} /> : (isTwoFactorOn ? <ShieldAlert size={22} color="#ef4444" /> : <Lock size={22} color={BRAND_INDIGO} />)}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                            <Typography component="span" sx={{ color: 'white', fontWeight: 900, fontSize: '0.9rem', lineHeight: 1.25 }}>{isTwoFactorOn ? 'DEACTIVATE PROTOCOLS' : 'BEGIN 2FA ACTIVATION'}</Typography>
                            <Typography component="span" sx={{ color: 'white/40', fontWeight: 600, fontSize: '0.72rem', lineHeight: 1.35 }}>{isTwoFactorOn ? 'Downgrade account protection level' : 'Activate cross-node identity security'}</Typography>
                        </Box>
                        <ArrowRight size={18} style={{ color: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
                    </Box>
                </motion.div>
            )}

            {step === 'email-init' && (
                <motion.div key="email-init" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                    <Card sx={{ bgcolor: NAV_SURFACE, border: '1px solid rgba(255,255,255,0.05)', borderRadius: '28px', overflow: 'hidden', boxShadow: 'none' }}>
                        <CardHeader sx={{ p: 3, pb: 1 }} title={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: alpha(BRAND_INDIGO, 0.1), color: BRAND_INDIGO, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                    <Mail size={20} />
                                </Box>
                                <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                    <Typography component="span" sx={{ color: 'white', fontWeight: 900, fontSize: '0.9rem', lineHeight: 1.2 }}>PHASE 1: EMAIL</Typography>
                                    <Typography component="span" sx={{ color: 'white/30', fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Verify Backup Relay</Typography>
                                </Box>
                            </Box>
                        } />
                        <CardContent sx={{ p: 3, pt: 1 }}>
                            <Typography component="span" sx={{ display: 'block', color: 'white/60', fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.5, mb: 3 }}>
                                A one-time activation code will be dispatched to your registered email address. This is required for recovery synchronization.
                            </Typography>
                            <Button variant="contained" fullWidth onClick={sendEmailCode} disabled={loading}
                                sx={{ py: 1.75, borderRadius: '14px', bgcolor: BRAND_INDIGO, color: 'white', fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', '&:hover': { bgcolor: '#4f46e5' } }}>
                                {loading ? <CircularProgress size={20} color="inherit" /> : 'Dispatch Verification Code'}
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {step === 'email-verify' && (
                <motion.div key="email-verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                    <Card sx={{ bgcolor: NAV_SURFACE, border: '1px solid rgba(255,255,255,0.05)', borderRadius: '28px', overflow: 'hidden', boxShadow: 'none' }}>
                        <CardHeader sx={{ p: 3, pb: 1 }} title={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: alpha(BRAND_INDIGO, 0.1), color: BRAND_INDIGO, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                    <ShieldCheck size={20} />
                                </Box>
                                <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                    <Typography component="span" sx={{ color: 'white', fontWeight: 900, fontSize: '0.9rem', lineHeight: 1.2 }}>VERIFY IDENTITY</Typography>
                                    <Typography component="span" sx={{ color: 'white/30', fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Check your inbox</Typography>
                                </Box>
                            </Box>
                        } />
                        <CardContent sx={{ p: 3, pt: 1.5 }}>
                            <Box component="input" type="text" value={emailOtp} onChange={(e: any) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000" sx={{ width: '100%', bgcolor: PITCH_BLACK, color: 'white', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', px: 3, py: 2.5, fontSize: '1.75rem', fontWeight: 900, textAlign: 'center', letterSpacing: '0.2em', mb: 3, outline: 'none', fontMono: 'var(--font-mono)', '&:focus': { borderColor: BRAND_INDIGO } }} />
                            
                            <Button variant="contained" fullWidth onClick={verifyEmailChallenge} disabled={loading || emailOtp.length !== 6 || !vaultUnlocked}
                                sx={{ py: 2, borderRadius: '16px', bgcolor: BRAND_INDIGO, color: 'white', fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
                                {loading ? <CircularProgress size={20} color="inherit" /> : 'Confirm Relay'}
                            </Button>

                            {!vaultUnlocked && (
                                <Box sx={{ p: 2, borderRadius: '12px', bgcolor: alpha('#F59E0B', 0.05), border: '1px solid rgba(245, 158, 11, 0.15)', display: 'flex', gap: 1.5, alignItems: 'center' }}>
                                    <AlertTriangle size={14} color="#F59E0B" />
                                    <Typography component="span" sx={{ color: '#F59E0B', fontSize: '0.72rem', fontWeight: 700 }}>Vault Unlock Required to Proceed</Typography>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {step === 'totp' && (
                <motion.div key="totp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 pb-12">
                    <Card sx={{ bgcolor: NAV_SURFACE, border: '1px solid rgba(255,255,255,0.05)', borderRadius: '28px', overflow: 'hidden', boxShadow: 'none' }}>
                        <CardHeader sx={{ p: 3, pb: 1 }} title={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: alpha(BRAND_EMERALD, 0.1), color: BRAND_EMERALD, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                    <Smartphone size={20} />
                                </Box>
                                <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                    <Typography component="span" sx={{ color: 'white', fontWeight: 900, fontSize: '0.9rem', lineHeight: 1.2 }}>PHASE 2: AUTHENTICATOR</Typography>
                                    <Typography component="span" sx={{ color: 'white/30', fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTP Key Activation</Typography>
                                </Box>
                            </Box>
                        } />
                        <CardContent sx={{ p: 3, pt: 1.5 }}>
                            <Typography component="span" sx={{ display: 'block', color: 'white/50', fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.5, mb: 3 }}>
                                Scan this secure vector using an authoritative TOTP manager (e.g., Raivo, Google Auth).
                            </Typography>
                            
                            {totpQr && (
                                <Box sx={{ p: 2, bgcolor: 'white', borderRadius: '24px', display: 'flex', justifyContent: 'center', mb: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                                    <Box component="img" src={totpQr} sx={{ width: 220, height: 220 }} />
                                </Box>
                            )}

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: PITCH_BLACK, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', mb: 4 }}>
                                <Typography sx={{ color: 'white/60', fontSize: '0.65rem', fontWeight: 700, fontFamily: 'var(--font-mono)', flex: 1, wordBreak: 'break-all', lineHeight: 1.4 }}>
                                    {totpSecret}
                                </Typography>
                                <IconButton onClick={() => copyToClipboard(totpSecret, 'Secret copied.')} sx={{ color: 'white/30', '&:hover': { color: 'white' }, bgcolor: 'white/3' }}>
                                    <Copy size={14} />
                                </IconButton>
                            </Box>

                            <Box sx={{ mb: 2 }}>
                                <Typography component="span" sx={{ display: 'block', color: 'white/40', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', mb: 1.5, ml: 0.5 }}>Verification Challenge</Typography>
                                <Box component="input" type="text" value={totpOtp} onChange={(e: any) => setTotpOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000000" sx={{ width: '100%', bgcolor: PITCH_BLACK, color: 'white', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', px: 3, py: 2, fontSize: '1.5rem', fontWeight: 900, textAlign: 'center', letterSpacing: '0.2em', mb: 3, outline: 'none', fontMono: 'var(--font-mono)', '&:focus': { borderColor: BRAND_EMERALD } }} />
                            </Box>

                            <Button variant="contained" fullWidth onClick={verifyTotpSetup} disabled={loading || totpOtp.length !== 6 || !vaultUnlocked}
                                sx={{ py: 2, borderRadius: '16px', bgcolor: BRAND_EMERALD, color: 'black', fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', '&:hover': { bgcolor: '#0fa976' } }}>
                                {loading ? <CircularProgress size={20} color="inherit" /> : 'Finalize Activation'}
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {step === 'done' && (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                    <Box sx={{ p: 4, borderRadius: '32px', bgcolor: alpha(BRAND_EMERALD, 0.04), border: '1px solid rgba(16, 185, 129, 0.12)', textAlign: 'center' }}>
                        <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: BRAND_EMERALD, color: 'black', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2, shadow: `0 0 24px ${alpha(BRAND_EMERALD, 0.4)}` }}>
                            <CheckCircle2 size={36} />
                        </Box>
                        <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '1.25rem', fontClash: 'var(--font-clash)' }}>IDENTITY SECURED</Typography>
                        <Typography sx={{ color: BRAND_EMERALD, fontSize: '0.78rem', fontWeight: 900, mt: 0.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>2FA Protocol Fully Active</Typography>
                    </Box>

                    {recoveryCodes.length > 0 && (
                    <Card sx={{ bgcolor: NAV_SURFACE, border: '1px solid rgba(255,255,255,0.05)', borderRadius: '32px', overflow: 'hidden', boxShadow: 'none' }}>
                        <CardHeader sx={{ p: 3, pb: 1 }} title={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: alpha(BRAND_EMERALD, 0.1), color: BRAND_EMERALD, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                    <ShieldCheck size={20} />
                                </Box>
                                <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                    <Typography component="span" sx={{ color: 'white', fontWeight: 900, fontSize: '0.9rem', lineHeight: 1.2 }}>RECOVERY VECTORS</Typography>
                                    <Typography component="span" sx={{ color: 'white/30', fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Emergency Access Layer</Typography>
                                </Box>
                            </Box>
                        } />
                        <CardContent sx={{ p: 3, pt: 1.5 }}>
                            <Typography component="span" sx={{ display: 'block', color: 'white/40', fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.5, mb: 3 }}>
                                {RECOVERY_COPY_HINT} Save these to a trusted offline device.
                            </Typography>
                            
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5, mb: 4 }}>
                            {recoveryCodes.map((code) => (
                                <Box key={code} sx={{ p: 2.25, borderRadius: '14px', bgcolor: PITCH_BLACK, border: '1px solid rgba(255,255,255,0.04)', color: 'white', fontSize: '0.72rem', fontWeight: 800, fontFamily: 'var(--font-mono)', textAlign: 'center', letterSpacing: '0.05em' }}>
                                {code}
                                </Box>
                            ))}
                            </Box>

                            <Stack direction="row" spacing={2}>
                                <Button variant="outlined" startIcon={<Copy size={16} />} onClick={() => copyToClipboard(recoveryCodes.join('\n'), 'Codes copied.')}
                                    sx={{ flex: 1, borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 800, fontSize: '0.75rem', py: 1.5, textTransform: 'uppercase' }}>
                                    Copy
                                </Button>
                                <Button variant="contained" startIcon={<Download size={16} />} onClick={downloadRecoveryCodes}
                                    sx={{ flex: 1, borderRadius: '14px', bgcolor: 'white', color: 'black', fontWeight: 900, fontSize: '0.75rem', py: 1.5, textTransform: 'uppercase', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
                                    Download
                                </Button>
                            </Stack>
                        </CardContent>
                    </Card>
                    )}

                    <Button fullWidth onClick={onClose}
                        sx={{ py: 2, borderRadius: '18px', bgcolor: alpha(BRAND_INDIGO, 0.1), color: BRAND_INDIGO, fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', '&:hover': { bgcolor: alpha(BRAND_INDIGO, 0.2) } }}>
                        Complete Configuration
                    </Button>
                </motion.div>
            )}
            </AnimatePresence>
        </Box>
      </Box>

      {/* Persistence Ledger Footer */}
      <Box sx={{ px: 4, py: 2.5, borderTop: '1px solid rgba(255,255,255,0.03)', bgcolor: NAV_SURFACE, display: 'flex', alignItems: 'center', gap: 2 }}>
         <Box sx={{ position: 'relative' }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: isTwoFactorOn ? BRAND_EMERALD : alpha('#ef4444', 0.4), shadow: `0 0 8px ${isTwoFactorOn ? BRAND_EMERALD : '#ef4444'}` }} />
            {isTwoFactorOn && <Box sx={{ position: 'absolute', inset: 0, width: 8, height: 8, borderRadius: '50%', bgcolor: BRAND_EMERALD, animate: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite' }} />}
         </Box>
         <Typography sx={{ color: 'white/30', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-mono)' }}>
            System Ledger: {isTwoFactorOn ? 'PROTECTED (SHA-256)' : 'UNSHIELDED IDENTITY'}
         </Typography>
      </Box>
    </Drawer>
  );
}
