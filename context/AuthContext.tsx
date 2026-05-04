"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Models } from 'appwrite';
import { useDataNexus } from './DataNexusContext';
import { account, getCurrentUserSnapshot, getCurrentUser, invalidateCurrentUserCache } from '@/lib/appwrite';

interface AuthContextType {
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialUser = getCurrentUserSnapshot();
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);
  const { fetchOptimized, invalidate } = useDataNexus();

  const fetchUser = useCallback(async (forceRefresh = false) => {
    try {
      const u = forceRefresh
        ? await getCurrentUser(true)
        : await fetchOptimized('current_user', async () => {
            return await getCurrentUser();
          }, 1000 * 60 * 5); // 5 minutes TTL for user object
      
      setUser(u);
    } catch (_e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [fetchOptimized]);

  const logout = useCallback(async () => {
    try {
      await account.deleteSession('current');
      invalidate('current_user');
      invalidateCurrentUserCache(null);
      setUser(null);
    } catch (_e) {
      console.error('Logout failed', _e);
    }
  }, [invalidate]);

  useEffect(() => {
    fetchUser(true);
  }, [fetchUser]);

  const refresh = useCallback(async () => {
    invalidate('current_user');
    await fetchUser(true);
  }, [fetchUser, invalidate]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
