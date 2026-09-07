"use client";


import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode, useMemo } from 'react';
import { 

export function normalizeVisibility(bag: any) {
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
  hasInitiallyFetchedForUserRef,
  hasMore,
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
  mergeFetchedNotesWithLocalDrafts,
  meta,
  migrateDraftNoteId,
  normalizeVisibility,
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

  const meta = (() => {
    try {
      return typeof note.metadata === 'string' ? JSON.parse(note.metadata) : (note.metadata || {});
    } catch {
      return {};
    }
  })();
  // Prefer real DB projectId; fall back to metadata for local drafts
  const projectId = (note as any).projectId || meta.projectId || undefined;
  // Respect DB/metadata isWorkspace flag or fallback to presence of projectId
  const isWorkspace = note.isWorkspace === true || meta.isWorkspace === true || Boolean(projectId);
  return {
    ...note,
    isPublic: getNotePublicState(note),
    projectId,
    isWorkspace,
  } as Notes;
}
