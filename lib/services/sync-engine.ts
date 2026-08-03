'use client';

/**
 * Autonomic sync engine — source of truth for note/goal amber/green.
 * Pending queue is client-only in RxDB cache (never Appwrite columns / payloads).
 *
 * Demand-driven (not spine-polled):
 * - markPending → coalesced flush (~450ms)
 * - online / tab focus / visibility → flush if unpaid work exists
 * - pagehide / hidden → flushImmediately
 * - failed items retry with exponential backoff only (never 0ms spin)
 */

import { markNotePersistedRemote, markComposePersisted, markComposeDraft } from '@/lib/notes/compose-draft-registry';
import { updateNote, createNote } from '@/lib/actions/client-ops';
import { getNotePublicState } from '@/lib/appwrite';
import { pickNoteAutosavePayload } from '@/lib/appwrite/note';
import { getLiveNoteForSync, getLiveGoalForSync, getLiveEventForSync } from '@/lib/sync/pending-sync-bridge';
import type { Event } from '@/types';

async function flushEventPending(
  pendingKey: string,
  eventId: string,
  queuedRevision: string,
  db: Awaited<ReturnType<typeof import('@/lib/webrtc/RxDBManager').getRxDB>> | null,
  activeUserId: string | null
) {
  let payload: Event | null =
    pendingPayloads.get(pendingKey) ||
    pendingPayloads.get(eventId) ||
    getLiveEventForSync(eventId);

  if (!payload && db) {
    try {
      const doc = await db.cache.findOne(`event_${eventId}`).exec();
      payload = (doc?.data as Event) || null;
    } catch {
      payload = null;
    }
  }

  if (!payload) {
    const prev = failedSyncAttempts.get(pendingKey) || { count: 0, lastFailedAt: 0 };
    failedSyncAttempts.set(pendingKey, { count: prev.count + 1, lastFailedAt: Date.now() });
    notifyStatusListeners();
    return;
  }

  if (!activeUserId) return;

  const { events: eventApi } = await import('@/lib/kylrixflow');
  const flushRevision = queuedRevision || new Date().toISOString();

  try {
    const startTimeStr = typeof payload.startTime === 'string' ? payload.startTime : payload.startTime?.toISOString();
    const endTimeStr = typeof payload.endTime === 'string' ? payload.endTime : payload.endTime?.toISOString();
    await eventApi.update(eventId, {
      title: payload.title,
      description: payload.description,
      startTime: startTimeStr,
      endTime: endTimeStr,
      location: payload.location,
      meetingUrl: (payload as any).meetingUrl || payload.url,
      visibility: (payload as any).visibility || (payload.isPublic !== false ? 'public' : 'private'),
      isPublic: payload.isPublic !== false,
      isGuest: payload.isGuest !== false,
    } as any);

    failedSyncAttempts.delete(pendingKey);
    failedSyncAttempts.delete(eventId);
    autonomicSyncEngine.ack(pendingKey, flushRevision);
    autonomicSyncEngine.ack(eventId, flushRevision);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('kylrix:sync-complete', {
          detail: { eventId, revision: flushRevision, kind: 'event' },
        })
      );
    }
  } catch (err: any) {
    const prev = failedSyncAttempts.get(pendingKey) || { count: 0, lastFailedAt: 0 };
    failedSyncAttempts.set(pendingKey, { count: prev.count + 1, lastFailedAt: Date.now() });
    notifyStatusListeners();
    throw err;
  }
}
import { parseGoalPendingKey, goalPendingKey } from '@/lib/sync/goal-keys';
import { pickGoalAutosavePayload } from '@/lib/goals/pick-goal-autosave-payload';
import type { Notes } from '@/types/appwrite';
import type { Task } from '@/types';


const PENDING_QUEUE_KEY = 'kylrix:sync:pending-queue';
const PENDING_PAYLOADS_KEY = 'kylrix:sync:pending-payloads';

/** noteId → live revision string we still owe upstream */
const pendingById = new Map<string, string>();
/** noteId → live payload object stored in SyncEngine memory (independent of React UI components/routes) */
const pendingPayloads = new Map<string, any>();
const statusListeners = new Set<() => void>();

const failedSyncAttempts = new Map<string, { count: number; lastFailedAt: number }>();

