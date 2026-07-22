'use client';

/**
 * Autonomic sync engine — source of truth for note amber/green.
 * Pending queue is client-only in RxDB cache (never Appwrite columns / payloads).
 */

import { markNotePersistedRemote, markComposePersisted, markComposeDraft } from '@/lib/notes/compose-draft-registry';
import { updateNote, createNote } from '@/lib/actions/client-ops';
import { getNote, getNotePublicState } from '@/lib/appwrite';
import { pickNoteAutosavePayload } from '@/lib/appwrite/note';
import { getLiveNoteForSync, getLiveGoalForSync } from '@/lib/sync/pending-sync-bridge';
import { parseGoalPendingKey, goalPendingKey } from '@/lib/sync/goal-keys';
import { pickGoalAutosavePayload } from '@/lib/goals/pick-goal-autosave-payload';
import type { Notes } from '@/types/appwrite';
import type { Task } from '@/types';

const PENDING_QUEUE_KEY = 'kylrix:sync:pending-queue';

/** noteId → live revision string we still owe upstream */
const pendingById = new Map<string, string>();
const statusListeners = new Set<() => void>();

const failedSyncAttempts = new Map<string, { count: number; lastFailedAt: number }>();
let lastSuccessfulSyncTime = 0;

let globalIntensity = 0;
let lastKeystrokeTime = 0;
let lastPullAt = 0;
let syncTimeout: NodeJS.Timeout | null = null;
let isSyncing = false;
let persistWriteChain: Promise<void> = Promise.resolve();

const activityListeners = new Set<(intensity: number) => void>();

function notifyStatusListeners() {
  statusListeners.forEach((l) => l());
}

function queueSnapshot(): Record<string, string> {
  const obj: Record<string, string> = {};
  pendingById.forEach((rev, id) => {
    obj[id] = rev;
  });
  return obj;
}

/** One-shot bridge: older builds used sessionStorage. */
function absorbSessionStorageQueue() {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(PENDING_QUEUE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [id, rev] of Object.entries(parsed)) {
        if (id && rev) pendingById.set(id, String(rev));
      }
    }
    sessionStorage.removeItem(PENDING_QUEUE_KEY);
  } catch {
    // ignore
  }
}

/** Persist pending queue in RxDB cache (IndexedDB) — survives browser close / offline. */
function writePersistedQueue() {
  if (typeof window === 'undefined') return;
  persistWriteChain = persistWriteChain.then(async () => {
    const snapshot = queueSnapshot();
    try {
      const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
      const db = await getRxDB();
      await db.cache.upsert({
        id: PENDING_QUEUE_KEY,
        data: snapshot,
        timestamp: Date.now(),
      });
    } catch {
      // ignore storage failures — in-memory map still drives the UI
    }
  });
}

async function hydratePendingQueue() {
  if (typeof window === 'undefined') return;
  absorbSessionStorageQueue();
  persistWriteChain = persistWriteChain.then(async () => {
    try {
      const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
      const db = await getRxDB();
      const doc = await db.cache.findOne(PENDING_QUEUE_KEY).exec();
      const stored = (doc?.data && typeof doc.data === 'object' ? doc.data : {}) as Record<
        string,
        string
      >;
      for (const [id, rev] of Object.entries(stored)) {
        if (id && rev) pendingById.set(id, String(rev));
      }
      await db.cache.upsert({
        id: PENDING_QUEUE_KEY,
        data: queueSnapshot(),
        timestamp: Date.now(),
      });
    } catch {
      // RxDB unavailable — memory (+ absorbed session) still works this session
    }
    notifyStatusListeners();
  });
  await persistWriteChain;
}

if (typeof window !== 'undefined') {
  absorbSessionStorageQueue();
  void hydratePendingQueue();

  const handleUserActivity = (e: Event) => {
    const now = Date.now();
    if (e.type === 'keydown' || e.type === 'input') {
      const delta = now - lastKeystrokeTime;
      lastKeystrokeTime = now;
      if (delta < 250) globalIntensity = Math.min(10, globalIntensity + 2);
      else if (delta < 1000) globalIntensity = Math.min(10, globalIntensity + 0.5);
      else globalIntensity = Math.max(0.5, globalIntensity - 1);
    } else {
      globalIntensity = Math.max(0.2, globalIntensity - 0.2);
    }
    activityListeners.forEach((l) => l(globalIntensity));
    triggerAutonomicSyncScheduler();
  };

  window.addEventListener('keydown', handleUserActivity, { passive: true });
  window.addEventListener('input', handleUserActivity, { passive: true });
  window.addEventListener('scroll', handleUserActivity, { passive: true });
  window.addEventListener('click', handleUserActivity, { passive: true });
  window.addEventListener('online', () => triggerAutonomicSyncScheduler(), { passive: true });
}

