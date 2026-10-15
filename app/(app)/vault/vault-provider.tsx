"use client";

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { masterPassCrypto } from '@/lib/masterpass-crypto';
import { VaultContext, VaultUser } from '@/context/vault-context';

export function VaultProvider({ children }: { children: ReactNode }) {
  const { user: authUser, isLoading: authLoading, logout: authLogout, refreshUser } = useAuth();
  const [needsMasterPassword, setNeedsMasterPassword] = useState(false);
  const [isVaultBlurEnabled, setIsVaultBlurEnabled] = useState(false);
  const [usePasskeysByDefault, setUsePasskeysByDefaultState] = useState(true);
  const [masterpassForLoginEnabled, setMasterpassForLoginEnabledState] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [idmWindowOpen, setIDMWindowOpen] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  const user = useMemo<VaultUser | null>(() => {
    if (!authUser) return null;
    return {
      $id: authUser.$id || authUser.id,
      id: authUser.id || authUser.$id,
      name: authUser.name,
      email: authUser.email,
      prefs: authUser.prefs || {},
    };
  }, [authUser]);

  useEffect(() => {
    if (!authLoading) {
      setIsAuthReady(true);
      const unlocked = masterPassCrypto.isVaultUnlocked();
      const isAuthPage = pathname === '/' || pathname === '/landing' || pathname.startsWith('/login');
      if (isAuthPage) {
        setNeedsMasterPassword(false);
      } else {
        setNeedsMasterPassword(!unlocked);
      }
    }
  }, [authLoading, pathname]);

  useEffect(() => {
    const handleVaultLocked = () => setNeedsMasterPassword(true);
    const handleVaultUnlocked = () => setNeedsMasterPassword(false);

    window.addEventListener("vault-locked", handleVaultLocked);
    window.addEventListener("vault-unlocked", handleVaultUnlocked);

    return () => {
      window.removeEventListener("vault-locked", handleVaultLocked);
      window.removeEventListener("vault-unlocked", handleVaultUnlocked);
    };
  }, []);

  const refresh = useCallback(async () => {
    await refreshUser(true);
    const unlocked = masterPassCrypto.isVaultUnlocked();
    const isAuthPage = pathname === "/" || pathname === "/landing";
    setNeedsMasterPassword(isAuthPage ? false : !unlocked);
  }, [refreshUser, pathname]);

  const logout = useCallback(async () => {
    setNeedsMasterPassword(false);
    masterPassCrypto.lock();
    await authLogout();
  }, [authLogout]);

  const resetMasterpass = useCallback(async () => {
    masterPassCrypto.lock();
    setNeedsMasterPassword(true);
  }, []);

  const isVaultUnlocked = useCallback(() => {
    return masterPassCrypto.isVaultUnlocked();
  }, []);

  const openIDMWindow = useCallback(async () => {
    if (user) {
      router.replace('/vault');
      return;
    }
    setIsAuthenticating(true);
    setIDMWindowOpen(true);
  }, [user, router]);

  const closeIDMWindow = useCallback(() => {
    setIDMWindowOpen(false);
    setIsAuthenticating(false);
  }, []);

  const setVaultBlurEnabled = useCallback(async (enabled: boolean) => {
    setIsVaultBlurEnabled(enabled);
  }, []);

  const setUsePasskeysByDefault = useCallback(async (enabled: boolean) => {
    setUsePasskeysByDefaultState(enabled);
  }, []);

  const setMasterpassForLoginEnabled = useCallback(async (enabled: boolean) => {
    setMasterpassForLoginEnabledState(enabled);
  }, []);

  const contextValue = useMemo(() => ({
    user,
    loading: authLoading,
    isAuthenticating,
    isAuthenticated: !!user,
    isAuthReady,
    isVaultUnlocked,
    needsMasterPassword,
    logout,
    resetMasterpass,
    refresh,
    openIDMWindow,
    closeIDMWindow,
    idmWindowOpen,
    isVaultBlurEnabled,
    setVaultBlurEnabled,
    usePasskeysByDefault,
    setUsePasskeysByDefault,
    masterpassForLoginEnabled,
    setMasterpassForLoginEnabled,
  }), [
    user,
    authLoading,
    isAuthenticating,
    isAuthReady,
    isVaultUnlocked,
    needsMasterPassword,
    logout,
    resetMasterpass,
    refresh,
    openIDMWindow,
    closeIDMWindow,
    idmWindowOpen,
    isVaultBlurEnabled,
    setVaultBlurEnabled,
    usePasskeysByDefault,
    setUsePasskeysByDefault,
    masterpassForLoginEnabled,
    setMasterpassForLoginEnabled,
  ]);

  return (
    <VaultContext.Provider value={contextValue}>
      {children}
    </VaultContext.Provider>
  );
}

export const AppwriteProvider = VaultProvider;
