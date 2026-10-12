/**
 * Client-side read-through cache for TablesDB `getRow` and `listRows` hot paths.
 * Prevents redundant round-trips and coalesces concurrent inflight requests.
 */

export type TablesDbRowCacheKey = {
  databaseId: string;
  tableId: string;
  rowId: string;
};

export type TablesDbListCacheKey = {
  databaseId: string;
  tableId: string;
  queries?: any[];
};

const DEFAULT_ROW_TTL_MS = 6 * 60 * 1000;
const DEFAULT_LIST_TTL_MS = 30 * 1000; // 30 seconds for list queries

const rowCache = new Map<string, { row: any; at: number }>();
const inflightRows = new Map<string, Promise<any>>();

const listCache = new Map<string, { result: any; at: number }>();
const inflightLists = new Map<string, Promise<any>>();

function cacheKey(parts: TablesDbRowCacheKey): string {
  return `${parts.databaseId}\0${parts.tableId}\0${parts.rowId}`;
}

function listKey(parts: TablesDbListCacheKey): string {
  const qStr = parts.queries ? JSON.stringify(parts.queries) : '';
  return `${parts.databaseId}\0${parts.tableId}\0${qStr}`;
}

export function invalidateTablesDbRowCache(parts: TablesDbRowCacheKey): void {
  const k = cacheKey(parts);
  rowCache.delete(k);
  inflightRows.delete(k);
  const prefix = `${parts.databaseId}\0${parts.tableId}\0`;
  for (const lk of listCache.keys()) {
    if (lk.startsWith(prefix)) {
      listCache.delete(lk);
    }
  }
}

export function invalidateTablesDbListCache(databaseId: string, tableId: string): void {
  const prefix = `${databaseId}\0${tableId}\0`;
  for (const lk of listCache.keys()) {
    if (lk.startsWith(prefix)) {
      listCache.delete(lk);
    }
  }
}

export async function getTablesDbRowCached(
  parts: TablesDbRowCacheKey,
  fetcher: () => Promise<any>,
  ttlMs: number = DEFAULT_ROW_TTL_MS,
): Promise<any> {
  if (typeof window === 'undefined') {
    return fetcher();
  }

  const k = cacheKey(parts);
  const hit = rowCache.get(k);
  if (hit && Date.now() - hit.at < ttlMs) {
    return hit.row != null ? { ...hit.row } : hit.row;
  }

  const pending = inflightRows.get(k);
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
      inflightRows.delete(k);
    });

  inflightRows.set(k, request);
  const row = await request;
  return row != null ? { ...row } : row;
}

export async function getTablesDbListCached(
  parts: TablesDbListCacheKey,
  fetcher: () => Promise<any>,
  ttlMs: number = DEFAULT_LIST_TTL_MS,
): Promise<any> {
  if (typeof window === 'undefined') {
    return fetcher();
  }

  const k = listKey(parts);
  const hit = listCache.get(k);
  if (hit && Date.now() - hit.at < ttlMs) {
    return hit.result != null ? JSON.parse(JSON.stringify(hit.result)) : hit.result;
  }

  const pending = inflightLists.get(k);
  if (pending) {
    const res = await pending;
    return res != null ? JSON.parse(JSON.stringify(res)) : res;
  }

  const request = fetcher()
    .then((result) => {
      listCache.set(k, { result, at: Date.now() });
      return result;
    })
    .finally(() => {
      inflightLists.delete(k);
    });

  inflightLists.set(k, request);
  const res = await request;
  return res != null ? JSON.parse(JSON.stringify(res)) : res;
}
