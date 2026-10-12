'use client';

import { useSyncExternalStore } from 'react';
import { subscribeAgenticLocalStore } from '@/lib/agentic/session-local-store';

export function AgenticSyncDot({
  syncStatus}: {
  syncStatus?: 'pending' | 'synced' | 'error';
}) {
  useSyncExternalStore(subscribeAgenticLocalStore, () => syncStatus, () => syncStatus);

  if (syncStatus === 'pending') {
    return (
      <span
        className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]"
        title="Saving locally — syncing to cloud"
      />
    );
  }

  if (syncStatus === 'error') {
    return (
      <span
        className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
        title="Sync issue — still on this device"
      />
    );
  }

  return (
    <span
      className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
      title="Synced"
    />
  );
}
