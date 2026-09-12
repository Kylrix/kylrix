'use client';

import React, { useEffect, useRef } from 'react';
import { executeCloudSync, getCloudSyncConfig, type CloudSyncConfig } from '@/lib/sync/cloud-sync-client';
import { LocalEngine } from '@/lib/services/LocalEngine';

/**
 * CloudSyncProvider — Background replication driver for local-first client resolution.
 * 
 * Works regardless of whether the client is a self-hosted instance replicating to Cloud,
 * or an official client maintaining sync with a remote node.
 * 
 * Functions:
 * 1. Listens for config changes via `kylrix:cloud-sync-config-changed`.
 * 2. Runs initial sync on mount if enabled and lastSync was > interval minutes ago.
 * 3. Schedules periodic background resolution (default 15m) using window timers when idle.
 * 4. Syncs on window focus / online events if dirtied or overdue.
 */
export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let active = true;

    const checkAndTriggerSync = async (reason = 'timer') => {
      if (isSyncingRef.current) return;
      if (!window.navigator.onLine) return;

      try {
        const config: CloudSyncConfig = await getCloudSyncConfig();
        if (!config.enabled || !config.token) return;
        if (!config.autoSync && reason === 'timer') return;

        const intervalMs = Math.max(5, config.autoSyncIntervalMinutes || 15) * 60 * 1000;
        const lastSync = config.lastSyncAt ? Number(config.lastSyncAt) : 0;
        const now = Date.now();

        // Check if sync is overdue or triggered by reconnect
        if (now - lastSync >= intervalMs || reason === 'online' || reason === 'config_change') {
          isSyncingRef.current = true;
          try {
            await executeCloudSync();
          } finally {
            isSyncingRef.current = false;
          }
        }
      } catch (err) {
        isSyncingRef.current = false;
        console.warn('[CloudSyncProvider] Background sync pass warning:', err);
      }
    };

    // Initial check on mount
    void checkAndTriggerSync('mount');

    // Interval checker: every 2 minutes, check if overdue
    syncTimerRef.current = setInterval(() => {
      void checkAndTriggerSync('timer');
    }, 2 * 60 * 1000);

    // Online & focus reconnect handlers
    const handleOnline = () => void checkAndTriggerSync('online');
    const handleConfigChange = () => void checkAndTriggerSync('config_change');

    window.addEventListener('online', handleOnline);
    window.addEventListener('kylrix:cloud-sync-config-changed', handleConfigChange);

    return () => {
      active = false;
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('kylrix:cloud-sync-config-changed', handleConfigChange);
    };
  }, []);

  return <>{children}</>;
}
