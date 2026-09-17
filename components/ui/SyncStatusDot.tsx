'use client';

import { useSyncExternalStore } from 'react';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { getMissingRequiredColumns, TABLE_ID_FOR_KIND } from '@/lib/sync/required-columns';
import { getLiveNoteForSync, getLiveGoalForSync, getLiveEventForSync } from '@/lib/sync/pending-sync-bridge';
import { getCurrentUserSnapshot, onCurrentUserChanged } from '@/lib/appwrite/client';
import { hasPaidKylrixPlan } from '@/lib/utils';

function useIsProUser() {
  return useSyncExternalStore(
    (onStoreChange) => onCurrentUserChanged(onStoreChange),
    () => hasPaidKylrixPlan(getCurrentUserSnapshot()),
    () => false
  );
}

function useEnginePending(resourceId?: string | null) {
  return useSyncExternalStore(
    (onStoreChange) => autonomicSyncEngine.subscribe(onStoreChange),
    () => autonomicSyncEngine.isPending(resourceId),
    () => false
  );
}

function useMissingForResource(
  resourceId?: string | null,
  row?: Record<string, unknown> | null,
  kind?: string | null,
  tableId?: string | null,
): string[] {
  if (row && (kind || tableId)) {
    const tid = tableId || (kind ? TABLE_ID_FOR_KIND[kind] : null);
    if (tid) return getMissingRequiredColumns(tid, row);
  }
  if (row && tableId) return getMissingRequiredColumns(tableId, row);
  const rid = String(resourceId || '').trim();
  if (!rid) return [];
  // If kind is explicitly provided, try that kind first via live getters
  if (kind) {
    const tid = TABLE_ID_FOR_KIND[kind];
    if (tid) {
      if (kind === 'goal' || kind === 'task') {
        const id = rid.startsWith('goal:') ? rid.slice(5) : rid;
        const live = getLiveGoalForSync(id) as unknown as Record<string, unknown> | null;
        if (live) {
          const miss = getMissingRequiredColumns(tid, live);
          if (miss.length) return miss;
          // still return to show not missing if live exists and has all required
          return [];
        }
      } else if (kind === 'event') {
        const id = rid.startsWith('event:') ? rid.slice(6) : rid;
        const live = getLiveEventForSync(id) as unknown as Record<string, unknown> | null;
        if (live) return getMissingRequiredColumns(tid, live);
      } else if (kind === 'note' || kind === 'idea') {
        const id = rid.startsWith('note:') ? rid.slice(5) : rid;
        const live = getLiveNoteForSync(id) as unknown as Record<string, unknown> | null;
        if (live) return getMissingRequiredColumns(tid, live);
      } else {
        // For tag/form/secret/totp, no live getter registry — cannot auto-detect, caller should pass row
        return [];
      }
    }
  }
  if (rid.startsWith('goal:')) {
    const id = rid.slice(5);
    const live = getLiveGoalForSync(id) as unknown as Record<string, unknown> | null;
    if (live) return getMissingRequiredColumns(TABLE_ID_FOR_KIND.goal, live);
  }
  if (rid.startsWith('event:')) {
    const id = rid.slice(6);
    const live = getLiveEventForSync(id) as unknown as Record<string, unknown> | null;
    if (live) return getMissingRequiredColumns(TABLE_ID_FOR_KIND.event, live);
  }
  const noteId = rid.startsWith('note:') ? rid.slice(5) : rid;
  if (!rid.startsWith('goal:') && !rid.startsWith('event:')) {
    const liveNote = getLiveNoteForSync(noteId) as unknown as Record<string, unknown> | null;
    if (liveNote) {
      const miss = getMissingRequiredColumns(TABLE_ID_FOR_KIND.note, liveNote);
      if (miss.length) return miss;
      const liveGoal = getLiveGoalForSync(noteId) as unknown as Record<string, unknown> | null;
      if (liveGoal) {
        const mg = getMissingRequiredColumns(TABLE_ID_FOR_KIND.goal, liveGoal);
        if (mg.length) return mg;
      }
      const liveEvent = getLiveEventForSync(noteId) as unknown as Record<string, unknown> | null;
      if (liveEvent) {
        const me = getMissingRequiredColumns(TABLE_ID_FOR_KIND.event, liveEvent);
        if (me.length) return me;
      }
    }
  }
  return [];
}

