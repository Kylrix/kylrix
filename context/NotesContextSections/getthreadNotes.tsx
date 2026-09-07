"use client";


import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode, useMemo } from 'react';
import { 

export function getthreadNotes(bag: any) {
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

  if (typeof window === 'undefined') return [];
  const historyRaw = localStorage.getItem('kylrix_thread_notes_v2');
  if (!historyRaw) return [];
  try {
    const history = JSON.parse(historyRaw);
    if (!Array.isArray(history)) return [];
    const { decryptThreadData } = await import('@/lib/encryption/thread-crypto');
    const mapped = await Promise.all(history.map(async (item: any) => {
      const meta = (() => {
        try { return JSON.parse(item.metadata || '{}'); } catch { return {}; }
      })();
      const kind = meta?.send_object?.kind || 'note';
      if (kind !== 'note' || meta?._deleted === true) return null;

      let decryptedTitle = item.title;
      let decryptedContent = item.content || '';
      if (item.decryptionKey) {
        try {
          decryptedTitle = await decryptThreadData(item.title, item.decryptionKey);
          decryptedContent = await decryptThreadData(item.content || '', item.decryptionKey);
        } catch (e) {
          console.error('Failed to decrypt thread note in getthreadNotes:', e);
        }
      }
      return {
        $id: item.id,
        $createdAt: item.createdAt,
        $updatedAt: item.createdAt,
        title: decryptedTitle,
        content: decryptedContent,
        format: 'text',
        tags: [],
        userId: 'thread',
        isPublic: false,
        isGuest: false,
        metadata: item.metadata || '{}',
      };
    }));
    return mapped.filter(Boolean) as any as Notes[];
  } catch (e) {
    console.error('Failed to parse thread history in getthreadNotes', e);
    return [];
  }
}
