"use client";


import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode, useMemo } from 'react';
import { 

export function hydrateFromCache(bag: any) {
  const {
  INITIAL_NOTES_CACHE_KEY,
  PAGE_SIZE,
  PINNED_CACHE_KEY,
  _pinnedIds,
  activeComposeNoteIdsRef,
  activeUserId,
  applyNotePin,
  clearLiveNoteGuard,
  composeSyncEpoch,
  context,
  contextValue,
  cursor,
  cursorRef,
  displayTitle,
  effectivePinnedIds,
  error,
  fetchBatch,
  getthreadNotes,
  hasInitiallyFetchedForUserRef,
  hasMore,
  historyRaw,
  hydrateFromCache,
  hydratedUserIdRef,
  isCacheLoaded,
  isFetchingRef,
  isLoading,
  isPinned,
  isUnpersistedComposeDraftLocal,
  isWorkspace,
  lastPullAtRef,
  liveEditGuardsRef,
  loadMore,
  meta,
  migrateDraftNoteId,
  noteOwnerId,
  notes,
  notesRef,
  opportunisticallyDecryptNote,
  pinNote,
  projectId,
  pushLiveNote,
  refetchNotes,
  registerComposeSession,
  removeNote,
  scheduleInvalidateInitialNotesPage,
  seen,
  setComposeSyncEpoch,
  setCursor,
  setError,
  setHasMore,
  setIsCacheLoaded,
  setIsLoading,
  setNotes,
  setPinnedIds,
  setTotalNotes,
  setUnpersistedComposeDraftIds,
  sortedNotes,
  sweepEncryptedNotes,
  totalNotes,
  transferComposeSession,
  unpersistedComposeDraftIds,
  unpinNote,
  unregisterComposeSession,
  upsertNote
  } = bag as any;

      const userId = activeUserId;
      if (hydratedUserIdRef.current !== userId) {
        setNotes([]);
        notesRef.current = [];
        setTotalNotes(0);
        setCursor(null);
        setHasMore(true);
        setIsCacheLoaded(false);
        hydratedUserIdRef.current = userId;
      } else if (isCacheLoaded) {
        return;
      }

      const local = await loadNotesFromLocalCopy({
        userId,
        existingNotes: notesRef.current,
        getCachedDataSync: (key) => getCachedData(key),
        getCachedDataAsync: (key) => getCachedDataAsync(key)});

      if (cancelled) return;

      if (local?.notes?.length) {
        setNotes((prev) => (prev.length ? prev : local.notes));
        setTotalNotes(local.totalNotes || local.notes.length);
        setCursor(local.cursor ?? null);
        setHasMore(local.hasMore ?? true);
        void warmNotesLocalCopy(userId, local.notes);
        console.log('[NotesContext] Instant cold start via local copy cascade.');
      }
      hydratedUserIdRef.current = userId;
      setIsLoading(false);
      setIsCacheLoaded(true);
}
