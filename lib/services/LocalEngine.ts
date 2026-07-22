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
        timestamp: Date.now(),
      }).catch(() => {});
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
      createdAt: new Date().toISOString(),
    });
  },
};