function triggerAutonomicSyncScheduler() {
  if (syncTimeout) clearTimeout(syncTimeout);
  if (isSyncing) return;
  syncTimeout = setTimeout(() => {
    void autonomicSyncEngine.runCycle();
  }, 0);
}

function revisionOf(note: Notes | null | undefined): string {
  if (!note) return '';
  const u: unknown = note.updatedAt || note.$updatedAt;
  if (!u) return '';
  try {
    if (typeof u === 'string') return u.trim();
    if (typeof (u as any)?.toISOString === 'function') {
      return (u as any).toISOString();
    }
    if (typeof (u as any)?.getTime === 'function') {
      return new Date((u as any).getTime()).toISOString();
    }
    return String(u ?? '').trim();
  } catch {
    return '';
  }
}

function goalRevisionOf(task: Task | null | undefined): string {
  if (!task) return '';
  const u: unknown = task.updatedAt;
  if (!u) return '';
  try {
    if (typeof u === 'string') return u.trim();
    if (typeof (u as any)?.toISOString === 'function') {
      return (u as any).toISOString();
    }
    if (typeof (u as any)?.getTime === 'function') {
      return new Date((u as any).getTime()).toISOString();
    }
    return String(u ?? '').trim();
  } catch {
    return '';
  }
}

async function flushGoalPending(
  pendingKey: string,
  goalId: string,
  queuedRevision: string,
  db: Awaited<ReturnType<typeof import('@/lib/webrtc/RxDBManager').getRxDB>> | null,
  activeUserId: string | null
) {
  let payload: Task | null = getLiveGoalForSync(goalId);

  if (!payload && db) {
    try {
      const doc = await db.cache.findOne(`goal_${goalId}`).exec();
      payload = (doc?.data as Task) || null;
    } catch {
      payload = null;
    }
  }

  if (!payload) {
    console.warn(`[SyncEngine] No live payload for pending goal: ${goalId}`);
    return;
  }

  if (activeUserId) {
    const payloadAny = payload as any;
    if (!payloadAny.userId || payloadAny.userId === 'guest' || payloadAny.userId === 'ghost') {
      payloadAny.userId = activeUserId;
      payload.creatorId = activeUserId;
      if (Array.isArray(payload.assigneeIds)) {
        payload.assigneeIds = payload.assigneeIds.map((id) => (id === 'guest' || !id ? activeUserId : id));
      }
      if (db) {
        await db.cache.upsert({
          id: `goal_${goalId}`,
          data: payload as any,
          timestamp: Date.now()
        }).catch(() => {});
      }
    } else if (payloadAny.userId !== activeUserId) {
      console.warn(`[SyncEngine] Skipped goal belonging to different user: ${payloadAny.userId}`);
      return;
    }
  }

  if (!activeUserId) {
    // Guest mode — stay pending until claimed/migrated by a logged in user; do not hit Appwrite.
    return;
  }

  const dataPayload = pickGoalAutosavePayload(payload);
  if (!String(dataPayload.title || '').trim() && !String(dataPayload.description || '').trim()) {
    console.warn(`[SyncEngine] Ignored empty pending goal: ${goalId}`);
    return;
  }

  const flushRevision = goalRevisionOf(payload) || queuedRevision;
  const { tasks: taskApi, buildTaskPermissions } = await import('@/lib/kylrixflow');

  const creatorId = payload.creatorId || activeUserId || 'guest';
  const assignees = (payload.assigneeIds || []).filter(Boolean);
  const permissions = buildTaskPermissions(creatorId, assignees, []);

  let synced: Awaited<ReturnType<typeof taskApi.update>>;
  try {
    synced = await taskApi.update(goalId, dataPayload as any, permissions);
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    const isNotFound = msg.includes('not found') || err?.code === 404 || err?.status === 404;
    if (isNotFound) {
      synced = await taskApi.create(
        {
          ...(dataPayload as any),
          $id: goalId,
          userId: creatorId,
        },
        permissions,
      );
      try {
        const { taskCollaborators } = await import('@/lib/kylrixflow');
        for (const assigneeId of assignees) {
          if (!assigneeId || assigneeId === creatorId || assigneeId === 'guest') continue;
          await taskCollaborators
            .create(goalId, assigneeId, 'read', creatorId, permissions)
            .catch(() => null);
        }
      } catch {}
    } else {
      throw err;
    }
  }

  if (db) {
    await db.cache
      .upsert({
        id: `goal_${goalId}`,
        data: { ...payload, id: synced.$id, updatedAt: new Date(synced.$updatedAt || Date.now()) },
        timestamp: Date.now(),
      })
      .catch(() => {});
  }

  const liveAfter = getLiveGoalForSync(goalId);
  const liveRev = goalRevisionOf(liveAfter);
  if (liveRev && flushRevision && liveRev !== flushRevision) {
    pendingById.set(pendingKey, liveRev);
    writePersistedQueue();
    notifyStatusListeners();
    console.log(`[SyncEngine] Re-queued goal after concurrent edit: ${goalId}`);
    window.dispatchEvent(
      new CustomEvent('kylrix:sync-pending', { detail: { noteId: pendingKey, goalId, kind: 'goal' } }),
    );
  } else {
    lastSuccessfulSyncTime = Date.now();
    failedSyncAttempts.delete(pendingKey);
    autonomicSyncEngine.ack(pendingKey, flushRevision);
    window.dispatchEvent(
      new CustomEvent('kylrix:sync-complete', {
        detail: { noteId: pendingKey, goalId, syncedGoal: synced, revision: flushRevision, kind: 'goal' },
      }),
    );
  }
  console.log(`[SyncEngine] Successfully synced goal: ${goalId}`);
}

