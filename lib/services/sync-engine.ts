'use client';

import { markNotePersistedRemote, markComposePersisted, markComposeDraft } from '@/lib/notes/compose-draft-registry';
import { getLiveNoteForSync, getLiveGoalForSync, getLiveEventForSync } from '@/lib/sync/pending-sync-bridge';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { isDogfoodSafetyActive } from '@/lib/deployment/surface';
import { parseGoalPendingKey, goalPendingKey } from '@/lib/sync/goal-keys';
import { pickGoalAutosavePayload } from '@/lib/goals/pick-goal-autosave-payload';
import {
  upsertVaultItemTurso,
  upsertTotpSecretTurso,
  upsertFormTurso,
  upsertGoalTurso,
  upsertEventTurso,
  upsertNoteTurso,
} from '@/lib/actions/turso-ops';


const PENDING_QUEUE_KEY = 'kylrix:sync:pending-queue';
const PENDING_PAYLOADS_KEY = 'kylrix:sync:pending-payloads';

const pendingById = new Map<string, string>();
const pendingPayloads = new Map<string, any>();
const statusListeners = new Set<() => void>();
const failedSyncAttempts = new Map<string, { count: number; lastFailedAt: number }>();

let globalIntensity = 0;
let lastKeystrokeTime = 0;
let lastPullAt = 0;
let syncTimeout: NodeJS.Timeout | null = null;
let retryTimeout: NodeJS.Timeout | null = null;
let isSyncing = false;
let flushQueuedDuringSync = false;
let persistWriteChain: Promise<void> = Promise.resolve();
let firstPendingTimestamp: number | null = null;

const FLUSH_TYPING_DEBOUNCE_MS = 150;
const FLUSH_DISCRETE_MS = 0;
const HARD_CEILING_MS = 500;
const RETRY_BASE_MS = 100;
const RETRY_MAX_MS = 1_500;

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
        timestamp: Date.now(),
      });
      await db.cache.upsert({
        id: PENDING_PAYLOADS_KEY,
        data: payloads,
        timestamp: Date.now(),
      });
    } catch {}
  });
}

function maxFailedAttempts(): number {
  let max = 0;
  failedSyncAttempts.forEach((info) => {
    if (info.count > max) max = info.count;
  });
  return max;
}

function scheduleDemandFlush(opts?: { immediate?: boolean; retry?: boolean; discrete?: boolean; activeEditing?: boolean }) {
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
    const backoff = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(1.4, maxFailedAttempts()));
    retryTimeout = setTimeout(() => {
      retryTimeout = null;
      void autonomicSyncEngine.runCycle();
    }, backoff);
    return;
  }

  const now = Date.now();
  const isActivelyEditing = opts?.activeEditing || (now - lastKeystrokeTime < 1500);
  const delay = opts?.discrete ? FLUSH_DISCRETE_MS : (isActivelyEditing ? FLUSH_TYPING_DEBOUNCE_MS : FLUSH_DISCRETE_MS);

  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncTimeout = null;
    void autonomicSyncEngine.runCycle();
  }, delay);
}

function triggerAutonomicSyncScheduler(opts?: { activeEditing?: boolean }) {
  scheduleDemandFlush(opts);
}

function goalRevisionOf(task: any): string {
  if (!task) return '';
  const u = task.updatedAt;
  if (!u) return '';
  try {
    if (typeof u === 'string') return u.trim();
    return String(u ?? '').trim();
  } catch {
    return '';
  }
}

function getRelatedKeys(rawId: string): string[] {
  const clean = String(rawId || '').trim();
  if (!clean) return [];
  const keys = new Set<string>([clean]);
  if (clean.includes(':')) {
    const parts = clean.split(':');
    if (parts[1]) keys.add(parts[1]);
  } else {
    keys.add(`cred:${clean}`);
    keys.add(`totp:${clean}`);
    keys.add(`form:${clean}`);
    keys.add(`event:${clean}`);
    keys.add(goalPendingKey(clean));
  }
  return Array.from(keys);
}

