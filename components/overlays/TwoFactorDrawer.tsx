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
  Lock
} from 'lucide-react';

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
    <>
      {/* 🏗️ 1. Backdrop (Closes on Click) */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1399] transition-opacity duration-300 ease-in-out cursor-default animate-fadeIn"
        onClick={onClose}
      />
      
      {/* 🏗️ 2. Slide-up Panel Container (Tailwind Migration - Phase II) */}
      <div className="fixed bottom-0 right-0 left-0 md:left-auto md:top-0 w-full md:w-[480px] md:h-full max-h-[90vh] md:max-h-full bg-[#161412] border-t md:border-t-0 md:border-l border-white/8 rounded-t-[28px] md:rounded-t-0 z-[1400] text-white flex flex-col animate-slide-up overflow-hidden">
        {/* Decorative drag handle bar (mobile only) */}
        <div className="w-10 h-1 bg-white/12 rounded-[2px] mx-auto mt-3 mb-1 flex-shrink-0 md:hidden" />
        
        {/* Header container */}
        <div className="flex items-center justify-between gap-4 p-6 border-b border-white/5 bg-[#161412]">
          <div className="flex items-center gap-3">
             <div className={`w-2.5 h-2.5 rounded-full ${isTwoFactorOn ? 'bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-[#6366F1] shadow-[0_0_8px_rgba(99,102,241,0.5)]'}`} />
             <div>
                <h3 className="text-white text-lg font-black tracking-tight leading-tight font-clash uppercase">
                    {mode === 'reminder' ? 'Security Upgrade' : '2FA Protocol'}
                </h3>
                <p className="text-white/40 text-[10px] font-black mt-0.5 uppercase tracking-widest">
                    Mandatory: Email Relay → App Authenticator
                </p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white bg-white/3 hover:bg-white/6 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-[#0A0908]">
          
          {/* Integrity Notice */}
          {step !== 'done' && (
            <div className="p-4 rounded-2xl bg-[#161412] border border-white/4 flex flex-col gap-2">
                <span className="text-white font-extrabold text-[13px] leading-none">Ecosystem Integrity Check</span>
                <p className="text-white/50 text-[12px] font-semibold leading-relaxed">
                    To mathematically prevent lockout, we verify your email relay as a secure backup before establishing TOTP as your primary factor.
                </p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-500/8 border border-red-500/20 flex gap-3 items-start animate-shake">
                <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-red-500 font-black text-[11px] uppercase tracking-wider">Protocol Error</span>
                    <p className="text-red-400 text-[12px] font-bold leading-normal">{error}</p>
                </div>
            </div>
          )}

          {/* Stepper Logic */}
          <div className="flex flex-col gap-4">
            {step === 'summary' && (
                <button
                    onClick={isTwoFactorOn ? disableTwoFactor : startTwoFactorSetup}
                    disabled={loading || (!isTwoFactorOn && !canUseEmailFactor)}
                    className="group w-full flex items-center gap-4 p-5 rounded-2xl bg-[#161412] border border-white/5 text-left transition-all hover:bg-white/[0.03] active:scale-[0.98] disabled:opacity-50"
                >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isTwoFactorOn ? 'bg-red-500/10 text-red-500' : 'bg-[#6366F1]/10 text-[#6366F1]'}`}>
                        {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" /> : (isTwoFactorOn ? <ShieldAlert size={22} /> : <Lock size={22} />)}
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                        <span className="text-white font-black text-[14px] uppercase tracking-tight">
                            {isTwoFactorOn ? 'Deactivate Protocols' : 'Begin 2FA Activation'}
                        </span>
                        <span className="text-white/40 font-bold text-[11px] uppercase tracking-wider">
                            {isTwoFactorOn ? 'Downgrade account protection level' : 'Activate cross-node identity security'}
                        </span>
                    </div>
                    <ArrowRight size={18} className="text-white/10 group-hover:text-white/30 transition-colors" />
                </button>
            )}

            {step === 'email-init' && (
                <div className="flex flex-col gap-4 animate-fadeIn">
                    <div className="p-5 rounded-3xl bg-[#161412] border border-white/5 flex flex-col items-center text-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center">
                            <Mail size={28} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <h4 className="text-white font-black text-base uppercase">Phase 1: Email</h4>
                            <p className="text-white/40 text-[12px] font-bold uppercase tracking-wider px-4">Verify Backup Relay</p>
                        </div>
                        <p className="text-white/50 text-sm font-semibold leading-relaxed px-2">
                            A one-time activation code will be dispatched to your registered email address. This is required for recovery synchronization.
                        </p>
                        <button
                            onClick={sendEmailCode}
                            disabled={loading}
                            className="w-full mt-2 py-4 rounded-xl bg-[#6366F1] text-black font-black text-sm uppercase tracking-widest hover:bg-[#5254E8] transition-all disabled:opacity-50"
                        >
                            {loading ? 'Dispatching...' : 'Dispatch Code'}
                        </button>
                    </div>
                </div>
            )}

            {step === 'email-verify' && (
                <div className="flex flex-col gap-4 animate-fadeIn">
                    <div className="p-5 rounded-3xl bg-[#161412] border border-white/5 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center flex-shrink-0">
                                <ShieldCheck size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="text-white font-black text-[13px] uppercase tracking-tight">Verify Identity</h4>
                                <p className="text-white/30 font-bold text-[10px] uppercase tracking-widest">Enter code from inbox</p>
                            </div>
                        </div>

                        <input
                            type="text"
                            value={emailOtp}
                            onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            className="w-full bg-[#0A0908] text-white border border-white/8 rounded-2xl px-4 py-5 text-3xl font-black text-center tracking-[0.3em] focus:outline-none focus:border-[#6366F1] transition-all font-mono"
                        />

                        <button
                            onClick={verifyEmailChallenge}
                            disabled={loading || emailOtp.length !== 6 || !vaultUnlocked}
                            className="w-full py-4 rounded-xl bg-[#6366F1] text-black font-black text-sm uppercase tracking-widest hover:bg-[#5254E8] transition-all disabled:opacity-50"
                        >
                            {loading ? 'Verifying...' : 'Confirm Relay'}
                        </button>

                        {!vaultUnlocked && (
                            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex gap-2 items-center justify-center">
                                <AlertTriangle size={14} className="text-amber-500" />
                                <span className="text-amber-500 font-bold text-[11px] uppercase tracking-wider">Vault Unlock Required</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {step === 'totp' && (
                <div className="flex flex-col gap-5 animate-fadeIn pb-10">
                    <div className="p-5 rounded-3xl bg-[#161412] border border-white/5 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center flex-shrink-0">
                                <Smartphone size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="text-white font-black text-[13px] uppercase tracking-tight">Phase 2: Authenticator</h4>
                                <p className="text-white/30 font-bold text-[10px] uppercase tracking-widest">TOTP Key Activation</p>
                            </div>
                        </div>
                        
                        <p className="text-white/50 text-[12px] font-semibold leading-relaxed">
                            Scan this secure vector using an authoritative TOTP manager (e.g., Raivo, Google Auth).
                        </p>

                        {totpQr && (
                            <div className="p-3 bg-white rounded-[24px] flex items-center justify-center shadow-2xl mx-auto">
                                <img src={totpQr} alt="TOTP QR" className="w-48 h-48" />
                            </div>
                        )}

                        <div className="flex items-center gap-3 p-3 bg-[#0A0908] border border-white/5 rounded-2xl">
                            <span className="flex-1 min-w-0 text-white/60 font-mono text-[10px] break-all font-bold leading-tight select-all">
                                {totpSecret}
                            </span>
                            <button 
                                onClick={() => copyToClipboard(totpSecret, 'Secret copied.')}
                                className="w-8 h-8 rounded-lg bg-white/3 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/6 transition-all flex-shrink-0"
                            >
                                <Copy size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="p-5 rounded-3xl bg-[#161412] border border-white/5 flex flex-col gap-4">
                        <div className="flex flex-col gap-1 px-1">
                            <span className="text-white/40 font-black text-[10px] uppercase tracking-widest">Verification Challenge</span>
                            <input
                                type="text"
                                value={totpOtp}
                                onChange={(e) => setTotpOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                className="w-full bg-[#0A0908] text-white border border-white/8 rounded-xl px-4 py-3 text-2xl font-black text-center tracking-[0.2em] focus:outline-none focus:border-[#10B981] transition-all font-mono"
                            />
                        </div>

                        <button
                            onClick={verifyTotpSetup}
                            disabled={loading || totpOtp.length !== 6 || !vaultUnlocked}
                            className="w-full py-4 rounded-xl bg-[#10B981] text-black font-black text-sm uppercase tracking-widest hover:bg-[#0fa976] transition-all disabled:opacity-50"
                        >
                            {loading ? 'Finalizing...' : 'Finalize Activation'}
                        </button>
                    </div>
                </div>
            )}

            {step === 'done' && (
                <div className="flex flex-col gap-6 animate-fadeIn">
                    <div className="p-8 rounded-[40px] bg-[#10B981]/5 border border-[#10B981]/15 text-center flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-[#10B981] text-black flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-pulse">
                            <CheckCircle2 size={36} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <h4 className="text-white font-black text-xl font-clash uppercase">Identity Secured</h4>
                            <p className="text-[#10B981] text-[11px] font-black uppercase tracking-widest">2FA Protocol Fully Active</p>
                        </div>
                    </div>

                    {recoveryCodes.length > 0 && (
                        <div className="p-6 rounded-[32px] bg-[#161412] border border-white/5 flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <ShieldCheck size={20} className="text-[#10B981]" />
                                <span className="text-white font-black text-sm uppercase">Recovery Vectors</span>
                            </div>
                            <p className="text-white/40 text-[11px] font-semibold leading-relaxed">
                                {RECOVERY_COPY_HINT} Save these to a trusted offline device.
                            </p>
                            
                            <div className="grid grid-cols-2 gap-2">
                                {recoveryCodes.map((code) => (
                                    <div key={code} className="p-2.5 rounded-xl bg-[#0A0908] border border-white/4 text-white font-mono text-[11px] font-black text-center tracking-tight">
                                        {code}
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => copyToClipboard(recoveryCodes.join('\n'), 'Codes copied.')}
                                    className="flex-1 py-3 rounded-xl border border-white/8 text-white font-black text-[11px] uppercase tracking-wider hover:bg-white/2 transition-all flex items-center justify-center gap-2"
                                >
                                    <Copy size={14} /> Copy
                                </button>
                                <button
                                    onClick={downloadRecoveryCodes}
                                    className="flex-1 py-3 rounded-xl bg-white text-black font-black text-[11px] uppercase tracking-wider hover:bg-white/90 transition-all flex items-center justify-center gap-2"
                                >
                                    <Download size={14} /> Download
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full py-4 rounded-2xl bg-white/3 border border-white/8 text-white/50 font-black text-xs uppercase tracking-[0.2em] hover:text-white hover:bg-white/6 transition-all"
                    >
                        Complete Configuration
                    </button>
                </div>
            )}
          </div>
        </div>

        {/* 🏗️ 5. Safe Text Truncation boundaries / Footer Persistence Ledger */}
        <div className="p-4 border-t border-white/4 bg-[#161412] flex items-center gap-3 mt-auto">
            <div className="relative flex-shrink-0">
                <div className={`w-2 h-2 rounded-full ${isTwoFactorOn ? 'bg-[#10B981]' : 'bg-white/10'}`} />
                {isTwoFactorOn && <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#10B981] animate-ping" />}
            </div>
            <div className="min-w-0 flex-1">
                <span className="block text-white/30 font-black text-[9px] uppercase tracking-[0.15em] font-mono truncate">
                    System Ledger: {isTwoFactorOn ? 'Protected (SHA-256)' : 'Unshielded Identity'}
                </span>
            </div>
        </div>
      </div>
    </>
  );
}
