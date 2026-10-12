'use client';

import React, { createContext, ReactNode, useState, useCallback, useEffect, useMemo } from 'react';
import { SecurityEngine, KeychainEntry } from '@/lib/services/SecurityEngine';
import { useAuth } from '@/context/auth/AuthContext';

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
        const { SecurityEnclave } = await import('@/lib/security/enclave');
        await SecurityEnclave.hydrateFromRemote(user.$id, { force: true });
        return (await SecurityEnclave.getKeychain(user.$id)) as KeychainEntry[];
      } catch (_e) {}
    }
    return [];
  }, [user]);

  const syncKeychainLocal = useCallback(async (): Promise<KeychainEntry[]> => {
    if (!user?.$id) return [];
    const { SecurityEnclave } = await import('@/lib/security/enclave');
    try {
      // Prefer existing enclave; only hit network when empty or online soft-TTL
      const local = await SecurityEnclave.getKeychain(user.$id);
      if (local.length > 0) {
        if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
          void SecurityEnclave.hydrateFromRemote(user.$id).catch(() => {});
        }
        return local as KeychainEntry[];
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return [];
      }

      await SecurityEnclave.hydrateFromRemote(user.$id, { force: true });
      return (await SecurityEnclave.getKeychain(user.$id)) as KeychainEntry[];
    } catch (_e) {
      return SecurityEngine.getLocalKeychain(user.$id);
    }
  }, [user]);

  // Background security enclave hydrate on auth (keychain + identity + wallets)
  useEffect(() => {
    if (!user?.$id) return;
    void syncKeychainLocal();
    void import('@/lib/security/enclave').then(({ SecurityEnclave }) => {
      void SecurityEnclave.hydrateFromRemote(user.$id!).catch(() => {});
    });
  }, [user?.$id, syncKeychainLocal]);

  const value = useMemo<SecurityContextType>(
    () => ({
      isUnlocked,
      enterObservationMode,
      exitObservationMode,
      unlockVault,
      lockVault,
      getKeychain,
      syncKeychainLocal,
    }),
    [isUnlocked, enterObservationMode, exitObservationMode, unlockVault, lockVault, getKeychain, syncKeychainLocal],
  );

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>;
}

