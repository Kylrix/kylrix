"use client";

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
  useRef,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  getCurrentUser,
  getCurrentUserSnapshot,
  onCurrentUserChanged,
  resetMasterpassAndWipe,
  logoutAppwrite,
} from '@/lib/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getAuthOrigin, openAuthPopup } from '@/lib/authUrl';
import { masterPassCrypto } from '@/lib/masterpass-crypto';
import { logDebug, logWarn } from '@/lib/logger';
import { AppwriteContext } from '@/context/appwrite-context';

// Types
import type { Models } from 'appwrite';

interface AppwriteError extends Error {
  code?: number;
  response?: unknown;
}

export function AppwriteProvider({ children }: { children: ReactNode }) {
  const initialUser = getCurrentUserSnapshot();
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(
    initialUser,
  );
  const [loading, setLoading] = useState(!initialUser);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [needsMasterPassword, setNeedsMasterPassword] = useState(false);
  const [isVaultBlurEnabled, setIsVaultBlurEnabled] = useState(false);
  const [usePasskeysByDefault, setUsePasskeysByDefaultState] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [idmWindowOpen, setIDMWindowOpen] = useState(false);
  const verbose = process.env.NODE_ENV === "development";
  const pathname = usePathname();
  const router = useRouter();
  const fetchUserRef = useRef<
    ((isRetry?: boolean, retryCount?: number) => Promise<Models.User<Models.Preferences> | null | undefined>) | undefined
  >(undefined);

  const attemptSilentAuthRef = useRef<() => Promise<void>>(async () => undefined);

  // ... (existing state)

  // Fetch current user and check master password status
  const fetchUser = useCallback(async (isRetry = false, retryCount = 0) => {
    if (typeof window === 'undefined') return;
    if (!isRetry) setLoading(true);
    try {
      const account = getCurrentUserSnapshot() ?? await getCurrentUser(isRetry);
      
      if (verbose)
        logDebug("[auth] account.get success", { hasAccount: !!account });

      if (account) {
        // Update user state first
        setUser(account);

        // Load preferences
        if (account.prefs?.vault_blur_enabled !== undefined) {
            setIsVaultBlurEnabled(!!account.prefs.vault_blur_enabled);
        }
        if (account.prefs?.use_passkeys_by_default !== undefined) {
            setUsePasskeysByDefaultState(!!account.prefs.use_passkeys_by_default);
        } else {
            setUsePasskeysByDefaultState(true); // Default to true
        }

        // Clear the auth=success param from URL if it exists
        // ... (existing logic)

        const unlocked = masterPassCrypto.isVaultUnlocked();
        if (verbose)
          logDebug("[auth] master password status", {
            unlocked,
          });
        
        // Skip masterpass modal on public landing pages
        const isAuthPage = pathname === '/' || pathname === '/landing';
        
        // The crypto lock state is the source of truth for whether the vault is usable.
        // If it's an auth page, we don't need to force the modal.
        if (isAuthPage) {
          setNeedsMasterPassword(false);
        } else {
          setNeedsMasterPassword(!unlocked);
        }
      } else {
        if (!isRetry) {
          await attemptSilentAuthRef.current?.();
          const retryAccount = getCurrentUserSnapshot() ?? await getCurrentUser(true);
          if (retryAccount) {
            setUser(retryAccount);
            const isLanding = pathname === '/' || pathname === '/landing';
            setNeedsMasterPassword(isLanding ? false : !masterPassCrypto.isVaultUnlocked());
            return retryAccount;
          }
        }

        // Explicitly clear everything on failure
        setUser(null);
        setNeedsMasterPassword(false);
      }
      return account;
    } catch (err: unknown) {
      const e = err as AppwriteError;
      
      // Explicitly clear user on 401
      setUser(null);
      setNeedsMasterPassword(false);
      
      // Check for auth=success signal in URL
      const hasAuthSignal = window.location.search.includes('auth=success');
      
      if (hasAuthSignal && retryCount < 3) {
        logWarn(`[auth] Auth signal detected but session not found in keep. Retrying... (${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchUser(true, retryCount + 1);
      }

      if (verbose) logWarn("[auth] account.get error", { error: e });
      return null;
    } finally {
      if (!isRetry) setLoading(false);
      setIsAuthReady(true);
    }
  }, [verbose, pathname]);

  fetchUserRef.current = fetchUser;

  const attemptSilentAuth = useCallback(async () => {
    if (typeof window === "undefined") return;

    const authSubdomain = APPWRITE_CONFIG.SYSTEM.AUTH_SUBDOMAIN;
    const domain = APPWRITE_CONFIG.SYSTEM.DOMAIN;
    if (!authSubdomain || !domain) return;

    return new Promise<void>((resolve) => {
      const iframe = document.createElement("iframe");
      iframe.src = `https://${authSubdomain}.${domain}/silent-check`;
      iframe.style.display = "none";

      const timeout = setTimeout(() => {
        cleanup();
        resolve();
      }, 5000);

      const handleIframeMessage = (event: MessageEvent) => {
        if (event.origin !== `https://${authSubdomain}.${domain}`) return;

        if (
          event.data?.type === "idm:auth-status" &&
          event.data.status === "authenticated"
        ) {
          logDebug("[auth] Silent auth discovered session");
          void fetchUserRef.current?.(false); // retry fetch using cache-first flow
          cleanup();
          resolve();
        } else if (event.data?.type === "idm:auth-status") {
          cleanup();
          resolve();
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        window.removeEventListener("message", handleIframeMessage);
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      };

      window.addEventListener("message", handleIframeMessage);
      document.body.appendChild(iframe);
    });
  }, []);

  attemptSilentAuthRef.current = attemptSilentAuth;

  const openIDMWindow = useCallback(async () => {
    if (typeof window === "undefined" || isAuthenticating) return;

    setIsAuthenticating(true);

    // First, check if we already have a session locally
    try {
        const account = getCurrentUserSnapshot() ?? await getCurrentUser();
        if (account) {
          console.log("[auth] Active session detected, skipping IDM window");
          setUser(account);
          setIsAuthenticating(false);
          if (pathname === "/" || pathname === "/landing") {
            router.replace("/vault/dashboard");
          }
          return;
      }
    } catch (_e: unknown) {
      // No session, proceed to silent check
    }

    // Try silent auth before opening popup
    await attemptSilentAuth();
    try {
        const account = getCurrentUserSnapshot() ?? await getCurrentUser();
        if (account) {
          setUser(account);
          setIsAuthenticating(false);
          if (pathname === "/" || pathname === "/landing") {
            router.replace("/vault/dashboard");
          }
          return;
      }
    } catch (_e: unknown) {
      // Still no session
    }

    if (idmWindowRef.current && !idmWindowRef.current.closed) {
      idmWindowRef.current.focus();
      return;
    }

    try {
      const popup = openAuthPopup((url) => router.push(url));
      if (popup) {
        idmWindowRef.current = popup;
        setIDMWindowOpen(true);
      } else {
        setIsAuthenticating(false);
      }
    } catch (error: unknown) {
      console.error("Failed to open IDM window:", error);
      setIsAuthenticating(false);
    }
  }, [pathname, router, isAuthenticating, attemptSilentAuth]);

  const closeIDMWindow = useCallback(() => {
    if (idmWindowRef.current && !idmWindowRef.current.closed) {
      idmWindowRef.current.close();
    }
    idmWindowRef.current = null;
    setIDMWindowOpen(false);
    setIsAuthenticating(false);
  }, []);

  // Listen for auth success messages from IDM
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const expectedOrigin = getAuthOrigin();
      if (event.origin !== expectedOrigin) return;

      if (event.data?.type === "idm:auth-success") {
        logDebug("[auth] Received auth success message from IDM");
        
        // Close the window first for better UX
        closeIDMWindow();
        setIsAuthenticating(false);
        
        // Refresh user state
        const account = await fetchUser(true);
        
        // Redirect to dashboard if authenticated
        if (account) {
          router.replace("/vault/dashboard");
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [fetchUser, closeIDMWindow, router]);

  // Poll for window closure as a fallback
  useEffect(() => {
    if (!idmWindowOpen) return;

    const interval = setInterval(() => {
      if (idmWindowRef.current && idmWindowRef.current.closed) {
        clearInterval(interval);
        idmWindowRef.current = null;
        setIDMWindowOpen(false);
        setIsAuthenticating(false);
        fetchUser(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [idmWindowOpen, fetchUser]);

  // Initial load and authentication check orchestration
  useEffect(() => {
    const initAuth = async () => {
      try {
        await fetchUser(false);
      } catch (err: unknown) {
        const e = err as AppwriteError;
        if (e.code === 401) {
          await attemptSilentAuth();
        }
      } finally {
        setLoading(false);
        setIsAuthReady(true);
      }
    };

    initAuth();

    const unsubscribe = onCurrentUserChanged((nextUser) => {
      if (nextUser) {
        setUser(nextUser);
        setLoading(false);
        setIsAuthReady(true);
      } else if (!getCurrentUserSnapshot()) {
        setUser(null);
      }
    });

    // Listen for vault lock events
    const handleVaultLocked = () => {
      setTimeout(() => setNeedsMasterPassword(true), 0);
    };
    window.addEventListener("vault-locked", handleVaultLocked);

    // Listen for vault unlock events
    const handleVaultUnlocked = () => {
      setTimeout(() => setNeedsMasterPassword(false), 0);
    };
    window.addEventListener("vault-unlocked", handleVaultUnlocked);

    // Listen for storage changes (multi-tab logout)
    const handleStorageChange = () => fetchUser(true);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("vault-locked", handleVaultLocked);
      window.removeEventListener("vault-unlocked", handleVaultUnlocked);
      window.removeEventListener("storage", handleStorageChange);
      unsubscribe();
    };
  }, [fetchUser, attemptSilentAuth]);

  const refresh = useCallback(async () => {
    await fetchUser(true);
    // After refresh, re-calculate needsMasterPassword specifically
    const unlocked = masterPassCrypto.isVaultUnlocked();
    const isAuthPage = pathname === "/" || pathname === "/landing";
    
    if (isAuthPage) {
      setNeedsMasterPassword(false);
    } else {
      setNeedsMasterPassword(!unlocked);
    }
  }, [fetchUser, pathname, setNeedsMasterPassword]);

  const logout = useCallback(async () => {
    // 1. Immediately clear local security state to stop modal triggers
    setNeedsMasterPassword(false);
    masterPassCrypto.lock();
    
    // Clear ecosystem status as well
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("kylrix_vault_unlocked");
    }

    // 2. Perform the actual Appwrite logout
    await logoutAppwrite();
    
    // 3. Clear the user state and trigger a final refresh
    setUser(null);
  }, [setNeedsMasterPassword, setUser]);

  const resetMasterpass = useCallback(async () => {
    if (!user) return;
    await resetMasterpassAndWipe(user.$id);
    masterPassCrypto.lock();
    setNeedsMasterPassword(true);
  }, [user, setNeedsMasterPassword]);

  const isVaultUnlocked = useCallback(() => {
    const unlocked = masterPassCrypto.isVaultUnlocked();
    if (verbose) logDebug("[auth] vault unlock status", { unlocked });
    return unlocked;
  }, [verbose]);

  const setVaultBlurEnabled = useCallback(async (enabled: boolean) => {
    setIsVaultBlurEnabled(enabled);
    if (user?.$id) {
        try {
            const { account } = await import('@/lib/appwrite/client');
            const currentPrefs = user.prefs || {};
            await account.updatePrefs({ ...currentPrefs, vault_blur_enabled: enabled });
        } catch (err) {
            console.error("[Vault] Failed to persist blur preference", err);
        }
    }
  }, [user]);

  const setUsePasskeysByDefault = useCallback(async (enabled: boolean) => {
    setUsePasskeysByDefaultState(enabled);
    if (user?.$id) {
        try {
            const { account } = await import('@/lib/appwrite/client');
            const currentPrefs = user.prefs || {};
            await account.updatePrefs({ ...currentPrefs, use_passkeys_by_default: enabled });
        } catch (err) {
            console.error("[Vault] Failed to persist passkey default preference", err);
        }
    }
  }, [user]);

  const contextValue = useMemo(() => ({
    user,
    loading,
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
  }), [user, loading, isAuthenticating, isAuthReady, isVaultUnlocked, needsMasterPassword, logout, resetMasterpass, refresh, openIDMWindow, closeIDMWindow, idmWindowOpen, isVaultBlurEnabled, setVaultBlurEnabled, usePasskeysByDefault, setUsePasskeysByDefault]);

  return (
    <AppwriteContext.Provider
      value={contextValue}
    >
      {children}
    </AppwriteContext.Provider>
  );
}
