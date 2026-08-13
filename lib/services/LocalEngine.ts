'use client';

/**
 * LocalEngine — Decoupled universal local storage substrate for local copy & RxDB IndexedDB.
 * Independent of SyncEngine, readable and writable by all application engines (Sync, Spine, Neural).
 */

import { getRxDB } from '@/lib/webrtc/RxDBManager';

/** Realtime subscription registry — one per channel, survives HMR */
const realtimeSubs = new Map<string, { unsubscribe: () => void; refCount: number }>();
/** Batch queue for high-activity writes — flushed every 2s or 10 items */
const batchQueue = new Map<string, { data: any; mutator: () => Promise<any>; ts: number }>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;

async function getFreshJWT(): Promise<string | undefined> {
  try {
    const { account } = await import('@/lib/appwrite/client');
    const r = await account.createJWT().catch(() => null);
    return r?.jwt;
  } catch { return undefined; }
}

function scheduleBatchFlush() {
  if (batchTimer) return;
  batchTimer = setTimeout(async () => {
    batchTimer = null;
    const entries = Array.from(batchQueue.entries());
    if (!entries.length) return;
    batchQueue.clear();
    for (const [, { mutator }] of entries) {
      try { await mutator(); } catch (e) { console.warn('[LocalEngine batch] mutator failed', e); }
    }
  }, 2000);
}

