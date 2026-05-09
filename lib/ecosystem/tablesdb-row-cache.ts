/**
 * Client-side read-through cache for TablesDB `getRow` hot paths (social attachments, etc.).
 * Mutations should call `invalidateTablesDbRowCache` for the same (databaseId, tableId, rowId).
 */

export type TablesDbRowCacheKey = {
  databaseId: string;
  tableId: string;
  rowId: string;
};

const DEFAULT_TTL_MS = 6 * 60 * 1000;

const rowCache = new Map<string, { row: any; at: number }>();
const inflight = new Map<string, Promise<any>>();

function cacheKey(parts: TablesDbRowCacheKey) {
  return `${parts.databaseId}\0${parts.tableId}\0${parts.rowId}`;
}

export function invalidateTablesDbRowCache(parts: TablesDbRowCacheKey) {
  const k = cacheKey(parts);
  rowCache.delete(k);
  inflight.delete(k);
}

export async function getTablesDbRowCached(
  parts: TablesDbRowCacheKey,
  fetcher: () => Promise<any>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<any> {
  if (typeof window === 'undefined') {
    return fetcher();
  }

  const k = cacheKey(parts);
  const hit = rowCache.get(k);
  if (hit && Date.now() - hit.at < ttlMs) {
    return hit.row != null ? { ...hit.row } : hit.row;
  }

  const pending = inflight.get(k);
  if (pending) {
    const row = await pending;
    return row != null ? { ...row } : row;
  }

  const request = fetcher()
    .then((row) => {
      rowCache.set(k, { row, at: Date.now() });
      return row;
    })
    .finally(() => {
      inflight.delete(k);
    });

  inflight.set(k, request);
  const row = await request;
  return row != null ? { ...row } : row;
}
