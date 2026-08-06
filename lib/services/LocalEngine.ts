'use client';

/**
 * LocalEngine — Decoupled universal local storage substrate for local copy & RxDB IndexedDB.
 * Independent of SyncEngine, readable and writable by all application engines (Sync, Spine, Neural).
 */

import { getRxDB } from '@/lib/webrtc/RxDBManager';

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
