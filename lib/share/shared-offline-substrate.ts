'use client';

/**
 * SharedOfflineSubstrate — Modular offline-first storage engine for shared routes.
 *
 * Architecture:
 * 1. Owner-First Fast Path:
 *    When visiting a shared route, immediately checks if the object is already
 *    present in the current user's local engine (RxDB notes/tasks/forms) to provide
 *    instant 0ms owner rendering.
 * 2. Isolated Shared Cache:
 *    For viewers and collaborators, stores shared representations under an isolated
 *    namespace (`shared_resource:${kind}:${id}`) in LocalEngine so shared data never
 *    pollutes or collides with personal local storage collections.
 * 3. Inevitable Background Pull & Eviction on Revocation:
 *    Pulls fresh remote state. If access was revoked or turned private remotely,
 *    immediately purges the local shared cache and cuts access.
 */

import { LocalEngine } from '@/lib/services/LocalEngine';
import { getRxDB } from '@/lib/webrtc/RxDBManager';
import { resolveResourceOwnerId } from '@/lib/utils/resource-ids';

export type SharedResourceKind =
  | 'note'
  | 'idea'
  | 'goal'
  | 'task'
  | 'form'
  | 'vault'
  | 'event'
  | 'moment'
  | 'workspace'
  | 'flow';

export interface OfflineSharedHit<T = any> {
  data: T;
  isOwner: boolean;
  source: 'owner-local' | 'shared-cache';
}

export interface SharedSyncOptions<T = any> {
  kind: SharedResourceKind;
  id: string;
  currentUserId?: string;
  fetchRemote: () => Promise<T | null>;
  onLocalHit?: (data: T, isOwner: boolean) => void;
  onRemoteSuccess: (data: T, isOwner: boolean) => void;
  onAccessRevoked: (reason: 'not-found' | 'no-access' | 'expired') => void;
  isAccessibleRemote?: (data: T, currentUserId?: string) => boolean;
}

