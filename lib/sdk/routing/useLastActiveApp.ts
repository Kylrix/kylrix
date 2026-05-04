'use client';

import { useState, useCallback, useEffect } from 'react';

export type KylrixAppId = 'accounts' | 'note' | 'vault' | 'flow' | 'connect';

const LAST_APP_KEY = 'kylrix_last_active_app';
const DEFAULT_APP: KylrixAppId = 'connect';

export interface UseLastActiveAppReturn {
  appId: KylrixAppId;
  lastAppId: KylrixAppId | null;
  setLastActiveApp: (appId: KylrixAppId) => void;
}

/**
 * Hook to track the user's last active app in the Kylrix ecosystem.
 * Persists to localStorage and provides navigation helpers.
 * 
 * Usage:
 * ```tsx
 * const { lastAppId, setLastActiveApp } = useLastActiveApp();
 * 
 * // On app mount, track this app as active
 * useEffect(() => {
 *   setLastActiveApp('note');
 * }, [setLastActiveApp]);
 * 
 * // Navigate to the last active app
 * if (lastAppId) {
 *   navigate(getEcosystemUrl(lastAppId));
 * }
 * ```
 */
export function useLastActiveApp(): UseLastActiveAppReturn {
  const [appId, setAppId] = useState<KylrixAppId>('accounts');
  const [lastAppId, setLastAppIdState] = useState<KylrixAppId | null>(null);
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LAST_APP_KEY);
      setLastAppIdState((stored as KylrixAppId) || null);
      setMounted(true);
    }
  }, []);

  const setLastActiveApp = useCallback((newAppId: KylrixAppId) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LAST_APP_KEY, newAppId);
      setLastAppIdState(newAppId);
    }
  }, []);

  // Determine the effective last app ID (default to DEFAULT_APP if none found)
  const effectiveLastAppId = lastAppId || DEFAULT_APP;

  return {
    appId,
    lastAppId: lastAppId || DEFAULT_APP,
    setLastActiveApp,
  };
}
