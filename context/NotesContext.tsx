"use client";


import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode, useMemo } from 'react';
import { 
  listNotesPaginated,
  updateNote,
  realtime,
  APPWRITE_DATABASE_ID,
  getNotePublicState,
  decryptPublicEncryptedNote,
  getCurrentUserSnapshot,
} from '@/lib/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import type { Notes } from '@/types/appwrite';
import { useAuth } from '@/context/auth/AuthContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { isExcludedNote } from '@/lib/appwrite/note';
import { useDataNexus } from './DataNexusContext';
import { useResourcePins } from '@/context/ResourcePinContext';
import { resolveNoteCardTitle } from '@/constants/noteTitle';
import {
  markComposeDraft,
  markComposePersisted,
  isUnpersistedComposeDraft,
  markNotePersistedRemote} from '@/lib/notes/compose-draft-registry';
import {
  mergeServerPageWithLocalCopy,
  sortPinnedThenCreatedAt,
  shouldSoftPull} from '@/lib/sync/local-copy-sync';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { registerLiveNoteGetter } from '@/lib/sync/pending-sync-bridge';
import { loadNotesFromLocalCopy, warmNotesLocalCopy } from '@/lib/notes/load-local-notes';
import { subscribeLocalSoftRefresh } from '@/lib/sync/local-soft-refresh';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useWorkspaceFilteredItems } from '@/hooks/useWorkspaceFilteredItems';

type LiveEditGuard = {
  title: string;
  content: string;
  tags: string[];
  at: number;
};


;

function mergeFetchedNotesWithLocalDrafts(
  serverBatch: Notes[],
  localNotes: Notes[],
  guards: Map<string, LiveEditGuard>,
  deletedIds?: Set<string>,
): Notes[] {
  return mergeServerPageWithLocalCopy<Notes>({
    serverBatch,
    localNotes,
    guards,
    deletedIds,
    normalize: normalizeVisibility,
    applyGuard: (serverNote, guard) =>
      mergeServerWithLiveGuard(serverNote, {
        title: guard.title || '',
        content: guard.content || '',
        tags: Array.isArray(guard.tags) ? guard.tags : [],
        at: guard.at || Date.now()}),
  });
}

function dedupeNotesById(rows: Notes[]): Notes[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!row.$id || seen.has(row.$id)) return false;
    seen.add(row.$id);
    return true;
  });
}

function mergeServerWithLiveGuard(serverNote: Notes, guard: LiveEditGuard): Notes {
  const displayTitle = resolveNoteCardTitle(guard.title, guard.content) || serverNote.title || '';
  return normalizeVisibility({
    ...serverNote,
    title: displayTitle,
    content: guard.content,
    tags: guard.tags.length ? guard.tags : serverNote.tags});
}

interface NotesContextType {
  notes: Notes[];
  totalNotes: number;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetchNotes: () => void;
  upsertNote: (note: Notes) => void;
  /** Live-copy upsert. `pending: false` = already remote / hydrate (no amber). Default enqueues engine flush. */
  pushLiveNote: (note: Notes, options?: { pending?: boolean }) => void;
  registerComposeSession: (noteId: string) => void;
  unregisterComposeSession: (noteId: string) => void;
  clearLiveNoteGuard: (noteId: string) => void;
  removeNote: (noteId: string) => void;
  migrateDraftNoteId: (ephemeralId: string, savedId: string) => void;
  /** Bumps when compose draft set changes — create lifecycle UI (not the sync dot). */
  composeSyncEpoch: number;
  pinnedIds: string[];
  pinNote: (noteId: string) => Promise<void>;
  unpinNote: (noteId: string) => Promise<void>;
  isPinned: (noteId: string) => boolean;
  isUnpersistedComposeDraft: (noteId?: string | null) => boolean;
}

const NotesContext = createContext<NotesContextType>({
  notes: [],
  totalNotes: 0,
  isLoading: false,
  error: null,
  hasMore: false,
  loadMore: async () => {},
  refetchNotes: () => {},
  upsertNote: () => {},
  pushLiveNote: () => {},
  registerComposeSession: () => {},
  unregisterComposeSession: () => {},
  clearLiveNoteGuard: () => {},
  removeNote: () => {},
  migrateDraftNoteId: () => {},
  composeSyncEpoch: 0,
  pinnedIds: [],
  pinNote: async () => {},
  unpinNote: async () => {},
  isPinned: () => false,
  isUnpersistedComposeDraft: () => false,
});

