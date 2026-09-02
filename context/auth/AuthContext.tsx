'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCurrentUser, account, getKylrixPulse, setKylrixPulse, clearKylrixPulse, invalidateCurrentUserCache, onCurrentUserChanged, getCurrentUserSnapshot } from '@/lib/appwrite/client';
import { getEcosystemUrl } from '@/lib/ecosystem';
import { assertAuthenticatedAccount, completeMfaChallenge, isMfaRequiredError } from '@/lib/mfa';

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
  const refreshUserRef = useRef<() => Promise<User | null>>(async () => null);
  const attemptSilentAuthRef = useRef<() => Promise<boolean>>(async () => false);
  const sessionVerifySeq = useRef(0);
  const lastSeenUserIdRef = useRef<string | null>(user?.$id || null);

  // 2. Background Revalidation (Mandatory account.get)
  const attemptSilentAuth = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    // Use config to get auth subdomain and domain
    // We import it dynamically to avoid circular issues
    const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
    const authSubdomain = APPWRITE_CONFIG.SYSTEM.AUTH_SUBDOMAIN;
    const domain = APPWRITE_CONFIG.SYSTEM.DOMAIN;
    if (!authSubdomain || !domain) return false;

    return new Promise<boolean>((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.src = `https://${authSubdomain}.${domain}/silent-check`;
      iframe.style.display = 'none';

      const timeout = setTimeout(() => {
        cleanup();
        resolve(false);
      }, 2500);

      const handleIframeMessage = (event: MessageEvent) => {
        if (event.origin !== `https://${authSubdomain}.${domain}`) return;

        if (
          event.data?.type === 'idm:auth-status' &&
          event.data.status === 'authenticated'
        ) {
          cleanup();
          resolve(true);
        } else if (event.data?.type === 'idm:auth-status') {
          cleanup();
          resolve(false);
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        window.removeEventListener('message', handleIframeMessage);
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      };

      window.addEventListener('message', handleIframeMessage);
      document.body.appendChild(iframe);
    });
  }, []);

  attemptSilentAuthRef.current = attemptSilentAuth;

  const refreshUser = useCallback(async (forceRefresh = false): Promise<User | null> => {
    try {
      const isOAuthSuccess = typeof window !== 'undefined' && window.location.search.includes('auth=success');

      // 1. Get from cache or query Appwrite
      const session = await getCurrentUser(forceRefresh || isOAuthSuccess);
      if (session && session.$id) {
        if (lastSeenUserIdRef.current && lastSeenUserIdRef.current !== session.$id) {
          const { purgeAllClientStorageOnLogout } = await import('@/lib/services/wipe-client-storage');
          await purgeAllClientStorageOnLogout();
        }
        lastSeenUserIdRef.current = session.$id;
        setUser(session as any);
        setKylrixPulse(session);

        if (typeof window !== 'undefined' && window.location.search.includes('auth=success')) {
          const url = new URL(window.location.href);
          url.searchParams.delete('auth');
          window.history.replaceState({}, '', url.toString());
        }

        return session as any;
      }

      // If online and session is genuinely null, clear session
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
  }, []);

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

  // 4. Centralized User Profile & Username Bootstrapping
  useEffect(() => {
    if (user?.$id && !user.isPulse) {
      const initProfile = async () => {
        try {
          const { UsersService } = await import('@/lib/services/users');
          await UsersService.ensureProfileForUser(user);
        } catch (err) {
          console.warn('[AuthContext] Background profile bootstrapping failed:', err);
        }
      };
      void initProfile();

      // 5. Silent Attribution & Referral Claiming
      const claimAttribution = async () => {
        try {
          const match = document.cookie.match(/(?:^|;\s*)attribution_payload=([^;]+)/);
          if (match && match[1]) {
            const raw = atob(decodeURIComponent(match[1]));
            const payload = JSON.parse(raw);
            if (payload && payload.ref) {
              const { claimReferralAction } = await import('@/lib/actions/referrals');
              await claimReferralAction(payload);
              document.cookie = 'attribution_payload=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
            }
          }
        } catch (claimErr) {
          console.warn('[AuthContext] Background referral claim:', claimErr);
        }
      };
      void claimAttribution();
    }
  }, [user?.$id, user?.isPulse, user]);

  useEffect(() => {
    if (initAuthStarted.current) return;
    initAuthStarted.current = true;
    (async () => {
      const refreshed = await refreshUser();
      if (!refreshed) {
        const { salvageUserFromLocalSubstrate } = await import('@/lib/appwrite/client');
        const salvaged = await salvageUserFromLocalSubstrate();
        if (salvaged) {
          setUser(salvaged as any);
        }
      }
    })();
  }, [refreshUser]);

  useEffect(() => {
    const unsubscribe = onCurrentUserChanged((nextUser) => {
      setUser(nextUser ? (nextUser as any) : null);
      if (nextUser) {
        setKylrixPulse(nextUser);
      } else {
        clearKylrixPulse();
      }
      setIsLoading(false);
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
      idmWindowRef.current = null;
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshUser]);

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
      await account.deleteSession('current');
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
      const { jwt } = await account.createJWT();
      return jwt;
    } catch {
      return null;
    }
  }, []);

  const updatePreferences = useCallback(async (prefs: Record<string, any>) => {
    try {
      const res = await account.updatePrefs({
        ...(user?.prefs || {}),
        ...prefs
      });
      // Locally update user object preferences without triggering heavy auth re-verification
      setUser((prev: any) => (prev ? { ...prev, prefs: res } : prev));
      return res;
    } catch (e) {
      console.error('Failed to update user preferences:', e);
      throw e;
    }
  }, [user]);

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
    updatePreferences}), [user, isLoading, isAuthenticating, logout, refreshUser, openIDMWindow, idmWindowOpen, loginWithEmailOTP, verifyEmailOTP, verifyMFA, getJWT, updatePreferences]);

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