export const LocalEngine = {
  /** Retrieve generic cached payload by key */
  async cacheGet<T = any>(id: string, maxAgeMs?: number): Promise<T | null> {
    if (typeof window === 'undefined') return null;
    try {
      const db = await getRxDB().catch(() => null);
      if (!db) return null;
      const doc = await db.cache.findOne(id).exec().catch(() => null);
      if (!doc || !doc.data) return null;

      if (maxAgeMs && doc.timestamp) {
        if (Date.now() - doc.timestamp > maxAgeMs) {
          return null;
        }
      }
      return doc.data as T;
    } catch (_err) {
      return null;
    }
  },

  /** Upsert generic cached payload by key */
  async cacheSet<T = any>(id: string, data: T): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const db = await getRxDB().catch(() => null);
      if (!db) return;
      await db.cache.upsert({
        id,
        data: data as any,
        timestamp: Date.now()}).catch(() => {});
    } catch (_err) {
      // Non-blocking storage
    }
  },

  /** Remove cached payload by key */
  async cacheDelete(id: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const db = await getRxDB().catch(() => null);
      if (!db) return;
      const doc = await db.cache.findOne(id).exec().catch(() => null);
      if (doc) await doc.remove().catch(() => {});
    } catch (_err) {
      // Non-blocking
    }
  },

  /** Persist telemetry & engine logs to local engine storage */
  async writeTelemetry(kind: string, payload: Record<string, any>): Promise<void> {
    if (typeof window === 'undefined') return;
    const telemetryId = `telemetry_${kind}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await this.cacheSet(telemetryId, {
      kind,
      payload,
      createdAt: new Date().toISOString()});
  },

  /** Store a clean baseline snapshot for an object ID when loaded from server/clean state. */
  snapshotBaseline(id: string, payload: any): void {
    if (typeof window === 'undefined' || !id || !payload) return;
    try {
      const cleanData = pickComparablePayload(payload);
      const snapshot = JSON.stringify(cleanData);
      (window as any)[`__kylrix_baseline_${id}`] = snapshot;
    } catch {}
  },

  /** Check if a incoming payload has actual structural differences against its baseline snapshot. */
  hasObjectDiff(id: string, payload: any): boolean {
    if (typeof window === 'undefined' || !id || !payload) return true;
    const baseline = (window as any)[`__kylrix_baseline_${id}`];
    if (!baseline) {
      this.snapshotBaseline(id, payload);
      return true;
    }
    try {
      const currentSnapshot = JSON.stringify(pickComparablePayload(payload));
      return currentSnapshot !== baseline;
    } catch {
      return true;
    }
  },

  // ── Unified Gateway — sole Appwrite touchpoint (UI must not import appwrite directly) ──

  /** Instant toggle: write local immediately, sync to Appwrite in background, revert on failure */
  async instantWrite<T>(cacheKey: string, data: T, mutator: (jwt?: string) => Promise<any>): Promise<T> {
    await this.cacheSet(cacheKey, data);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kylrix:nexus:update', { detail: { key: cacheKey, data } }));
    void (async () => {
      try {
        const jwt = await getFreshJWT();
        await mutator(jwt);
      } catch (e: any) {
        console.warn('[LocalEngine instantWrite] sync failed, revert may be needed', e);
      }
    })();
    return data;
  },

  /** Lazy write: local immediately, debounced sync (800ms) */
  async lazyWrite<T>(cacheKey: string, data: T, mutator: (jwt?: string) => Promise<any>): Promise<T> {
    await this.cacheSet(cacheKey, data);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kylrix:nexus:update', { detail: { key: cacheKey, data } }));
    setTimeout(async () => {
      try { const jwt = await getFreshJWT(); await mutator(jwt); } catch (e) { console.warn('[LocalEngine lazyWrite] failed', e); }
    }, 800);
    return data;
  },

  /** Batched write: queue and flush every 2s or 10 items — for high activity */
  async batchedWrite<T>(cacheKey: string, data: T, mutator: (jwt?: string) => Promise<any>): Promise<T> {
    await this.cacheSet(cacheKey, data);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kylrix:nexus:update', { detail: { key: cacheKey, data } }));
    batchQueue.set(cacheKey, { data, mutator: async () => { const jwt = await getFreshJWT(); return mutator(jwt); }, ts: Date.now() });
    if (batchQueue.size >= 10) {
      if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }
      const entries = Array.from(batchQueue.entries()); batchQueue.clear();
      for (const [, { mutator: m }] of entries) { try { await m(); } catch (e) { console.warn('[LocalEngine batch] failed', e); } }
    } else scheduleBatchFlush();
    return data;
  },

  /** Realtime: subscribe to Appwrite channel, write directly to RxDB cache on event — prevents pull-before-push double read */
  async subscribeRealtime(channel: string, handler?: (payload: any) => void): Promise<() => void> {
    if (typeof window === 'undefined') return () => {};
    const existing = realtimeSubs.get(channel);
    if (existing) { existing.refCount++; return () => { existing.refCount--; if (existing.refCount <= 0) { existing.unsubscribe(); realtimeSubs.delete(channel); } }; }
    try {
      const { client } = await import('@/lib/appwrite/client');
      const unsubscribe = client.subscribe(channel, async (event: any) => {
        try {
          if (event?.payload && event?.events?.[0]) {
            const doc = event.payload;
            const cacheKey = `${channel}:${doc.$id || doc.id}`;
            await this.cacheSet(cacheKey, doc);
            if (handler) handler(doc);
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kylrix:nexus:update', { detail: { key: cacheKey, data: doc } }));
          } else if (handler) handler(event);
        } catch {}
      });
      const entry = { unsubscribe: unsubscribe as unknown as () => void, refCount: 1 };
      realtimeSubs.set(channel, entry);
      return () => { entry.refCount--; if (entry.refCount <= 0) { entry.unsubscribe(); realtimeSubs.delete(channel); } };
    } catch { return () => {}; }
  },

  /** Unified query: RxDB first, background Realtime + fetch if stale — UI never calls Appwrite directly */
  async query<T>(cacheKey: string, fetcher: (jwt?: string) => Promise<T>, opts?: { ttl?: number; realtimeChannel?: string }): Promise<T> {
    const cached = await this.cacheGet<T>(cacheKey, opts?.ttl);
    if (cached) {
      if (opts?.realtimeChannel) void this.subscribeRealtime(opts.realtimeChannel);
      // background refresh — failsafe: never wipe populated cache with empty fetch (workspace-introduced vault empty bug)
      void (async () => {
        try {
          const jwt = await getFreshJWT();
          const fresh = await fetcher(jwt);
          if (JSON.stringify(fresh) === JSON.stringify(cached)) return;
          const isFreshEmpty = Array.isArray(fresh) ? (fresh as any).length === 0 : (fresh as any)?.rows ? (fresh as any).rows.length === 0 : !fresh;
          const isCachedPopulated = Array.isArray(cached) ? (cached as any).length > 0 : (cached as any)?.rows ? (cached as any).rows.length > 0 : !!cached;
          if (isCachedPopulated && isFreshEmpty) return;
          await this.cacheSet(cacheKey, fresh as any);
        } catch {}
      })();
      return cached;
    }
    const jwt = await getFreshJWT();
    const fresh = await fetcher(jwt);
    await this.cacheSet(cacheKey, fresh as any);
    if (opts?.realtimeChannel) void this.subscribeRealtime(opts.realtimeChannel);
    return fresh;
  },

  /** Unified mutate: local optimistic + tiered sync — UI never calls secure-ops directly */
  async mutate<T>(cacheKey: string, data: T, mutator: (jwt?: string) => Promise<any>, tier: 'instant' | 'lazy' | 'batch' = 'instant'): Promise<T> {
    if (tier === 'instant') return this.instantWrite(cacheKey, data, mutator);
    if (tier === 'lazy') return this.lazyWrite(cacheKey, data, mutator);
    return this.batchedWrite(cacheKey, data, mutator);
  },

  // ── Unified object handles — UI calls these, never backend directly ──
  /** Manual fetch handle: UI can force refresh when cache feels stale/empty */
  async fetch<T>(kind: string, queries: string[] = [], opts?: { force?: boolean; cacheKey?: string; ttl?: number }): Promise<{ total: number; rows: T[] }> {
    const { unifiedRead } = await import('./unified-object-service');
    const cacheKey = opts?.cacheKey || `local:${kind}:${JSON.stringify(queries)}`;
    if (!opts?.force) {
      const cached = await this.cacheGet<{ total: number; rows: T[] }>(cacheKey, opts?.ttl);
      if (cached && Array.isArray((cached as any).rows) && (cached as any).rows.length) {
        // background refresh — failsafe: don't overwrite populated cache with empty (vault starter bug)
        void unifiedRead(kind, queries).then(fresh => {
          const isFreshEmpty = (fresh as any)?.rows ? (fresh as any).rows.length === 0 : !fresh;
          if (isFreshEmpty) return;
          return this.cacheSet(cacheKey, fresh);
        }).catch(()=>{});
        return cached;
      }
    }
    const fresh = await unifiedRead<T>(kind, queries);
    await this.cacheSet(cacheKey, fresh as any);
    return fresh;
  },

  async get<T>(kind: string, id: string, opts?: { force?: boolean }): Promise<T | null> {
    const { unifiedGet } = await import('./unified-object-service');
    const cacheKey = `local:${kind}:${id}`;
    if (!opts?.force) {
      const cached = await this.cacheGet<T>(cacheKey);
      if (cached) return cached;
    }
    const doc = await unifiedGet<T>(kind, id);
    if (doc) await this.cacheSet(cacheKey, doc as any);
    return doc;
  },

  async create<T>(kind: string, data: Record<string, any>): Promise<T> {
    const { unifiedCreate } = await import('./unified-object-service');
    const row = await unifiedCreate<T>(kind, data);
    // optimistic cache
    await this.cacheSet(`local:${kind}:${(row as any).$id || (row as any).id}`, row as any);
    return row;
  },

  async update<T>(kind: string, id: string, data: Record<string, any>): Promise<T> {
    const { unifiedUpdate } = await import('./unified-object-service');
    const row = await unifiedUpdate<T>(kind, id, data);
    await this.cacheSet(`local:${kind}:${id}`, row as any);
    return row;
  },

  async delete(kind: string, id: string, opts?: { recursive?: boolean; cascade?: Array<{ kind: string; foreignField: string }> }): Promise<void> {
    const { unifiedDelete } = await import('./unified-object-service');
    await unifiedDelete(kind, id, opts);
    await this.cacheDelete(`local:${kind}:${id}`);
  },

  async systemCreate<T>(kind: string, data: Record<string, any>): Promise<T> {
    const { systemCreate } = await import('./unified-object-service');
    return systemCreate<T>(kind, data);
  },
  async systemUpdate<T>(kind: string, id: string, data: Record<string, any>): Promise<T> {
    const { systemUpdate } = await import('./unified-object-service');
    return systemUpdate<T>(kind, id, data);
  },
  async systemDelete(kind: string, id: string): Promise<void> {
    const { systemDelete } = await import('./unified-object-service');
    return systemDelete(kind, id);
  },
};

function pickComparablePayload(payload: any): Record<string, any> {
  if (!payload || typeof payload !== 'object') return {};
  return {
    title: String(payload.title || '').trim(),
    content: String(payload.content || '').trim(),
    description: String(payload.description || '').trim(),
    tags: Array.isArray(payload.tags) ? [...payload.tags].sort() : [],
    labels: Array.isArray(payload.labels) ? [...payload.labels].sort() : [],
    status: payload.status || undefined,
    priority: payload.priority || undefined,
    isPublic: payload.isPublic ?? undefined,
    isGuest: payload.isGuest ?? undefined,
    dueDate: payload.dueDate ? new Date(payload.dueDate).toISOString() : undefined,
  };
}
