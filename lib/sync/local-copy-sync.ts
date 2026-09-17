/**
 * Local-copy sync primitives (object-agnostic).
 *
 * Principles:
 * 1. Live/local copy is the source of truth for on-device UI.
 * 2. Remote database is the source of truth that *feeds* the live copy.
 * 3. Pull/push upsert by id — never wipe the local list because a page missed a row.
 * 4. Pending (pre-synced / dirty) rows must survive pull until remote confirms them.
 */

import { LocalEngine } from '@/lib/services/LocalEngine';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';

export type SyncableRow = {
  $id: string;
  $createdAt?: string | null;
  $updatedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  isPinned?: boolean | null;
};

export type LiveEditGuardLike = {
  title?: string;
  content?: string;
  tags?: string[];
  at?: number;
};

function parseTs(value?: string | null): number {
  if (!value) return 0;
  const n = Date.parse(String(value));
  return Number.isFinite(n) ? n : 0;
}

function getRowUpdatedAt(row: SyncableRow): number {
  return Math.max(parseTs(row.updatedAt), parseTs(row.$updatedAt), parseTs(row.createdAt), parseTs(row.$createdAt));
}

export function getRowCreatedAt(row: SyncableRow): number {
  return Math.max(parseTs(row.$createdAt), parseTs(row.createdAt), getRowUpdatedAt(row));
}

/**
 * Merge a remote page into the existing local list.
 * - LWW Resolution: Local copy trumps remote strictly when the item is actively pending in the uncommitted outbox queue (`autonomicSyncEngine.isPending(id)`).
 * - Clean local items: If the local item is clean (!isPending) and the server copy is newer or equal, the server copy overwrites local.
 * - Rows only local: preserved if dirty or unpersisted.
 * - Rows only remote: appended.
 */
export function mergeServerPageWithLocalCopy<T extends SyncableRow>(params: {
  serverBatch: T[];
  localNotes: T[];
  guards?: Map<string, LiveEditGuardLike>;
  applyGuard?: (serverRow: T, guard: LiveEditGuardLike) => T;
  normalize?: (row: T) => T;
  /** Optional: ids that must never reappear (hard deletes / tombstones). */
  deletedIds?: Set<string>;
}): T[] {
  const {
    serverBatch,
    localNotes,
    guards,
    applyGuard,
    normalize = (row) => row,
    deletedIds} = params;

  const localById = new Map(localNotes.filter((r) => r?.$id).map((r: any) => [r.$id, r]));
  const mergedById = new Map<string, T>();

  for (const serverRow of serverBatch) {
    if (!serverRow?.$id) continue;
    if (deletedIds?.has(serverRow.$id) || LocalEngine.isDeleted(serverRow.$id)) continue;
    if ((serverRow as any).isTrash === true || (serverRow as any).isDeleted === true || String((serverRow as any).isTrash) === 'true' || String((serverRow as any).isDeleted) === 'true') continue;

    const local = localById.get(serverRow.$id);
    const guard = guards?.get(serverRow.$id);
    let next: T = normalize(serverRow);

    const isLocallyPending = autonomicSyncEngine.isPending(serverRow.$id);

    if (guard && applyGuard) {
      next = applyGuard(serverRow, guard);
    } else if (local && isLocallyPending) {
      // Local copy is actively pending in uncommitted outbox — keep local uncommitted fields
      next = normalize({ ...serverRow, ...local, $id: serverRow.$id });
    } else if (local && getRowUpdatedAt(local) > getRowUpdatedAt(serverRow)) {
      // Fallback timestamp check for non-ack'd uncommitted state
      next = normalize({ ...serverRow, ...local, $id: serverRow.$id });
    } else if (local) {
      // Clean local item or remote has newer timestamp — remote copy overwrites
      next = normalize({ ...local, ...serverRow, $id: serverRow.$id });
    }

    mergedById.set(serverRow.$id, next);
  }

  for (const local of localNotes) {
    if (!local?.$id) continue;
    if (deletedIds?.has(local.$id) || LocalEngine.isDeleted(local.$id)) continue;
    if ((local as any).isTrash === true || (local as any).isDeleted === true || String((local as any).isTrash) === 'true' || String((local as any).isDeleted) === 'true') continue;
    if (mergedById.has(local.$id)) continue;
    // Preserve local presence: drafts, pending sync, or local-only items not on this server page
    mergedById.set(local.$id, normalize(local));
  }

  return Array.from(mergedById.values());
}

/**
 * Canonical list order for Kylrix object grids:
 * 1) pinned first
 * 2) then newest created
 */
export function sortPinnedThenCreatedAt<T extends SyncableRow>(
  rows: T[],
  isPinned: (row: T) => boolean): T[] {
  return [...rows].sort((a: any, b: any) => {
    const aPinned = isPinned(a);
    const bPinned = isPinned(b);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return getRowUpdatedAt(b) - getRowUpdatedAt(a);
  });
}

/** Goals list order: earliest deadline first; no deadline falls back to most recently updated. */
export function sortByDeadlineThenUpdatedAt<T extends SyncableRow & { dueDate?: Date | string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const aDueMs = a.dueDate ? Date.parse(String(a.dueDate)) : NaN;
    const bDueMs = b.dueDate ? Date.parse(String(b.dueDate)) : NaN;
    const aHasDue = Number.isFinite(aDueMs);
    const bHasDue = Number.isFinite(bDueMs);

    if (aHasDue && bHasDue && aDueMs !== bDueMs) return aDueMs - bDueMs;
    if (aHasDue && !bHasDue) return -1;
    if (!aHasDue && bHasDue) return 1;

    return getRowUpdatedAt(b) - getRowUpdatedAt(a);
  });
}

/**
 * High-intent inbound delta guard.
 * Replaces periodic timer-based soft polling with a minimum 60-second guard between inbound delta requests.
 */
const MIN_INBOUND_GAP_MS = 60_000;

export function shouldSoftPull(params: {
  lastPullAt: number;
  activityIntensity?: number;
  now?: number;
}): boolean {
  const now = params.now ?? Date.now();
  const elapsed = now - (params.lastPullAt || 0);
  return elapsed >= MIN_INBOUND_GAP_MS;
}

export function shouldRunEmptyEscapeHatch(_dataType: string, _userId?: string | null): boolean {
  return false;
}

export function markEmptyEscapeHatchRan(_dataType: string, _userId?: string | null): void {
  // No-op: periodic/escape hatch lockout removed
}

export function resetEmptyEscapeHatch(_dataType?: string, _userId?: string | null): void {
  // No-op: periodic/escape hatch lockout removed
}
