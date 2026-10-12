'use client';

import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { purgeExpiredTrash } from '@/lib/actions/client-ops';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { getSettings, updateSettings, createSettings } from '@/lib/appwrite/note';

interface TrashPurgeContextType {
  runTrashPurge: (force?: boolean) => Promise<{ success: boolean; purgedCount: number }>;
}

const TrashPurgeContext = createContext<TrashPurgeContextType | undefined>(undefined);

// Check interval: 2 weeks (14 days)
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 90;
const LOCAL_LAST_CHECKED_KEY = 'kylrix_trash_purge_last_checked_';

export function TrashPurgeProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const isPurging = useRef(false);

  const runTrashPurge = useCallback(async (force = false): Promise<{ success: boolean; purgedCount: number }> => {
    if (!user?.$id || isPurging.current) {
      return { success: false, purgedCount: 0 };
    }

    const now = Date.now();
    const localKey = `${LOCAL_LAST_CHECKED_KEY}${user.$id}`;

    if (!force) {
      // 1. Check local timestamp first (instant offline-first check)
      const localLast = await LocalEngine.cacheGet<number>(localKey).catch(() => null);
      if (localLast && now - localLast < TWO_WEEKS_MS) {
        return { success: true, purgedCount: 0 };
      }

      // 2. Check settings row in database if available
      try {
        const settingsRow = await getSettings(user.$id).catch(() => null);
        if (settingsRow?.settings) {
          try {
            const parsed = JSON.parse(settingsRow.settings);
            if (parsed.lastTrashPurgeAt && now - Number(parsed.lastTrashPurgeAt) < TWO_WEEKS_MS) {
              await LocalEngine.cacheSet(localKey, Number(parsed.lastTrashPurgeAt)).catch(() => {});
              return { success: true, purgedCount: 0 };
            }
          } catch {}
        }
      } catch {}
    }

    // Only run if online
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { success: false, purgedCount: 0 };
    }

    isPurging.current = true;
    try {
      console.log(`[TrashPurge] Starting automated trash purge for items older than ${RETENTION_DAYS} days...`);
      const result = await purgeExpiredTrash(RETENTION_DAYS);
      const purgedCount = result?.purgedCount || 0;

      // Update local storage stamp
      await LocalEngine.cacheSet(localKey, now).catch(() => {});

      // Persist to user settings table
      try {
        const settingsRow = await getSettings(user.$id).catch(() => null);
        let config: Record<string, any> = {};
        if (settingsRow?.settings) {
          try { config = JSON.parse(settingsRow.settings); } catch { config = {}; }
        }
        config.lastTrashPurgeAt = now;
        config.lastTrashPurgeRetentionDays = RETENTION_DAYS;

        const payload = { settings: JSON.stringify(config) };
        try {
          await updateSettings(user.$id, payload);
        } catch {
          await createSettings({ userId: user.$id, settings: payload.settings }).catch(() => {});
        }
      } catch (settingsErr) {
        console.warn('[TrashPurge] Failed to update user settings lastTrashPurgeAt:', settingsErr);
      }

      // If items were purged, notify local components to refresh trash lists
      if (purgedCount > 0) {
        console.log(`[TrashPurge] Successfully purged ${purgedCount} expired trash item(s).`);
        try {
          const cacheKeyAll = `trash_all_${user.$id}`;
          await LocalEngine.cacheSet(cacheKeyAll, []).catch(() => {});
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kylrix:trash-updated'));
          }
        } catch {}
      }

      return { success: true, purgedCount };
    } catch (err) {
      console.error('[TrashPurge] Error running scheduled trash purge:', err);
      return { success: false, purgedCount: 0 };
    } finally {
      isPurging.current = false;
    }
  }, [user?.$id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.$id) return;

    // Run check in background with a gentle startup delay (4.5s) to avoid competing with hydration
    const timer = setTimeout(() => {
      void runTrashPurge(false);
    }, 4500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user?.$id, runTrashPurge]);

  return (
    <TrashPurgeContext.Provider value={{ runTrashPurge }}>
      {children}
    </TrashPurgeContext.Provider>
  );
}

export function useTrashPurge() {
  const ctx = useContext(TrashPurgeContext);
  if (!ctx) {
    throw new Error('useTrashPurge must be used within a TrashPurgeProvider');
  }
  return ctx;
}
