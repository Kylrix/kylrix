'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCurrentUser, getUser, createUser, updateUser, account } from '@/lib/appwrite';
import { getEffectiveUsername } from '@/lib/utils';
import { getEcosystemUrl } from '@/lib/ecosystem';

interface User {
  $id: string;
  email: string | null;
  name: string | null;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refreshUser: (retryCount?: number) => Promise<User | null>;
  openIDMWindow: () => void;
  idmWindowOpen: boolean;
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

  const attemptSilentAuth = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined') return;

    const authBaseUrl = getEcosystemUrl('accounts');
    console.log('[Auth] Attempting silent auth via:', authBaseUrl);

    return new Promise<void>((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.src = `${authBaseUrl}/silent-check`;
      iframe.style.display = 'none';

      const timeout = setTimeout(() => {
        console.log('[Auth] Silent auth timeout');
        cleanup();
        resolve();
      }, 5000);

      const handleIframeMessage = (event: MessageEvent) => {
        if (event.origin !== authBaseUrl) return;

        if (event.data?.type === 'idm:auth-status' && event.data.status === 'authenticated') {
          console.log('[Auth] Silent auth discovered session, refreshing...');
          refreshUser();
          cleanup();
          resolve();
        } else if (event.data?.type === 'idm:auth-status') {
          console.log('[Auth] Silent auth status:', event.data.status);
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

  const refreshUser = useCallback(async (retryCount = 0): Promise<User | null> => {
    try {
      console.log('[Auth] Refreshing user (attempt ' + (retryCount + 1) + ')...');
      
      let currentUser;
      try {
        currentUser = await account.get();
      } catch (err) {
        console.log('[Auth] account.get() failed:', err);
        currentUser = null;
      }
      
      if (currentUser) {
        console.log('[Auth] Found Appwrite user:', currentUser.$id);
        let dbUser = {};
        try {
          dbUser = await getUser(currentUser.$id);
          console.log('[Auth] Found DB user');
        } catch (e) {
          console.log('[Auth] User not in database, creating...', e);
          try {
            const autoUsername = getEffectiveUsername(currentUser);
            dbUser = await createUser({
              id: currentUser.$id,
              email: currentUser.email,
              name: currentUser.name,
              username: autoUsername
            });
            console.log('[Auth] Created DB user');
          } catch (createErr) {
            console.error('[Auth] Failed to create DB user, falling back to pure Appwrite user:', createErr);
          }
        }
        const combinedUser = { ...currentUser, ...dbUser };
        setUser(combinedUser);
        setIsLoading(false);
        return combinedUser;
      } else {
        // Check for auth=success signal in URL
        const hasAuthSignal = typeof window !== 'undefined' && window.location.search.includes('auth=success');
        
        if (hasAuthSignal && retryCount < 3) {
          console.log('[Auth] Auth signal detected but session not found. Retrying in 1s...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          return refreshUser(retryCount + 1);
        }

        console.log('[Auth] No active session found.');
        setUser(null);
        return null;
      }
    } catch (error) {
      console.error('[Auth] Refresh user error:', error);
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initAuthStarted.current) return;
    initAuthStarted.current = true;
    
    const init = async () => {
      const currentUser = await refreshUser();
      // If no user found via direct session check, try silent iframe discovery
      if (!currentUser) {
        await attemptSilentAuth();
      }
    };
    init();
  }, [refreshUser, attemptSilentAuth]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const authBaseUrl = getEcosystemUrl('accounts');
      if (event.origin !== authBaseUrl) return;
      if (event.data?.type !== 'idm:auth-success') return;

      console.log('[Auth] Received auth success via postMessage');
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

  const openIDMWindow = useCallback(() => {
    if (typeof window === 'undefined' || isAuthenticating) return;

    setIsAuthenticating(true);
    const authBaseUrl = getEcosystemUrl('accounts');
    const authUrl = `${authBaseUrl}/login`;
    const sourceUrl = window.location.origin + pathname;
    const targetUrl = `${authUrl}?source=${encodeURIComponent(sourceUrl)}`;

    const width = 560;
    const height = 750;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    console.log('[Auth] Opening IDM window:', targetUrl);
    const windowRef = window.open(
      targetUrl,
      'KylrixAccounts',
      `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
    );

    if (!windowRef) {
      console.log('[Auth] Popup blocked, redirecting...');
      window.location.assign(targetUrl);
      return;
    }

    idmWindowRef.current = windowRef;
    setIDMWindowOpen(true);
  }, [isAuthenticating, pathname]);

  const logout = useCallback(async () => {
    try {
      await account.deleteSession('current');
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      setUser(null);
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
