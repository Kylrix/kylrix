/**
 * Turso Quiet Sync Marker
 *
 * A client-only, non-database marker attached to local engine data copies
 * to track which rows have been synchronized to the modern Turso/libSQL database.
 *
 * This marker is purely local: it is not a column in Turso and is never persisted
 * to the remote SQL schema. It enables zero-downtime auditing, local sync state
 * visualization, and verification for all domain objects (ideas, goals, workspaces,
 * forms, events, masterpass keychains, totp secrets, and vault items).
 */

export interface TursoSyncMarker {
  synced: boolean;
  syncedAt: string;
  table?: string;
  rowId?: string;
  source?: 'turso' | 'sync_bridge' | 'autonomic';
}

/** Registry of in-memory synced IDs per user for instant synchronous check */
const inMemoryTursoSyncedIds = new Map<string, Set<string>>();

function getSyncedIdsSet(userId = 'guest'): Set<string> {
  if (typeof window === 'undefined') return new Set();
  let set = inMemoryTursoSyncedIds.get(userId);
  if (!set) {
    set = new Set();
    try {
      const raw = localStorage.getItem(`f_turso_synced_ids_${userId}`);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((id) => set!.add(String(id)));
        }
      }
    } catch {}
    inMemoryTursoSyncedIds.set(userId, set);
  }
  return set;
}

const pendingPersistTimers = new Map<string, ReturnType<typeof setTimeout>>();

function persistSyncedIdsSet(userId = 'guest', set: Set<string>): void {
  if (typeof window === 'undefined') return;
  const existing = pendingPersistTimers.get(userId);
  if (existing) clearTimeout(existing);
  
  const timer = setTimeout(() => {
    pendingPersistTimers.delete(userId);
    try {
      localStorage.setItem(`f_turso_synced_ids_${userId}`, JSON.stringify(Array.from(set)));
    } catch {}
  }, 100);
  pendingPersistTimers.set(userId, timer);
}

/**
 * Record an entity ID as synced to Turso in the local fast-index.
 */
export function recordTursoSyncedId(id: string, userId = 'guest'): void {
  if (!id) return;
  const canonicalId = id.includes(':') ? id.slice(id.indexOf(':') + 1).trim() : id.trim();
  const set = getSyncedIdsSet(userId);
  set.add(canonicalId);
  set.add(id);
  persistSyncedIdsSet(userId, set);
}

/**
 * Retrieve all IDs marked as synced to Turso for a user.
 */
export function getTursoSyncedIds(userId = 'guest'): Set<string> {
  return getSyncedIdsSet(userId);
}

/**
 * Checks if an item or ID is marked as synced to Turso.
 */
export function isTursoSynced(itemOrId: any, userId = 'guest'): boolean {
  if (!itemOrId) return false;

  // 1. If passed an object, inspect the quiet marker directly
  if (typeof itemOrId === 'object') {
    if (itemOrId._tursoSync?.synced === true) return true;
    if (itemOrId._tursoSynced === true) return true;
    if (typeof itemOrId._tursoSyncedAt === 'string' && itemOrId._tursoSyncedAt) return true;
    // Check if item has an ID in the fast set
    const id = itemOrId.id || itemOrId.$id;
    if (id && getSyncedIdsSet(userId).has(String(id))) return true;
    return false;
  }

  // 2. If passed a string ID, query the local synced registry
  if (typeof itemOrId === 'string') {
    const canonical = itemOrId.includes(':') ? itemOrId.slice(itemOrId.indexOf(':') + 1).trim() : itemOrId.trim();
    return getSyncedIdsSet(userId).has(canonical) || getSyncedIdsSet(userId).has(itemOrId);
  }

  return false;
}

/**
 * Extracts the quiet Turso sync marker from an item.
 */
export function getTursoSyncMarker(item: any): TursoSyncMarker | null {
  if (!item || typeof item !== 'object') return null;
  if (item._tursoSync && typeof item._tursoSync === 'object') {
    return item._tursoSync as TursoSyncMarker;
  }
  if (item._tursoSynced === true || item._tursoSyncedAt) {
    return {
      synced: true,
      syncedAt: item._tursoSyncedAt || new Date().toISOString(),
      table: item._tursoTable,
      rowId: item.id || item.$id,
    };
  }
  return null;
}

/**
 * Stretches a quiet marker onto a target entity, row, array of rows, or list payload.
 * Does not mutate non-object primitives. Works seamlessly across ideas, goals, workspaces,
 * masterpass keys, and vault items.
 */
export function stampTursoSync<T>(
  target: T,
  options?: {
    table?: string;
    rowId?: string;
    at?: string;
    userId?: string;
  }
): T {
  if (!target) return target;

  const now = options?.at || new Date().toISOString();
  const uid = options?.userId || 'guest';

  // Helper to stamp a single object
  const stampSingle = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;

    const rowId = options?.rowId || obj.id || obj.$id;
    const marker: TursoSyncMarker = {
      synced: true,
      syncedAt: now,
      table: options?.table || obj._tursoTable,
      rowId,
      source: 'turso',
    };

    // Attach quiet properties (prefixed with _ so DB queries & schemas ignore them)
    obj._tursoSync = marker;
    obj._tursoSynced = true;
    obj._tursoSyncedAt = now;
    if (options?.table) obj._tursoTable = options.table;

    if (rowId) {
      recordTursoSyncedId(String(rowId), uid);
    }
    return obj;
  };

  // Case 1: Array of items (e.g. list of ideas, goals, keychain entries)
  if (Array.isArray(target)) {
    return target.map((item) => stampSingle(item)) as unknown as T;
  }

  // Case 2: Object with rows array (e.g. { rows: [...], total: n })
  if (typeof target === 'object' && Array.isArray((target as any).rows)) {
    (target as any).rows = (target as any).rows.map((row: any) => stampSingle(row));
    return stampSingle(target) as T;
  }

  // Case 3: Single row or document
  if (typeof target === 'object') {
    return stampSingle(target) as T;
  }

  return target;
}

/**
 * Cleans quiet markers before sending a payload to remote backend APIs or SQL execution,
 * guaranteeing zero schema contamination.
 */
export function stripTursoMarker<T>(target: T): T {
  if (!target || typeof target !== 'object') return target;

  if (Array.isArray(target)) {
    return target.map((item) => stripTursoMarker(item)) as unknown as T;
  }

  const copy = { ...target } as any;
  delete copy._tursoSync;
  delete copy._tursoSynced;
  delete copy._tursoSyncedAt;
  delete copy._tursoTable;

  if (Array.isArray(copy.rows)) {
    copy.rows = copy.rows.map((r: any) => stripTursoMarker(r));
  }

  return copy as T;
}