/**
 * 3-state status dot for resource sync status:
 * 1. Static Red: Cannot sync (missing required columns).
 * 2. Slate/Gray (#64748B / bg-slate-500): Local Only for free users and guests ("Saved locally (Offline Mode)").
 * 3. Amber (#F59E0B / bg-amber-500): Syncing / Pending for Pro users ("Syncing changes...").
 * 4. Green (#10B981 / bg-emerald-500): Cloud Synced for Pro users ("Synced to cloud").
 */
export function SyncStatusDot({
  noteId,
  resourceId,
  pending: pendingOverride,
  missingColumns,
  kind,
  row,
  tableId,
}: {
  noteId?: string | null;
  resourceId?: string | null;
  /** When set, drives the dot directly (pulse amber / solid green). */
  pending?: boolean | null;
  /** Explicit missing required columns (from getMissingRequiredColumns). If provided, takes precedence. */
  missingColumns?: string[] | null;
  /** Kind for dynamic required-field lookup (goal|note|event|form|tag|secret|totp) */
  kind?: string | null;
  /** Live row for required-field check */
  row?: Record<string, unknown> | null;
  /** Explicit tableId override */
  tableId?: string | null;
}) {
  const isPro = useIsProUser();
  const enginePending = useEnginePending(resourceId ?? noteId);
  const pending = typeof pendingOverride === 'boolean' ? pendingOverride : enginePending;
  const autoMissing = useMissingForResource(resourceId ?? noteId, row, kind, tableId);
  const missing = missingColumns != null ? missingColumns : autoMissing;

  if (missing && missing.length > 0) {
    return (
      <span
        className="w-2 h-2 min-w-2 min-h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] shrink-0 flex-none block"
        title={`Cannot sync: missing ${missing.join(', ')}`}
      />
    );
  }

  if (!isPro) {
    return (
      <span
        className="w-2 h-2 min-w-2 min-h-2 rounded-full bg-slate-500 dark:bg-muted-foreground shrink-0 flex-none block"
        title="Saved locally (Offline Mode)"
      />
    );
  }

  if (pending) {
    return (
      <span
        className="w-2 h-2 min-w-2 min-h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)] shrink-0 flex-none block"
        title="Syncing changes..."
      />
    );
  }

  return (
    <span
      className="w-2 h-2 min-w-2 min-h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] shrink-0 flex-none block"
      title="Synced to cloud"
    />
  );
}

/** Layman label bound to the same engine pending queue as SyncStatusDot. */
export function SyncStatusLabel({
  noteId,
  resourceId,
  missingColumns,
  kind,
  row,
  tableId,
}: {
  noteId?: string | null;
  resourceId?: string | null;
  missingColumns?: string[] | null;
  kind?: string | null;
  row?: Record<string, unknown> | null;
  tableId?: string | null;
}) {
  const isPro = useIsProUser();
  const pending = useEnginePending(resourceId ?? noteId);
  const autoMissing = useMissingForResource(resourceId ?? noteId, row, kind, tableId);
  const missing = missingColumns != null ? missingColumns : autoMissing;

  if (missing && missing.length > 0) {
    return (
      <span className="text-[10px] font-semibold text-red-400">
        Cannot sync: missing {missing.join(', ')}
      </span>
    );
  }

  if (!isPro) {
    return (
      <span className="text-[10px] font-semibold text-slate-500 dark:text-muted-foreground">
        Saved locally
      </span>
    );
  }

  return (
    <span className="text-[10px] font-semibold text-[#9B9691]">
      {pending ? 'Syncing changes...' : 'Synced to cloud'}
    </span>
  );
}

/** Detail inline helper: red dot + missing list text, used beside the dot in detail headers. */
export function SyncStatusDetail({
  resourceId,
  noteId,
  missingColumns,
  kind,
  row,
  tableId,
}: {
  resourceId?: string | null;
  noteId?: string | null;
  missingColumns?: string[] | null;
  kind?: string | null;
  row?: Record<string, unknown> | null;
  tableId?: string | null;
}) {
  const pending = useEnginePending(resourceId ?? noteId);
  const autoMissing = useMissingForResource(resourceId ?? noteId, row, kind, tableId);
  const missing = missingColumns != null ? missingColumns : autoMissing;

  if (missing && missing.length > 0) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" title={`Cannot sync: missing ${missing.join(', ')}`} />
        <span className="text-[10px] font-semibold text-red-400">missing {missing.join(', ')}</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <SyncStatusDot resourceId={resourceId} noteId={noteId} pending={pending} kind={kind} row={row} tableId={tableId} missingColumns={missingColumns} />
      <SyncStatusLabel resourceId={resourceId} noteId={noteId} kind={kind} row={row} tableId={tableId} missingColumns={missingColumns} />
    </span>
  );
}
