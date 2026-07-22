'use client';

import React, { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import { SecurityEngine, KeychainEntry } from '@/lib/services/SecurityEngine';
import { useAuth } from '@/context/auth/AuthContext';
import { KeychainService } from '@/lib/appwrite/keychain';

interface SecurityContextType {
  isUnlocked: boolean;
  enterObservationMode: (id?: string) => void;
  exitObservationMode: () => void;
  unlockVault: (masterKey: Uint8Array) => void;
  lockVault: () => void;
  getKeychain: () => Promise<KeychainEntry[]>;
  syncKeychainLocal: () => Promise<KeychainEntry[]>;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export function SecurityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isUnlocked, setIsUnlocked] = useState(() => SecurityEngine.isVaultUnlocked());

  const enterObservationMode = useCallback((id?: string) => {
    SecurityEngine.enterObservationMode(id);
  }, []);

  const exitObservationMode = useCallback(() => {
    SecurityEngine.exitObservationMode();
  }, []);

  const unlockVault = useCallback((masterKey: Uint8Array) => {
    SecurityEngine.setMasterKeyInMemory(masterKey);
    setIsUnlocked(true);
  }, []);

  const lockVault = useCallback(() => {
    SecurityEngine.lockVault();
    setIsUnlocked(false);
  }, []);

  const getKeychain = useCallback(async (): Promise<KeychainEntry[]> => {
    const userId = user?.$id || 'guest';
    const local = await SecurityEngine.getLocalKeychain(userId);
    if (local.length > 0) return local;

    // Fallback sync if online
    if (typeof navigator !== 'undefined' && navigator.onLine && user?.$id) {
      try {
        const remote = await KeychainService.listKeychainEntries(user.$id);
        if (remote && remote.length > 0) {
          await SecurityEngine.saveLocalKeychain(user.$id, remote as any);
          return remote as any;
        }
      } catch (_e) {}
    }
    return [];
  }, [user]);

  const syncKeychainLocal = useCallback(async (): Promise<KeychainEntry[]> => {
    if (!user?.$id) return [];
    try {
      const remote = await KeychainService.listKeychainEntries(user.$id);
      if (remote) {
        await SecurityEngine.saveLocalKeychain(user.$id, remote as any);
        return remote as any;
      }
    } catch (_e) {}
    return SecurityEngine.getLocalKeychain(user.$id);
  }, [user]);

  // Initial cold hydration of keychain to local storage on mount
  useEffect(() => {
    if (user?.$id) {
      void syncKeychainLocal();
    }
  }, [user?.$id, syncKeychainLocal]);

  const value: SecurityContextType = {
    isUnlocked,
    enterObservationMode,
    exitObservationMode,
    unlockVault,
    lockVault,
    getKeychain,
    syncKeychainLocal,
  };

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>;
}

export function useSecurity() {
  const ctx = useContext(SecurityContext);
  if (!ctx) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return ctx;
}
