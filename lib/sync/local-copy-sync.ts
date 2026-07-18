/**
 * Local-copy sync primitives (object-agnostic).
 *
 * Principles:
 * 1. Live/local copy is the source of truth for on-device UI.
 * 2. Remote database is the source of truth that *feeds* the live copy.
 * 3. Pull/push upsert by id — never wipe the local list because a page missed a row.
 * 4. Pending (pre-synced / dirty) rows must survive pull until remote confirms them.
 */

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

export function getRowUpdatedAt(row: SyncableRow): number {
  return Math.max(parseTs(row.updatedAt), parseTs(row.$updatedAt), parseTs(row.createdAt), parseTs(row.$createdAt));
}

export function getRowCreatedAt(row: SyncableRow): number {
  return Math.max(parseTs(row.$createdAt), parseTs(row.createdAt), getRowUpdatedAt(row));
}

/**
 * Merge a remote page into the existing local list.
 * - Rows in both: apply guard if present; else prefer newer updatedAt (local wins if newer).
 * - Rows only local: always kept (prevents "synced then vanished" wipes).
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
    deletedIds,
  } = params;

  const localById = new Map(localNotes.filter((r) => r?.$id).map((r) => [r.$id, r]));
  const mergedById = new Map<string, T>();

  for (const serverRow of serverBatch) {
    if (!serverRow?.$id) continue;
    if (deletedIds?.has(serverRow.$id)) continue;

    const local = localById.get(serverRow.$id);
    const guard = guards?.get(serverRow.$id);
    let next: T = normalize(serverRow);

    if (guard && applyGuard) {
      next = applyGuard(serverRow, guard);
    } else if (local && getRowUpdatedAt(local) > getRowUpdatedAt(serverRow)) {
      // Local copy is newer (e.g. just edited, remote page stale) — keep local fields.
      next = normalize({ ...serverRow, ...local, $id: serverRow.$id });
    } else if (local) {
      next = normalize({ ...local, ...serverRow, $id: serverRow.$id });
    }

    mergedById.set(serverRow.$id, next);
  }

  for (const local of localNotes) {
    if (!local?.$id) continue;
    if (deletedIds?.has(local.$id)) continue;
    if (mergedById.has(local.$id)) continue;
    // Preserve local presence: drafts, pending sync, or simply not on this remote page yet.
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
  isPinned: (row: T) => boolean,
): T[] {
  return [...rows].sort((a, b) => {
    const aPinned = isPinned(a);
    const bPinned = isPinned(b);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return getRowCreatedAt(b) - getRowCreatedAt(a);
  });
}

/** Soft-pull cadence helpers (activity / heartbeat). */
export const SYNC_PULL_IDLE_MS = 45_000;
export const SYNC_PULL_ACTIVE_MS = 120_000;
export const SYNC_PULL_MIN_GAP_MS = 15_000;

export function shouldSoftPull(params: {
  lastPullAt: number;
  activityIntensity: number;
  now?: number;
}): boolean {
  const now = params.now ?? Date.now();
  const elapsed = now - (params.lastPullAt || 0);
  if (elapsed < SYNC_PULL_MIN_GAP_MS) return false;
  const threshold = params.activityIntensity >= 5 ? SYNC_PULL_ACTIVE_MS : SYNC_PULL_IDLE_MS;
  return elapsed >= threshold;
}