export const SharedOfflineSubstrate = {
  /** Namespace key for isolated shared cache */
  getSharedKey(kind: SharedResourceKind, id: string): string {
    return `shared_resource:${kind}:${id}`;
  },

  /**
   * Fast offline lookup:
   * 1. Checks owner's primary local copy first if user is logged in.
   * 2. Falls back to isolated shared cache.
   */
  async loadOffline<T = any>(
    kind: SharedResourceKind,
    id: string,
    currentUserId?: string
  ): Promise<OfflineSharedHit<T> | null> {
    if (typeof window === 'undefined' || !id) return null;

    try {
      // ── Step 1: Owner-First Fast Path ─────────────────────────────────────
      if (currentUserId) {
        const ownerHit = await this.loadFromOwnerLocalCopy<T>(kind, id, currentUserId);
        if (ownerHit) {
          return {
            data: ownerHit,
            isOwner: true,
            source: 'owner-local',
          };
        }
      }

      // ── Step 2: Isolated Shared Cache ─────────────────────────────────────
      const sharedKey = this.getSharedKey(kind, id);
      const cached = await LocalEngine.cacheGet<T>(sharedKey);
      if (cached && (cached as any).isTrash !== true && (cached as any).isDeleted !== true) {
        const ownerId = resolveResourceOwnerId(cached as Record<string, unknown>);
        const isOwner = Boolean(currentUserId && ownerId && currentUserId === ownerId);
        return {
          data: cached,
          isOwner,
          source: 'shared-cache',
        };
      }
    } catch (err) {
      console.warn('[SharedOfflineSubstrate] Offline lookup error:', err);
    }

    return null;
  },

  /**
   * Owner-first lookup in the primary personal RxDB / LocalEngine store.
   */
  async loadFromOwnerLocalCopy<T = any>(
    kind: SharedResourceKind,
    id: string,
    currentUserId: string
  ): Promise<T | null> {
    try {
      const db = await getRxDB().catch(() => null);

      if (kind === 'note' || kind === 'idea') {
        if (db?.notes) {
          const doc = await db.notes.findOne(id).exec().catch(() => null);
          if (doc && !doc._deleted && (doc.userId === currentUserId || !doc.userId)) {
            return {
              $id: doc.id,
              id: doc.id,
              title: doc.title,
              content: doc.content,
              userId: doc.userId || currentUserId,
              metadata: doc.metadata,
              $updatedAt: doc.updatedAt,
              updatedAt: doc.updatedAt,
            } as unknown as T;
          }
        }
      }

      if (kind === 'goal' || kind === 'task') {
        if (db?.tasks) {
          const doc = await db.tasks.findOne(id).exec().catch(() => null);
          if (doc && !doc._deleted && (doc.userId === currentUserId || !doc.userId)) {
            return {
              $id: doc.id,
              id: doc.id,
              title: doc.title,
              description: doc.description,
              status: doc.status,
              priority: doc.priority,
              userId: doc.userId || currentUserId,
              $updatedAt: doc.updatedAt,
              updatedAt: doc.updatedAt,
            } as unknown as T;
          }
        }
      }

      if (kind === 'form') {
        const schema = await LocalEngine.cacheGet<any>(`f_form_schema_${id}`);
        if (schema && (schema.userId === currentUserId || !schema.userId)) {
          return schema as T;
        }
      }

      // Check generic user caches in LocalEngine
      const userCached = await LocalEngine.cacheGet<any>(`f_${kind}_${id}_${currentUserId}`);
      if (userCached && !userCached._deleted && !userCached.isTrash) {
        return userCached as T;
      }
    } catch (err) {
      console.warn('[SharedOfflineSubstrate] Owner local store lookup failed:', err);
    }
    return null;
  },

  /**
   * Persists shared representation in isolated LocalEngine namespace.
   */
  async saveShared<T = any>(kind: SharedResourceKind, id: string, data: T): Promise<void> {
    if (typeof window === 'undefined' || !id || !data) return;
    try {
      const sharedKey = this.getSharedKey(kind, id);
      await LocalEngine.cacheSet(sharedKey, data);
    } catch (err) {
      console.warn('[SharedOfflineSubstrate] Failed to cache shared resource:', err);
    }
  },

  /**
   * Evicts shared representation from LocalEngine (e.g., when access is revoked or made private).
   */
  async evictShared(kind: SharedResourceKind, id: string): Promise<void> {
    if (typeof window === 'undefined' || !id) return;
    try {
      const sharedKey = this.getSharedKey(kind, id);
      await LocalEngine.cacheDelete(sharedKey);
    } catch (err) {
      console.warn('[SharedOfflineSubstrate] Failed to evict shared resource:', err);
    }
  },

  /**
   * Orchestrates the complete offline-first + remote reconciliation lifecycle for shared routes.
   */
  async syncSharedRoute<T = any>(options: SharedSyncOptions<T>): Promise<void> {
    const {
      kind,
      id,
      currentUserId,
      fetchRemote,
      onLocalHit,
      onRemoteSuccess,
      onAccessRevoked,
      isAccessibleRemote,
    } = options;

    if (!id) {
      onAccessRevoked('not-found');
      return;
    }

    // 1. Instant 0ms Offline Pass
    let hadLocalHit = false;
    try {
      const offlineHit = await this.loadOffline<T>(kind, id, currentUserId);
      if (offlineHit && offlineHit.data) {
        hadLocalHit = true;
        onLocalHit?.(offlineHit.data, offlineHit.isOwner);
      }
    } catch {}

    // 2. Inevitable Remote Synchronization & Visibility Revalidation
    // Brief retries cover the race where the owner just opened share and
    // isPublic/isGuest are still flushing to Appwrite.
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const maxAttempts = 4;
    const delaysMs = [0, 350, 700, 1200];

    let lastErr: any = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (delaysMs[attempt]) await sleep(delaysMs[attempt]);
      try {
        const remoteData = await fetchRemote();

        if (!remoteData || (remoteData as any).isTrash === true || (remoteData as any).isDeleted === true) {
          lastErr = new Error('not found');
          if (attempt < maxAttempts - 1) continue;
          await this.evictShared(kind, id);
          onAccessRevoked('not-found');
          return;
        }

        if (isAccessibleRemote && !isAccessibleRemote(remoteData, currentUserId)) {
          // May still be racing publish flags — retry a few times before deny
          lastErr = new Error('no-access');
          if (attempt < maxAttempts - 1) continue;
          await this.evictShared(kind, id);
          onAccessRevoked('no-access');
          return;
        }

        const ownerId = resolveResourceOwnerId(remoteData as Record<string, unknown>);
        const isOwner = Boolean(currentUserId && ownerId && currentUserId === ownerId);

        await this.saveShared<T>(kind, id, remoteData);
        onRemoteSuccess(remoteData, isOwner);
        return;
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message || '').toLowerCase();
        const isNotFoundRace =
          msg.includes('not found') || msg.includes('404');
        const isHardDeny =
          msg.includes('403') ||
          msg.includes('unauthorized') ||
          msg.includes('private');

        if (isHardDeny) break;
        if (isNotFoundRace && attempt < maxAttempts - 1) continue;
        break;
      }
    }

    const msg = String(lastErr?.message || '').toLowerCase();
    const isRevoked =
      msg.includes('not found') ||
      msg.includes('404') ||
      msg.includes('403') ||
      msg.includes('unauthorized') ||
      msg.includes('no-access') ||
      msg.includes('private');

    if (isRevoked) {
      await this.evictShared(kind, id);
      onAccessRevoked(msg.includes('404') || msg.includes('not found') ? 'not-found' : 'no-access');
    } else if (!hadLocalHit) {
      onAccessRevoked('no-access');
    }
  },
};
