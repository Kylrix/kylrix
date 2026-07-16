'use client';

import { isUnpersistedComposeDraft, markNotePersistedRemote } from '@/lib/notes/compose-draft-registry';
import { updateNote, createNote } from '@/lib/actions/client-ops';
import { getNote, getNotePublicState } from '@/lib/appwrite';
import type { Notes } from '@/types/appwrite';

// Global user activity tracking properties
let globalIntensity = 0;
let lastKeystrokeTime = 0;
let syncTimeout: NodeJS.Timeout | null = null;
let isSyncing = false;

// Dynamic listener registries
const activityListeners = new Set<(intensity: number) => void>();

/**
 * Global User Activity Intensity Tracker
 * Detects keyup/keydown events globally to compute real-time user intensity.
 */
if (typeof window !== 'undefined') {
  const handleUserActivity = (e: Event) => {
    const now = Date.now();
    
    // Keystroke frequency calculation
    if (e.type === 'keydown' || e.type === 'input') {
      const delta = now - lastKeystrokeTime;
      lastKeystrokeTime = now;

      if (delta < 250) {
        // High activity rate: rapid typing
        globalIntensity = Math.min(10, globalIntensity + 2);
      } else if (delta < 1000) {
        // Moderate typing
        globalIntensity = Math.min(10, globalIntensity + 0.5);
      } else {
        // Single strokes or reading transitions
        globalIntensity = Math.max(0.5, globalIntensity - 1);
      }
    } else {
      // General movement or scroll events - keep min active level
      globalIntensity = Math.max(0.2, globalIntensity - 0.2);
    }

    // Notify listeners
    activityListeners.forEach((l) => l(globalIntensity));

    // Intensity-aware Sync scheduler
    triggerAutonomicSyncScheduler();
  };

  window.addEventListener('keydown', handleUserActivity, { passive: true });
  window.addEventListener('input', handleUserActivity, { passive: true });
  window.addEventListener('scroll', handleUserActivity, { passive: true });
  window.addEventListener('click', handleUserActivity, { passive: true });
}

function triggerAutonomicSyncScheduler() {
  if (syncTimeout) clearTimeout(syncTimeout);
  if (isSyncing) return;

  // Compute wait duration dynamically based on activity intensity
  // Highly intense typing -> check draft buffer every 4 seconds
  // Mild/idle states -> check draft buffer every 12 seconds
  const waitDuration = globalIntensity >= 5 ? 4000 : 12000;

  syncTimeout = setTimeout(() => {
    void autonomicSyncEngine.runCycle();
  }, waitDuration);
}

/**
 * Autonomous Sync Engine
 * Scans offline state layers, filters out invalid drafts, and pushes them to Appwrite.
 */
export const autonomicSyncEngine = {
  /**
   * Subscribe to global activity intensity changes
   */
  subscribeToActivity(callback: (intensity: number) => void) {
    activityListeners.add(callback);
    return () => {
      activityListeners.delete(callback);
    };
  },

  /**
   * Grab current global activity intensity
   */
  getActivityIntensity() {
    return globalIntensity;
  },

  /**
   * Scan and sync unpersisted compose drafts securely
   */
  async runCycle() {
    if (isSyncing) return;
    isSyncing = true;

    try {
      // Retrieve the current data cache and drafts registry
      const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
      const db = await getRxDB();
      const allCachedDocs = await db.cache.find().exec();

      // Find draft items prefix (e.g. note_)
      const draftsToSync = allCachedDocs.filter((doc) => {
        const id = doc.id;
        if (!id.startsWith('note_')) return false;
        const noteId = id.replace('note_', '');
        return isUnpersistedComposeDraft(noteId);
      });

      if (draftsToSync.length === 0) return;

      console.log(`[SyncEngine] Spun up. Found ${draftsToSync.length} drafts to sync.`);

      for (const doc of draftsToSync) {
        const noteId = doc.id.replace('note_', '');
        const payload = doc.data as Notes;

        // Extra verification schema check to prevent data corruption
        if (!payload.content || payload.content.trim() === '') {
          console.warn(`[SyncEngine] Ignored empty draft: ${noteId}`);
          continue;
        }

        try {
          // Check if remote row already exists
          let remoteNote: Notes | null = null;
          try {
            remoteNote = await getNote(noteId);
          } catch {
            // Note doesn't exist on server yet
          }

          let syncedNote: Notes;
          const isPublic = getNotePublicState(payload);

          const dataPayload = {
            title: payload.title || '',
            content: payload.content || '',
            tags: payload.tags || [],
            format: 'text',
            isPublic,
            isGuest: !!payload.isGuest,
          };

          if (remoteNote) {
            // Update existing remote note
            syncedNote = await updateNote(noteId, dataPayload);
          } else {
            // Create a new remote note with matching client-allocated ID
            syncedNote = await createNote({
              ...dataPayload,
              $id: noteId,
            });
          }

          markNotePersistedRemote(noteId);
          console.log(`[SyncEngine] Successfully synced note: ${noteId}`);

          // Update cached timestamp to match server
          await db.cache.upsert({
            id: doc.id,
            data: syncedNote as any,
            timestamp: Date.now(),
          });

          // Dispatch event to notify listeners (e.g. NoteCard dot color updates)
          window.dispatchEvent(new CustomEvent('kylrix:sync-complete', {
            detail: { noteId }
          }));

        } catch (err) {
          console.error(`[SyncEngine] Sync failed for item ${noteId}:`, err);
          // Isolated: failed draft stays local to prevent halting other synchronizations
        }
      }
    } catch (error) {
      console.error('[SyncEngine] Autonomic sync error:', error);
    } finally {
      isSyncing = false;
      triggerAutonomicSyncScheduler();
    }
  }
};
