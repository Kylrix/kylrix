'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { X, Mail, ArrowLeft, Fingerprint, Trash2 } from 'lucide-react';
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
import { listOtherAccounts, upsertAccount } from '@/lib/account/vault';
import { setActivePartitionId } from '@/lib/account/partition';

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
  const { activeContent, drawerData, close } = useUnifiedDrawer();
  const { loginWithEmailOTP, verifyEmailOTP, refreshUser, user } = useAuth();
  const { setIsDrawerOpen } = useDrawerState();
  const isDesktop = useIsDesktop();
  const isSwitchMode = drawerData?.mode === 'switch';

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
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

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
      const session: any = await account.createEmailPasswordSession(email, password);

      // Cache device session in RxDB (plaintext, instant, no masterpass)
      try {
        const { storeAccountSession } = await import('@/lib/account/vault');
        const jwt = await account.createJWT().then((r: any) => r.jwt).catch(() => null);
        await storeAccountSession(session.userId, { jwt: jwt || undefined, secret: session.secret || undefined, sessionId: session.$id });
      } catch {}

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
      
      // Cache session in RxDB for instant switching (no encryption)
      try {
        const { storeAccountSession } = await import('@/lib/account/vault');
        const jwt = await account.createJWT().then((r: any) => r.jwt).catch(() => null);
        await storeAccountSession(verifyRes.userId, { jwt: jwt || undefined, secret: verifyRes.token, sessionId: `passkey_${verifyRes.userId}` });
      } catch {}
      setActivePartitionId(`_acc_${verifyRes.userId}` as any);
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

  // keep vault in sync with current user (virtual partition)
  useEffect(() => {
    if (user?.$id) {
      upsertAccount({ id: user.$id, name: user.name ?? null, email: user.email ?? null, username: (user as any).username ?? null, addedAt: Date.now() });
    }
  }, [user?.$id]);

  useEffect(() => {
    if (isOpen && isSwitchMode) setShowAddAccount(false);
  }, [isOpen, isSwitchMode]);

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
        // Do not auto-close when explicitly opened in switch mode
        if (!cancelled && current && !isSwitchMode) {
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
  }, [isOpen, isSwitchMode, close, refreshUser]);

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
      // Cache session for switching (plaintext device cache, no masterpass)
      try {
        const { storeAccountSession } = await import('@/lib/account/vault');
        const { account } = await import('@/lib/appwrite/client');
        const jwt = await account.createJWT().then((r: any) => r.jwt).catch(() => null);
        // verifyEmailOTP creates session internally; use email as id fallback
        const { getCurrentUser } = await import('@/lib/appwrite/client');
        const cur = await getCurrentUser().catch(() => null);
        if (cur?.$id) await storeAccountSession(cur.$id, { jwt: jwt || undefined });
      } catch {}
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
    setShowAddAccount(false);
    close();
  };

  const handleSwitchTo = useCallback(async (targetId: string) => {
    if (!targetId || targetId === user?.$id || isSwitching) return;
    setIsSwitching(true);

    // Opaque blanket to prevent flash of stale UI
    const blanket = document.createElement('div');
    blanket.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0A0908';
    document.body.appendChild(blanket);

    try {
      const { getAccountSession } = await import('@/lib/account/vault');
      const cached = await getAccountSession(targetId);

      // 0. Persist the current user's active workspace before switching away so it's remembered on switch-back
      // Also cache current JWT for instant return (no masterpass)
      if (user?.$id) {
        try {
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          const currentWorkspaceCacheKey = `kylrix_active_workspace_${user.$id}`;
          const alreadyStored = await LocalEngine.cacheGet<string>(currentWorkspaceCacheKey);
          if (!alreadyStored) {
            await LocalEngine.cacheSet(currentWorkspaceCacheKey, user.$id);
          }
          // Refresh current session JWT in cache before leaving
          const { storeAccountSession } = await import('@/lib/account/vault');
          const jwt = await account.createJWT().then((r: any) => r.jwt).catch(() => null);
          if (jwt) await storeAccountSession(user.$id, { jwt });
        } catch {}
      }

      if (!cached?.secret && !cached?.jwt) {
        // Fallback: try server-minted custom token via Admin SDK
        try {
          const { mintSessionForUserAction } = await import('@/lib/actions/account-switch');
          const minted = await (mintSessionForUserAction as any)(targetId);
          if (minted?.success && minted?.secret) {
            await account.deleteSession('current').catch(() => {});
            await account.createSession({ userId: targetId, secret: minted.secret });
            const { setActivePartitionId } = await import('@/lib/account/partition');
            setActivePartitionId(`_acc_${targetId}` as any);
            try {
              const freshJwt = await account.createJWT().then((r: any) => r.jwt).catch(() => null);
              if (freshJwt) {
                const { storeAccountSession } = await import('@/lib/account/vault');
                await storeAccountSession(targetId, { secret: minted.secret, jwt: freshJwt, sessionId: `minted_${targetId}` });
              }
            } catch {}
            try { sessionStorage.clear(); const { invalidateCurrentUserCache } = await import('@/lib/appwrite/client'); invalidateCurrentUserCache(); } catch {}
            toast.success('Switched account');
            setTimeout(() => window.location.reload(), 180);
            return;
          }
        } catch {}
        document.body.removeChild(blanket);
        toast.error(`No stored session for this account. Please add it again.`);
        setIsSwitching(false);
        return;
      }

      // 1. Restore the target account's Appwrite session using cached secret/jwt
      // Use server-minted escalation (secret one-time) — mint BEFORE deleting old session so we never leave no-session state
      let freshSecret: string | null = null;
      try {
        const { mintSessionForUserAction, createSessionFromJWTAction } = await import('@/lib/actions/account-switch');
        if (cached.jwt) {
          const res = await (createSessionFromJWTAction as any)(cached.jwt).catch(() => null);
          if (res?.success && res?.secret) freshSecret = res.secret;
        }
        if (!freshSecret) {
          const minted = await (mintSessionForUserAction as any)(targetId, cached.jwt).catch(() => null);
          if (minted?.success && minted?.secret) freshSecret = minted.secret;
        }
      } catch {}

      if (freshSecret) {
        try { await account.deleteSession('current').catch(() => {}); } catch {}
        await account.createSession({ userId: targetId, secret: freshSecret });
        try {
          const freshJwt = await account.createJWT().then((r: any) => r.jwt).catch(() => null);
          if (freshJwt) {
            const { storeAccountSession } = await import('@/lib/account/vault');
            await storeAccountSession(targetId, { secret: freshSecret, jwt: freshJwt, sessionId: `minted_${targetId}` });
          }
        } catch {}
      } else if (cached.secret) {
        // Last resort: try cached one-time secret directly (may fail if already consumed) — only after mint fails
        try { await account.deleteSession('current').catch(() => {}); } catch {}
        await account.createSession({ userId: targetId, secret: cached.secret });
        try {
          const freshJwt = await account.createJWT().then((r: any) => r.jwt).catch(() => null);
          if (freshJwt) {
            const { storeAccountSession } = await import('@/lib/account/vault');
            await storeAccountSession(targetId, { secret: cached.secret, jwt: freshJwt, sessionId: cached.sessionId });
          }
        } catch {}
      } else {
        // Final server fallback without JWT
        try {
          const { mintSessionForUserAction } = await import('@/lib/actions/account-switch');
          const fallback = await (mintSessionForUserAction as any)(targetId).catch(() => null);
          if (fallback?.success && fallback?.secret) {
            try { await account.deleteSession('current').catch(() => {}); } catch {}
            await account.createSession({ userId: targetId, secret: fallback.secret });
            const freshJwt = await account.createJWT().then((r: any) => r.jwt).catch(() => null);
            if (freshJwt) {
              const { storeAccountSession } = await import('@/lib/account/vault');
              await storeAccountSession(targetId, { secret: fallback.secret, jwt: freshJwt, sessionId: `minted_${targetId}` });
            }
          } else {
            throw new Error('Unauthorized: cached session expired and server mint failed');
          }
        } catch (e: any) {
          throw new Error(e?.message || 'Account switch failed');
        }
      }

      // 2. Flip partition pointer in localStorage
      const targetPid = `_acc_${targetId}`;
      setActivePartitionId(targetPid as any);

      // 3. Clear all stale in-memory caches
      try {
        sessionStorage.clear();
        const { invalidateCurrentUserCache } = await import('@/lib/appwrite/client');
        invalidateCurrentUserCache();
        const { clearChatsListMemory, clearThreadsListMemory } = await import('@/lib/chat/local-chat-cache');
        clearChatsListMemory();
        if (typeof clearThreadsListMemory === 'function') (clearThreadsListMemory as any)();
        const { clearSessionProjectsList } = await import('@/lib/projects/projects-cache');
        clearSessionProjectsList();
      } catch {}

      // 3.5 Account → Workspace cascading (top-down, single no-gap flow):
      // As soon as incoming lands, prompt incoming's local copy which also queries remote if none listed
      // or been long since fetch, get workspaces first, then check default prefs, fallback to personal.
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const { warmProjectsList } = await import('@/lib/projects/warm-projects-list');
        const workspaceCacheKey = `kylrix_active_workspace_${targetId}`;
        const storedWorkspace = await LocalEngine.cacheGet<string>(workspaceCacheKey);

        if (storedWorkspace && typeof storedWorkspace === 'string' && storedWorkspace.trim()) {
          // (a) Returning user — verify stored workspace still exists in their workspace list
          try {
            const rows = await warmProjectsList({
              userId: targetId,
              getCachedDataAsync: async (k: string) => (await LocalEngine.cacheGet(k)) as any,
              fetchOptimized: async (k: string, fetcher: () => Promise<any>) => fetcher(),
            }).catch(() => []);
            const list = Array.isArray(rows) ? rows : (rows as any)?.rows || [];
            const stillExists = list.some((p: any) => String(p.$id || p.id) === storedWorkspace);
            if (!stillExists && list.length) {
              // Stored points to deleted workspace — reset to prefs/personal below
              await LocalEngine.cacheDelete(workspaceCacheKey);
            } else {
              // valid stored workspace — keep it, but ensure workspace list is warm for next step
            }
          } catch {}
          const refreshedStored = await LocalEngine.cacheGet<string>(workspaceCacheKey);
          if (refreshedStored && refreshedStored.trim()) {
            // still valid — cascade will pick it up, nothing more to do
          } else {
            // was deleted — fall through to prefs/personal
            let resolvedWorkspaceId: string | null = null;
            try {
              const prefs = await account.getPrefs();
              const prefWorkspaceId = prefs?.activeWorkspaceId || prefs?.defaultWorkspaceId;
              if (prefWorkspaceId && typeof prefWorkspaceId === 'string' && prefWorkspaceId.trim()) {
                const { ProjectsService } = await import('@/lib/appwrite/projects');
                const { rows } = await ProjectsService.listProjects(true);
                const found = rows.some((p: any) => String(p.$id || p.id) === prefWorkspaceId);
                if (found) resolvedWorkspaceId = prefWorkspaceId;
                else resolvedWorkspaceId = prefWorkspaceId;
              }
            } catch {}
            await LocalEngine.cacheSet(workspaceCacheKey, resolvedWorkspaceId || targetId);
          }
        } else {
          // (b) First ensure we have the incoming account's workspaces (local copy → remote if none/stale)
          let rows: any[] = [];
          try {
            rows = await warmProjectsList({
              userId: targetId,
              getCachedDataAsync: async (k: string) => (await LocalEngine.cacheGet(k)) as any,
              fetchOptimized: async (k: string, fetcher: () => Promise<any>) => fetcher(),
            });
            if (!Array.isArray(rows)) rows = (rows as any)?.rows || [];
          } catch {
            try {
              const { ProjectsService } = await import('@/lib/appwrite/projects');
              const res = await ProjectsService.listProjects(true);
              rows = res.rows || [];
            } catch { rows = []; }
          }
          // Seed DataNexus session list so WorkspaceContext sees workspaces instantly post-reload
          try {
            const { setSessionProjectsList } = await import('@/lib/projects/projects-cache');
            if (rows.length) setSessionProjectsList(rows);
          } catch {}

          // (c) Then check default workspace from incoming user settings
          let resolvedWorkspaceId: string | null = null;
          try {
            const prefs = await account.getPrefs();
            const prefWorkspaceId = prefs?.activeWorkspaceId || prefs?.defaultWorkspaceId;
            if (prefWorkspaceId && typeof prefWorkspaceId === 'string' && prefWorkspaceId.trim()) {
              const found = rows.some((p: any) => String(p.$id || p.id) === prefWorkspaceId);
              if (found) resolvedWorkspaceId = prefWorkspaceId;
              else if (prefWorkspaceId) resolvedWorkspaceId = prefWorkspaceId; // trust pref even if not yet in list
            }
          } catch {}

          // (d) Fall back to personal virtual workspace "{username}'s Workspace" (id = userId)
          await LocalEngine.cacheSet(workspaceCacheKey, resolvedWorkspaceId || targetId);
        }
      } catch {}

      // 4. Full page reload — cleanest possible context flush
      try {
        const { getAccount } = await import('@/lib/account/vault');
        const _acct = getAccount(targetId);
        toast.success(`Switched to ${_acct?.name || _acct?.email || 'account'}`);
      } catch { toast.success('Switched account'); }
      close();
      setTimeout(() => window.location.reload(), 120);
    } catch (_e: any) {
      try { document.body.removeChild(blanket); } catch {}
      // Session secret may be expired — tell user to re-add account
      toast.error('Session expired for this account. Please add it again via "Add Account".');
      setIsSwitching(false);
    }
  }, [user?.$id, isSwitching, close]);

  const [stashedActiveUser, setStashedActiveUser] = useState<any>(null);

  const handleStartAddAccount = useCallback(async () => {
    if (user?.$id) {
      setStashedActiveUser(user);
      // Cache current JWT before suspending so cancel can restore without re-login
      try {
        const { storeAccountSession } = await import('@/lib/account/vault');
        const jwt = await account.createJWT().then((r: any) => r.jwt).catch(() => null);
        if (jwt) await storeAccountSession(user.$id, { jwt });
      } catch {}
    }
    try {
      const { clearStatelessSessions } = await import('@/lib/utils');
      clearStatelessSessions();
      // Suspend current session but keep vault entry — cancel will restore via cached JWT/secret
      try {
        await account.deleteSession('current').catch(() => {});
      } catch {}
    } catch {}
    setShowAddAccount(true);
  }, [user]);

  const handleCancelAddAccount = useCallback(async () => {
    setShowAddAccount(false);
    if (stashedActiveUser?.$id) {
      setActivePartitionId(`_acc_${stashedActiveUser.$id}` as any);
      // Restore stashed account's session from cache if we suspended it
      try {
        const { getAccountSession } = await import('@/lib/account/vault');
        const cached = await getAccountSession(stashedActiveUser.$id);
        if (cached?.secret || cached?.jwt) {
          const { account } = await import('@/lib/appwrite/client');
          // Try mint then create to avoid one-time secret reuse
          let freshSecret: string | null = null;
          try {
            const { mintSessionForUserAction, createSessionFromJWTAction } = await import('@/lib/actions/account-switch');
            if (cached.jwt) {
              const res = await (createSessionFromJWTAction as any)(cached.jwt).catch(() => null);
              if (res?.success && res?.secret) freshSecret = res.secret;
            }
            if (!freshSecret) {
              const minted = await (mintSessionForUserAction as any)(stashedActiveUser.$id, cached.jwt).catch(() => null);
              if (minted?.success && minted?.secret) freshSecret = minted.secret;
            }
          } catch {}
          if (freshSecret) await account.createSession({ userId: stashedActiveUser.$id, secret: freshSecret }).catch(() => {});
          else if (cached.secret) await account.createSession({ userId: stashedActiveUser.$id, secret: cached.secret }).catch(() => {});
          const { invalidateCurrentUserCache } = await import('@/lib/appwrite/client');
          invalidateCurrentUserCache();
          setTimeout(() => window.location.reload(), 120);
        }
      } catch {}
    }
  }, [stashedActiveUser]);

  const handleContinueCurrent = useCallback(() => {
    handleClose();
  }, []);

  const currentLabel = user?.name || (user as any)?.username || user?.email || 'Current account';
  const otherAccounts = isSwitchMode ? listOtherAccounts(user?.$id) : [];

  const handleDeleteAccount = useCallback(async (targetId: string) => {
    const acct = listOtherAccounts(user?.$id).find(a => a.id === targetId);
    const label = acct?.name || acct?.email || 'this account';
    if (!window.confirm(`Remove ${label}? Session will be removed and you will have to sign in again.`)) return;
    try {
      const { removeAccount, clearAccountSession } = await import('@/lib/account/vault');
      removeAccount(targetId);
      await clearAccountSession(targetId);
      // also clear per-account workspace cache
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        await LocalEngine.cacheDelete(`kylrix_active_workspace_${targetId}`);
        await LocalEngine.cacheDelete(`f_projects_list_${targetId}`);
        await LocalEngine.cacheDelete(`f_notes_list_${targetId}`);
      } catch {}
      toast.success(`Removed ${label}`);
      setShowAddAccount(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove account');
    }
  }, [user?.$id]);

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
              <h3 className="font-clash font-black text-white text-xl tracking-tight leading-tight">
                {isSwitchMode && !showAddAccount ? 'Switch Account' : 'Continue to Kylrix'}
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

          {isSwitchMode && !showAddAccount ? (
            <div className="space-y-5 animate-fadeIn">
              {/* Switch account list */}
              {otherAccounts.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/50 font-mono m-0">Switch account</p>
                  <div className="space-y-2">
                    {otherAccounts.map(acct => (
                      <div
                        key={acct.id}
                        className="w-full flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/20 transition-all"
                      >
                        <button
                          type="button"
                          onClick={() => handleSwitchTo(acct.id)}
                          disabled={isSwitching}
                          className="flex-1 flex items-center gap-3 text-left min-w-0 disabled:opacity-50"
                        >
                          <div className="w-9 h-9 rounded-full bg-[#F59E0B] flex items-center justify-center text-black font-black text-sm shrink-0">
                            {(acct.name || acct.username || acct.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-extrabold text-white truncate m-0">{acct.name || acct.username || acct.email}</p>
                            {acct.email ? <p className="text-xs text-white/50 truncate m-0">{acct.email}</p> : null}
                          </div>
                          <span className="text-xs font-bold text-white/40 shrink-0">Switch</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(acct.id)}
                          className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-white/60 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-colors shrink-0"
                          aria-label={`Remove ${acct.name || acct.email || 'account'}`}
                          title="Remove account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-white/40 text-center py-2">No other accounts yet</p>
              )}
              <div className="h-px bg-white/[0.06]" />
              <button
                type="button"
                onClick={handleStartAddAccount}
                className="w-full h-[52px] rounded-2xl bg-white text-black font-black text-sm hover:bg-white/90 transition-colors"
              >
                Add account
              </button>
              <button
                type="button"
                onClick={handleContinueCurrent}
                className="w-full h-[52px] rounded-2xl bg-white/[0.06] border border-white/[0.08] text-white font-bold text-sm hover:bg-white/[0.10] transition-colors"
              >
                Continue with {currentLabel}
              </button>
            </div>
          ) : isSwitchMode && showAddAccount ? (
            <div className="space-y-3">
              <button type="button" onClick={handleCancelAddAccount} className="text-xs font-bold text-white/60 hover:text-white flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to switch
              </button>
              {renderStep()}
            </div>
          ) : (
            renderStep()
          )}

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
