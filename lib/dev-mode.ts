'use client';

import { useState, useEffect } from 'react';
import { account } from '@/lib/appwrite/client';

const DEV_MODE_STORAGE_KEY = 'kylrix:dev_mode';
const DEV_MODE_EVENT = 'kylrix:dev_mode_change';

/** Centralized synchronous Dev Mode reader */
export function getDevMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DEV_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Centralized Dev Mode setter (updates local cache + Appwrite account preferences) */
export async function setDevMode(enabled: boolean): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(DEV_MODE_STORAGE_KEY, String(enabled));
      window.dispatchEvent(new CustomEvent(DEV_MODE_EVENT, { detail: enabled }));
    } catch {}
  }
  try {
    const appPrefs = (await account.getPrefs()) || {};
    await account.updatePrefs({ ...appPrefs, devMode: enabled });
  } catch (err) {
    console.warn('[DevMode] Failed to sync devMode to account prefs:', err);
  }
}

/** Sync dev mode status from Appwrite account prefs on login/load */
export async function syncDevModeFromPrefs(): Promise<boolean> {
  try {
    const appPrefs = await account.getPrefs();
    const enabled = appPrefs?.devMode === true;
    if (typeof window !== 'undefined') {
      localStorage.setItem(DEV_MODE_STORAGE_KEY, String(enabled));
      window.dispatchEvent(new CustomEvent(DEV_MODE_EVENT, { detail: enabled }));
    }
    return enabled;
  } catch {
    return getDevMode();
  }
}

/** React Hook for components responding to Dev Mode state changes */
export function useDevMode(): { devMode: boolean; toggleDevMode: (val: boolean) => Promise<void> } {
  const [devMode, setDevModeState] = useState<boolean>(getDevMode);

  useEffect(() => {
    setDevModeState(getDevMode());
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setDevModeState(customEvent.detail ?? getDevMode());
    };
    window.addEventListener(DEV_MODE_EVENT, handler);
    return () => window.removeEventListener(DEV_MODE_EVENT, handler);
  }, []);

  const toggleDevMode = async (val: boolean) => {
    setDevModeState(val);
    await setDevMode(val);
  };

  return { devMode, toggleDevMode };
}
