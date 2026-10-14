'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth/better-auth-client';
import { getEcosystemUrl } from '@/lib/ecosystem';
import { toast } from 'react-hot-toast';

interface User {
  $id: string;
  id: string;
  email: string | null;
  name: string | null;
  image?: string | null;
  emailVerified?: boolean;
  prefs?: Record<string, any>;
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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [idmWindowOpen, setIDMWindowOpen] = useState(false);
  const idmWindowRef = useRef<Window | null>(null);
  const initAuthStarted = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const lastSeenUserIdRef = useRef<string | null>(null);

  const refreshUser = useCallback(async (_forceRefresh = false): Promise<User | null> => {
    try {
      const betterSession = await authClient.getSession().catch(() => null);
      if (betterSession?.data?.user) {
        const bUser = betterSession.data.user;
        const userObj: User = {
          $id: bUser.id,
          id: bUser.id,
          name: bUser.name || bUser.email.split('@')[0],
          email: bUser.email || null,
          image: bUser.image || null,
          emailVerified: Boolean(bUser.emailVerified),
          authProvider: 'better-auth',
        };
        lastSeenUserIdRef.current = bUser.id;
        setUser(userObj);

        // Check for auth=success redirect
        if (typeof window !== 'undefined' && window.location.search.includes('auth=success')) {
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

        return userObj;
      }

      lastSeenUserIdRef.current = null;
      setUser(null);
      return null;
    } catch (_error) {
      lastSeenUserIdRef.current = null;
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [pathname, router]);

  // Bootstrapping user profile & collaboration
  useEffect(() => {
    if (user?.$id) {
      const initServices = async () => {
        try {
          const { CollaborationService } = await import('@/lib/services/collaboration');
          await CollaborationService.setupReplication(user.$id);
        } catch {}
        try {
          const { UsersService } = await import('@/lib/services/users');
          await UsersService.ensureProfileForUser(user);
        } catch {}
        try {
          const { ensureBetterAuthUserTurso } = await import('@/lib/actions/turso-ops');
          await ensureBetterAuthUserTurso({
            id: user.$id,
            name: user.name || (user.email ? user.email.split('@')[0] : 'User'),
            email: user.email || `${user.$id}@kylrix.local`,
            emailVerified: Boolean(user.emailVerified),
          });
        } catch {}
      };
      void initServices();
    }
  }, [user?.$id]);

  useEffect(() => {
    if (initAuthStarted.current) return;
    initAuthStarted.current = true;
    void refreshUser();
  }, [refreshUser]);

  // Handle cross-tab or popup IDM window authorization completion
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const authBaseUrl = getEcosystemUrl('accounts');
      if (event.origin !== authBaseUrl) return;
      if (event.data?.type !== 'idm:auth-success') return;

      void refreshUser();
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
    lastSeenUserIdRef.current = null;
    try {
      await authClient.signOut().catch(() => {});
    } catch {}
    try {
      const { purgeAllClientStorageOnLogout } = await import('@/lib/services/wipe-client-storage');
      await purgeAllClientStorageOnLogout();
    } catch {}
    setUser(null);
    setIDMWindowOpen(false);
  }, []);

  const loginWithEmailOTP = useCallback(async (email: string) => {
    try {
      const res = await (authClient as any).emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
      return res?.data?.userId || crypto.randomUUID();
    } catch {
      return crypto.randomUUID();
    }
  }, []);

  const verifyEmailOTP = useCallback(async (email: string, _userId: string, secret: string): Promise<void> => {
    const res = await (authClient as any).signIn.emailOtp({ email, otp: secret });
    if (res?.error) {
      throw new Error(res.error.message || 'OTP verification failed');
    }
    await refreshUser(true);
  }, [refreshUser]);

  const verifyMFA = useCallback(async (_challengeId: string, otp: string) => {
    const res = await (authClient as any).twoFactor.verifyOtp({ code: otp });
    if (res?.error) {
      throw new Error(res.error.message || 'MFA verification failed');
    }
    await refreshUser(true);
  }, [refreshUser]);

  const getJWT = useCallback(async () => {
    if (!user?.$id) return null;
    const session = await authClient.getSession().catch(() => null);
    return session?.data?.session?.token || null;
  }, [user]);

  const updatePreferences = useCallback(async (prefs: Record<string, any>) => {
    try {
      const { updateUserPreferencesAction } = await import('@/lib/actions/user-settings');
      const r = await updateUserPreferencesAction(prefs);
      const updatedPrefs = r.prefs || prefs;
      setUser((prev) => (prev ? { ...prev, prefs: updatedPrefs } : prev));
      return updatedPrefs;
    } catch (e) {
      console.error('Failed to update user preferences:', e);
      throw e;
    }
  }, []);

  const switchAccount = useCallback(async (sessionToken: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const res = await (authClient as any).multiSession.setActive({ sessionToken });
      if (res?.error) {
        toast.error(res.error.message || 'Failed to switch account');
        return false;
      }
      lastSeenUserIdRef.current = null;
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