let globalIntensity = 0;
let lastKeystrokeTime = 0;
let lastPullAt = 0;
let syncTimeout: NodeJS.Timeout | null = null;
let retryTimeout: NodeJS.Timeout | null = null;
let isSyncing = false;
/** markPending during an in-flight cycle must not drop the next flush. */
let flushQueuedDuringSync = false;
let persistWriteChain: Promise<void> = Promise.resolve();

/** Coalesce keystroke/CRUD bursts — never tight-loop the network. */
const FLUSH_COALESCE_MS = 450;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;

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

function payloadsSnapshot(): Record<string, any> {
  const obj: Record<string, any> = {};
  pendingPayloads.forEach((payload, id) => {
    if (payload) obj[id] = payload;
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
    const payloads = payloadsSnapshot();
    try {
      const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
      const db = await getRxDB();
      await db.cache.upsert({
        id: PENDING_QUEUE_KEY,
        data: snapshot,
        timestamp: Date.now()});
      await db.cache.upsert({
        id: PENDING_PAYLOADS_KEY,
        data: payloads,
        timestamp: Date.now()});
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

      const payloadsDoc = await db.cache.findOne(PENDING_PAYLOADS_KEY).exec();
      const storedPayloads = (payloadsDoc?.data && typeof payloadsDoc.data === 'object' ? payloadsDoc.data : {}) as Record<
        string,
        any
      >;
      for (const [id, payload] of Object.entries(storedPayloads)) {
        if (id && payload) pendingPayloads.set(id, payload);
      }

      // Migrate bare goal ids → goal: prefix (older builds treated them as notes and never flushed).
      let migrated = false;
      for (const [id, rev] of Array.from(pendingById.entries())) {
        if (parseGoalPendingKey(id)) continue;
        const payload = pendingPayloads.get(id);
        const looksLikeGoal =
          !!payload &&
          typeof payload === 'object' &&
          !!(payload as any).status &&
          !!(payload as any).priority &&
          !(payload as any).content &&
          (!(payload as any).$id || (payload as any).id);
        const cacheHit = await db.cache.findOne(`goal_${id}`).exec().catch(() => null);
        if (!looksLikeGoal && !cacheHit) continue;

        const namespaced = goalPendingKey(id);
        pendingById.set(namespaced, rev);
        pendingById.delete(id);
        if (payload) {
          pendingPayloads.set(namespaced, payload);
          pendingPayloads.delete(id);
        }
        failedSyncAttempts.delete(id);
        failedSyncAttempts.delete(namespaced);
        migrated = true;
      }

      await db.cache.upsert({
        id: PENDING_QUEUE_KEY,
        data: queueSnapshot(),
        timestamp: Date.now()});
      if (migrated) {
        await db.cache.upsert({
          id: PENDING_PAYLOADS_KEY,
          data: payloadsSnapshot(),
          timestamp: Date.now()});
      }

      // Unblock goals that spent days in exponential backoff under the old re-queue bug.
      for (const id of pendingById.keys()) {
        if (parseGoalPendingKey(id)) failedSyncAttempts.delete(id);
      }
    } catch {
      // RxDB unavailable — memory (+ absorbed session) still works this session
    }
    notifyStatusListeners();
    if (pendingById.size > 0) {
      scheduleDemandFlush({ immediate: true });
    }
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
  window.addEventListener('online', () => scheduleDemandFlush({ immediate: true }), { passive: true });
  window.addEventListener('beforeunload', () => autonomicSyncEngine.flushImmediately());
  window.addEventListener('pagehide', () => autonomicSyncEngine.flushImmediately());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      autonomicSyncEngine.flushImmediately();
    } else if (pendingById.size > 0) {
      // Tab focused again with unpaid work — flush on demand, not on a timer.
      scheduleDemandFlush({ immediate: true });
    }
  });
  window.addEventListener('focus', () => {
    if (pendingById.size > 0) scheduleDemandFlush({ immediate: true });
  });
}

function maxFailedAttempts(): number {
  let max = 0;
  failedSyncAttempts.forEach((info) => {
    if (info.count > max) max = info.count;
  });
  return max;
}

/**
 * Demand-driven flush scheduler.
 * - Coalesces bursts (typing / rapid CRUD)
 * - Never re-arms itself into a 0ms spin loop
 * - Retries only when unpaid work remains, with exponential backoff
 */
