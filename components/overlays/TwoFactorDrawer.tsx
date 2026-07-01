'use client';

import { useCallback, useEffect, useState } from 'react';
import { account, avatars } from '@/lib/appwrite/client';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import {
  createTotpAuthenticator,
  disableAllMfaFactors,
  enableAccountMfa,
  generateMfaRecoveryCodes,
  isMfaFullyEnabled,
  listCurrentMfaFactors,
  type MfaLoginMethod,
  verifyTotpAuthenticator,
} from '@/lib/mfa';
import { loadMfaRecoveryCodes, persistMfaRecoveryCodes } from '@/lib/mfa-recovery-vault';
import toast from 'react-hot-toast';
import { X as CloseIcon, Copy as ContentCopyIcon } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  emailVerified?: boolean;
  loginMethod: MfaLoginMethod;
  onEnabled?: () => void;
  mode?: 'setup' | 'reminder';
};

type Step = 'summary' | 'recovery' | 'email-verify' | 'totp' | 'done';

const RECOVERY_COPY_HINT = 'Save these recovery codes in a secure place. They are shown once by Appwrite.';

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

  const copyToClipboard = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  };

  const ensureVaultUnlocked = () => {
    if (!ecosystemSecurity.status.isUnlocked) {
      throw new Error('Unlock the vault before continuing so recovery codes can be saved securely.');
    }
  };

  const generateAndStoreRecoveryCodes = useCallback(async () => {
    ensureVaultUnlocked();
    const codes = await generateMfaRecoveryCodes();
    if (!codes.length) {
      throw new Error('Appwrite did not return recovery codes.');
    }
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
      throw new Error('Both email and TOTP must be enabled before turning on 2FA.');
    }
    await enableAccountMfa();
    setStep('done');
    onEnabled?.();
    await refreshFactors();
  }, [onEnabled, refreshFactors]);

  const sendEmailVerification = async () => {
    setLoading(true);
    setError(null);
    try {
      const verifyUrl = `${window.location.origin}/accounts/settings/security#mfa`;
      await account.createVerification({ url: verifyUrl });
      toast.success('Verification email sent.');
    } catch (err) {
      const message = (err as { message?: string })?.message || 'Failed to send verification email.';
      setError(message);
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
        await finalizeTwoFactor();
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
      const message = (err as { message?: string })?.message || 'Failed to create TOTP setup.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [emailVerified, finalizeTwoFactor, refreshFactors]);

  const verifyTotpSetup = async () => {
    if (totpOtp.trim().length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      ensureVaultUnlocked();
      await verifyTotpAuthenticator(totpOtp.trim());
      await finalizeTwoFactor();
    } catch (err) {
      const message = (err as { message?: string })?.message || 'TOTP verification failed.';
      setError(message);
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
      setStep('summary');
      await refreshFactors();
      toast.success('2FA turned off.');
      onEnabled?.();
    } catch (err) {
      const message = (err as { message?: string })?.message || 'Unable to disable 2FA.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const startTwoFactorSetup = async () => {
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
      if (!recoveryCodes.length) {
        await generateAndStoreRecoveryCodes();
      }
      await startTotpSetup();
    } catch (err) {
      const message = (err as { message?: string })?.message || 'Failed to prepare 2FA setup.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const showStoredRecoveryCodes = async () => {
    setLoading(true);
    setError(null);
    try {
      ensureVaultUnlocked();
      const codes = await loadMfaRecoveryCodes(userId);
      if (!codes?.length) {
        throw new Error('No recovery codes were found in your vault.');
      }
      setStoredRecoveryCodes(codes);
      setStep('done');
    } catch (err) {
      const message = (err as { message?: string })?.message || 'Unable to load recovery codes.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    setStep('summary');
    setTotpSecret('');
    setTotpUri('');
    setTotpQr('');
    setTotpOtp('');
    setRecoveryCodes([]);
    setStoredRecoveryCodes(null);
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

  const primaryActionLabel = isTwoFactorOn ? 'Turn off 2FA' : 'Enable 2FA';
  const displayRecoveryCodes = storedRecoveryCodes || recoveryCodes;

  return (
    <>
      <div
        className="fixed inset-0 z-[1399] bg-black/60 backdrop-blur-sm transition-all duration-300 animate-fadeIn"
        onClick={onClose}
      />

      <div className="fixed z-[1400] bg-[#0A0A0A]/98 backdrop-blur-[28px] border-white/5 shadow-2xl transition-all duration-300 flex flex-col overflow-y-auto right-0 top-0 bottom-0 w-full sm:w-[420px] border-l animate-slideInRight">
        <div className="w-full px-6 py-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-white font-clash font-black text-xl tracking-tight leading-tight">
                {mode === 'reminder' ? 'Set up 2FA' : '2FA'}
              </h3>
              <p className="text-xs text-white/50 font-semibold font-satoshi mt-1">
                Recovery codes first, verified email, then TOTP.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] border border-white/5 hover:border-white/20 text-white/70 hover:text-white transition-all cursor-pointer"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="h-px bg-white/10 w-full mb-6" />

          {step === 'summary' && (
            <div className="space-y-6 animate-fadeIn">
              {!vaultUnlocked && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-semibold font-satoshi">
                  Unlock your vault before enabling 2FA so recovery codes can be saved securely.
                </div>
              )}

              {error && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold font-satoshi">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={isTwoFactorOn ? disableTwoFactor : startTwoFactorSetup}
                  disabled={loading || (!isTwoFactorOn && !vaultUnlocked)}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-black font-black text-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />}
                  <span>{primaryActionLabel}</span>
                </button>

                {isTwoFactorOn && (
                  <button
                    type="button"
                    onClick={showStoredRecoveryCodes}
                    disabled={loading || !vaultUnlocked}
                    className="w-full px-6 py-3.5 rounded-xl border border-white/10 text-white font-black text-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    Show recovery codes
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'recovery' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-6 rounded-[24px] bg-[#161514] border border-white/5 space-y-4">
                <span className="block text-white font-extrabold text-base">1. Recovery codes</span>
                <p className="text-sm text-white/60 leading-relaxed font-satoshi">
                  Appwrite shows these once. Kylrix saves an encrypted copy in your vault as <code>kylrix:mfa-recovery</code>.
                </p>
                {recoveryCodes.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {recoveryCodes.map((code) => (
                      <div key={code} className="p-3 rounded-xl bg-[#0A0908] border border-white/5 font-mono text-center text-white text-xs select-all">
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
                        toast.success(RECOVERY_COPY_HINT);
                      } catch (err) {
                        setError((err as Error).message);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading || !vaultUnlocked}
                    className="px-5 py-3 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-black font-black text-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    Generate and save recovery codes
                  </button>
                )}
                {recoveryCodes.length > 0 && (
                  <button
                    type="button"
                    onClick={continueFromRecovery}
                    disabled={loading}
                    className="w-full px-5 py-3 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-black font-black text-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    Continue to TOTP
                  </button>
                )}
              </div>
              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold font-satoshi">
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'email-verify' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-6 rounded-[24px] bg-[#161514] border border-white/5 space-y-4">
                <span className="block text-white font-extrabold text-base">Verify your email</span>
                <p className="text-sm text-white/60 leading-relaxed font-satoshi">
                  Appwrite needs a verified email before it can count email as an MFA factor.
                </p>
                <button
                  type="button"
                  onClick={sendEmailVerification}
                  disabled={loading}
                  className="px-5 py-3 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-black font-black text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  Send verification email
                </button>
                <button
                  type="button"
                  onClick={startTotpSetup}
                  disabled={loading}
                  className="w-full px-5 py-3 rounded-xl border border-white/10 text-white font-black text-xs transition-all cursor-pointer"
                >
                  I verified my email — continue
                </button>
              </div>
              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold font-satoshi">
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'totp' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-6 rounded-[24px] bg-[#161514] border border-white/5 space-y-4">
                <span className="block text-white font-extrabold text-base">2. Set up TOTP</span>
                <p className="text-sm text-white/60 leading-relaxed font-satoshi">
                  Add this account to your authenticator app, then enter the 6-digit code.
                </p>
                {totpQr && (
                  <div className="flex justify-center items-center py-2 bg-white/[0.02] rounded-2xl">
                    <img src={totpQr} alt="TOTP QR code" className="w-48 h-48 rounded-xl bg-white p-2" />
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 bg-[#0A0908] p-4 rounded-xl border border-white/5">
                  <span className="font-mono text-xs text-white/80 break-all select-all flex-1 min-w-0">
                    {totpUri || totpSecret}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(totpUri || totpSecret, 'Copied setup secret.')}
                    className="p-2 bg-white/[0.04] border border-white/5 rounded-lg text-white/70 hover:text-white transition-all cursor-pointer flex-shrink-0"
                  >
                    <ContentCopyIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 rounded-[24px] bg-[#161514] border border-white/5 space-y-4">
                <span className="block text-white font-extrabold text-base">3. Verify TOTP</span>
                <input
                  type="text"
                  value={totpOtp}
                  onChange={(event) => setTotpOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  className="w-full bg-[#0A0908] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-[#6366F1]"
                />
                <button
                  type="button"
                  onClick={verifyTotpSetup}
                  disabled={loading || totpOtp.trim().length !== 6 || !vaultUnlocked}
                  className="w-full px-5 py-3 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-black font-black text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  Verify and enable 2FA
                </button>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold font-satoshi">
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-6 rounded-[24px] bg-emerald-500/5 border border-emerald-500/10 space-y-2">
                <span className="block text-white font-extrabold text-base">
                  {isTwoFactorOn ? '2FA is active' : 'Recovery codes'}
                </span>
                <p className="text-sm text-emerald-400/80 font-satoshi font-semibold">
                  {isTwoFactorOn ? 'Email and TOTP are both enabled.' : 'Saved recovery codes from your vault.'}
                </p>
              </div>

              {displayRecoveryCodes.length > 0 && (
                <div className="p-6 rounded-[24px] bg-[#161514] border border-white/5 space-y-4">
                  <span className="block text-white font-extrabold text-base">Recovery codes</span>
                  <p className="text-xs text-white/50 leading-relaxed font-satoshi">{RECOVERY_COPY_HINT}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {displayRecoveryCodes.map((code) => (
                      <div key={code} className="p-3 rounded-xl bg-[#0A0908] border border-white/5 font-mono text-center text-white text-xs select-all">
                        {code}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(displayRecoveryCodes.join('\n'), 'Recovery codes copied.')}
                    className="w-full py-2.5 px-4 rounded-xl border border-white/10 text-white font-extrabold text-xs hover:border-[#6366F1] hover:bg-[#6366F1]/5 transition-all cursor-pointer"
                  >
                    Copy recovery codes
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-black font-black text-sm transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
