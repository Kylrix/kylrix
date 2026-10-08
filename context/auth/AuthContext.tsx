'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCurrentUser, account, getKylrixPulse, setKylrixPulse, clearKylrixPulse, invalidateCurrentUserCache, onCurrentUserChanged, getCurrentUserSnapshot } from '@/lib/appwrite/client';
import { getEcosystemUrl } from '@/lib/ecosystem';
import { assertAuthenticatedAccount, completeMfaChallenge, isMfaRequiredError } from '@/lib/mfa';

import { toast } from 'react-hot-toast';

interface User {
  $id: string;
  email: string | null;
  name: string | null;
  isPulse?: boolean;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refreshUser: (forceRefresh?: boolean) => Promise<User | null>;
  openIDMWindow: (target?: string) => void;
  idmWindowOpen: boolean;
  loginWithEmailOTP: (email: string) => Promise<string>;
  verifyEmailOTP: (email: string, userId: string, secret: string) => Promise<void>;
  verifyMFA: (challengeId: string, otp: string) => Promise<void>;
  getJWT: () => Promise<string | null>;
  updatePreferences: (prefs: Record<string, any>) => Promise<any>;
  listDeviceSessions: () => Promise<any[]>;
  switchAccount: (sessionToken: string) => Promise<boolean>;
  revokeDeviceSession: (sessionToken: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Instant Synchronous Load — pulse, then last known local user (local-first).
  // Network account.verify runs in the background; UI must not wait on it.
  const [user, setUser] = useState<User | null>(() => {
    const pulse = getKylrixPulse();
    if (pulse) {
        return { $id: pulse.$id, name: pulse.name, isPulse: true, email: null, profilePicId: pulse.profilePicId };
    }
    const snap = getCurrentUserSnapshot();
    if (snap?.$id) {
        return {
            ...snap,
            $id: snap.$id,
            name: snap.name ?? null,
            email: snap.email ?? null,
            isPulse: true,
        };
    }
    return null;
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [idmWindowOpen, setIDMWindowOpen] = useState(false);
  const idmWindowRef = useRef<Window | null>(null);
  const initAuthStarted = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const sessionVerifySeq = useRef(0);
  const lastSeenUserIdRef = useRef<string | null>(user?.$id || null);
  const refreshUserRef = useRef<() => Promise<User | null>>(async () => null);
  const refreshUser = useCallback(async (forceRefresh = false): Promise<User | null> => {
    try {
      const isOAuthSuccess = typeof window !== 'undefined' && window.location.search.includes('auth=success');

      // 1. Better Auth session check (Primary authority)
      try {
        const { authClient } = await import('@/lib/auth/better-auth-client');
        const betterSession = await authClient.getSession().catch(() => null);
        if (betterSession?.data?.user) {
          const bUser = betterSession.data.user;
          const userObj = {
            $id: bUser.id,
            name: bUser.name,
            email: bUser.email,
            isPulse: false,
            authProvider: 'better-auth',
          };
          lastSeenUserIdRef.current = bUser.id;
          setUser(userObj as any);
          setKylrixPulse(userObj as any);

          if (isOAuthSuccess) {
            let target = '/app';
            if (typeof document !== 'undefined') {
              const match = document.cookie.match(/(?:^|; )kylrix_last_route=([^;]*)/);
              if (match && match[1]) {
                try {
                  const decoded = decodeURIComponent(match[1]);
                  if (
                    decoded &&
                    decoded !== '/' &&
                    decoded !== '/landing' &&
                    !decoded.startsWith('/login') &&
                    !decoded.startsWith('/connect')
                  ) {
                    target = decoded;
                  }
                } catch {}
              }
            }
            if (!pathname || pathname === '/' || pathname === '/landing' || pathname.startsWith('/login') || pathname.startsWith('/connect')) {
              router.replace(target);
            } else {
              const url = new URL(window.location.href);
              url.searchParams.delete('auth');
              window.history.replaceState({}, '', url.toString());
            }
          }

          return userObj as any;
        }
      } catch (betterAuthErr) {
        console.warn('[AuthContext] Better Auth session check warning:', betterAuthErr);
      }

      // 2. Secondary Appwrite active session check
      try {
        const appwriteUser = await getCurrentUser(forceRefresh || isOAuthSuccess).catch(() => null);
        if (appwriteUser && appwriteUser.$id) {
          lastSeenUserIdRef.current = appwriteUser.$id;
          setUser(appwriteUser as any);
          setKylrixPulse(appwriteUser);

          if (isOAuthSuccess) {
            let target = '/app';
            if (typeof document !== 'undefined') {
              const match = document.cookie.match(/(?:^|; )kylrix_last_route=([^;]*)/);
              if (match && match[1]) {
                try {
                  const decoded = decodeURIComponent(match[1]);
                  if (
                    decoded &&
                    decoded !== '/' &&
                    decoded !== '/landing' &&
                    !decoded.startsWith('/login') &&
                    !decoded.startsWith('/connect')
                  ) {
                    target = decoded;
                  }
                } catch {}
              }
            }
            if (!pathname || pathname === '/' || pathname === '/landing' || pathname.startsWith('/login') || pathname.startsWith('/connect')) {
              router.replace(target);
            } else {
              const url = new URL(window.location.href);
              url.searchParams.delete('auth');
              window.history.replaceState({}, '', url.toString());
            }
          }

          return appwriteUser as any;
        }
      } catch (appwriteAuthErr) {
        console.warn('[AuthContext] Appwrite session check warning:', appwriteAuthErr);
      }

      // If online and BOTH sessions are genuinely null, clear session
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        lastSeenUserIdRef.current = null;
        setUser(null);
        clearKylrixPulse();
        return null;
      }

      const offlineSnap = getCurrentUserSnapshot();
      if (offlineSnap?.$id) {
        setUser(offlineSnap as any);
        return offlineSnap as any;
      }
      return null;
    } catch (_error) {
      const offlineSnap = getCurrentUserSnapshot();
      if (offlineSnap?.$id) {
        setUser(offlineSnap as any);
        return offlineSnap as any;
      }
      if (user?.$id) {
        return user;
      }
      lastSeenUserIdRef.current = null;
      setUser(null);
      clearKylrixPulse();
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  refreshUserRef.current = refreshUser;

  // 3. RxDB Replication Trigger
  useEffect(() => {
    if (user?.$id && !user.isPulse) {
        const initCollaboration = async () => {
            const { CollaborationService } = await import('@/lib/services/collaboration');
            await CollaborationService.setupReplication(user.$id);
        };
        initCollaboration();
    }
  }, [user?.$id, user?.isPulse]);

  // 4. Centralized User Profile & Username Bootstrapping (triggered once per authenticated user)
  const userProfileBootstrappedRef = useRef<string | null>(null);
  useEffect(() => {
    if (user?.$id && !user.isPulse) {
      if (userProfileBootstrappedRef.current === user.$id) return;
      userProfileBootstrappedRef.current = user.$id;

      const initProfile = async () => {
        try {
          if (typeof window !== 'undefined' && user?.email) {
            try {
              const raw = localStorage.getItem('kylrix_known_accounts');
              const known = raw ? JSON.parse(raw) : [];
              const filtered = Array.isArray(known) ? known.filter((k: any) => k.id !== user.$id && k.email?.toLowerCase() !== user.email?.toLowerCase()) : [];
              filtered.unshift({
                id: user.$id,
                email: user.email,
                name: user.name || user.email.split('@')[0],
                image: (user as any).image || null,
                lastSeen: Date.now(),
              });
              localStorage.setItem('kylrix_known_accounts', JSON.stringify(filtered.slice(0, 10)));
            } catch {}
          }
          const { UsersService } = await import('@/lib/services/users');
          await UsersService.ensureProfileForUser(user);
        } catch (err) {
          console.warn('[AuthContext] Background profile bootstrapping failed:', err);
        }
      };
      void initProfile();

      // Silent Better Auth & Turso user minting & aggressive Tier 1/2 sync (runs once in background)
      const mintBetterAuthTurso = async () => {
        try {
          const { ensureBetterAuthUserTurso, syncTier1FromAppwriteTurso, resolveUserAppwriteMigrationGate } = await import('@/lib/actions/turso-ops');
          await ensureBetterAuthUserTurso({
            id: user.$id,
            name: user.name || (user.email ? user.email.split('@')[0] : 'User'),
            email: user.email || `${user.$id}@kylrix.local`,
            emailVerified: Boolean(user.emailVerification),
          });

          // Check migration gate: if user has no Appwrite account or has already fully synced, completely skip Appwrite!
          const gate = await resolveUserAppwriteMigrationGate({
            userId: user.$id,
            email: user.email || undefined,
          });

          if (gate.shouldSkipAppwrite) {
            return;
          }

          // Aggressive Tier 1 sync: keychain, encryption keys, vault secrets, totps, workspaces, notes, goals, conversations
          let userJwt: string | undefined;
          try {
            const { account } = await import('@/lib/appwrite/client');
            const jwtRes = await account.createJWT();
            userJwt = jwtRes.jwt;
          } catch {}
          void syncTier1FromAppwriteTurso(user.$id, true, userJwt).catch((e) => {
            console.warn('[AuthContext] Background aggressive sync warning:', e);
          });
        } catch (tursoErr) {
          console.warn('[AuthContext] Background Turso user minting failed:', tursoErr);
        }
      };
      void mintBetterAuthTurso();

      // 5. Silent Attribution & Referral Claiming (new + existing accounts, once)
      const claimAttribution = async () => {
        try {
          const { claimPendingReferralAttribution } = await import('@/lib/services/referral-client');
          let res = await claimPendingReferralAttribution();
          // Session cookie/JWT may still be warming on first paint
          if (res.attempted && !res.ok && !res.alreadyReferred && !/self-referral|invalid/i.test(String(res.error || ''))) {
            await new Promise((r) => setTimeout(r, 1200));
            res = await claimPendingReferralAttribution();
          }
        } catch (claimErr) {
          console.warn('[AuthContext] Background referral claim:', claimErr);
        }
      };
      void claimAttribution();
    }
  }, [user?.$id, user?.isPulse]);

  useEffect(() => {
    if (initAuthStarted.current) return;
    initAuthStarted.current = true;
    (async () => {
      const refreshed = await refreshUser();
      if (!refreshed && typeof navigator !== 'undefined' && !navigator.onLine) {
        const { salvageUserFromLocalSubstrate } = await import('@/lib/appwrite/client');
        const salvaged = await salvageUserFromLocalSubstrate();
        if (salvaged) {
          setUser(salvaged as any);
        }
      }
    })();
  }, [refreshUser]);

  useEffect(() => {
    const unsubscribe = onCurrentUserChanged(async (nextUser) => {
      if (nextUser) {
        setUser(nextUser as any);
        setKylrixPulse(nextUser);
        setIsLoading(false);
      } else {
        try {
          const { authClient } = await import('@/lib/auth/better-auth-client');
          const betterSession = await authClient.getSession().catch(() => null);
          if (betterSession?.data?.user) {
            const bUser = betterSession.data.user;
            const userObj = {
              $id: bUser.id,
              name: bUser.name,
              email: bUser.email,
              isPulse: false,
              authProvider: 'better-auth',
            };
            setUser(userObj as any);
            setKylrixPulse(userObj as any);
            setIsLoading(false);
            return;
          }
        } catch {}
        setUser(null);
        clearKylrixPulse();
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle cross-tab or bridge discovery
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkPulse = () => {
        const pulse = getKylrixPulse();
        if (pulse && !user) {
            setUser({ $id: pulse.$id, name: pulse.name, isPulse: true, email: null, profilePicId: pulse.profilePicId });
            setIsLoading(false);
        }
    };
    window.addEventListener('focus', checkPulse);
    return () => window.removeEventListener('focus', checkPulse);
  }, [user]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const authBaseUrl = getEcosystemUrl('accounts');
      if (event.origin !== authBaseUrl) return;
      if (event.data?.type !== 'idm:auth-success') return;

      refreshUser();
      setIDMWindowOpen(false);
      setIsAuthenticating(false);
      if (idmWindowRef.current && !idmWindowRef.current.closed) {
        idmWindowRef.current.close();
      }
      let target = '/app';
      if (typeof document !== 'undefined') {
        const match = document.cookie.match(/(?:^|; )kylrix_last_route=([^;]*)/);
        if (match && match[1]) {
          try {
            const decoded = decodeURIComponent(match[1]);
            if (
              decoded &&
              decoded !== '/' &&
              decoded !== '/landing' &&
              !decoded.startsWith('/login') &&
              !decoded.startsWith('/connect')
            ) {
              target = decoded;
            }
          } catch {}
        }
      }
      if (!pathname || pathname === '/' || pathname === '/landing' || pathname.startsWith('/login') || pathname.startsWith('/connect')) {
        router.push(target);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshUser, pathname, router]);

  const openIDMWindow = useCallback((target?: string) => {
    if (typeof window === 'undefined' || isAuthenticating) return;

    setIsAuthenticating(true);
    const authBaseUrl = getEcosystemUrl('accounts');
    const authUrl = `${authBaseUrl}/login`;
    const sourceUrl = target || (window.location.origin + pathname);
    const targetUrl = `${authUrl}?source=${encodeURIComponent(sourceUrl)}`;

    const width = 560, height = 750;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const windowRef = window.open(targetUrl, 'KylrixAccounts', `width=${width},height=${height},left=${left},top=${top}`);

    if (!windowRef) {
      router.push(targetUrl);
      return;
    }

    idmWindowRef.current = windowRef;
    setIDMWindowOpen(true);
  }, [isAuthenticating, pathname, router]);


  const logout = useCallback(async () => {
    sessionVerifySeq.current += 1;
    lastSeenUserIdRef.current = null;
    try {
      const { authClient } = await import('@/lib/auth/better-auth-client');
      await authClient.signOut().catch(() => {});
    } catch {}
    try {
      await account.deleteSession('current').catch(() => {});
    } catch {
    } finally {
      const { purgeAllClientStorageOnLogout } = await import('@/lib/services/wipe-client-storage');
      await purgeAllClientStorageOnLogout();
      setUser(null);
      setIDMWindowOpen(false);
    }
  }, []);

  const loginWithEmailOTP = useCallback(async (email: string) => {
    const { ID } = await import('appwrite');
    const result = await account.createEmailToken(ID.unique(), email);
    return result.userId;
  }, []);
  const verifyEmailOTP = useCallback(async (_email: string, userId: string, secret: string): Promise<void> => {
    await account.deleteSession('current').catch(() => {});
    invalidateCurrentUserCache();
    let _session: any;
    try {
      _session = await account.createSession({ userId, secret });
    } catch (err: any) {
      if (err?.code === 401 || err?.message?.includes('already active')) {
        await account.deleteSession('current').catch(() => {});
        _session = await account.createSession({ userId, secret });
      } else {
        throw err;
      }
    }
    try {
      await assertAuthenticatedAccount();
      await refreshUser(true);
    } catch (error) {
      if (isMfaRequiredError(error)) {
        throw error;
      }
      throw error;
    }
    return;
  }, [refreshUser]);

  const verifyMFA = useCallback(async (challengeId: string, otp: string) => {
    await completeMfaChallenge(challengeId, otp);
    await refreshUser(true);
  }, [refreshUser]);

  const getJWT = useCallback(async () => {
    try {
      if (!user?.$id) return null;
      if ((user as any).authProvider === 'better-auth') return null;
      const jwtPromise = account.createJWT().then((res) => res.jwt).catch(() => null);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200));
      return await Promise.race([jwtPromise, timeoutPromise]);
    } catch {
      return null;
    }
  }, [user]);

  const updatePreferences = useCallback(async (prefs: Record<string, any>) => {
    try {
      let res: any = null;
      try {
        res = await account.updatePrefs({
          ...(user?.prefs || {}),
          ...prefs
        });
      } catch {
        const { updateUserPreferencesAction } = await import('@/lib/actions/user-settings');
        const r = await updateUserPreferencesAction(prefs);
        res = r.prefs;
      }
      // Locally update user object preferences without triggering heavy auth re-verification
      setUser((prev: any) => (prev ? { ...prev, prefs: res } : prev));
      return res;
    } catch (e) {
      console.error('Failed to update user preferences:', e);
      throw e;
    }
  }, [user?.prefs]);

  const switchAccount = useCallback(async (sessionToken: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const { authClient } = await import('@/lib/auth/better-auth-client');
      const res = await (authClient as any).multiSession.setActive({ sessionToken });
      if (res?.error) {
        toast.error(res.error.message || 'Failed to switch account');
        return false;
      }
      clearKylrixPulse();
      lastSeenUserIdRef.current = null;
      userProfileBootstrappedRef.current = null;
      const newUser = await refreshUser(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kylrix:auth:account-switched', { detail: { user: newUser } }));
      }
      toast.success(`Switched account to ${newUser?.email || newUser?.name || 'account'}`);
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to switch account');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshUser]);

  const listDeviceSessions = useCallback(async (): Promise<any[]> => {
    try {
      const { authClient } = await import('@/lib/auth/better-auth-client');
      const res = await (authClient as any).multiSession.listDeviceSessions();
      if (res?.data && Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    } catch (err) {
      console.warn('[AuthContext] listDeviceSessions failed:', err);
      return [];
    }
  }, []);

  const revokeDeviceSession = useCallback(async (sessionToken: string): Promise<boolean> => {
    try {
      const { authClient } = await import('@/lib/auth/better-auth-client');
      const res = await (authClient as any).multiSession.revoke({ sessionToken });
      if (res?.error) {
        toast.error(res.error.message || 'Failed to remove session');
        return false;
      }
      toast.success('Session removed');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove session');
      return false;
    }
  }, []);

  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticating,
    isAuthenticated: !!user,
    logout,
    refreshUser,
    openIDMWindow,
    idmWindowOpen,
    loginWithEmailOTP,
    verifyEmailOTP,
    verifyMFA,
    getJWT,
    updatePreferences,
    listDeviceSessions,
    switchAccount,
    revokeDeviceSession,
  }), [user, isLoading, isAuthenticating, logout, refreshUser, openIDMWindow, idmWindowOpen, loginWithEmailOTP, verifyEmailOTP, verifyMFA, getJWT, updatePreferences, listDeviceSessions, switchAccount, revokeDeviceSession]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
