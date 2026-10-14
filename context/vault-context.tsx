"use client";

import { createContext, useContext } from 'react';

export interface UserPreferences {
  vault_blur_enabled?: boolean;
  use_passkeys_by_default?: boolean;
  masterpass_for_login_enabled?: boolean;
  [key: string]: any;
}

export interface VaultUser {
  $id: string;
  id: string;
  name: string | null;
  email: string | null;
  prefs?: UserPreferences;
  [key: string]: any;
}

export interface VaultContextType {
  user: VaultUser | null;
  loading: boolean;
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  isVaultUnlocked: () => boolean;
  needsMasterPassword: boolean;
  logout: () => Promise<void>;
  resetMasterpass: () => Promise<void>;
  refresh: () => Promise<void>;
  openIDMWindow: () => Promise<void>;
  closeIDMWindow: () => void;
  idmWindowOpen: boolean;
  isVaultBlurEnabled: boolean;
  setVaultBlurEnabled: (enabled: boolean) => Promise<void>;
  usePasskeysByDefault: boolean;
  setUsePasskeysByDefault: (enabled: boolean) => Promise<void>;
  masterpassForLoginEnabled: boolean;
  setMasterpassForLoginEnabled: (enabled: boolean) => Promise<void>;
}

export const VaultContext = createContext<VaultContextType | undefined>(
  undefined,
);

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
}

/** Backwards-compatibility alias during transition */
export const useAppwriteVault = useVault;