function scheduleDemandFlush(opts?: { immediate?: boolean; retry?: boolean }) {
  if (typeof window === 'undefined') return;
  if (isSyncing) {
    flushQueuedDuringSync = true;
    return;
  }
  if (pendingById.size === 0) {
    if (syncTimeout) clearTimeout(syncTimeout);
    if (retryTimeout) clearTimeout(retryTimeout);
    syncTimeout = null;
    retryTimeout = null;
    return;
  }

  if (opts?.immediate) {
    if (syncTimeout) clearTimeout(syncTimeout);
    if (retryTimeout) clearTimeout(retryTimeout);
    syncTimeout = null;
    retryTimeout = null;
    void autonomicSyncEngine.runCycle();
    return;
  }

  if (opts?.retry) {
    if (retryTimeout) return;
    const backoff = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(1.6, maxFailedAttempts()));
    retryTimeout = setTimeout(() => {
      retryTimeout = null;
      void autonomicSyncEngine.runCycle();
    }, backoff);
    return;
  }

  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncTimeout = null;
    void autonomicSyncEngine.runCycle();
  }, FLUSH_COALESCE_MS);
}

function triggerAutonomicSyncScheduler() {
  scheduleDemandFlush();
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
  let payload: Task | null =
    pendingPayloads.get(pendingKey) ||
    pendingPayloads.get(goalId) ||
    getLiveGoalForSync(goalId);

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
    const prev = failedSyncAttempts.get(pendingKey) || { count: 0, lastFailedAt: 0 };
    failedSyncAttempts.set(pendingKey, { count: prev.count + 1, lastFailedAt: Date.now() });
    notifyStatusListeners();
    return;
  }

  if (activeUserId) {
    const payloadAny = payload as any;
    if (!payloadAny.userId || payloadAny.userId === 'guest' || payloadAny.userId === 'ghost') {
      payloadAny.userId = activeUserId;
      payload.creatorId = activeUserId;
      if (Array.isArray(payload.assigneeIds)) {
        payload.assigneeIds = payload.assigneeIds.map((id: any) => (id === 'guest' || !id ? activeUserId : id));
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
  if (!String(dataPayload.title || '').trim()) {
    dataPayload.title = String(dataPayload.description || '').trim().slice(0, 32) || 'Untitled Goal';
  }

  const flushRevision = goalRevisionOf(payload) || queuedRevision;
  const { tasks: taskApi, buildTaskPermissions } = await import('@/lib/kylrixflow');

  const creatorId = payload.creatorId || (payload as any).userId || activeUserId || 'guest';
  const assignees = (payload.assigneeIds || []).filter(
    (id) => !!id && id !== 'guest' && id !== 'ghost' && id !== creatorId,
  );
  const permissions = buildTaskPermissions(creatorId, [creatorId, ...assignees], []);

  let synced: Awaited<ReturnType<typeof taskApi.update>>;
  try {
    synced = await taskApi.update(goalId, dataPayload as any, permissions);
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    const isNotFound =
      msg.includes('not found') ||
      msg.includes('could not be found') ||
      err?.code === 404 ||
      err?.status === 404;
    const isForbiddenOrMissing =
      msg.includes('forbidden') ||
      msg.includes('insufficient permissions') ||
      msg.includes('unauthorized');
    if (isNotFound || isForbiddenOrMissing) {
      synced = await taskApi.create(
        {
          ...(dataPayload as any),
          $id: goalId,
          userId: creatorId},
        permissions,
      );
      try {
        const { taskCollaborators } = await import('@/lib/kylrixflow');
        for (const assigneeId of assignees) {
          if (!assigneeId || assigneeId === creatorId) continue;
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
        data: {
          ...payload,
          id: synced.$id || goalId,
          userId: creatorId,
          creatorId,
          updatedAt: new Date(synced.$updatedAt || Date.now())},
        timestamp: Date.now(),
      })
      .catch(() => {});
  }

  // Ack against the *queue* revision, not live updatedAt.
  // Goal realtime / UPDATE_TASK used to stamp `new Date()` and permanently
  // re-queue successful flushes (ideas guard live edits; goals did not).
  const queuedAfter = pendingById.get(pendingKey) || '';
  if (queuedAfter && flushRevision && queuedAfter !== flushRevision) {
    writePersistedQueue();
    notifyStatusListeners();
    console.log(`[SyncEngine] Re-queued goal after concurrent edit: ${goalId}`);
    window.dispatchEvent(
      new CustomEvent('kylrix:sync-pending', { detail: { noteId: pendingKey, goalId, kind: 'goal' } }),
    );
  } else {
    failedSyncAttempts.delete(pendingKey);
    failedSyncAttempts.delete(goalId);
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
  let payload: Notes | null = pendingPayloads.get(noteId) || getLiveNoteForSync(noteId);

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
    const prev = failedSyncAttempts.get(noteId) || { count: 0, lastFailedAt: 0 };
    failedSyncAttempts.set(noteId, { count: prev.count + 1, lastFailedAt: Date.now() });
    notifyStatusListeners();
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
    isGuest: !!payload.isGuest};

  if (!String(dataPayload.title || '').trim()) {
    dataPayload.title = String(dataPayload.content || '').trim().slice(0, 32) || 'Untitled Note';
  }

  const flushRevision = revisionOf(payload) || queuedRevision;

  let syncedNote: Notes;
  try {
    syncedNote = await updateNote(noteId, dataPayload);
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    const isNotFound = msg.includes('not found') || err?.code === 404 || err?.status === 404;
    const isForbiddenOrMissing = msg.includes('forbidden') || msg.includes('insufficient permissions') || msg.includes('unauthorized');
    if (isNotFound || isForbiddenOrMissing) {
      syncedNote = await createNote({
        ...dataPayload,
        $id: noteId});
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

  const liveAfter = pendingPayloads.get(noteId) || getLiveNoteForSync(noteId);
  const liveRev = revisionOf(liveAfter);
  if (liveRev && flushRevision && liveRev !== flushRevision) {
    pendingById.set(noteId, liveRev);
    markComposeDraft(noteId);
    writePersistedQueue();
    notifyStatusListeners();
    console.log(`[SyncEngine] Re-queued note after concurrent edit: ${noteId}`);
    window.dispatchEvent(new CustomEvent('kylrix:sync-pending', { detail: { noteId } }));
  } else {
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
    scheduleDemandFlush();
  },

  flushImmediately() {
    scheduleDemandFlush({ immediate: true });
  },

  getLastPullAt() {
    return lastPullAt;
  },

  markPullComplete(at = Date.now()) {
    lastPullAt = at;
  },

  /**
   * Signal-driven freshness pull when an object detail or surface is opened.
   * Background engine fetch — zero UI overhead. Replaces local copy only if un-pending and remote differs.
   */
  requestObjectFreshness(kind: 'note' | 'goal' | 'workspace' | 'flows', id?: string, onRefreshed?: (item: any) => void) {
    if (kind === 'flows') {
      void (async () => {
        try {
          const { pullAndSyncUserFlowInstalls } = await import('@/lib/flows/installed');
          const synced = await pullAndSyncUserFlowInstalls();
          if (onRefreshed) onRefreshed(synced);

          // Background: check for community flow step updates
          const { checkFlowUpdatesSecure } = await import('@/lib/actions/secure-ops/flows');
          const result = await checkFlowUpdatesSecure().catch(() => null);
          if (result?.success && Object.keys(result.updates ?? {}).length > 0) {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('kylrix:flows-updated', {
                detail: { updates: result.updates },
              }));
            }
          }
        } catch {
          // Quiet background freshness failure
        }
      })();
      return;
    }

    const targetId = String(id || '').trim();
    if (!targetId || targetId.startsWith('live-') || targetId.startsWith('ghost-')) return;
    if (this.isPending(targetId)) return;

    void (async () => {
      try {
        if (kind === 'note') {
          const { getNote } = await import('@/lib/appwrite');
          const remote = await getNote(targetId).catch(() => null);
          if (remote && !this.isPending(targetId)) {
            if (onRefreshed) onRefreshed(remote);
          }
        } else if (kind === 'goal') {
          const { tasks: taskApi } = await import('@/lib/kylrixflow');
          const { mapAppwriteTaskToTask } = await import('@/context/TaskContext');
          const remoteDoc = await taskApi.get(targetId).catch(() => null);
          if (remoteDoc && !this.isPending(targetId)) {
            const mapped = mapAppwriteTaskToTask(remoteDoc);
            if (onRefreshed) onRefreshed(mapped);
          }
        }
      } catch {
        // Quiet background freshness failure — keep local copy intact
      }
    })();
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
  markPending(noteId: string, revision?: string | null, payload?: any) {
    const rawId = String(noteId || '').trim();
    if (!rawId) return;
    const rev = String(revision || Date.now()).trim() || String(Date.now());

    let id = rawId;
    if (!parseGoalPendingKey(rawId) && getLiveGoalForSync(rawId)) {
      id = goalPendingKey(rawId);
    }

    pendingById.set(id, rev);
    if (payload) {
      pendingPayloads.set(id, payload);
      pendingPayloads.set(rawId, payload);
    }

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
    pendingPayloads.delete(id);
    const goalId = parseGoalPendingKey(id);
    if (goalId) {
      pendingPayloads.delete(goalId);
    }
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

    if (pendingById.size === 0) return;

    const { hasAuthSessionHint, getCurrentUserSnapshot } = await import('@/lib/appwrite');
    const hasSession = hasAuthSessionHint();
    const activeUser = getCurrentUserSnapshot();
    const activeUserId = activeUser?.$id || null;

    if (!hasSession && !activeUserId) {
      // No account — unpaid work stays amber locally until claim/login.
      return;
    }

    isSyncing = true;

    try {
      const pendingIds = Array.from(pendingById.keys());
      console.log(`[SyncEngine] Demand flush. ${pendingIds.length} pending live row(s).`);

      const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
      const db = await getRxDB().catch(() => null);

      const tasksToFlush = pendingIds.filter((pendingId) => {
        if (
          pendingId.startsWith('form:') ||
          pendingId.startsWith('tag:')
        ) {
          return false;
        }
        if (!pendingById.has(pendingId)) return false;
        const failInfo = failedSyncAttempts.get(pendingId);
        if (failInfo) {
          const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(1.5, failInfo.count));
          if (Date.now() - failInfo.lastFailedAt < delay) return false;
        }
        return true;
      });

      if (tasksToFlush.length > 0) {
        await Promise.allSettled(
          tasksToFlush.map(async (pendingId) => {
            const queuedRevision = pendingById.get(pendingId) || '';
            try {
              let goalId = parseGoalPendingKey(pendingId);
              if (!goalId) {
                // Runtime rescue: payload/cache shaped like a goal → flush as goal, not note.
                const payload = pendingPayloads.get(pendingId);
                const looksLikeGoal =
                  !!payload &&
                  typeof payload === 'object' &&
                  !!(payload as any).status &&
                  !!(payload as any).priority &&
                  !(payload as any).content;
                if (looksLikeGoal || getLiveGoalForSync(pendingId)) {
                  goalId = pendingId;
                  const namespaced = goalPendingKey(pendingId);
                  if (namespaced !== pendingId) {
                    pendingById.set(namespaced, queuedRevision);
                    pendingById.delete(pendingId);
                    if (payload) {
                      pendingPayloads.set(namespaced, payload);
                    }
                    await flushGoalPending(namespaced, goalId, queuedRevision, db, activeUserId);
                    return;
                  }
                }
              }
              if (pendingId.startsWith('event:')) {
                const eventId = pendingId.replace(/^event:/, '');
                await flushEventPending(pendingId, eventId, queuedRevision, db, activeUserId);
              } else if (goalId) {
                await flushGoalPending(pendingId, goalId, queuedRevision, db, activeUserId);
              } else {
                await flushNotePending(pendingId, queuedRevision, db, activeUserId);
              }
            } catch (err: any) {
              console.error(`[SyncEngine] Sync failed for item ${pendingId}:`, err);
              const prev = failedSyncAttempts.get(pendingId) || { count: 0, lastFailedAt: 0 };
              failedSyncAttempts.set(pendingId, { count: prev.count + 1, lastFailedAt: Date.now() });
              notifyStatusListeners();
            }
          })
        );
      }
    } catch (error) {
      console.error('[SyncEngine] Autonomic sync error:', error);
    } finally {
      isSyncing = false;
      // Demand-only retry: if flushable work remains, back off. Never spin at 0ms.
      const hasFlushable = Array.from(pendingById.keys()).some(
        (id) =>
          !id.startsWith('form:') &&
          !id.startsWith('tag:'),
      );
      const shouldFlushAgain = flushQueuedDuringSync || hasFlushable;
      flushQueuedDuringSync = false;
      if (shouldFlushAgain && hasFlushable) {
        scheduleDemandFlush({ retry: true });
      }
    }
  },
};