async function flushCredentialPending(
  pendingKey: string,
  credId: string,
  queuedRevision: string,
  db: any,
  activeUserId: string | null
) {
  let payload = pendingPayloads.get(pendingKey) || pendingPayloads.get(credId);

  if (!payload && db) {
    try {
      const doc = await db.cache.findOne(`cred_${credId}`).exec();
      payload = doc?.data || null;
    } catch {
      payload = null;
    }
  }

  if (!payload || !activeUserId) {
    const prev = failedSyncAttempts.get(pendingKey) || { count: 0, lastFailedAt: 0 };
    failedSyncAttempts.set(pendingKey, { count: prev.count + 1, lastFailedAt: Date.now() });
    notifyStatusListeners();
    return;
  }

  const flushRevision = queuedRevision;

  try {
    const res = await upsertVaultItemTurso({ ...payload, id: credId, userId: activeUserId });
    if (!res?.success) {
      if (res?.error && (res.error.includes('401') || res.error.toLowerCase().includes('unauthorized'))) {
        console.warn('[sync-engine] Vault mutation unauthenticated (401), canceling pending retry:', credId);
        autonomicSyncEngine.cancelPending(pendingKey);
        autonomicSyncEngine.cancelPending(credId);
        return;
      }
      throw new Error(res?.error || 'upsertVaultItemTurso failed');
    }
    failedSyncAttempts.delete(pendingKey);
    failedSyncAttempts.delete(credId);
    autonomicSyncEngine.ack(pendingKey, flushRevision);
    autonomicSyncEngine.ack(credId, flushRevision);
  } catch (err: any) {
    if (err?.message && (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized'))) {
      console.warn('[sync-engine] Vault mutation unauthenticated (401), canceling pending retry:', credId);
      autonomicSyncEngine.cancelPending(pendingKey);
      autonomicSyncEngine.cancelPending(credId);
      return;
    }
    const prev = failedSyncAttempts.get(pendingKey) || { count: 0, lastFailedAt: 0 };
    failedSyncAttempts.set(pendingKey, { count: prev.count + 1, lastFailedAt: Date.now() });
    notifyStatusListeners();
  }
}

async function flushTotpPending(
  pendingKey: string,
  totpId: string,
  queuedRevision: string,
  db: any,
  activeUserId: string | null
) {
  let payload = pendingPayloads.get(pendingKey) || pendingPayloads.get(totpId);

  if (!payload && db) {
    try {
      const doc = await db.cache.findOne(`totp_${totpId}`).exec();
      payload = doc?.data || null;
    } catch {
      payload = null;
    }
  }

  if (!payload || !activeUserId) {
    const prev = failedSyncAttempts.get(pendingKey) || { count: 0, lastFailedAt: 0 };
    failedSyncAttempts.set(pendingKey, { count: prev.count + 1, lastFailedAt: Date.now() });
    notifyStatusListeners();
    return;
  }

  const flushRevision = queuedRevision;

  try {
    const res = await upsertTotpSecretTurso({ ...payload, id: totpId, userId: activeUserId });
    if (!res?.success) {
      if (res?.error && (res.error.includes('401') || res.error.toLowerCase().includes('unauthorized'))) {
        console.warn('[sync-engine] TOTP mutation unauthenticated (401), canceling pending retry:', totpId);
        autonomicSyncEngine.cancelPending(pendingKey);
        autonomicSyncEngine.cancelPending(totpId);
        return;
      }
      throw new Error(res?.error || 'upsertTotpSecretTurso failed');
    }
    failedSyncAttempts.delete(pendingKey);
    failedSyncAttempts.delete(totpId);
    autonomicSyncEngine.ack(pendingKey, flushRevision);
    autonomicSyncEngine.ack(totpId, flushRevision);
  } catch (err: any) {
    if (err?.message && (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized'))) {
      console.warn('[sync-engine] TOTP mutation unauthenticated (401), canceling pending retry:', totpId);
      autonomicSyncEngine.cancelPending(pendingKey);
      autonomicSyncEngine.cancelPending(totpId);
      return;
    }
    const prev = failedSyncAttempts.get(pendingKey) || { count: 0, lastFailedAt: 0 };
    failedSyncAttempts.set(pendingKey, { count: prev.count + 1, lastFailedAt: Date.now() });
    notifyStatusListeners();
  }
}

async function flushFormPending(
  pendingKey: string,
  formId: string,
  queuedRevision: string,
  db: any,
  activeUserId: string | null
) {
  let payload = pendingPayloads.get(pendingKey) || pendingPayloads.get(formId);

  if (!payload && db) {
    try {
      const doc = await db.cache.findOne(`form_${formId}`).exec();
      payload = doc?.data || null;
    } catch {
      payload = null;
    }
  }

  if (!payload || !activeUserId) {
    const prev = failedSyncAttempts.get(pendingKey) || { count: 0, lastFailedAt: 0 };
    failedSyncAttempts.set(pendingKey, { count: prev.count + 1, lastFailedAt: Date.now() });
    notifyStatusListeners();
    return;
  }

  const flushRevision = queuedRevision;

  try {
    const res = await upsertFormTurso({ ...payload, id: formId, userId: activeUserId });
    if (!res?.success) {
      if (res?.error && (res.error.includes('401') || res.error.toLowerCase().includes('unauthorized'))) {
        console.warn('[sync-engine] Form mutation unauthenticated (401), canceling pending retry:', formId);
        autonomicSyncEngine.cancelPending(pendingKey);
        autonomicSyncEngine.cancelPending(formId);
        return;
      }
      throw new Error(res?.error || 'upsertFormTurso failed');
    }
    failedSyncAttempts.delete(pendingKey);
    failedSyncAttempts.delete(formId);
    autonomicSyncEngine.ack(pendingKey, flushRevision);
    autonomicSyncEngine.ack(formId, flushRevision);
  } catch (err: any) {
    if (err?.message && (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized'))) {
      console.warn('[sync-engine] Form mutation unauthenticated (401), canceling pending retry:', formId);
      autonomicSyncEngine.cancelPending(pendingKey);
      autonomicSyncEngine.cancelPending(formId);
      return;
    }
    const prev = failedSyncAttempts.get(pendingKey) || { count: 0, lastFailedAt: 0 };
    failedSyncAttempts.set(pendingKey, { count: prev.count + 1, lastFailedAt: Date.now() });
    notifyStatusListeners();
  }
}

async function flushGoalPending(
  pendingKey: string,
  goalId: string,
  queuedRevision: string,
  db: any,
  activeUserId: string | null
) {
  let payload = pendingPayloads.get(pendingKey) || pendingPayloads.get(goalId) || getLiveGoalForSync(goalId);

  if (!payload && db) {
    try {
      const doc = await db.cache.findOne(`goal_${goalId}`).exec();
      payload = doc?.data || null;
    } catch {
      payload = null;
    }
  }

  if (!payload || !activeUserId) {
    const prev = failedSyncAttempts.get(pendingKey) || { count: 0, lastFailedAt: 0 };
    failedSyncAttempts.set(pendingKey, { count: prev.count + 1, lastFailedAt: Date.now() });
    notifyStatusListeners();
    return;
  }

  const dataPayload: any = {
    ...pickGoalAutosavePayload(payload),
    userId: activeUserId,
  };
  if (!String(dataPayload.title || '').trim()) {
    dataPayload.title = String(dataPayload.description || '').trim().slice(0, 32) || 'Untitled Goal';
  }

  const flushRevision = goalRevisionOf(payload) || queuedRevision;

  try {
    const res = await upsertGoalTurso({ ...(dataPayload as any), id: goalId, userId: activeUserId, title: dataPayload.title });
    if (!res?.success) {
      if (res?.error && (res.error.includes('401') || res.error.toLowerCase().includes('unauthorized'))) {
        console.warn('[sync-engine] Goal mutation unauthenticated (401), canceling pending retry:', goalId);
        autonomicSyncEngine.cancelPending(pendingKey);
        autonomicSyncEngine.cancelPending(goalId);
        return;
      }
      throw new Error(res?.error || 'upsertGoalTurso failed');
    }
    failedSyncAttempts.delete(pendingKey);
    failedSyncAttempts.delete(goalId);
    autonomicSyncEngine.ack(pendingKey, flushRevision);
    autonomicSyncEngine.ack(goalId, flushRevision);
  } catch (err: any) {
    if (err?.message && (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized'))) {
      console.warn('[sync-engine] Goal mutation unauthenticated (401), canceling pending retry:', goalId);
      autonomicSyncEngine.cancelPending(pendingKey);
      autonomicSyncEngine.cancelPending(goalId);
      return;
    }
    const prev = failedSyncAttempts.get(pendingKey) || { count: 0, lastFailedAt: 0 };
    failedSyncAttempts.set(pendingKey, { count: prev.count + 1, lastFailedAt: Date.now() });
    notifyStatusListeners();
  }
}

async function flushEventPending(
  pendingKey: string,
  eventId: string,
  queuedRevision: string,
  db: any,
  activeUserId: string | null
) {
  let payload = pendingPayloads.get(pendingKey) || pendingPayloads.get(eventId) || getLiveEventForSync(eventId);

  if (!payload && db) {
    try {
      const doc = await db.cache.findOne(`event_${eventId}`).exec();
      payload = doc?.data || null;
    } catch {
      payload = null;
    }
  }

  if (!payload || !activeUserId) {
    const prev = failedSyncAttempts.get(pendingKey) || { count: 0, lastFailedAt: 0 };
    failedSyncAttempts.set(pendingKey, { count: prev.count + 1, lastFailedAt: Date.now() });
    notifyStatusListeners();
    return;
  }

  const flushRevision = queuedRevision;

  try {
    const res = await upsertEventTurso({ ...payload, id: eventId, userId: activeUserId });
    if (!res?.success) {
      if (res?.error && (res.error.includes('401') || res.error.toLowerCase().includes('unauthorized'))) {
        console.warn('[sync-engine] Event mutation unauthenticated (401), canceling pending retry:', eventId);
        autonomicSyncEngine.cancelPending(pendingKey);
        autonomicSyncEngine.cancelPending(eventId);
        return;
      }
      throw new Error(res?.error || 'upsertEventTurso failed');
    }
    failedSyncAttempts.delete(pendingKey);
    failedSyncAttempts.delete(eventId);
    autonomicSyncEngine.ack(pendingKey, flushRevision);
    autonomicSyncEngine.ack(eventId, flushRevision);
  } catch (err: any) {
    if (err?.message && (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized'))) {
      console.warn('[sync-engine] Event mutation unauthenticated (401), canceling pending retry:', eventId);
      autonomicSyncEngine.cancelPending(pendingKey);
      autonomicSyncEngine.cancelPending(eventId);
      return;
    }
    const prev = failedSyncAttempts.get(pendingKey) || { count: 0, lastFailedAt: 0 };
    failedSyncAttempts.set(pendingKey, { count: prev.count + 1, lastFailedAt: Date.now() });
    notifyStatusListeners();
  }
}

async function flushNotePending(
  noteId: string,
  queuedRevision: string,
  db: any,
  activeUserId: string | null
) {
  let payload = pendingPayloads.get(noteId) || getLiveNoteForSync(noteId);

  if (!payload && db) {
    try {
      const doc = await db.cache.findOne(`note_${noteId}`).exec();
      payload = doc?.data || null;
    } catch {
      payload = null;
    }
  }

  if (!payload || !activeUserId) {
    const prev = failedSyncAttempts.get(noteId) || { count: 0, lastFailedAt: 0 };
    failedSyncAttempts.set(noteId, { count: prev.count + 1, lastFailedAt: Date.now() });
    notifyStatusListeners();
    return;
  }

  const flushRevision = queuedRevision;

  try {
    const res = await upsertNoteTurso({ ...payload, id: noteId, userId: activeUserId });
    if (!res?.success) {
      if (res?.error && (res.error.includes('401') || res.error.toLowerCase().includes('unauthorized'))) {
        console.warn('[sync-engine] Note mutation unauthenticated (401), canceling pending retry:', noteId);
        autonomicSyncEngine.cancelPending(noteId);
        return;
      }
      throw new Error(res?.error || 'upsertNoteTurso failed');
    }
    failedSyncAttempts.delete(noteId);
    autonomicSyncEngine.ack(noteId, flushRevision);
  } catch (err: any) {
    if (err?.message && (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized'))) {
      console.warn('[sync-engine] Note mutation unauthenticated (401), canceling pending retry:', noteId);
      autonomicSyncEngine.cancelPending(noteId);
      return;
    }
    const prev = failedSyncAttempts.get(noteId) || { count: 0, lastFailedAt: 0 };
    failedSyncAttempts.set(noteId, { count: prev.count + 1, lastFailedAt: Date.now() });
    notifyStatusListeners();
  }
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

  nudge(discrete = false) {
    scheduleDemandFlush(discrete ? { discrete: true } : {});
  },

  flushImmediately() {
    if (typeof window !== 'undefined') {
      try {
        writePersistedQueue();
      } catch {}
    }
    scheduleDemandFlush({ immediate: true });
  },

  getLastPullAt() {
    return lastPullAt;
  },

  markPullComplete(at = Date.now()) {
    lastPullAt = at;
  },

  requestObjectFreshness(_kind: string, _id?: string, _onRefreshed?: (item: any) => void) {},

  subscribe(listener: () => void) {
    statusListeners.add(listener);
    return () => {
      statusListeners.delete(listener);
    };
  },

  markPending(
    noteId: string,
    revision?: string | null,
    payload?: any,
    opts?: { force?: boolean; discrete?: boolean }
  ) {
    const rawId = String(noteId || '').trim();
    if (!rawId) return;
    const rev = String(revision || Date.now()).trim() || String(Date.now());

    let id = rawId;
    if (!parseGoalPendingKey(rawId) && !rawId.includes(':') && getLiveGoalForSync(rawId)) {
      id = goalPendingKey(rawId);
    }

    if (pendingById.size === 0) {
      firstPendingTimestamp = Date.now();
    }

    pendingById.set(id, rev);
    if (payload) {
      pendingPayloads.set(id, payload);
      pendingPayloads.set(rawId, payload);
      if (rawId.includes(':')) {
        const unPrefixed = rawId.split(':')[1];
        if (unPrefixed) pendingPayloads.set(unPrefixed, payload);
      }
    }

    if (!parseGoalPendingKey(id) && !id.includes(':')) {
      markComposeDraft(id);
    }
    writePersistedQueue();
    notifyStatusListeners();

    const duration = Date.now() - (firstPendingTimestamp || Date.now());
    if (duration >= HARD_CEILING_MS || opts?.force || opts?.discrete) {
      firstPendingTimestamp = Date.now();
      scheduleDemandFlush({ immediate: true });
    } else {
      triggerAutonomicSyncScheduler();
    }
  },

  isPending(noteId?: string | null) {
    const id = String(noteId || '').trim();
    if (!id) return false;
    if (id.startsWith('live-') || id.startsWith('thread-')) return true;
    if (pendingById.has(id)) return true;
    if (pendingById.has(`cred:${id}`)) return true;
    if (pendingById.has(`totp:${id}`)) return true;
    if (pendingById.has(`form:${id}`)) return true;
    if (pendingById.has(`event:${id}`)) return true;
    if (pendingById.has(`tag:${id}`)) return true;
    return pendingById.has(goalPendingKey(id));
  },

  listPendingIds(): string[] {
    return Array.from(pendingById.keys());
  },

  ack(noteId: string, flushedRevision?: string | null) {
    const id = String(noteId || '').trim();
    if (!id) return;
    const queued = pendingById.get(id);
    const flushed = String(flushedRevision || '').trim();
    if (flushed && queued && queued !== flushed) {
      notifyStatusListeners();
      return;
    }
    const cleanPayload = pendingPayloads.get(id) || (parseGoalPendingKey(id) ? pendingPayloads.get(parseGoalPendingKey(id)!) : null);

    const related = getRelatedKeys(id);
    for (const k of related) {
      pendingById.delete(k);
      pendingPayloads.delete(k);
      failedSyncAttempts.delete(k);
    }

    if (cleanPayload) {
      for (const k of related) {
        LocalEngine.snapshotBaseline(k, cleanPayload);
      }
    }
    if (!parseGoalPendingKey(id) && !id.includes(':')) {
      markComposePersisted(id);
      markNotePersistedRemote(id);
    }
    if (pendingById.size === 0) {
      firstPendingTimestamp = null;
    }
    writePersistedQueue();
    notifyStatusListeners();
  },

  markConfirmed(noteOrResourceId: string) {
    const id = String(noteOrResourceId || '').trim();
    if (!id) return;
    this.ack(id);
    this.cancelPending(id);
  },

  cancelPending(noteOrGoalId: string) {
    const id = String(noteOrGoalId || '').trim();
    if (!id) return;
    const related = getRelatedKeys(id);
    for (const k of related) {
      pendingById.delete(k);
      pendingPayloads.delete(k);
      failedSyncAttempts.delete(k);
      LocalEngine.clearBaseline(k);
    }
    if (!parseGoalPendingKey(id) && !id.includes(':')) {
      markComposePersisted(id);
      markNotePersistedRemote(id);
    }
    if (pendingById.size === 0) {
      firstPendingTimestamp = null;
    }
    writePersistedQueue();
    notifyStatusListeners();
  },

  async runCycle() {
    if (isSyncing || isDogfoodSafetyActive()) return;
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    if (pendingById.size === 0) return;

    let activeUserId: string | null = null;
    if (typeof window !== 'undefined') {
      try {
        const { authClient } = await import('@/lib/auth/better-auth-client');
        const sessionRes = await authClient.getSession().catch(() => null);
        if (sessionRes?.data?.user?.id) {
          activeUserId = sessionRes.data.user.id;
        }
      } catch {}
    }

    if (!activeUserId) return;

    isSyncing = true;

    try {
      const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
      const db = await getRxDB().catch(() => null);

      const pendingIds = Array.from(pendingById.keys());
      // Bolt: Flush pending items concurrently with Promise.all to avoid sequential network latency
      await Promise.all(
        pendingIds.map(async (pendingId) => {
          const queuedRevision = pendingById.get(pendingId) || '';
          try {
            if (pendingId.startsWith('cred:')) {
              const rawId = pendingId.replace(/^cred:/, '');
              await flushCredentialPending(pendingId, rawId, queuedRevision, db, activeUserId);
            } else if (pendingId.startsWith('totp:')) {
              const rawId = pendingId.replace(/^totp:/, '');
              await flushTotpPending(pendingId, rawId, queuedRevision, db, activeUserId);
            } else if (pendingId.startsWith('form:')) {
              const rawId = pendingId.replace(/^form:/, '');
              await flushFormPending(pendingId, rawId, queuedRevision, db, activeUserId);
            } else if (pendingId.startsWith('event:')) {
              const rawEventId = pendingId.replace(/^event:/, '');
              await flushEventPending(pendingId, rawEventId, queuedRevision, db, activeUserId);
            } else {
              const goalId = parseGoalPendingKey(pendingId);
              if (goalId) {
                await flushGoalPending(pendingId, goalId, queuedRevision, db, activeUserId);
              } else {
                await flushNotePending(pendingId, queuedRevision, db, activeUserId);
              }
            }
          } catch {}
        })
      );
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403 || String(err?.message || '').includes('401') || String(err?.message || '').toLowerCase().includes('unauthorized')) {
        console.warn('[SyncEngine] Auth failure during flush — pausing retry cycle to prevent log spam.');
        isSyncing = false;
        return;
      }
    } finally {
      isSyncing = false;
      const hasFlushable = pendingById.size > 0;
      if (!hasFlushable) {
        firstPendingTimestamp = null;
      }
      if (flushQueuedDuringSync || hasFlushable) {
        scheduleDemandFlush({ retry: true });
      }
      flushQueuedDuringSync = false;
    }
  },
};
