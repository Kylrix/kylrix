'use client';


export function flushNotePending(bag: any) {
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
    if (prev.count >= 2) {
      pendingById.delete(noteId);
      autonomicSyncEngine.ack(noteId);
      writePersistedQueue();
    }
    return;
  }

  if (activeUserId) {
    const rawUserId = String((payload as any).userId || '').trim();
    const isWorkspaceNote = !!(payload as any).projectId && !!(payload as any).isWorkspace;
    // Workspace notes use isGuest/isGeneral escape hatch + project_objects membership, not strict userId equality (see security.secure-ops-rls-bypass).
    // For workspace notes we always restamp to activeUserId to avoid Forbidden: Cannot create resource for another user (createRowSecure guest fallback).
    if (!rawUserId || rawUserId === 'guest' || rawUserId === 'thread' || isWorkspaceNote) {
      if (rawUserId !== activeUserId) {
        (payload as any).userId = activeUserId;
        if ((payload as any).creatorId && (payload as any).creatorId !== activeUserId && ((payload as any).creatorId === 'guest' || (payload as any).creatorId === 'thread')) {
          (payload as any).creatorId = activeUserId;
        }
        if (db) {
          await db.cache.upsert({
            id: `note_${noteId}`,
            data: payload as any,
            timestamp: Date.now()
          }).catch(() => {});
        }
      }
    } else if (rawUserId !== activeUserId) {
      console.warn(`[SyncEngine] Skipped note belonging to different user: ${rawUserId}`);
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

      // On initial creation sync, if item belongs to a custom workspace, guarantee project_objects registration
      const targetProjectId = (payload as any)?.projectId;
      const isWs = (payload as any)?.isWorkspace;
      if (targetProjectId && targetProjectId !== activeUserId && isWs) {
        try {
          const { attachObjectToProject } = await import('@/lib/projects/object-attachment');
          await attachObjectToProject({
            projectId: targetProjectId,
            entityKind: 'note',
            entityId: noteId,
          });
          console.log(`[SyncEngine] Attached new note ${noteId} to project_objects for ${targetProjectId}`);
        } catch (attachErr) {
          console.warn('[SyncEngine] Failed to attach note to project_objects on initial sync:', attachErr);
        }
      }
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
