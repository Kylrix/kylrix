"use client";

import { createContext, useContext } from "react";
import type { Models } from "appwrite";

export interface AppwriteContextType {
  user: Models.User<Models.Preferences> | null;
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
}

export const AppwriteContext = createContext<AppwriteContextType | undefined>(
  undefined,
);

export function useAppwriteVault() {
  const ctx = useContext(AppwriteContext);
  if (!ctx) throw new Error("useAppwriteVault must be used within AppwriteProvider");
  return ctx;
}
