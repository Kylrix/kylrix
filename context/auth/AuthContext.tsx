'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCurrentUser, account, getKylrixPulse, setKylrixPulse, clearKylrixPulse, globalSessionPromise } from '@/lib/appwrite';
import { getEcosystemUrl } from '@/lib/ecosystem';

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
  refreshUser: () => Promise<User | null>;
  openIDMWindow: (target?: string) => void;
  idmWindowOpen: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Instant Synchronous Load from Pulse Cache (Bridge or Local)
  const [user, setUser] = useState<User | null>(() => {
    const pulse = getKylrixPulse();
    if (pulse) {
        return { $id: pulse.$id, name: pulse.name, isPulse: true, email: null, profilePicId: pulse.profilePicId };
    }
    return null;
  });
  
  const [isLoading, setIsLoading] = useState(!getKylrixPulse());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [idmWindowOpen, setIDMWindowOpen] = useState(false);
  const idmWindowRef = useRef<Window | null>(null);
  const initAuthStarted = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  // 2. Background Revalidation (Mandatory account.get)
  const attemptSilentAuth = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // Use config to get auth subdomain and domain
    // We import it dynamically to avoid circular issues
    const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
    const authSubdomain = APPWRITE_CONFIG.SYSTEM.AUTH_SUBDOMAIN;
    const domain = APPWRITE_CONFIG.SYSTEM.DOMAIN;
    if (!authSubdomain || !domain) return;

    return new Promise<void>((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.src = `https://${authSubdomain}.${domain}/silent-check`;
      iframe.style.display = 'none';

      const timeout = setTimeout(() => {
        cleanup();
        resolve();
      }, 5000);

      const handleIframeMessage = (event: MessageEvent) => {
        if (event.origin !== `https://${authSubdomain}.${domain}`) return;

        if (
          event.data?.type === 'idm:auth-status' &&
          event.data.status === 'authenticated'
        ) {
          refreshUser();
          cleanup();
          resolve();
        } else if (event.data?.type === 'idm:auth-status') {
          cleanup();
          resolve();
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

  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      // Use the pre-started global promise for maximum speed
      const session = await globalSessionPromise;
      if (session) {
        setUser(session as any);
        setKylrixPulse(session);
        
        if (typeof window !== 'undefined' && window.location.search.includes('auth=success')) {
          const url = new URL(window.location.href);
          url.searchParams.delete('auth');
          window.history.replaceState({}, '', url.toString());
        }
      } else {
        // If local session check fails, try silent auth
        await attemptSilentAuth();
        
        // Re-check session after silent auth might have succeeded
        const retrySession = await getCurrentUser(true);
        if (retrySession) {
          setUser(retrySession as any);
          setKylrixPulse(retrySession);
          return retrySession as any;
        }

        setUser(null);
        clearKylrixPulse();
      }
      return session as any;
    } catch (error) {
      setUser(null);
      clearKylrixPulse();
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [attemptSilentAuth]);

  useEffect(() => {
    if (initAuthStarted.current) return;
    initAuthStarted.current = true;
    refreshUser();
  }, [refreshUser]);

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
  }, [isAuthenticating, pathname]);


  const logout = useCallback(async () => {
    try {
      await account.deleteSession('current');
    } finally {
      setUser(null);
      clearKylrixPulse();
      setIDMWindowOpen(false);
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
  }), [user, isLoading, isAuthenticating, logout, refreshUser, openIDMWindow, idmWindowOpen]);

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
