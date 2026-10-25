'use client';
import { ulid } from '@/lib/utils/ulid';

/**
 * LocalEngine — Decoupled universal local storage substrate for local copy & RxDB IndexedDB.
 * Independent of SyncEngine, readable and writable by all application engines (Sync, Spine, Neural).
 */

import { getRxDB } from '@/lib/webrtc/RxDBManager';
import { isDogfoodSafetyActive } from '@/lib/deployment/surface';

const batchQueue = new Map<string, { data: any; mutator: () => Promise<any>; ts: number }>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;

async function getFreshJWT(): Promise<string | undefined> {
  return undefined;
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

const inflightQueries = new Map<string, Promise<any>>();
const backgroundRevalidationCooldowns = new Map<string, number>();
const inMemoryCacheSnapshots = new Map<string, string>();
const inMemoryDeletedIds = new Set<string>();

function ensureDeletedIdsLoaded(userId?: string): Set<string> {
  if (typeof window === 'undefined') return inMemoryDeletedIds;
  const uid = userId || 'guest';
  if (inMemoryDeletedIds.size === 0) {
    try {
      const raw = localStorage.getItem(`f_deleted_ids_${uid}`);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((id) => inMemoryDeletedIds.add(String(id)));
        }
      }
    } catch {}
  }
  return inMemoryDeletedIds;
}

