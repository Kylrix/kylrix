'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { account, avatars } from '@/lib/appwrite/client';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import {
  createTotpAuthenticator,
  disableAllMfaFactors,
  enableAccountMfa,
  generateMfaRecoveryCodes,
  isMfaFullyEnabled,
  listCurrentMfaFactors,
  removeEmailFactor,
  removeTotpFactor,
  type MfaLoginMethod,
  verifyTotpAuthenticator,
} from '@/lib/mfa';
import { loadMfaRecoveryCodes, persistMfaRecoveryCodes } from '@/lib/mfa-recovery-vault';
import toast from 'react-hot-toast';
import {
  X as CloseIcon,
  Copy as ContentCopyIcon,
  Mail,
  Smartphone,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';

type Props = {
  onClose: () => void;
  userId: string;
  emailVerified?: boolean;
  loginMethod?: MfaLoginMethod;
  onChanged?: () => void;
  mode?: 'setup' | 'reminder';
};

type Step = 'manage' | 'recovery' | 'email-verify' | 'totp' | 'recovery-view';

const RECOVERY_HINT = 'Save these codes somewhere safe. They are shown once.';

function MethodRow({
  icon,
  title,
  on,
  actionLabel,
  onAction,
  disabled,
  danger,
}: {
  icon: ReactNode;
  title: string;
  on: boolean;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[16px] bg-[#0A0908] border border-white/[0.04] px-3.5 py-3.5">
      <div className="p-2 rounded-xl bg-[#161412] border border-white/[0.06] text-[#6366F1] shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">{title}</p>
        <p className={`text-[11px] font-extrabold uppercase tracking-wide mt-0.5 ${on ? 'text-emerald-400' : 'text-white/35'}`}>
          {on ? 'On' : 'Off'}
        </p>
      </div>
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className={`py-1.5 px-3 rounded-lg text-[11px] font-extrabold cursor-pointer border-none disabled:opacity-40 ${
          danger
            ? 'bg-red-500/15 text-red-400'
            : 'bg-[#6366F1] text-white'
        }`}
      >
        {actionLabel}
      </button>
    </div>
  );
}

/**
 * Full 2FA manage/setup panel — mount in Overlay (mobile) or native right rail (desktop).
 */
export function TwoFactorPanel({
  onClose,
  userId,
  emailVerified = true,
  loginMethod = 'password',
  onChanged,
  mode = 'setup',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [step, setStep] = useState<Step>('manage');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [totpQr, setTotpQr] = useState('');
  const [totpOtp, setTotpOtp] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [storedRecoveryCodes, setStoredRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isTwoFactorOn = emailEnabled && totpEnabled;

  const refreshFactors = useCallback(async () => {
    try {
      const factors = await listCurrentMfaFactors();
      setEmailEnabled(Boolean(factors.email));
      setTotpEnabled(Boolean(factors.totp));
      return factors;
    } catch {
      setEmailEnabled(false);
      setTotpEnabled(false);
      return null;
    }
  }, []);

  const notifyChanged = useCallback(() => {
    onChanged?.();
  }, [onChanged]);

  const copyToClipboard = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  };

  const ensureVaultUnlocked = () => {
    if (!ecosystemSecurity.status.isUnlocked) {
      throw new Error('Unlock your vault first so recovery codes can be saved.');
    }
  };

  const generateAndStoreRecoveryCodes = useCallback(async () => {
    ensureVaultUnlocked();
    const codes = await generateMfaRecoveryCodes();
    if (!codes.length) throw new Error('No recovery codes returned.');
    await persistMfaRecoveryCodes(userId, codes, {
      source: 'appwrite-mfa',
      loginMethod,
    });
    setRecoveryCodes(codes);
    setStoredRecoveryCodes(codes);
    return codes;
  }, [loginMethod, userId]);

  const finalizeTwoFactor = useCallback(async () => {
    const factors = await refreshFactors();
    if (!isMfaFullyEnabled(factors)) {
      throw new Error('Turn on email codes and authenticator first.');
    }
    await enableAccountMfa();
    await refreshFactors();
    notifyChanged();
    setStep('manage');
    toast.success('2FA is on.');
  }, [notifyChanged, refreshFactors]);

  const sendEmailVerification = async () => {
    setLoading(true);
    setError(null);
    try {
      const verifyUrl = `${window.location.origin}/settings?tab=security#mfa`;
      await account.createVerification({ url: verifyUrl });
      toast.success('Verification email sent.');
    } catch (err) {
      setError((err as { message?: string })?.message || 'Could not send email.');
    } finally {
      setLoading(false);
    }
  };

  const startTotpSetup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      ensureVaultUnlocked();
      const factors = await refreshFactors();
      if (!factors?.email && !emailVerified) {
        setStep('email-verify');
        return;
      }
      if (factors?.totp) {
        if (factors.email) await finalizeTwoFactor();
        else setStep('manage');
        return;
      }
      const { secret, uri } = await createTotpAuthenticator();
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
    } catch (err) {
      setError((err as { message?: string })?.message || 'Could not start authenticator setup.');
    } finally {
      setLoading(false);
    }
  }, [emailVerified, finalizeTwoFactor, refreshFactors]);

  const verifyTotpSetup = async () => {
    if (totpOtp.trim().length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      ensureVaultUnlocked();
      await verifyTotpAuthenticator(totpOtp.trim());
      const factors = await refreshFactors();
      if (isMfaFullyEnabled(factors)) {
        await enableAccountMfa();
        toast.success('2FA is on.');
      } else {
        toast.success('Authenticator added.');
      }
      notifyChanged();
      setStep('manage');
    } catch (err) {
      setError((err as { message?: string })?.message || 'Code did not match.');
    } finally {
      setLoading(false);
    }
  };

  const disableTwoFactor = async () => {
    setLoading(true);
    setError(null);
    try {
      await disableAllMfaFactors();
      setRecoveryCodes([]);
      setStoredRecoveryCodes(null);
      await refreshFactors();
      notifyChanged();
      toast.success('2FA turned off.');
      setStep('manage');
    } catch (err) {
      setError((err as { message?: string })?.message || 'Could not turn off 2FA.');
    } finally {
      setLoading(false);
    }
  };

  const removeEmail = async () => {
    setLoading(true);
    setError(null);
    try {
      await removeEmailFactor();
      await refreshFactors();
      notifyChanged();
      toast.success('Email codes removed.');
    } catch (err) {
      setError((err as { message?: string })?.message || 'Could not remove email codes.');
    } finally {
      setLoading(false);
    }
  };

  const removeTotp = async () => {
    setLoading(true);
    setError(null);
    try {
      await removeTotpFactor();
      await refreshFactors();
      notifyChanged();
      toast.success('Authenticator removed.');
    } catch (err) {
      setError((err as { message?: string })?.message || 'Could not remove authenticator.');
    } finally {
      setLoading(false);
    }
  };

  const beginSetup = async () => {
    setError(null);
    setTotpSecret('');
    setTotpUri('');
    setTotpQr('');
    setTotpOtp('');
    setRecoveryCodes([]);
    setStep('recovery');
  };

  const continueFromRecovery = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!recoveryCodes.length) await generateAndStoreRecoveryCodes();
      await startTotpSetup();
    } catch (err) {
      setError((err as Error).message || 'Could not continue setup.');
      setLoading(false);
    }
  };

  const showStoredRecoveryCodes = async () => {
    setLoading(true);
    setError(null);
    try {
      ensureVaultUnlocked();
      const codes = await loadMfaRecoveryCodes(userId);
      if (!codes?.length) throw new Error('No recovery codes in your vault.');
      setStoredRecoveryCodes(codes);
      setStep('recovery-view');
    } catch (err) {
      setError((err as { message?: string })?.message || 'Could not load recovery codes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    setStep('manage');
    setError(null);
    setVaultUnlocked(ecosystemSecurity.status.isUnlocked);
    void (async () => {
      await refreshFactors();
      if (!mounted) return;
    })();
    return () => {
      mounted = false;
    };
  }, [refreshFactors]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVaultUnlocked(ecosystemSecurity.status.isUnlocked);
    }, 500);
    return () => window.clearInterval(interval);
  }, []);

  const displayRecoveryCodes = storedRecoveryCodes || recoveryCodes;
  const title =
    step === 'manage'
      ? mode === 'reminder'
        ? 'Set up 2FA'
        : '2FA'
      : step === 'recovery'
        ? 'Recovery codes'
        : step === 'email-verify'
          ? 'Verify email'
          : step === 'totp'
            ? 'Authenticator'
            : 'Recovery codes';

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#161412] text-white">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] shrink-0">
        {step !== 'manage' ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep('manage');
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#0A0908] border border-white/[0.06] text-white/70 hover:text-white cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-clash font-black text-lg tracking-tight leading-tight">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#0A0908] border border-white/[0.06] text-white/70 hover:text-white cursor-pointer"
          aria-label="Close"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {error ? (
          <div className="p-3.5 rounded-[16px] bg-[#0A0908] border border-red-500/25 text-red-400 text-xs font-semibold font-satoshi">
            {error}
          </div>
        ) : null}

        {step === 'manage' && (
          <div className="space-y-3">
            {!vaultUnlocked ? (
              <div className="p-3.5 rounded-[16px] bg-[#0A0908] border border-amber-500/25 text-amber-300 text-xs font-semibold font-satoshi">
                Unlock your vault to change 2FA or save recovery codes.
              </div>
            ) : null}

            <MethodRow
              icon={<Mail className="w-4 h-4" />}
              title="Email codes"
              on={emailEnabled}
              actionLabel={emailEnabled ? 'Remove' : 'Enable'}
              danger={emailEnabled}
              disabled={loading || (!emailEnabled && !vaultUnlocked)}
              onAction={() => {
                if (emailEnabled) void removeEmail();
                else setStep('email-verify');
              }}
            />

            <MethodRow
              icon={<Smartphone className="w-4 h-4" />}
              title="Authenticator"
              on={totpEnabled}
              actionLabel={totpEnabled ? 'Remove' : 'Add'}
              danger={totpEnabled}
              disabled={loading || (!totpEnabled && !vaultUnlocked)}
              onAction={() => {
                if (totpEnabled) void removeTotp();
                else if (emailEnabled) void startTotpSetup();
                else void beginSetup();
              }}
            />

            <MethodRow
              icon={<KeyRound className="w-4 h-4" />}
              title="Recovery codes"
              on={Boolean(storedRecoveryCodes?.length || isTwoFactorOn)}
              actionLabel="Show"
              disabled={loading || !vaultUnlocked}
              onAction={() => void showStoredRecoveryCodes()}
            />

            <div className="pt-2 space-y-2">
              {!isTwoFactorOn ? (
                <button
                  type="button"
                  onClick={() => void beginSetup()}
                  disabled={loading || !vaultUnlocked}
                  className="w-full py-3.5 rounded-[14px] bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-sm font-satoshi cursor-pointer border-none disabled:opacity-50"
                >
                  {loading ? 'Working…' : 'Set up 2FA'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void disableTwoFactor()}
                  disabled={loading}
                  className="w-full py-3.5 rounded-[14px] bg-red-500/15 hover:bg-red-500/25 text-red-400 font-bold text-sm font-satoshi cursor-pointer border-none disabled:opacity-50"
                >
                  Turn off 2FA
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'recovery' && (
          <div className="space-y-3">
            <div className="rounded-[16px] bg-[#0A0908] border border-white/[0.04] p-4 space-y-3">
              <p className="text-xs text-white/50 font-satoshi leading-relaxed">{RECOVERY_HINT}</p>
              {recoveryCodes.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {recoveryCodes.map((code) => (
                    <div
                      key={code}
                      className="p-3 rounded-xl bg-[#161412] border border-white/[0.06] font-mono text-center text-white text-xs select-all"
                    >
                      {code}
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    setLoading(true);
                    setError(null);
                    try {
                      await generateAndStoreRecoveryCodes();
                      toast.success('Recovery codes saved.');
                    } catch (err) {
                      setError((err as Error).message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || !vaultUnlocked}
                  className="w-full py-3 rounded-[14px] bg-[#6366F1] text-white font-bold text-xs cursor-pointer border-none disabled:opacity-50"
                >
                  Generate codes
                </button>
              )}
            </div>
            {recoveryCodes.length > 0 ? (
              <button
                type="button"
                onClick={() => void continueFromRecovery()}
                disabled={loading}
                className="w-full py-3.5 rounded-[14px] bg-[#6366F1] text-white font-bold text-sm cursor-pointer border-none disabled:opacity-50"
              >
                Continue
              </button>
            ) : null}
          </div>
        )}

        {step === 'email-verify' && (
          <div className="space-y-3">
            <div className="rounded-[16px] bg-[#0A0908] border border-white/[0.04] p-4 space-y-3">
              <p className="text-xs text-white/50 font-satoshi leading-relaxed">
                Confirm your email, then continue.
              </p>
              <button
                type="button"
                onClick={() => void sendEmailVerification()}
                disabled={loading}
                className="w-full py-3 rounded-[14px] bg-[#6366F1] text-white font-bold text-xs cursor-pointer border-none disabled:opacity-50"
              >
                Send verification email
              </button>
              <button
                type="button"
                onClick={() => void startTotpSetup()}
                disabled={loading}
                className="w-full py-3 rounded-[14px] bg-[#161412] border border-white/[0.08] text-white font-bold text-xs cursor-pointer"
              >
                I verified — continue
              </button>
            </div>
          </div>
        )}

        {step === 'totp' && (
          <div className="space-y-3">
            <div className="rounded-[16px] bg-[#0A0908] border border-white/[0.04] p-4 space-y-3">
              <p className="text-xs text-white/50 font-satoshi">Scan with your authenticator app.</p>
              {totpQr ? (
                <div className="flex justify-center py-2">
                  <img src={totpQr} alt="Authenticator QR" className="w-44 h-44 rounded-xl bg-white p-2" />
                </div>
              ) : null}
              <div className="flex items-center gap-2 rounded-xl bg-[#161412] border border-white/[0.06] p-3">
                <span className="font-mono text-[11px] text-white/80 break-all select-all flex-1 min-w-0">
                  {totpUri || totpSecret}
                </span>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(totpUri || totpSecret, 'Copied.')}
                  className="p-2 rounded-lg bg-[#0A0908] border border-white/[0.06] text-white/70 cursor-pointer shrink-0"
                >
                  <ContentCopyIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="rounded-[16px] bg-[#0A0908] border border-white/[0.04] p-4 space-y-3">
              <input
                type="text"
                inputMode="numeric"
                value={totpOtp}
                onChange={(e) => setTotpOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                className="w-full bg-[#161412] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-[#6366F1]"
              />
              <button
                type="button"
                onClick={() => void verifyTotpSetup()}
                disabled={loading || totpOtp.trim().length !== 6 || !vaultUnlocked}
                className="w-full py-3.5 rounded-[14px] bg-[#6366F1] text-white font-bold text-sm cursor-pointer border-none disabled:opacity-50"
              >
                Verify
              </button>
            </div>
          </div>
        )}

        {step === 'recovery-view' && (
          <div className="space-y-3">
            <div className="rounded-[16px] bg-[#0A0908] border border-white/[0.04] p-4 space-y-3">
              <p className="text-xs text-white/50 font-satoshi">{RECOVERY_HINT}</p>
              <div className="grid grid-cols-1 gap-2">
                {displayRecoveryCodes.map((code) => (
                  <div
                    key={code}
                    className="p-3 rounded-xl bg-[#161412] border border-white/[0.06] font-mono text-center text-white text-xs select-all"
                  >
                    {code}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  void copyToClipboard(displayRecoveryCodes.join('\n'), 'Recovery codes copied.')
                }
                className="w-full py-3 rounded-[14px] bg-[#161412] border border-white/[0.08] text-white font-bold text-xs cursor-pointer"
              >
                Copy all
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** @deprecated Prefer mounting TwoFactorPanel via Overlay / native sidebar. */
export function TwoFactorDrawer({
  open,
  onClose,
  userId,
  emailVerified,
  loginMethod,
  onEnabled,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  emailVerified?: boolean;
  loginMethod: MfaLoginMethod;
  onEnabled?: () => void;
  mode?: 'setup' | 'reminder';
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1400] flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative h-full w-full sm:w-[420px] shadow-2xl">
        <TwoFactorPanel
          onClose={onClose}
          userId={userId}
          emailVerified={emailVerified}
          loginMethod={loginMethod}
          onChanged={onEnabled}
          mode={mode}
        />
      </div>
    </div>
  );
}