function normalizeVisibility(note: Notes): Notes {
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


async function getthreadNotes(): Promise<Notes[]> {
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

// Outside component scope
const sweepInFlightRef = { current: false };

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Notes[]>([]);
  const [composeSyncEpoch, setComposeSyncEpoch] = useState(0);
  const [unpersistedComposeDraftIds, setUnpersistedComposeDraftIds] = useState<Set<string>>(new Set());
  const [totalNotes, setTotalNotes] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [_pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [isCacheLoaded, setIsCacheLoaded] = useState(false);
  const hydratedUserIdRef = useRef<string | null>(null);

  // Make useAuth optional - try to use it if available
  let user = null;
  let isAuthenticated = false;
  let isAuthLoading = true;
  
  try {
    const authContext = useAuth();
    user = authContext.user;
    isAuthenticated = authContext.isAuthenticated;
    isAuthLoading = authContext.isLoading;
  } catch (_e) {
    // AuthProvider not available yet, that's fine
    isAuthLoading = false;
  }

  const { fetchOptimized, setCachedData, invalidate, getCachedData, getCachedDataAsync } = useDataNexus();
  const { pinSets, isPinned: isResourcePinned, togglePin } = useResourcePins();
  const { activeWorkspace } = useWorkspace();

  const activeUserId = user?.$id || (typeof window !== 'undefined' ? (getCurrentUserSnapshot()?.$id || 'guest') : 'guest');
  const PINNED_CACHE_KEY = useMemo(() => `pinned_ids_${activeUserId}`, [activeUserId]);
  const INITIAL_NOTES_CACHE_KEY = useMemo(() => `initial_notes_${activeUserId}`, [activeUserId]);

  // Refs to avoid unnecessary re-creations / dependency loops
  const isFetchingRef = useRef(false);
  const notesRef = useRef<Notes[]>([]);
  const cursorRef = useRef<string | null>(null);
  const lastPullAtRef = useRef(0);
  const liveEditGuardsRef = useRef(new Map<string, LiveEditGuard>());
  const activeComposeNoteIdsRef = useRef(new Set<string>());
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { cursorRef.current = cursor; }, [cursor]);

  // Instant local hydration — same cascade as attach-object drawer / goals.
  // Re-runs when auth resolves guest → real user so we don't stick on an empty guest miss.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const hydrateFromCache = async () => {
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
    };

    void hydrateFromCache();

    // Rite of passage: soft refresh from LocalEngine whenever any object card/detail is opened
    const unsubscribe = subscribeLocalSoftRefresh((kind) => {
      if (!kind || kind === 'note' || kind === 'idea') {
        void (async () => {
          const local = await loadNotesFromLocalCopy({
            userId: activeUserId,
            existingNotes: notesRef.current,
            getCachedDataSync: (key) => getCachedData(key),
            getCachedDataAsync: (key) => getCachedDataAsync(key),
          });
          if (local?.notes?.length) {
            setNotes((prev) => {
              const liveById = new Map(prev.map((n) => [n.$id, n]));
              const next = local.notes.map((n) => liveById.get(n.$id) || n);
              return next;
            });
          }
        })();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [
    activeUserId,
    isAuthLoading,
    isCacheLoaded,
    getCachedData,
    getCachedDataAsync,
  ]);

  const PAGE_SIZE = Number(process.env.NEXT_PUBLIC_NOTES_PAGE_SIZE || 50);

  const fetchBatch = useCallback(async (reset: boolean = false) => {
    if (isFetchingRef.current) return;

    if (!isAuthenticated) {
      if (!isAuthLoading && !user?.$id) {
        setIsLoading(false);
        setHasMore(false);
        setError(null);
      }
      return;
    }
    
    isFetchingRef.current = true;
    if (reset) {
      setError(null);
    }

    try {
      // Load thread notes and deleted IDs
      const historyRaw = typeof window !== 'undefined' ? localStorage.getItem('kylrix_thread_notes_v2') : null;
      const deletedIds = new Set<string>();
      if (historyRaw) {
        try {
          const history = JSON.parse(historyRaw);
          if (Array.isArray(history)) {
            history.forEach((h: any) => {
              try {
                const meta = JSON.parse(h.metadata || '{}');
                if (meta?._deleted === true) {
                  deletedIds.add(h.id);
                }
              } catch {}
            });
          }
        } catch {}
      }
      const threadNotes = await getthreadNotes();

      // Pinned repatriation is secondary — sorted in-memory via sortPinnedThenCreatedAt (like goals), not a separate fetch.

      // If we are resetting, we can use fetchOptimized for the first page
      let res;
      if (reset && INITIAL_NOTES_CACHE_KEY) {
        const fetcher = () => listNotesPaginated({
          limit: PAGE_SIZE,
          cursor: null,
          userId: user?.$id});
        
        const optimizedRes = await fetchOptimized(INITIAL_NOTES_CACHE_KEY, fetcher);
        res = optimizedRes;
        
        // Update other states based on this initial fetch
        const batch = mergeFetchedNotesWithLocalDrafts(
          (res?.rows || []).map((note: Notes) => normalizeVisibility(note)).filter((n: any) => !deletedIds.has(n.$id) && !isExcludedNote(n)),
          notesRef.current,
          liveEditGuardsRef.current,
          deletedIds,
        );
        const withthreads = dedupeNotesById([...threadNotes, ...batch]) as Notes[];
        setNotes((prev) =>
          mergeFetchedNotesWithLocalDrafts(
            withthreads,
            Array.isArray(prev) ? prev : [],
            liveEditGuardsRef.current,
            deletedIds,
          ),
        );
        setTotalNotes(res?.total || 0);
        setHasMore(!!res?.hasMore);
        setCursor(res?.nextCursor || null);

        // Also cache individual notes for NoteEditorPage
        withthreads.forEach(note => {
          if (note?.$id) setCachedData(`note_${note.$id}`, note);
        });
        if (user?.$id) void warmNotesLocalCopy(user.$id, withthreads);

      } else {
        // Normal pagination or force refetch
        res = await listNotesPaginated({
          limit: PAGE_SIZE,
          cursor: reset ? null : (cursorRef.current || null),
          userId: user?.$id});

        const fetchedRows = (res?.rows || [])
          .map((note: Notes) => normalizeVisibility(note))
          .filter((n: any) => !deletedIds.has(n.$id) && !isExcludedNote(n));

        setNotes(prev => {
          const safePrev = Array.isArray(prev) ? prev : [];
          if (reset) {
            return fetchedRows;
          }
          const existingIds = new Set(safePrev.map(n => n.$id));
          const newOnes = fetchedRows.filter((n: any) => !existingIds.has(n.$id));
          return [...safePrev, ...newOnes];
        });

        setTotalNotes(res?.total || 0);
        setHasMore(!!res?.hasMore);
        if (res?.nextCursor) {
          setCursor(res.nextCursor);
        } else if (reset) {
          setCursor(null);
        }

        // Cache the first page result if it was a reset
        if (reset && INITIAL_NOTES_CACHE_KEY) {
            setCachedData(INITIAL_NOTES_CACHE_KEY, {
                notes: fetchedRows,
                totalNotes: res?.total || 0,
                cursor: res?.nextCursor || null,
                hasMore: !!res?.hasMore
            });
            if (user?.$id) void warmNotesLocalCopy(user.$id, fetchedRows);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch notes');
      // Never wipe a populated live copy on a failed pull.
      if (reset && notesRef.current.length === 0) {
        setNotes([]);
        setTotalNotes(0);
      }
      setHasMore(false);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
      lastPullAtRef.current = Date.now();
      autonomicSyncEngine.markPullComplete();
    }
  }, [isAuthenticated, isAuthLoading, user?.$id, PAGE_SIZE, fetchOptimized, setCachedData, INITIAL_NOTES_CACHE_KEY]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isFetchingRef.current) return;
    await fetchBatch(false);
  }, [hasMore, fetchBatch]);

  const refetchNotes = useCallback(() => {
    setCursor(null);
    cursorRef.current = null;
    setHasMore(true);
    // Invalidate initial page cache
    if (INITIAL_NOTES_CACHE_KEY) invalidate(INITIAL_NOTES_CACHE_KEY);
    fetchBatch(true);
  }, [fetchBatch, INITIAL_NOTES_CACHE_KEY, invalidate]);

  // Soft pull heartbeat: focus/visibility demand only (activity-gated). Relies on merge upserts — never a wipe.
  useEffect(() => {
    if (!isAuthenticated || !user?.$id) return;

    const maybeSoftPull = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (isFetchingRef.current) return;
      if (
        !shouldSoftPull({
          lastPullAt: lastPullAtRef.current || autonomicSyncEngine.getLastPullAt(),
          activityIntensity: autonomicSyncEngine.getActivityIntensity()})
      ) {
        return;
      }
      void fetchBatch(true);
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') maybeSoftPull();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [isAuthenticated, user?.$id, fetchBatch]);

  // Initial fetch logic - reset flag on user change or when empty
  const hasInitiallyFetchedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user?.$id && isCacheLoaded) {
      if (hasInitiallyFetchedForUserRef.current !== user.$id) {
        hasInitiallyFetchedForUserRef.current = user.$id;
        fetchBatch(true);
        return;
      }

      if (notes.length === 0 && !isFetchingRef.current) {
        fetchBatch(true);
      }
    } else if (!isAuthLoading && !isAuthenticated) {
      setIsLoading(false);
      setHasMore(false);
      hasInitiallyFetchedForUserRef.current = null;
    }
  }, [isAuthenticated, isAuthLoading, user?.$id, fetchBatch, isCacheLoaded, notes.length]);

  const transferComposeSession = useCallback((ephemeralId: string, savedId: string) => {
    const guard = liveEditGuardsRef.current.get(ephemeralId);
    if (guard) {
      liveEditGuardsRef.current.set(savedId, guard);
      liveEditGuardsRef.current.delete(ephemeralId);
    }
    if (activeComposeNoteIdsRef.current.has(ephemeralId)) {
      activeComposeNoteIdsRef.current.delete(ephemeralId);
    }
    activeComposeNoteIdsRef.current.add(savedId);
    markNotePersistedRemote(ephemeralId);
    markNotePersistedRemote(savedId);
  }, []);

  const upsertNote = useCallback((note: Notes) => {
    const normalized = normalizeVisibility(note);
    let added = false;
    setNotes((prev) => {
      const existingIndex = prev.findIndex((n) => n.$id === normalized.$id);
      if (existingIndex !== -1) {
        const existing = prev[existingIndex];
        if (
          existing.title === normalized.title &&
          existing.content === normalized.content &&
          existing.isPublic === normalized.isPublic &&
          existing.isGuest === normalized.isGuest &&
          existing.isWorkspace === (normalized as any).isWorkspace &&
          (existing as any).projectId === (normalized as any).projectId &&
          JSON.stringify(existing.tags) === JSON.stringify(normalized.tags)
        ) {
          return prev;
        }
        const updated = dedupeNotesById(prev.map((item) => (item.$id === normalized.$id ? { ...item, ...normalized } : item)));
        if (INITIAL_NOTES_CACHE_KEY) {
          setCachedData(INITIAL_NOTES_CACHE_KEY, {
            notes: updated,
            totalNotes: updated.length,
            cursor: cursorRef.current,
            hasMore: true});
        }
        return updated;
      }
      added = true;
      const updated = dedupeNotesById([normalized, ...prev]);
      if (INITIAL_NOTES_CACHE_KEY) {
        setCachedData(INITIAL_NOTES_CACHE_KEY, {
          notes: updated,
          totalNotes: updated.length,
          cursor: cursorRef.current,
          hasMore: true});
      }
      return updated;
    });
    if (added) {
      setTotalNotes((prev) => prev + 1);
    }
    setCachedData(`note_${normalized.$id}`, normalized);
  }, [setCachedData, INITIAL_NOTES_CACHE_KEY]);

  const pushLiveNote = useCallback((note: Notes, options?: { pending?: boolean }) => {
    if (!note?.$id) return;
    const tags = Array.isArray(note.tags) ? note.tags : [];
    const cardTitle = resolveNoteCardTitle(note.title, note.content) || note.title || '';
    const isPending = options?.pending !== false;
    if (isPending) {
      liveEditGuardsRef.current.set(note.$id, {
        title: cardTitle,
        content: note.content || '',
        tags,
        at: Date.now()});
    } else {
      liveEditGuardsRef.current.delete(note.$id);
    }
    const nowIso = new Date().toISOString();
    const stamped: Notes = {
      ...note,
      title: cardTitle,
      content: note.content || '',
      tags,
      $updatedAt: isPending ? nowIso : (note.$updatedAt || note.updatedAt || nowIso),
      updatedAt: isPending ? nowIso : (note.updatedAt || note.$updatedAt || nowIso),
    };
    upsertNote(stamped);
    // Sync engine is SoT for amber — enqueue live revision (never an Appwrite field).
    if (isPending) {
      autonomicSyncEngine.markPending(stamped.$id, stamped.updatedAt, stamped);
      autonomicSyncEngine.nudge();
    } else {
      autonomicSyncEngine.markConfirmed(stamped.$id);
    }
  }, [upsertNote]);

  /** Compose-lifecycle only. Dot green/amber is engine.ack / markPending — never here. */
  const registerComposeSession = useCallback((noteId: string) => {
    if (!noteId) return;
    activeComposeNoteIdsRef.current.add(noteId);
    markComposeDraft(noteId);
    setUnpersistedComposeDraftIds((prev) => {
      const next = new Set(prev);
      next.add(noteId);
      return next;
    });
    setComposeSyncEpoch((n) => n + 1);
  }, []);

  const unregisterComposeSession = useCallback((noteId: string) => {
    if (!noteId) return;
    activeComposeNoteIdsRef.current.delete(noteId);
    markComposePersisted(noteId);
    setUnpersistedComposeDraftIds((prev) => {
      const next = new Set(prev);
      next.delete(noteId);
      return next;
    });
    setComposeSyncEpoch((n) => n + 1);
  }, []);

  const isUnpersistedComposeDraftLocal = useCallback((noteId?: string | null) => {
    if (!noteId) return false;
    return unpersistedComposeDraftIds.has(noteId);
  }, [unpersistedComposeDraftIds]);

  // Sync engine reads live-copy payloads from here — never from a detail-owned cache.
  useEffect(() => {
    registerLiveNoteGetter((noteId) => notesRef.current.find((n) => n.$id === noteId) || null);
    return () => registerLiveNoteGetter(null);
  }, []);

  useEffect(() => {
    const onSyncComplete = (event: Event) => {
      const noteId = String((event as CustomEvent)?.detail?.noteId || '').trim();
      if (!noteId) return;
      unregisterComposeSession(noteId);
      markNotePersistedRemote(noteId);
    };
    const onSyncPending = (event: Event) => {
      const noteId = String((event as CustomEvent)?.detail?.noteId || '').trim();
      if (!noteId) return;
      registerComposeSession(noteId);
    };
    window.addEventListener('kylrix:sync-complete', onSyncComplete as EventListener);
    window.addEventListener('kylrix:sync-pending', onSyncPending as EventListener);
    return () => {
      window.removeEventListener('kylrix:sync-complete', onSyncComplete as EventListener);
      window.removeEventListener('kylrix:sync-pending', onSyncPending as EventListener);
    };
  }, [unregisterComposeSession, registerComposeSession]);

  const clearLiveNoteGuard = useCallback((noteId: string) => {
    liveEditGuardsRef.current.delete(noteId);
  }, []);

  const opportunisticallyDecryptNote = useCallback(async (note: Notes) => {
    if (!note?.$id) return;
    if (!ecosystemSecurity.status.isUnlocked) return; // Guard against vault-locked state

    const meta = (() => {
      try { return JSON.parse(note.metadata || '{}'); } catch { return {}; }
    })();

    if (!getNotePublicState(note) || !meta.isEncrypted || meta.encryptionVersion !== 'T4') return;

    const decrypted = await decryptPublicEncryptedNote(note);
    if (!decrypted || decrypted.title === note.title && decrypted.content === note.content) return;

    setNotes(prev => prev.map(item => item.$id === decrypted.$id ? normalizeVisibility(decrypted) : item));
    setCachedData(`note_${decrypted.$id}`, normalizeVisibility(decrypted));
  }, [setCachedData]);

  const sweepEncryptedNotes = useCallback(async () => {
    if (sweepInFlightRef.current || !isAuthenticated) return;
    sweepInFlightRef.current = true;
    try {
      await Promise.all(notesRef.current.map(opportunisticallyDecryptNote));
    } finally {
      sweepInFlightRef.current = false;
    }
  }, [isAuthenticated, opportunisticallyDecryptNote]);

  const removeNote = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((note) => note.$id !== noteId));
    setTotalNotes((prev) => Math.max(0, prev - 1));
    // Also remove from pinned if it was pinned
    setPinnedIds((prev) => prev.filter(id => id !== noteId));
    // Cancel any pending sync mutation immediately so it never resuscitates
    autonomicSyncEngine.cancelPending(noteId);
    liveEditGuardsRef.current.delete(noteId);
    activeComposeNoteIdsRef.current.delete(noteId);
    // Invalidate caches
    invalidate(`note_${noteId}`);
    if (INITIAL_NOTES_CACHE_KEY) invalidate(INITIAL_NOTES_CACHE_KEY);
    // Best-effort RxDB cleanup
    if (typeof window !== 'undefined') {
      import('@/lib/webrtc/RxDBManager').then(({ getRxDB }) => {
        getRxDB().then((db) => {
          db.notes.findOne(noteId).remove().catch(() => {});
          db.cache.findOne(`note_${noteId}`).remove().catch(() => {});
        }).catch(() => {});
      }).catch(() => {});
    }
  }, [invalidate, INITIAL_NOTES_CACHE_KEY]);

  const migrateDraftNoteId = useCallback((ephemeralId: string, savedId: string) => {
    if (!ephemeralId || !savedId || ephemeralId === savedId) return;

    transferComposeSession(ephemeralId, savedId);

    setNotes((prev) => {
      const hasSaved = prev.some((n) => n.$id === savedId);
      const hasEphemeral = prev.some((n) => n.$id === ephemeralId);
      const guard = liveEditGuardsRef.current.get(savedId) || liveEditGuardsRef.current.get(ephemeralId);

      if (hasSaved && !hasEphemeral) {
        if (!guard) return dedupeNotesById(prev);
        return dedupeNotesById(prev.map((n) => (
          n.$id === savedId ? mergeServerWithLiveGuard(n, guard) : n
        )));
      }

      let migratedNote: Notes | undefined;
      const mapped = prev.flatMap((note) => {
        if (note.$id === ephemeralId) {
          migratedNote = normalizeVisibility({ ...note, $id: savedId });
          return [migratedNote];
        }
        if (note.$id === savedId && hasEphemeral) {
          return [];
        }
        return [note];
      });

      const next = dedupeNotesById(mapped);
      if (migratedNote) setCachedData(`note_${savedId}`, migratedNote);
      return next;
    });
    invalidate(`note_${ephemeralId}`);
  }, [invalidate, setCachedData, transferComposeSession]);

  const scheduleInvalidateInitialNotesPage = useCallback(() => {
    if (INITIAL_NOTES_CACHE_KEY) invalidate(INITIAL_NOTES_CACHE_KEY);
  }, [invalidate, INITIAL_NOTES_CACHE_KEY]);

  // Realtime subscription
  useEffect(() => {
    if (!isAuthenticated || !user?.$id) return;

    // Listen to the entire collection and table to catch all relevant changes
    const channels = [
      `databases.${APPWRITE_DATABASE_ID}.tables.${APPWRITE_CONFIG.TABLES.NOTE.NOTES}.rows`,
      `databases.${APPWRITE_DATABASE_ID}.collections.${APPWRITE_CONFIG.TABLES.NOTE.NOTES}.documents`
    ];
    
    const sub = realtime.subscribe(channels, (response) => {
      const payload = normalizeVisibility(response.payload as Notes);
      
      const isOwner = payload.userId === user.$id || (payload as any).owner_id === user.$id;
      if (!isOwner) return;

      const isCreate = response.events.some(e => e.endsWith('.create'));
      const isUpdate = response.events.some(e => e.endsWith('.update'));
      const isDelete = response.events.some(e => e.endsWith('.delete'));

      if (isCreate) {
        if ((payload as any).isTrash === true || (payload as any).isDeleted === true) {
          setNotes(prev => prev.filter(n => n.$id !== payload.$id));
          setTotalNotes(prev => Math.max(0, prev - 1));
          setPinnedIds(prev => prev.filter(id => id !== payload.$id));
          invalidate(`note_${payload.$id}`);
          scheduleInvalidateInitialNotesPage();
          try {
            const { invalidateNoteRowClientCache } = require('@/lib/appwrite/note');
            invalidateNoteRowClientCache(payload.$id);
          } catch {}
          return;
        }
        liveEditGuardsRef.current.delete(payload.$id);
        autonomicSyncEngine.markConfirmed(payload.$id);
        const normalized = normalizeVisibility(payload);

        if (activeComposeNoteIdsRef.current.has(payload.$id) || notesRef.current.some(n => n.$id === payload.$id)) {
          setNotes(prev => dedupeNotesById(prev.map(n => n.$id === payload.$id ? normalized : n)));
          setCachedData(`note_${payload.$id}`, normalized);
          return;
        }

        const liveComposeId = [...activeComposeNoteIdsRef.current].find(
          (id) => isUnpersistedComposeDraft(id) && notesRef.current.some((n) => n.$id === id),
        );
        if (liveComposeId) {
          transferComposeSession(liveComposeId, payload.$id);
          setNotes((prev) => dedupeNotesById([
            normalized,
            ...prev.filter((n) => n.$id !== liveComposeId && n.$id !== payload.$id),
          ]));
          setCachedData(`note_${payload.$id}`, normalized);
          if (INITIAL_NOTES_CACHE_KEY) invalidate(INITIAL_NOTES_CACHE_KEY);
          void opportunisticallyDecryptNote(payload);
          return;
        }

        setNotes(prev => {
          if (prev.some(n => n.$id === payload.$id)) {
            return dedupeNotesById(prev.map(n => n.$id === payload.$id ? normalized : n));
          }
          return dedupeNotesById([normalized, ...prev]);
        });
        const alreadyListed = notesRef.current.some(n => n.$id === payload.$id);
        if (!alreadyListed) {
          setTotalNotes(prev => prev + 1);
        }
        setCachedData(`note_${payload.$id}`, normalized);
        if (INITIAL_NOTES_CACHE_KEY) invalidate(INITIAL_NOTES_CACHE_KEY);
        void opportunisticallyDecryptNote(payload);
      } else if (isUpdate) {
        if ((payload as any).isTrash === true || (payload as any).isDeleted === true) {
          setNotes(prev => prev.filter(n => n.$id !== payload.$id));
          setTotalNotes(prev => Math.max(0, prev - 1));
          setPinnedIds(prev => prev.filter(id => id !== payload.$id));
          invalidate(`note_${payload.$id}`);
          scheduleInvalidateInitialNotesPage();
          try {
            const { invalidateNoteRowClientCache } = require('@/lib/appwrite/note');
            invalidateNoteRowClientCache(payload.$id);
          } catch {}
          return;
        }
        liveEditGuardsRef.current.delete(payload.$id);
        autonomicSyncEngine.markConfirmed(payload.$id);
        const normalized = normalizeVisibility(payload);
        setNotes(prev => prev.map(n => n.$id === payload.$id ? normalized : n));
        setCachedData(`note_${payload.$id}`, normalized);
        scheduleInvalidateInitialNotesPage();
        void opportunisticallyDecryptNote(payload);
      } else if (isDelete) {
        setNotes(prev => prev.filter(n => n.$id !== payload.$id));
        setTotalNotes(prev => Math.max(0, prev - 1));
        setPinnedIds(prev => prev.filter(id => id !== payload.$id));
        invalidate(`note_${payload.$id}`);
        if (INITIAL_NOTES_CACHE_KEY) invalidate(INITIAL_NOTES_CACHE_KEY);
        try {
          const { invalidateNoteRowClientCache } = require('@/lib/appwrite/note');
          invalidateNoteRowClientCache(payload.$id);
        } catch {}
      }
    });
    
    return () => {
      if (typeof sub === 'function') {
        (sub as any)();
      } else if (sub && typeof (sub as any).unsubscribe === 'function') {
        (sub as any).unsubscribe();
      }
    };
  }, [isAuthenticated, user?.$id, setCachedData, invalidate, opportunisticallyDecryptNote, INITIAL_NOTES_CACHE_KEY, scheduleInvalidateInitialNotesPage, transferComposeSession]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onVaultUnlocked = () => {
      void sweepEncryptedNotes();
    };
    window.addEventListener('kylrix:vault-unlocked', onVaultUnlocked);
    return () => window.removeEventListener('kylrix:vault-unlocked', onVaultUnlocked);
  }, [sweepEncryptedNotes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      console.log('[NotesContext] Network connection restored. Refetching notes...');
      if (isAuthenticated) {
        refetchNotes();
      }
    };

    const handlethreadClaimed = () => {
      console.log('[NotesContext] thread items claimed. Refetching notes...');
      if (isAuthenticated) {
        refetchNotes();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('kylrix:thread-claimed', handlethreadClaimed);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('kylrix:thread-claimed', handlethreadClaimed);
    };
  }, [isAuthenticated, refetchNotes]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!notesRef.current.length) return;
    if (!sweepInFlightRef.current) {
      void sweepEncryptedNotes();
    }
  }, [isAuthenticated, notes.length, sweepEncryptedNotes]);

  const noteOwnerId = useCallback((note: Notes) => note.creatorId || note.userId || user?.$id || '', [user?.$id]);

  const isPinned = useCallback((noteId: string) => {
    const note = notes.find(n => n.$id === noteId);
    if (!note) return pinSets.note.has(noteId);
    return isResourcePinned('note', noteId, noteOwnerId(note), note.isPinned);
  }, [notes, pinSets.note, isResourcePinned, noteOwnerId]);

  const effectivePinnedIds = useMemo(() => {
    const ids = new Set<string>(pinSets.note);
    notes.forEach((note) => {
      if (isResourcePinned('note', note.$id, noteOwnerId(note), note.isPinned)) {
        ids.add(note.$id);
      }
    });
    return Array.from(ids);
  }, [notes, pinSets.note, isResourcePinned, noteOwnerId]);

  useEffect(() => {
    if (!PINNED_CACHE_KEY) return;
    setPinnedIds(effectivePinnedIds);
    setCachedData(PINNED_CACHE_KEY, effectivePinnedIds);
  }, [effectivePinnedIds, PINNED_CACHE_KEY, setCachedData]);

  // Pinned show via single local-engine fetch + sortPinnedThenCreatedAt — no separate missing-pinned hydration (goals pattern).

  const applyNotePin = useCallback(async (noteId: string, pinned: boolean) => {
    const note = notes.find(n => n.$id === noteId);
    const ownerId = note ? noteOwnerId(note) : (user?.$id || '');
    const currentlyPinned = isPinned(noteId);
    if (currentlyPinned === pinned) return;

    const isOwner = !user?.$id || !ownerId || user.$id === ownerId;

    // 1. Optimistic instant local update
    setNotes((prev) => prev.map((n) => (n.$id === noteId ? { ...n, isPinned: pinned } : n)));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kylrix:note-pinned', { detail: { noteId, isPinned: pinned } }));
    }

    try {
      await togglePin({
        resourceType: 'note',
        resourceId: noteId,
        ownerId,
        rowIsPinned: note?.isPinned,
        setOwnerRowPin: async (nextPinned) => {
          await updateNote(noteId, { isPinned: nextPinned } as any);
        },
      });
      if (isOwner) {
        setNotes((prev) => prev.map((n) => (n.$id === noteId ? { ...n, isPinned: pinned } : n)));
      }
    } catch (err) {
      // Revert optimistic update on failure
      setNotes((prev) => prev.map((n) => (n.$id === noteId ? { ...n, isPinned: currentlyPinned } : n)));
      throw err;
    }
  }, [notes, user?.$id, noteOwnerId, isPinned, togglePin]);

  const pinNote = useCallback(async (noteId: string) => {
    await applyNotePin(noteId, true);
  }, [applyNotePin]);

  const unpinNote = useCallback(async (noteId: string) => {
    await applyNotePin(noteId, false);
  }, [applyNotePin]);

  const { filteredItems: workspaceScopedNotes } = useWorkspaceFilteredItems(notes, 'note');

  // When activeWorkspace switches to a custom workspace, eagerly pull any workspace notes not yet in memory
  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.isPersonal) return;
    const wsId = activeWorkspace.id;
    let cancelled = false;

    void (async () => {
      try {
        const { ProjectsService } = await import('@/lib/appwrite/projects');
        const tagged = await ProjectsService.listTaggedResources(wsId).catch(() => null);
        if (tagged?.notes && Array.isArray(tagged.notes) && tagged.notes.length > 0 && !cancelled) {
          tagged.notes.forEach((n: any) => {
            const id = n.$id || n.id;
            if (id) {
              const stamped = { ...n, $id: id, projectId: wsId, isWorkspace: true };
              upsertNote(stamped);
            }
          });
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.id]);

  const sortedNotes = useMemo(() => {
    return sortPinnedThenCreatedAt(workspaceScopedNotes, (row) =>
      isResourcePinned('note', row.$id, noteOwnerId(row), row.isPinned),
    ).map((row) => {
      const pinned = isResourcePinned('note', row.$id, noteOwnerId(row), row.isPinned);
      return row.isPinned === pinned ? row : { ...row, isPinned: pinned };
    });
  }, [workspaceScopedNotes, isResourcePinned, noteOwnerId]);

  /**
   * Memoize the context value so consumers (note list, sidebar, search, etc.) don't
   * re-render whenever NotesProvider re-renders for unrelated state changes.
   */
  const contextValue = useMemo<NotesContextType>(
    () => ({
      notes: sortedNotes,
      totalNotes: totalNotes || 0,
      isLoading,
      error,
      hasMore,
      loadMore,
      refetchNotes,
      upsertNote,
      pushLiveNote,
      registerComposeSession,
      unregisterComposeSession,
      clearLiveNoteGuard,
      removeNote,
      migrateDraftNoteId,
      composeSyncEpoch,
      pinnedIds: effectivePinnedIds,
      pinNote,
      unpinNote,
      isPinned,
      isUnpersistedComposeDraft: isUnpersistedComposeDraftLocal}),
    [
      sortedNotes,
      totalNotes,
      isLoading,
      error,
      hasMore,
      loadMore,
      refetchNotes,
      upsertNote,
      pushLiveNote,
      registerComposeSession,
      unregisterComposeSession,
      clearLiveNoteGuard,
      removeNote,
      migrateDraftNoteId,
      composeSyncEpoch,
      effectivePinnedIds,
      pinNote,
      unpinNote,
      isPinned,
      isUnpersistedComposeDraftLocal,
    ]
  );

  return (
    <NotesContext.Provider value={contextValue}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NotesContext);
  return context || ({} as any);
}
