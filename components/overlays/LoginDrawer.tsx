'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { X, Mail, ArrowLeft, Fingerprint, Bot, ExternalLink, Terminal, Key, Copy, Check } from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import OAuthButtons from '@/components/OAuthButtons';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { MfaChallengeDrawer } from '@/components/overlays/MfaChallengeDrawer';
import { getCurrentLoginMethod, isMfaRequiredError } from '@/lib/mfa';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { account, invalidateCurrentUserCache } from '@/lib/appwrite/client';
import { getPasskeyLoginOptionsAction, verifyPasskeyLoginAction, checkEmailAuthStatusAction, selfHostedSignUpAction } from '@/lib/actions/auth-actions';
import { performNativePasskeyAuthentication } from '@/lib/webauthn-utils';
import { KYLRIX_AGENTS_SKILL_INSTALL } from '@/lib/api/public';
import { isSelfHostedDeployment } from '@/lib/deployment/surface';

type LoginStep = 'initial' | 'email' | 'otp' | 'agent';

// Simple custom media query hook to replace MUI useMediaQuery
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 768px)');
    setIsDesktop(media.matches);
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);
  return isDesktop;
}

export function LoginDrawer() {
  const { activeContent, drawerData, close } = useUnifiedDrawer();
  const { loginWithEmailOTP, verifyEmailOTP, refreshUser } = useAuth();
  const { setIsDrawerOpen } = useDrawerState();
  const isDesktop = useIsDesktop();
  const isSelfHosted = isSelfHostedDeployment();

  const customTitle = drawerData?.title || 'Continue to Kylrix';
  const customSubtitle = drawerData?.subtitle;

  const [step, setStep] = useState<LoginStep>('initial');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [otp, setOtp] = useState('');
  const [mfaDrawerOpen, setMfaDrawerOpen] = useState(false);
  const [mfaLoginMethod, setMfaLoginMethod] = useState<'email-otp' | 'oauth2' | 'password' | 'unknown'>('email-otp');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const [lastUsedMethod, setLastUsedMethod] = useState<string | null>(null);

  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const [checkingEmail, setCheckingEmail] = useState(false);
  const [hasMasterpass, setHasMasterpass] = useState(false);
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [useOTPAlternative, setUseOTPAlternative] = useState(false);
  const [copiedSkill, setCopiedSkill] = useState(false);

  useEffect(() => {
    if (step !== 'email') {
      setHasMasterpass(false);
      setUserExists(null);
      setPassword('');
      setUseOTPAlternative(false);
      return;
    }

    const emailTrimmed = email.trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);

    if (!emailValid) {
      setHasMasterpass(false);
      setUserExists(null);
      setPassword('');
      setUseOTPAlternative(false);
      return;
    }

    setCheckingEmail(true);
    const timer = setTimeout(async () => {
      try {
        const res = await checkEmailAuthStatusAction(emailTrimmed);
        if (res.success) {
          setUserExists(Boolean(res.exists));
          if (res.exists && res.hasMasterpass) {
            setHasMasterpass(true);
          } else {
            setHasMasterpass(false);
            if (!isSelfHosted) {
              setUseOTPAlternative(false);
            }
          }
        } else {
          setUserExists(null);
          setHasMasterpass(false);
          setUseOTPAlternative(false);
        }
      } catch (err) {
        console.error('Error checking email auth status:', err);
      } finally {
        setCheckingEmail(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [email, step, isSelfHosted]);

  const handleSelfHostedSignUp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const emailTrimmed = email.trim();
    if (!emailTrimmed || !password) return;
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }
    setLoading(true);
    localStorage.setItem('kylrix_last_auth_method', 'password');
    setLastUsedMethod('password');

    try {
      const signUpRes = await selfHostedSignUpAction({
        email: emailTrimmed,
        password,
        name: emailTrimmed.split('@')[0]
      });

      if (!signUpRes.success || !signUpRes.userId) {
        throw new Error(signUpRes.error || 'Failed to create account');
      }

      // Establish Appwrite session
      await account.deleteSession('current').catch(() => {});
      invalidateCurrentUserCache();
      const session: any = await account.createEmailPasswordSession(emailTrimmed, password);

      // Initialize MasterPass vault, keychain, E2E identity and profile
      try {
        const { masterPassCrypto } = await import('@/lib/masterpass-crypto');
        const { ecosystemSecurity } = await import('@/lib/ecosystem/security');
        const { UsersService } = await import('@/lib/services/users');

        await masterPassCrypto.unlock(password, session.userId, true);
        const pubKey = await ecosystemSecurity.syncIdentity(session.userId).catch(() => null);
        const profile = await UsersService.ensureProfileForUser({
          $id: session.userId,
          email: emailTrimmed,
          name: emailTrimmed.split('@')[0]
        });
        if (pubKey && profile) {
          await UsersService.updateProfile(session.userId, { publicKey: pubKey });
        }
        toast.success('Vault secured with master password');
      } catch (vaultErr) {
        console.warn('Vault auto-initialization warning on signup:', vaultErr);
      }

      toast.success('Account created successfully!');
      await refreshUser(true);
      close();
    } catch (err: any) {
      console.error('Self-hosted signup failed:', err);
      toast.error(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    localStorage.setItem('kylrix_last_auth_method', 'password');
    setLastUsedMethod('password');

    try {
      await account.deleteSession('current').catch(() => {});
      invalidateCurrentUserCache();
      const session: any = await account.createEmailPasswordSession(email, password);

      try {
        const { masterPassCrypto } = await import('@/lib/masterpass-crypto');
        const unlockSuccess = await masterPassCrypto.unlock(password, session.userId, false);
        if (unlockSuccess) {
          toast.success("Vault unlocked automatically");
        }
      } catch (vaultErr) {
        console.warn('Failed to auto-unlock vault with master password:', vaultErr);
      }

      toast.success('Logged in successfully!');
      await refreshUser(true);
      close();
    } catch (err: any) {
      if (isMfaRequiredError(err)) {
        setMfaLoginMethod('password');
        setMfaDrawerOpen(true);
        return;
      }
      toast.error(err.message || 'Password login failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    try {
      const hostname = window.location.hostname;
      const hostHeader = window.location.host;
      
      const optionsRes = await getPasskeyLoginOptionsAction(undefined, hostname);
      if (!optionsRes.success || !optionsRes.options || !optionsRes.challengeToken) {
        throw new Error(optionsRes.error || 'Failed to generate passkey options');
      }

      const authResp = await performNativePasskeyAuthentication(optionsRes.options);
      const verifyRes = await verifyPasskeyLoginAction(authResp, optionsRes.challengeToken, hostname, hostHeader);

      if (!verifyRes.success || !verifyRes.token) {
        throw new Error(verifyRes.error || 'Passkey verification failed');
      }

      // Complete Appwrite session creation using the minted token
      await account.deleteSession('current').catch(() => {});
      invalidateCurrentUserCache();
      await account.createSession({ userId: verifyRes.userId, secret: verifyRes.token });
      
      localStorage.setItem('kylrix_last_auth_method', 'passkey');
      localStorage.setItem(`kylrix_has_passkey_${verifyRes.userId}`, 'true');

      toast.success('Authenticated via Passkey!');
      await refreshUser(true);
      close();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        // User cancelled or timed out
        return;
      }
      console.error('Passkey login failed:', err);
      toast.error(`Passkey login failed: ${err.message}`);
    } finally {
      setPasskeyLoading(false);
    }
  };

  const isOpen = activeContent === 'login';

  useEffect(() => {
    setIsDrawerOpen(isOpen);
    return () => setIsDrawerOpen(false);
  }, [isOpen, setIsDrawerOpen]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLastUsedMethod(localStorage.getItem('kylrix_last_auth_method'));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setCheckingSession(false);
      return;
    }

    let cancelled = false;

    const verifySession = async () => {
      setCheckingSession(true);
      try {
        const current = await refreshUser(true);
        if (!cancelled && current) {
          close();
        }
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    };

    void verifySession();

    return () => {
      cancelled = true;
    };
  }, [isOpen, close, refreshUser]);

  const handleSendOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email) return;
    setLoading(true);
    localStorage.setItem('kylrix_last_auth_method', 'email');
    setLastUsedMethod('email');

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
    } catch (err: unknown) {
      if (isMfaRequiredError(err)) {
        const loginMethod = await getCurrentLoginMethod().catch(() => 'email-otp' as const);
        setMfaLoginMethod(loginMethod);
        setMfaDrawerOpen(true);
        setOtp('');
        return;
      }
      toast.error((err as { message?: string })?.message || 'Invalid code');
      setOtp('');
    } finally {
      setLoading(false);
    }
  }, [email, userId, verifyEmailOTP, close]);

  // Auto-submit effects for 6-digit completion
  useEffect(() => {
    if (step === 'otp' && otp.length === 6) {
      executeVerifyOTP(otp);
    }
  }, [otp, step, executeVerifyOTP]);

  const handleBack = () => {
    if (step === 'email' || step === 'agent') setStep('initial');
    else if (step === 'otp') {
        setStep('email');
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

  if (!isOpen) return null;

  const renderStep = () => {
    switch (step) {
      case 'initial':
        const isEmailLastUsed = lastUsedMethod === 'email';
        const isPasskeyLastUsed = lastUsedMethod === 'passkey';
        return (
          <div className="space-y-4 animate-fadeIn">
            {checkingSession ? (
              <div className="flex justify-center items-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#6366F1]" />
              </div>
            ) : (
              <OAuthButtons disabled={loading || checkingSession} lastUsed={lastUsedMethod} />
            )}
            
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={checkingSession || passkeyLoading}
              className={`w-full flex items-center justify-between px-5 rounded-2xl border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isPasskeyLastUsed 
                  ? 'h-[60px] border-white/30 bg-white/5 shadow-lg shadow-white/5' 
                  : 'h-[52px] border-[#34322F] bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3 font-extrabold text-sm text-white font-satoshi">
                {passkeyLoading ? (
                  <div className="animate-spin rounded-full h-4.5 w-4.5 border-b-2 border-white flex-shrink-0" />
                ) : (
                  <Fingerprint className="w-4.5 h-4.5 text-white/40 flex-shrink-0" />
                )}
                <span>Continue with Passkey</span>
              </div>
              {isPasskeyLastUsed && (
                <span className="text-[10px] font-black uppercase tracking-wider text-white opacity-60">
                  Last Used
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setStep('email')}
              disabled={checkingSession}
              className={`w-full flex items-center justify-between px-5 rounded-2xl border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isEmailLastUsed 
                  ? 'h-[60px] border-white/30 bg-white/5 shadow-lg shadow-white/5' 
                  : 'h-[52px] border-[#34322F] bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3 font-extrabold text-sm text-white font-satoshi">
                <Mail className="w-4.5 h-4.5 text-white/40 flex-shrink-0" />
                <span>Continue with Email</span>
              </div>
              {isEmailLastUsed && (
                <span className="text-[10px] font-black uppercase tracking-wider text-white opacity-60">
                  Last Used
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setStep('agent')}
              disabled={checkingSession}
              className="w-full flex items-center justify-between px-5 rounded-2xl border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-[52px] border-[#34322F] bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20"
            >
              <div className="flex items-center gap-3 font-extrabold text-sm text-white font-satoshi">
                <Bot className="w-4.5 h-4.5 text-[#6366F1] flex-shrink-0" />
                <span>Continue as Agent</span>
              </div>
              <span className="text-[10px] font-bold text-[#A5B4FC] font-mono">
                docs/agents →
              </span>
            </button>
          </div>
        );

      case 'email':
        const isNewSelfHostedUser = isSelfHosted && userExists === false;
        const showPasswordField = isSelfHosted 
          ? !useOTPAlternative 
          : (hasMasterpass && !useOTPAlternative);

        const submitHandler = isNewSelfHostedUser && showPasswordField
          ? handleSelfHostedSignUp
          : (showPasswordField ? handlePasswordLogin : handleSendOTP);

        let buttonLabel = 'Send Login Code';
        if (isSelfHosted) {
          if (isNewSelfHostedUser) {
            buttonLabel = showPasswordField ? 'Create Account' : 'Send Signup Code';
          } else {
            buttonLabel = showPasswordField ? 'Login with Password' : 'Send Login Code';
          }
        } else {
          buttonLabel = showPasswordField ? 'Login with Password' : 'Send Login Code';
        }

        let switchLabel = '';
        if (isSelfHosted) {
          if (isNewSelfHostedUser) {
            switchLabel = useOTPAlternative ? 'Create account with Password instead' : 'Sign up with Email OTP instead';
          } else {
            switchLabel = useOTPAlternative ? 'Login with Password instead' : 'Login with Email OTP instead';
          }
        } else if (hasMasterpass) {
          switchLabel = useOTPAlternative ? 'Use Password Login instead' : 'Login with Email OTP instead';
        }

        const passwordPlaceholder = isNewSelfHostedUser
          ? 'Create a password (min. 8 chars)'
          : (isSelfHosted ? 'Enter your password' : 'Enter your master password');

        return (
          <form 
            onSubmit={submitHandler} 
            className="space-y-4 animate-fadeIn"
          >
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Mail className="w-4.5 h-4.5 text-white/30" />
              </div>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                autoFocus
                className="w-full bg-[#0A0908] pl-11 pr-10 py-3 rounded-xl border border-[#34322F] text-white text-sm font-semibold focus:outline-none focus:border-[#6366F1] transition-all"
              />
              {checkingEmail && (
                <div className="absolute inset-y-0 right-4 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#6366F1]" />
                </div>
              )}
            </div>

            {showPasswordField && (
              <div className="relative animate-fadeIn">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <span className="text-white/30 text-sm font-semibold">🔑</span>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoFocus
                  className="w-full bg-[#0A0908] pl-11 pr-12 py-3 rounded-xl border border-[#34322F] text-white text-sm font-semibold focus:outline-none focus:border-[#6366F1] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-4 flex items-center text-xs text-white/40 hover:text-white transition-colors"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || (showPasswordField && !password)}
              className="w-full h-[52px] rounded-xl bg-white hover:bg-white/90 text-black font-black text-sm transition-all cursor-pointer flex justify-center items-center disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black" />
              ) : (
                buttonLabel
              )}
            </button>

            {switchLabel && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setUseOTPAlternative(!useOTPAlternative)}
                  className="text-xs text-[#6366F1] hover:underline font-bold transition-all"
                >
                  {switchLabel}
                </button>
              </div>
            )}
          </form>
        );

      case 'otp':
        return (
          <div className="space-y-4 animate-fadeIn">
            <p className="text-xs text-[#9B9691] text-center leading-relaxed">
              We sent a 6-digit code to <strong>{email}</strong>
            </p>
            <input
              type="text"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              disabled={loading}
              autoFocus
              className="w-full bg-[#0A0908] px-4 py-4 rounded-xl border border-[#34322F] text-center text-2xl font-black tracking-[0.5em] text-white focus:outline-none focus:border-[#6366F1] transition-all"
            />
            {loading && (
              <div className="flex justify-center items-center py-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#6366F1]" />
              </div>
            )}
          </div>
        );

      case 'agent':
        return (
          <div className="space-y-4 animate-fadeIn font-satoshi">
            <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#6366F1]/10 text-[#818CF8] flex items-center justify-center">
                  <Terminal className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  Agent Authentication
                </span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed font-sans m-0">
                Autonomous agents operate in isolated environments using <strong>Agent Provisioning Keys</strong> (<code className="text-[#818CF8] font-mono">kyl_apk_…</code>). They have zero access to your private notes or credentials.
              </p>
            </div>

            {/* Install Box */}
            <div className="p-3 rounded-xl bg-[#0A0908] border border-white/[0.06] space-y-1.5">
              <p className="text-[11px] font-bold text-white/50 font-mono uppercase tracking-wider m-0">
                CLI Skill Install
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 text-[11px] font-mono text-white/80 bg-[#161412] border border-white/[0.04] rounded-lg px-2.5 py-1.5 truncate select-all">
                  {KYLRIX_AGENTS_SKILL_INSTALL}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(KYLRIX_AGENTS_SKILL_INSTALL);
                      setCopiedSkill(true);
                      toast.success('Install command copied');
                      setTimeout(() => setCopiedSkill(false), 2000);
                    } catch {
                      toast.success(KYLRIX_AGENTS_SKILL_INSTALL);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-[#6366F1] hover:bg-[#5254E8] text-white cursor-pointer flex items-center gap-1 shrink-0 transition-colors"
                >
                  {copiedSkill ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSkill ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <Link
                href="/settings?tab=agents"
                onClick={handleClose}
                className="w-full h-[48px] rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#6366F1]/10 select-none cursor-pointer"
              >
                <Key className="w-4 h-4 text-white" />
                <span>Manage Agent Keys in Settings</span>
              </Link>

              <Link
                href="/docs/agents"
                onClick={handleClose}
                className="w-full h-[46px] rounded-xl bg-[#0A0908] hover:bg-[#161412] border border-white/10 hover:border-white/20 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 select-none cursor-pointer"
              >
                <span>Read Agent Documentation</span>
                <ExternalLink className="w-3.5 h-3.5 text-white/50" />
              </Link>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[1298] bg-black/60 transition-all duration-300 animate-fadeIn"
        onClick={handleClose}
      />

      {/* Drawer Container */}
      <div 
        className={`fixed z-[1299] bg-[#161412] border-white/5 shadow-2xl transition-all duration-300 flex flex-col overflow-y-auto ${
          isDesktop 
            ? 'right-0 top-0 bottom-0 w-full sm:w-[480px] border-l animate-slideInRight' 
            : 'left-0 right-0 bottom-0 h-auto max-h-[60vh] rounded-t-[24px] border-t animate-slideInUp'
        }`}
      >
        <div className="p-6 pb-[calc(24px+env(safe-area-inset-bottom))]">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              {step !== 'initial' && (
                <button 
                  type="button"
                  onClick={handleBack}
                  className="p-1.5 rounded-lg bg-white/[0.04] border border-white/5 hover:border-white/20 text-[#9B9691] hover:text-white transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4.5 h-4.5" />
                </button>
              )}
              <div>
                <h3 className="font-clash font-black text-white text-xl tracking-tight leading-tight m-0">
                  {customTitle}
                </h3>
                {customSubtitle && step === 'initial' && (
                  <p className="text-xs text-white/50 font-sans mt-1 m-0">
                    {customSubtitle}
                  </p>
                )}
              </div>
            </div>
            <button 
              type="button" 
              onClick={handleClose} 
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] border border-white/5 hover:border-white/20 text-[#9B9691] hover:text-white transition-all cursor-pointer flex-shrink-0"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {renderStep()}

          {/* Footer policy links */}
          <p className="text-center text-[10px] text-[#9B9691] mt-8 font-medium font-satoshi leading-normal">
            By continuing, you agree to our{' '}
            <Link
              href="/terms-of-service"
              onClick={handleClose}
              className="text-white underline hover:text-white/80 transition-colors"
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              href="/privacy-policy"
              onClick={handleClose}
              className="text-white underline hover:text-white/80 transition-colors"
            >
              Privacy Policy
            </Link>.
          </p>
        </div>
      </div>

      <MfaChallengeDrawer
        open={mfaDrawerOpen}
        onClose={() => setMfaDrawerOpen(false)}
        loginMethod={mfaLoginMethod}
        onSuccess={async () => {
          setMfaDrawerOpen(false);
          await refreshUser(true);
          close();
        }}
      />
    </>
  );
}
