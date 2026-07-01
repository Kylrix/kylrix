'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { X, Mail, ArrowLeft, Fingerprint } from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import OAuthButtons from '@/components/OAuthButtons';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { MfaChallengeDrawer } from '@/components/overlays/MfaChallengeDrawer';
import { getCurrentLoginMethod, isMfaRequiredError } from '@/lib/mfa';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { account } from '@/lib/appwrite/client';
import { getPasskeyLoginOptionsAction, verifyPasskeyLoginAction, checkEmailAuthStatusAction } from '@/lib/actions/auth-actions';
import { performNativePasskeyAuthentication } from '@/lib/webauthn-utils';

type LoginStep = 'initial' | 'email' | 'otp';

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
  const { activeContent, close } = useUnifiedDrawer();
  const { loginWithEmailOTP, verifyEmailOTP, refreshUser } = useAuth();
  const { setIsDrawerOpen } = useDrawerState();
  const isDesktop = useIsDesktop();

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
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [useOTPAlternative, setUseOTPAlternative] = useState(false);

  useEffect(() => {
    if (step !== 'email') {
      setHasMasterpass(false);
      setPassword('');
      setUseOTPAlternative(false);
      return;
    }

    const emailTrimmed = email.trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);

    if (!emailValid) {
      setHasMasterpass(false);
      setPassword('');
      setUseOTPAlternative(false);
      return;
    }

    setCheckingEmail(true);
    const timer = setTimeout(async () => {
      try {
        const res = await checkEmailAuthStatusAction(emailTrimmed);
        if (res.success && res.exists && res.hasMasterpass) {
          setHasMasterpass(true);
        } else {
          setHasMasterpass(false);
          setUseOTPAlternative(false);
        }
      } catch (err) {
        console.error('Error checking email auth status:', err);
      } finally {
        setCheckingEmail(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [email, step]);

  const handlePasswordLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    localStorage.setItem('kylrix_last_auth_method', 'password');
    setLastUsedMethod('password');

    try {
      try {
        await account.deleteSession('current');
      } catch {}

      const session = await account.createEmailPasswordSession(email, password);
      
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
      console.log('VERBOSE STACK:', err.stack);
      toast.error(`Passkey login failed: ${err.message}\nStack: ${err.stack?.slice(0, 150)}`);
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
    if (step === 'email') setStep('initial');
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
          </div>
        );

      case 'email':
        const showPasswordField = hasMasterpass && !useOTPAlternative;
        return (
          <form 
            onSubmit={showPasswordField ? handlePasswordLogin : handleSendOTP} 
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
                  placeholder="Enter your master password"
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
                showPasswordField ? 'Login with Password' : 'Send Login Code'
              )}
            </button>

            {hasMasterpass && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setUseOTPAlternative(!useOTPAlternative)}
                  className="text-xs text-[#6366F1] hover:underline font-bold transition-all"
                >
                  {useOTPAlternative ? 'Use Password Login instead' : 'Login with Email OTP instead'}
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
      
      default:
        return null;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[1298] bg-black/60 backdrop-blur-sm transition-all duration-300 animate-fadeIn"
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
              <h3 className="font-clash font-black text-white text-xl tracking-tight leading-tight">
                Continue to Kylrix
              </h3>
            </div>
            <button 
              type="button" 
              onClick={handleClose} 
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] border border-white/5 hover:border-white/20 text-[#9B9691] hover:text-white transition-all cursor-pointer"
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
