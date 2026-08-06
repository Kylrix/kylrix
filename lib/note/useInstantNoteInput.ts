'use client';

import { useCallback, useRef } from 'react';
import { useNotes } from '@/context/NotesContext';
import { useDataNexus } from '@/context/DataNexusContext';
import type { Notes } from '@/types/appwrite';

/**
 * Hardcore instant input hook — flow.realtime-input-rxdb-sync
 * - Direct onChange interception, synchronous LocalEngine dispatch
 * - Uncontrolled via refs so React scheduler never drops keystrokes (scorched-earth proof)
 * - Remote sync decoupled (only on close / visibility / ceiling)
 */
export function useInstantNoteInput(noteId: string | undefined, readOnly = false) {
  const { pushLiveNote } = useNotes();
  const { setCachedData } = useDataNexus();
  const lastEditAtRef = useRef(0);
  const noteIdRef = useRef(noteId);
  // Keep noteId fresh without violating refs-during-render
  const syncNoteId = () => { noteIdRef.current = noteId; };

  // Mark dirty for sync-engine guard — nudge engine immediately so create doesn't sit 10min pending
  const markDirty = useCallback((next: Partial<Notes>) => {
    syncNoteId();
    if (!noteIdRef.current || readOnly) return;
    lastEditAtRef.current = Date.now();
    const draft: Notes = {
      ...(next as Notes),
      $id: noteIdRef.current,
      $updatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Notes;
    // Synchronous local dispatch — no useEffect queue
    pushLiveNote(draft, { pending: true } as any);
    void setCachedData(`note_${noteIdRef.current}`, draft);
    // Ensure sync engine coalesced flush actually schedules (scorched-earth still needs engine nudge)
    void import('@/lib/services/sync-engine').then(({ autonomicSyncEngine }) => autonomicSyncEngine.nudge()).catch(() => {});
  }, [pushLiveNote, setCachedData, readOnly]);

  const getLastEditAt = useCallback(() => lastEditAtRef.current, []);

  // Allow parent to seed without triggering dirty
  const resetEditClock = useCallback(() => { lastEditAtRef.current = 0; }, []);

  return { markDirty, getLastEditAt, resetEditClock, lastEditAtRef };
}