export const LocalEngine = {
  async markDeleted(id: string, userId?: string): Promise<void> {
    if (!id || typeof window === 'undefined') return;
    const uid = userId || 'guest';
    ensureDeletedIdsLoaded(uid);
    inMemoryDeletedIds.add(id);

    try {
      localStorage.setItem(`f_deleted_ids_${uid}`, JSON.stringify(Array.from(inMemoryDeletedIds)));
    } catch {}

    delete (window as any)[`__kylrix_baseline_${id}`];
    try {
      const { autonomicSyncEngine } = await import('@/lib/services/sync-engine');
      autonomicSyncEngine.cancelPending(id);
      autonomicSyncEngine.cancelPending(`goal:${id}`);
      autonomicSyncEngine.cancelPending(`form:${id}`);
    } catch {}

    await Promise.all([
      this.cacheDelete(`local:note:${id}`),
      this.cacheDelete(`local:goal:${id}`),
      this.cacheDelete(`local:task:${id}`),
      this.cacheDelete(`local:form:${id}`),
      this.cacheDelete(`note_${id}`),
      this.cacheDelete(`goal_${id}`),
      this.cacheDelete(`form_${id}`),
      this.cacheDelete(id),
    ]);

    const listKeys = [
      `f_notes_list_${uid}`,
      `f_ideas_${uid}`,
      `f_tasks_${uid}`,
      `f_goals_list_${uid}`,
      `f_goals_list`,
      `f_forms_list_${uid}`,
      `f_forms_${uid}`,
      `f_forms_list`,
      `initial_notes_${uid}`,
    ];

    for (const key of listKeys) {
      try {
        const cached = await this.cacheGet<any>(key);
        if (!cached) continue;
        if (Array.isArray(cached)) {
          const updated = cached.filter((item: any) => (item?.$id || item?.id) !== id);
          await this.cacheSet(key, updated);
        } else if (cached && Array.isArray(cached.rows)) {
          const updatedRows = cached.rows.filter((item: any) => (item?.$id || item?.id) !== id);
          await this.cacheSet(key, { ...cached, rows: updatedRows, total: updatedRows.length });
        }
      } catch {}
    }

    try {
      const db = await getRxDB().catch(() => null);
      if (db) {
        if (db.notes) await db.notes.findOne(id).remove().catch(() => {});
        if (db.tasks) await db.tasks.findOne(id).remove().catch(() => {});
        if ((db as any).forms) await (db as any).forms.findOne(id).remove().catch(() => {});
        await db.cache.findOne(`note_${id}`).remove().catch(() => {});
        await db.cache.findOne(`goal_${id}`).remove().catch(() => {});
        await db.cache.findOne(`form_${id}`).remove().catch(() => {});
        await db.cache.findOne(id).remove().catch(() => {});
        await db.cache.upsert({ id: `f_deleted_ids_${uid}`, data: Array.from(inMemoryDeletedIds), timestamp: Date.now() }).catch(() => {});
      }
    } catch {}

    window.dispatchEvent(new CustomEvent('kylrix:nexus:delete', { detail: { id, userId: uid } }));
  },

  async unmarkDeleted(id: string, userId?: string): Promise<void> {
    if (!id || typeof window === 'undefined') return;
    const uid = userId || 'guest';
    ensureDeletedIdsLoaded(uid);
    inMemoryDeletedIds.delete(id);

    try {
      localStorage.setItem(`f_deleted_ids_${uid}`, JSON.stringify(Array.from(inMemoryDeletedIds)));
      const db = await getRxDB().catch(() => null);
      if (db?.cache) {
        await db.cache.upsert({ id: `f_deleted_ids_${uid}`, data: Array.from(inMemoryDeletedIds), timestamp: Date.now() }).catch(() => {});
      }
    } catch {}

    window.dispatchEvent(new CustomEvent('kylrix:nexus:restore', { detail: { id, userId: uid } }));
  },

  isDeleted(id: string, userId?: string): boolean {
    if (!id || typeof window === 'undefined') return false;
    const uid = userId || 'guest';
    ensureDeletedIdsLoaded(uid);
    return inMemoryDeletedIds.has(id);
  },

  getDeletedIds(userId?: string): Set<string> {
    const uid = userId || 'guest';
    return ensureDeletedIdsLoaded(uid);
  },

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

  async cacheSet<T = any>(id: string, data: T): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const serialized = typeof data === 'string' ? data : JSON.stringify(data);
      if (inMemoryCacheSnapshots.get(id) === serialized) {
        return;
      }
      inMemoryCacheSnapshots.set(id, serialized);

      const writeToDb = async () => {
        try {
          const db = await getRxDB().catch(() => null);
          if (!db) return;
          await db.cache.upsert({
            id,
            data: data as any,
            timestamp: Date.now()
          }).catch(() => {});
        } catch {}
      };

      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(writeToDb, { timeout: 2000 });
      } else {
        setTimeout(writeToDb, 0);
      }
    } catch (_err) {
      // Non-blocking storage
    }
  },

  async cacheDelete(id: string): Promise<void> {
    if (typeof window === 'undefined') return;
    inMemoryCacheSnapshots.delete(id);
    try {
      const db = await getRxDB().catch(() => null);
      if (!db) return;
      const doc = await db.cache.findOne(id).exec().catch(() => null);
      if (doc) await doc.remove().catch(() => {});
    } catch (_err) {
      // Non-blocking
    }
  },

  async writeTelemetry(kind: string, payload: Record<string, any>): Promise<void> {
    if (typeof window === 'undefined') return;
    const telemetryId = `telemetry_${kind}_${ulid()}`;
    await this.cacheSet(telemetryId, {
      kind,
      payload,
      createdAt: new Date().toISOString()});
  },

  snapshotBaseline(id: string, payload: any): void {
    if (typeof window === 'undefined' || !id || !payload) return;
    const canonicalId = id.includes(':') ? id.slice(id.indexOf(':') + 1).trim() : id.trim();
    try {
      const cleanData = pickComparablePayload(payload);
      const snapshot = JSON.stringify(cleanData);
      (window as any)[`__kylrix_baseline_${canonicalId}`] = snapshot;
    } catch {}
  },

  hasObjectDiff(id: string, payload: any): boolean {
    if (typeof window === 'undefined' || !id || !payload) return true;
    const canonicalId = id.includes(':') ? id.slice(id.indexOf(':') + 1).trim() : id.trim();
    const baseline = (window as any)[`__kylrix_baseline_${canonicalId}`];
    if (!baseline) {
      return true;
    }
    try {
      const currentSnapshot = JSON.stringify(pickComparablePayload(payload));
      return currentSnapshot !== baseline;
    } catch {
      return true;
    }
  },

  hasBaseline(id: string): boolean {
    if (typeof window === 'undefined' || !id) return false;
    const canonicalId = id.includes(':') ? id.slice(id.indexOf(':') + 1).trim() : id.trim();
    return Boolean((window as any)[`__kylrix_baseline_${canonicalId}`]);
  },

  clearBaseline(id: string): void {
    if (typeof window === 'undefined' || !id) return;
    const canonicalId = id.includes(':') ? id.slice(id.indexOf(':') + 1).trim() : id.trim();
    try {
      delete (window as any)[`__kylrix_baseline_${canonicalId}`];
    } catch {}
  },

  async instantWrite<T>(cacheKey: string, data: T, mutator: (jwt?: string) => Promise<any>): Promise<T> {
    await this.cacheSet(cacheKey, data);
    this.broadcastRealtime(cacheKey, data);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kylrix:nexus:update', { detail: { key: cacheKey, data } }));
    if (!isDogfoodSafetyActive()) {
      void (async () => {
        try {
          const jwt = await getFreshJWT();
          await mutator(jwt);
        } catch (e: any) {
          console.warn('[LocalEngine instantWrite] sync failed', e);
        }
      })();
    }
    return data;
  },

  async lazyWrite<T>(cacheKey: string, data: T, mutator: (jwt?: string) => Promise<any>): Promise<T> {
    await this.cacheSet(cacheKey, data);
    this.broadcastRealtime(cacheKey, data);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kylrix:nexus:update', { detail: { key: cacheKey, data } }));
    if (!isDogfoodSafetyActive()) {
      setTimeout(async () => {
        try { const jwt = await getFreshJWT(); await mutator(jwt); } catch (e) { console.warn('[LocalEngine lazyWrite] failed', e); }
      }, 800);
    }
    return data;
  },

  async batchedWrite<T>(cacheKey: string, data: T, mutator: (jwt?: string) => Promise<any>): Promise<T> {
    await this.cacheSet(cacheKey, data);
    this.broadcastRealtime(cacheKey, data);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kylrix:nexus:update', { detail: { key: cacheKey, data } }));
    batchQueue.set(cacheKey, { data, mutator: async () => { const jwt = await getFreshJWT(); return mutator(jwt); }, ts: Date.now() });
    if (batchQueue.size >= 10) {
      if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }
      const entries = Array.from(batchQueue.entries()); batchQueue.clear();
      for (const [, { mutator: m }] of entries) { try { await m(); } catch (e) { console.warn('[LocalEngine batch] failed', e); } }
    } else scheduleBatchFlush();
    return data;
  },

  broadcastRealtime(channel: string, payload: any, userId?: string): void {
    if (typeof window === 'undefined' || !payload) return;
    try {
      const { realtimeRelay } = require('@/lib/realtime/client');
      const uid = userId || payload.userId || payload.creatorId;
      if (uid && uid !== 'guest') {
        const isDelete = payload.isDeleted === true || payload.isTrash === true;
        realtimeRelay.broadcastToUser(uid, {
          type: isDelete ? 'delete' : 'mutation',
          channel,
          id: payload.$id || payload.id,
          data: payload,
          userId: uid,
          projectId: payload.projectId || payload.workspaceId,
        });
      }
    } catch {}
  },

  subscribeRealtime(_channel: string, _handler?: (event: any) => void): () => void {
    return () => {};
  },

  async query<T>(cacheKey: string, fetcher: (jwt?: string) => Promise<T>, opts?: { ttl?: number; realtimeChannel?: string; force?: boolean }): Promise<T> {
    const ttl = opts?.ttl ?? 1000 * 60 * 5;
    const cached = opts?.force ? null : await this.cacheGet<T>(cacheKey, ttl);

    if (cached) {
      if (isDogfoodSafetyActive()) {
        return cached;
      }

      const lastReval = backgroundRevalidationCooldowns.get(cacheKey) || 0;
      const now = Date.now();
      if (now - lastReval > 1000 * 60 * 3 && !inflightQueries.has(cacheKey)) {
        backgroundRevalidationCooldowns.set(cacheKey, now);
        const revalPromise = (async () => {
          try {
            const jwt = await getFreshJWT();
            const fresh = await fetcher(jwt);
            if (JSON.stringify(fresh) === JSON.stringify(cached)) return;
            const isFreshEmpty = Array.isArray(fresh) ? (fresh as any).length === 0 : (fresh as any)?.rows ? (fresh as any).rows.length === 0 : !fresh;
            const isCachedPopulated = Array.isArray(cached) ? (cached as any).length > 0 : (cached as any)?.rows ? (cached as any).rows.length > 0 : !!cached;
            if (isCachedPopulated && isFreshEmpty) return;
            await this.cacheSet(cacheKey, fresh as any);
          } catch {} finally {
            inflightQueries.delete(cacheKey);
          }
        })();
        inflightQueries.set(cacheKey, revalPromise);
      }
      return cached;
    }

    if (isDogfoodSafetyActive()) {
      return (Array.isArray(cached) ? [] : { total: 0, rows: [] }) as unknown as T;
    }

    if (inflightQueries.has(cacheKey)) {
      return inflightQueries.get(cacheKey)!;
    }

    const queryPromise = (async () => {
      try {
        const jwt = await getFreshJWT();
        const fresh = await fetcher(jwt);
        await this.cacheSet(cacheKey, fresh as any);
        backgroundRevalidationCooldowns.set(cacheKey, Date.now());
        return fresh;
      } finally {
        inflightQueries.delete(cacheKey);
      }
    })();

    inflightQueries.set(cacheKey, queryPromise);
    return queryPromise;
  },

  async mutate<T>(cacheKey: string, data: T, mutator: (jwt?: string) => Promise<any>, tier: 'instant' | 'lazy' | 'batch' = 'instant'): Promise<T> {
    if (tier === 'instant') return this.instantWrite(cacheKey, data, mutator);
    if (tier === 'lazy') return this.lazyWrite(cacheKey, data, mutator);
    return this.batchedWrite(cacheKey, data, mutator);
  },

  async fetch<T>(kind: string, queries: string[] = [], opts?: { force?: boolean; cacheKey?: string; ttl?: number }): Promise<{ total: number; rows: T[] }> {
    const { unifiedRead } = await import('./unified-object-service');
    const cacheKey = opts?.cacheKey || `local:${kind}:${JSON.stringify(queries)}`;
    const ttl = opts?.ttl ?? 1000 * 60 * 5;

    if (!opts?.force) {
      const cached = await this.cacheGet<{ total: number; rows: T[] }>(cacheKey, ttl);
      if (cached && Array.isArray((cached as any).rows) && (cached as any).rows.length) {
        return cached;
      }
    }

    if (inflightQueries.has(cacheKey)) {
      return inflightQueries.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
      try {
        const fresh = await unifiedRead<T>(kind, queries);
        await this.cacheSet(cacheKey, fresh as any);
        backgroundRevalidationCooldowns.set(cacheKey, Date.now());
        return fresh;
      } finally {
        inflightQueries.delete(cacheKey);
      }
    })();

    inflightQueries.set(cacheKey, fetchPromise);
    return fetchPromise;
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
    const rowId = (row as any).$id || (row as any).id;
    await this.cacheSet(`local:${kind}:${rowId}`, row as any);
    this.broadcastRealtime(`local:${kind}:${rowId}`, row as any);
    return row;
  },

  async update<T>(kind: string, id: string, data: Record<string, any>): Promise<T> {
    const { unifiedUpdate } = await import('./unified-object-service');
    const row = await unifiedUpdate<T>(kind, id, data);
    await this.cacheSet(`local:${kind}:${id}`, row as any);
    this.broadcastRealtime(`local:${kind}:${id}`, row as any);
    return row;
  },

  async delete(kind: string, id: string, opts?: { recursive?: boolean; cascade?: Array<{ kind: string; foreignField: string }> }): Promise<void> {
    const { unifiedDelete } = await import('./unified-object-service');
    await unifiedDelete(kind, id, opts);
    await this.cacheDelete(`local:${kind}:${id}`);
    this.broadcastRealtime(`local:${kind}:${id}`, { id, isDeleted: true });
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
    return (systemDelete as any)(kind, id);
  },

  async trashHangout(item: { id: string; title: string; kind: 'secure' | 'thread'; rawData?: any }, userId?: string): Promise<void> {
    if (typeof window === 'undefined' || !item?.id) return;
    const uid = userId || 'guest';
    const key = `kylrix_trashed_hangouts_${uid}`;
    try {
      const existing = await this.getTrashedHangouts(uid);
      const filtered = existing.filter((h) => h.id !== item.id);
      const trashedItem = {
        id: item.id,
        title: item.title || 'Untitled Hangout',
        type: 'Hangout',
        kind: item.kind,
        rawData: item.rawData,
        deletedAt: new Date().toISOString(),
        userId: uid,
      };
      const updated = [trashedItem, ...filtered];
      localStorage.setItem(key, JSON.stringify(updated));
      await this.cacheSet(key, updated).catch(() => {});
      await this.markDeleted(item.id, uid);
    } catch {}
  },

  async getTrashedHangouts(userId?: string): Promise<any[]> {
    if (typeof window === 'undefined') return [];
    const uid = userId || 'guest';
    const key = `kylrix_trashed_hangouts_${uid}`;
    try {
      const cached = await this.cacheGet<any[]>(key).catch(() => null);
      if (Array.isArray(cached) && cached.length) return cached;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  },

  async restoreTrashedHangout(id: string, userId?: string): Promise<void> {
    if (typeof window === 'undefined' || !id) return;
    const uid = userId || 'guest';
    const key = `kylrix_trashed_hangouts_${uid}`;
    try {
      const existing = await this.getTrashedHangouts(uid);
      const updated = existing.filter((h) => h.id !== id);
      localStorage.setItem(key, JSON.stringify(updated));
      await this.cacheSet(key, updated).catch(() => {});
      await this.unmarkDeleted(id, uid);
    } catch {}
  },

  async purgeTrashedHangout(id: string, userId?: string): Promise<void> {
    if (typeof window === 'undefined' || !id) return;
    const uid = userId || 'guest';
    const key = `kylrix_trashed_hangouts_${uid}`;
    try {
      const existing = await this.getTrashedHangouts(uid);
      const updated = existing.filter((h) => h.id !== id);
      localStorage.setItem(key, JSON.stringify(updated));
      await this.cacheSet(key, updated).catch(() => {});
    } catch {}
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