async function flushNotePending(
  noteId: string,
  queuedRevision: string,
  db: Awaited<ReturnType<typeof import('@/lib/webrtc/RxDBManager').getRxDB>> | null,
  activeUserId: string | null
) {
  let payload: Notes | null = getLiveNoteForSync(noteId);

  if (!payload && db) {
    try {
      const doc = await db.cache.findOne(`note_${noteId}`).exec();
      payload = (doc?.data as Notes) || null;
    } catch {
      payload = null;
    }
  }

  if (!payload) {
    console.warn(`[SyncEngine] No live payload for pending id: ${noteId}`);
    return;
  }

  if (activeUserId) {
    if (!payload.userId || payload.userId === 'guest' || payload.userId === 'ghost') {
      payload.userId = activeUserId;
      if (db) {
        await db.cache.upsert({
          id: `note_${noteId}`,
          data: payload as any,
          timestamp: Date.now()
        }).catch(() => {});
      }
    } else if (payload.userId !== activeUserId) {
      console.warn(`[SyncEngine] Skipped note belonging to different user: ${payload.userId}`);
      return;
    }
  }

  if (!activeUserId) {
    // Guest mode — stay pending until claimed/migrated by a logged in user; do not hit Appwrite.
    return;
  }

  const dataPayload = {
    ...pickNoteAutosavePayload(payload),
    isPublic: getNotePublicState(payload),
    isGuest: !!payload.isGuest,
  };

  if (!String(dataPayload.content || '').trim() && !String(dataPayload.title || '').trim()) {
    console.warn(`[SyncEngine] Ignored empty pending note: ${noteId}`);
    return;
  }

  const flushRevision = revisionOf(payload) || queuedRevision;

  let syncedNote: Notes;
  try {
    syncedNote = await updateNote(noteId, dataPayload);
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    const isNotFound = msg.includes('not found') || err?.code === 404 || err?.status === 404;
    if (isNotFound) {
      syncedNote = await createNote({
        ...dataPayload,
        $id: noteId,
      });
    } else {
      throw err;
    }
  }

  if (db) {
    await db.cache
      .upsert({
        id: `note_${noteId}`,
        data: syncedNote as any,
        timestamp: Date.now(),
      })
      .catch(() => {});
  }

  const liveAfter = getLiveNoteForSync(noteId);
  const liveRev = revisionOf(liveAfter);
  if (liveRev && flushRevision && liveRev !== flushRevision) {
    pendingById.set(noteId, liveRev);
    markComposeDraft(noteId);
    writePersistedQueue();
    notifyStatusListeners();
    console.log(`[SyncEngine] Re-queued note after concurrent edit: ${noteId}`);
    window.dispatchEvent(new CustomEvent('kylrix:sync-pending', { detail: { noteId } }));
  } else {
    lastSuccessfulSyncTime = Date.now();
    failedSyncAttempts.delete(noteId);
    autonomicSyncEngine.ack(noteId, flushRevision);
    window.dispatchEvent(
      new CustomEvent('kylrix:sync-complete', {
        detail: { noteId, syncedNote, revision: flushRevision },
      }),
    );
  }
  console.log(`[SyncEngine] Successfully synced note: ${noteId}`);
}

