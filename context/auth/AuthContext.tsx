'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCurrentUser, getUser, createUser, updateUser, account } from '@/lib/appwrite';
import { getEffectiveUsername } from '@/lib/utils';

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
  refreshUser: () => Promise<User | null>;
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

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        let dbUser;
        try {
          dbUser = await getUser(currentUser.$id);
        } catch (e) {
          const autoUsername = getEffectiveUsername(currentUser);
          dbUser = await createUser({
            id: currentUser.$id,
            email: currentUser.email,
            name: currentUser.name,
            username: autoUsername
          });
        }
        setUser({ ...currentUser, ...dbUser });
      } else {
        setUser(null);
      }
      return currentUser as User;
    } catch (error) {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initAuthStarted.current) return;
    initAuthStarted.current = true;
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const authDomain = 'accounts.kylrix.space';
      if (event.origin !== `https://${authDomain}`) return;
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

  const openIDMWindow = useCallback(() => {
    if (typeof window === 'undefined' || isAuthenticating) return;

    setIsAuthenticating(true);
    const authUrl = `https://accounts.kylrix.space/login`;
    const sourceUrl = window.location.origin + pathname;
    const targetUrl = `${authUrl}?source=${encodeURIComponent(sourceUrl)}`;

    const width = 560;
    const height = 750;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const windowRef = window.open(
      targetUrl,
      'KylrixAccounts',
      `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
    );

    if (!windowRef) {
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
