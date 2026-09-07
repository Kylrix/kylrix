'use client';


export function flushGoalPending(bag: any) {
  const {
  dataPayload,
  delay,
  flushGoalPending,
  flushNotePending,
  flushRevision,
  handleUserActivity,
  liveAfter,
  liveRev,
  now,
  queuedAfter,
  t
  } = bag as any;

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
    if (prev.count >= 2) {
      pendingById.delete(pendingKey);
      pendingById.delete(goalId);
      autonomicSyncEngine.ack(pendingKey);
      autonomicSyncEngine.ack(goalId);
      writePersistedQueue();
    }
    return;
  }

  if (activeUserId) {
    const payloadAny = payload as any;
    const rawUserId = String(payloadAny.userId || '').trim();
    const isWorkspaceGoal = !!payloadAny.projectId && !!payloadAny.isWorkspace;
    if (!rawUserId || rawUserId === 'guest' || rawUserId === 'thread' || isWorkspaceGoal) {
      if (rawUserId !== activeUserId) payloadAny.userId = activeUserId;
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
    } else if (rawUserId !== activeUserId) {
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
  const { createGoal, updateGoal } = await import('@/lib/actions/client-ops');

  let synced: any;
  try {
    synced = await updateGoal(goalId, dataPayload);
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
      synced = await createGoal({
        ...(dataPayload as any),
        $id: goalId,
      });

      const targetProjectId = (payload as any)?.projectId;
      const isWs = (payload as any)?.isWorkspace;
      if (targetProjectId && targetProjectId !== activeUserId && isWs) {
        try {
          const { attachObjectToProject } = await import('@/lib/projects/object-attachment');
          await attachObjectToProject({
            projectId: targetProjectId,
            entityKind: 'goal',
            entityId: goalId,
          });
          console.log(`[SyncEngine] Attached new goal ${goalId} to project_objects for ${targetProjectId}`);
        } catch (attachErr) {
          console.warn('[SyncEngine] Failed to attach goal to project_objects on initial sync:', attachErr);
        }
      }
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
          userId: payload.creatorId || activeUserId,
          creatorId: payload.creatorId || activeUserId,
          updatedAt: new Date(synced.$updatedAt || Date.now())},
        timestamp: Date.now(),
      })
      .catch(() => {});
  }

  // Ack against the *queue* revision, not live updatedAt.
  // Goal realtime / UPDATE_TASK used to stamp `new Date()` and permanently
  // re-queue successful flushes (ideas guard live edits; goals did not).
  const queuedAfter = pendingById.get(pendingKey) || pendingById.get(goalId) || '';
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
    autonomicSyncEngine.ack(goalId, flushRevision);
    window.dispatchEvent(
      new CustomEvent('kylrix:sync-complete', {
        detail: { noteId: pendingKey, goalId, syncedGoal: synced, revision: flushRevision, kind: 'goal' },
      }),
    );
  }
  console.log(`[SyncEngine] Successfully synced goal: ${goalId}`);
}