export const autonomicSyncEngine = {
  subscribeToActivity(callback: (intensity: number) => void) {
    activityListeners.add(callback);
    return () => {
      activityListeners.delete(callback);
    };
  },

  getActivityIntensity() {
    return globalIntensity;
  },

  nudge() {
    triggerAutonomicSyncScheduler();
  },

  getLastPullAt() {
    return lastPullAt;
  },

  markPullComplete(at = Date.now()) {
    lastPullAt = at;
  },

  /** Subscribe to pending-queue changes (amber/green). */
  subscribe(listener: () => void) {
    statusListeners.add(listener);
    return () => {
      statusListeners.delete(listener);
    };
  },

  /**
   * Enqueue a live revision for push. Client-only — never an Appwrite field.
   * Also mirrors compose-draft membership for create-lifecycle helpers.
   */
  markPending(noteId: string, revision?: string | null) {
    const rawId = String(noteId || '').trim();
    if (!rawId) return;
    const rev = String(revision || Date.now()).trim() || String(Date.now());

    let id = rawId;
    if (!parseGoalPendingKey(rawId) && getLiveGoalForSync(rawId)) {
      id = goalPendingKey(rawId);
    }

    pendingById.set(id, rev);
    if (!parseGoalPendingKey(id)) {
      markComposeDraft(id);
    }
    writePersistedQueue();
    notifyStatusListeners();
    triggerAutonomicSyncScheduler();
  },

  /** True while engine still owes upstream a flush for this id. */
  isPending(noteId?: string | null) {
    const id = String(noteId || '').trim();
    if (!id) return false;
    if (id.startsWith('live-') || id.startsWith('ghost-')) return true;
    if (pendingById.has(id)) return true;
    if (pendingById.has(`event:${id}`)) return true;
    if (pendingById.has(`form:${id}`)) return true;
    if (pendingById.has(`tag:${id}`)) return true;
    return pendingById.has(goalPendingKey(id));
  },

  listPendingIds(): string[] {
    return Array.from(pendingById.keys());
  },

  /** Confirmed remote accept for this id (optionally this revision). */
  ack(noteId: string, flushedRevision?: string | null) {
    const id = String(noteId || '').trim();
    if (!id) return;
    const queued = pendingById.get(id);
    const flushed = String(flushedRevision || '').trim();
    if (flushed && queued && queued !== flushed) {
      // Newer local revision arrived while flush ran — stay amber.
      notifyStatusListeners();
      return;
    }
    pendingById.delete(id);
    if (!parseGoalPendingKey(id)) {
      markComposePersisted(id);
      markNotePersistedRemote(id);
    }
    writePersistedQueue();
    notifyStatusListeners();
  },

  /**
   * Push pending live-copy notes + goals to Appwrite.
   * Payload = pick*AutosavePayload only (no pending flags).
   */
  async runCycle() {
    if (isSyncing) return;
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    const { hasAuthSessionHint, getCurrentUserSnapshot } = await import('@/lib/appwrite');
    const hasSession = hasAuthSessionHint();
    const activeUser = getCurrentUserSnapshot();
    const activeUserId = activeUser?.$id || null;

    if (!hasSession && !activeUserId) {
      // No account detected, stay offline
      return;
    }

    isSyncing = true;

    try {
      const pendingIds = Array.from(pendingById.keys());
      if (pendingIds.length === 0) return;

      console.log(`[SyncEngine] Spun up. Found ${pendingIds.length} pending live rows.`);

      const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
      const db = await getRxDB().catch(() => null);

      for (const pendingId of pendingIds) {
        if (!pendingById.has(pendingId)) continue;
        const queuedRevision = pendingById.get(pendingId) || '';

        // Backoff/retry delay for specific failed objects (ultra-fast sub-2 second retries):
        const failInfo = failedSyncAttempts.get(pendingId);
        if (failInfo) {
          const delay = Math.min(2000, 200 * Math.pow(1.5, failInfo.count));
          if (Date.now() - failInfo.lastFailedAt < delay) {
            if (lastSuccessfulSyncTime > 0 && Date.now() - lastSuccessfulSyncTime < 300000) {
              continue;
            }
          }
        }

        try {
          const goalId = parseGoalPendingKey(pendingId);
          if (goalId) {
            await flushGoalPending(pendingId, goalId, queuedRevision, db, activeUserId);
          } else {
            await flushNotePending(pendingId, queuedRevision, db, activeUserId);
          }
        } catch (err: any) {
          console.error(`[SyncEngine] Sync failed for item ${pendingId}:`, err);
          
          const prev = failedSyncAttempts.get(pendingId) || { count: 0, lastFailedAt: 0 };
          const nextCount = prev.count + 1;
          failedSyncAttempts.set(pendingId, { count: nextCount, lastFailedAt: Date.now() });

          const msg = String(err?.message || '').toLowerCase();
          const isPermissionOrUnrecoverable =
            msg.includes('forbidden') ||
            msg.includes('insufficient permissions') ||
            msg.includes('unauthorized') ||
            msg.includes('attribute "title"') ||
            nextCount >= 3;

          if (isPermissionOrUnrecoverable) {
            console.warn(`[SyncEngine] Self-healing: Purged un-syncable or zombie pending item: ${pendingId}`);
            failedSyncAttempts.delete(pendingId);
            autonomicSyncEngine.ack(pendingId);
          }

          notifyStatusListeners();
        }
      }
    } catch (error) {
      console.error('[SyncEngine] Autonomic sync error:', error);
    } finally {
      isSyncing = false;
      triggerAutonomicSyncScheduler();
    }
  },
};
