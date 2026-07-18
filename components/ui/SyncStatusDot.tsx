'use client';

import { useSyncExternalStore } from 'react';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';

function useEnginePending(resourceId?: string | null) {
  return useSyncExternalStore(
    (onStoreChange) => autonomicSyncEngine.subscribe(onStoreChange),
    () => autonomicSyncEngine.isPending(resourceId),
    () => false,
  );
}

/**
 * Amber/green from the sync engine pending queue only.
 * Same authority that flushes live copy → Appwrite (never UI theater).
 * Pass `resourceId` (e.g. goal:xxx) or legacy `noteId` (bare note id).
 */
export function SyncStatusDot({
  noteId,
  resourceId,
}: {
  noteId?: string | null;
  resourceId?: string | null;
}) {
  const pending = useEnginePending(resourceId ?? noteId);

  if (pending) {
    return (
      <span
        className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]"
        title="Not saved yet"
      />
    );
  }

  return (
    <span
      className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
      title="Saved"
    />
  );
}

/** Layman label bound to the same engine pending queue as SyncStatusDot. */
export function SyncStatusLabel({
  noteId,
  resourceId,
}: {
  noteId?: string | null;
  resourceId?: string | null;
}) {
  const pending = useEnginePending(resourceId ?? noteId);
  return (
    <span className="text-[10px] font-semibold text-[#9B9691]">
      {pending ? 'Not saved yet' : 'Saved'}
    </span>
  );
}
