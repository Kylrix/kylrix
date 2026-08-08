'use client';

import { useSyncExternalStore } from 'react';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { getMissingRequiredColumns, TABLE_ID_FOR_KIND } from '@/lib/sync/required-columns';
import { getLiveNoteForSync, getLiveGoalForSync, getLiveEventForSync } from '@/lib/sync/pending-sync-bridge';

function useEnginePending(resourceId?: string | null) {
  return useSyncExternalStore(
    (onStoreChange) => autonomicSyncEngine.subscribe(onStoreChange),
    () => autonomicSyncEngine.isPending(resourceId),
    () => false);
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
 * Amber/green from the sync engine pending queue only.
 * Same authority that flushes live copy → Appwrite (never UI theater).
 * Pass `resourceId` (e.g. goal:xxx) or legacy `noteId` (bare note id).
 * Optional `pending` overrides the engine (e.g. chat optimistic send).
 * Red static dot = cannot sync (missing required columns) — derived dynamically from appwrite.config.json.
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

  if (pending) {
    return (
      <span
        className="w-2 h-2 min-w-2 min-h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)] shrink-0 flex-none block"
        title="Sending"
      />
    );
  }

  return (
    <span
      className="w-2 h-2 min-w-2 min-h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] shrink-0 flex-none block"
      title="Sent"
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
  return (
    <span className="text-[10px] font-semibold text-[#9B9691]">
      {pending ? 'Not synced' : 'Synced'}
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
      <SyncStatusDot resourceId={resourceId} noteId={noteId} pending={pending} />
      <SyncStatusLabel resourceId={resourceId} noteId={noteId} />
    </span>
  );
}
