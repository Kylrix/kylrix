"use client";


import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode, useMemo } from 'react';
import { Query } from 'appwrite';
import { 
  listNotesPaginated, 
  getPinnedNoteIds,
  getNote,
  updateNote,
  realtime,
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ID_NOTES,
  getNotePublicState,
  decryptPublicEncryptedNote
} from '@/lib/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import type { Notes } from '@/types/appwrite';
import { useAuth } from '@/context/auth/AuthContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { isGhostNote } from '@/lib/appwrite/note';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { useDataNexus } from './DataNexusContext';
import { useResourcePins } from '@/context/ResourcePinContext';
import { buildAutoTitleFromContent, resolveNoteCardTitle } from '@/constants/noteTitle';
import {
  isEphemeralComposeNoteId,
  markComposeDraft,
  markComposePersisted,
  isUnpersistedComposeDraft,
  isNotePersistedRemote,
  markNotePersistedRemote,
} from '@/lib/notes/compose-draft-registry';
import {
  mergeServerPageWithLocalCopy,
  sortPinnedThenCreatedAt,
  shouldSoftPull,
} from '@/lib/sync/local-copy-sync';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { registerLiveNoteGetter } from '@/lib/sync/pending-sync-bridge';

type LiveEditGuard = {
  title: string;
  content: string;
  tags: string[];
  at: number;
};

export function isLiveDraftNoteId(noteId?: string | null): boolean {
  return isEphemeralComposeNoteId(noteId);
}

export { isUnpersistedComposeDraft };

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
        at: guard.at || Date.now(),
      }),
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
    tags: guard.tags.length ? guard.tags : serverNote.tags,
  });
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
  return {
    ...note,
    isPublic: getNotePublicState(note)
  };
}

async function getGhostNotes(): Promise<Notes[]> {
  if (typeof window === 'undefined') return [];
  const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
  if (!historyRaw) return [];
  try {
    const history = JSON.parse(historyRaw);
    if (!Array.isArray(history)) return [];
    const { decryptGhostData } = await import('@/lib/encryption/ghost-crypto');
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
          decryptedTitle = await decryptGhostData(item.title, item.decryptionKey);
          decryptedContent = await decryptGhostData(item.content || '', item.decryptionKey);
        } catch (e) {
          console.error('Failed to decrypt ghost note in getGhostNotes:', e);
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
        userId: 'ghost',
        isPublic: false,
        isGuest: false,
        metadata: item.metadata || '{}',
      };
    }));
    return mapped.filter(Boolean) as any as Notes[];
  } catch (e) {
    console.error('Failed to parse ghost history in getGhostNotes', e);
    return [];
  }
}

const PINNED_CACHE_KEY = 'pinned_note_ids';
const INITIAL_NOTES_CACHE_KEY = 'initial_notes_page';

// Outside component scope
const sweepInFlightRef = { current: false };

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Notes[]>([]);
  const [composeSyncEpoch, setComposeSyncEpoch] = useState(0);
  const [unpersistedComposeDraftIds, setUnpersistedComposeDraftIds] = useState<Set<string>>(new Set());
  const [totalNotes, setTotalNotes] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [isCacheLoaded, setIsCacheLoaded] = useState(false);

  // Make useAuth optional - try to use it if available
  let user = null;
  let isAuthenticated = false;
  let isAuthLoading = true;
  
  try {
    const authContext = useAuth();
    user = authContext.user;
    isAuthenticated = authContext.isAuthenticated;
    isAuthLoading = authContext.isLoading;
  } catch (e) {
    // AuthProvider not available yet, that's fine
    isAuthLoading = false;
  }

  const { fetchOptimized, setCachedData, invalidate, getCachedData, getCachedDataAsync } = useDataNexus();
  const { pinSets, isPinned: isResourcePinned, togglePin } = useResourcePins();

  const PINNED_CACHE_KEY = useMemo(() => user?.$id ? `pinned_ids_${user.$id}` : null, [user?.$id]);
  const INITIAL_NOTES_CACHE_KEY = useMemo(() => user?.$id ? `initial_notes_${user.$id}` : null, [user?.$id]);

  // Load from cache on mount (Instant Cold-Start Hydration)
  useEffect(() => {
    if (!user?.$id || isCacheLoaded) return;

    const hydrateFromCache = async () => {
        if (PINNED_CACHE_KEY && INITIAL_NOTES_CACHE_KEY) {
            // Try Async hit first (checks memory then RxDB/IndexedDB)
            const [cachedPinned, cachedNotes] = await Promise.all([
                getCachedDataAsync<string[]>(PINNED_CACHE_KEY),
                getCachedDataAsync<{
                    notes: Notes[];
                    totalNotes: number;
                    cursor: string | null;
                    hasMore: boolean;
                }>(INITIAL_NOTES_CACHE_KEY)
            ]);

            if (cachedPinned && Array.isArray(cachedPinned)) {
                setPinnedIds(cachedPinned);
            }

            if (cachedNotes && Array.isArray(cachedNotes.notes)) {
                setNotes(cachedNotes.notes);
                setTotalNotes(cachedNotes.totalNotes || 0);
                setCursor(cachedNotes.cursor || null);
                setHasMore(cachedNotes.hasMore ?? true);
                setIsLoading(false); // Stop loading immediately on local hit
                console.log('[NotesContext] Sub-millisecond cold start via RxDB substrate.');
            }
        }
        setIsCacheLoaded(true);
    };
    
    void hydrateFromCache();
  }, [user?.$id, isCacheLoaded, getCachedDataAsync, PINNED_CACHE_KEY, INITIAL_NOTES_CACHE_KEY]);

  // Refs to avoid unnecessary re-creations / dependency loops
  const isFetchingRef = useRef(false);
  const notesRef = useRef<Notes[]>([]);
  const cursorRef = useRef<string | null>(null);
  const lastPullAtRef = useRef(0);
  const liveEditGuardsRef = useRef(new Map<string, LiveEditGuard>());
  const activeComposeNoteIdsRef = useRef(new Set<string>());
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { cursorRef.current = cursor; }, [cursor]);

  const PAGE_SIZE = Number(process.env.NEXT_PUBLIC_NOTES_PAGE_SIZE || 50);

  const fetchPinnedIds = useCallback(async () => {
    return await getPinnedNoteIds(user?.$id || '');
  }, [user?.$id]);

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
    if (reset && notesRef.current.length === 0) {
      setIsLoading(true);
      setError(null);
    }

    try {
      // Load ghost notes and deleted IDs
      const historyRaw = typeof window !== 'undefined' ? localStorage.getItem('kylrix_ghost_notes_v2') : null;
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
      const ghostNotes = await getGhostNotes();

      // Fetch pinned IDs with optimization
      if (reset && PINNED_CACHE_KEY) {
        const pIds = await fetchOptimized(PINNED_CACHE_KEY, fetchPinnedIds);
        setPinnedIds(pIds || []);
      }

      // If we are resetting, we can use fetchOptimized for the first page
      let res;
      if (reset && INITIAL_NOTES_CACHE_KEY) {
        const fetcher = () => listNotesPaginated({
          limit: PAGE_SIZE,
          cursor: null,
          userId: user?.$id,
        });
        
        const optimizedRes = await fetchOptimized(INITIAL_NOTES_CACHE_KEY, fetcher);
        res = optimizedRes;
        
        // Update other states based on this initial fetch
        const batch = mergeFetchedNotesWithLocalDrafts(
          (res?.rows || []).map((note: Notes) => normalizeVisibility(note)).filter((n: any) => !deletedIds.has(n.$id) && !isGhostNote(n)),
          notesRef.current,
          liveEditGuardsRef.current,
          deletedIds,
        );
        const withGhosts = dedupeNotesById([...ghostNotes, ...batch]) as Notes[];
        setNotes((prev) =>
          mergeFetchedNotesWithLocalDrafts(
            withGhosts,
            Array.isArray(prev) ? prev : [],
            liveEditGuardsRef.current,
            deletedIds,
          ),
        );
        setTotalNotes(res?.total || 0);
        setHasMore(!!res?.hasMore);
        setCursor(res?.nextCursor || null);

        // Also cache individual notes for NoteEditorPage
        withGhosts.forEach(note => {
          if (note?.$id) setCachedData(`note_${note.$id}`, note);
        });

      } else {
        // Normal pagination or force refetch
        res = await listNotesPaginated({
          limit: PAGE_SIZE,
          cursor: reset ? null : (cursorRef.current || null),
          userId: user?.$id,
        });

        const mergedBatch = mergeFetchedNotesWithLocalDrafts(
          (res?.rows || []).map((note: Notes) => normalizeVisibility(note)).filter((n: any) => !deletedIds.has(n.$id)),
          notesRef.current,
          liveEditGuardsRef.current,
          deletedIds,
        );
        const batch = dedupeNotesById([...ghostNotes, ...mergedBatch]) as Notes[];

        setNotes(prev => {
          // Soft upsert: even on reset, fold remote into existing live copy — never discard local presence.
          const safePrev = Array.isArray(prev) ? prev : [];
          if (reset) {
            return mergeFetchedNotesWithLocalDrafts(batch, safePrev, liveEditGuardsRef.current, deletedIds);
          }
          const existingIds = new Set(safePrev.map(n => n.$id));
          const newOnes = batch.filter(n => !existingIds.has(n.$id));
          return dedupeNotesById([...safePrev, ...newOnes]);
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
                notes: batch,
                totalNotes: res?.total || 0,
                cursor: res?.nextCursor || null,
                hasMore: !!res?.hasMore
            });
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
  }, [isAuthenticated, isAuthLoading, user?.$id, PAGE_SIZE, fetchOptimized, fetchPinnedIds, setCachedData, PINNED_CACHE_KEY, INITIAL_NOTES_CACHE_KEY]);

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

  // Soft pull heartbeat: activity-aware + visibility. Relies on merge upserts — never a wipe.
  useEffect(() => {
    if (!isAuthenticated || !user?.$id) return;

    const maybeSoftPull = () => {
      if (isFetchingRef.current) return;
      if (
        !shouldSoftPull({
          lastPullAt: lastPullAtRef.current || autonomicSyncEngine.getLastPullAt(),
          activityIntensity: autonomicSyncEngine.getActivityIntensity(),
        })
      ) {
        return;
      }
      void fetchBatch(true);
    };

    const unsub = autonomicSyncEngine.subscribeToActivity(() => {
      maybeSoftPull();
    });

    const onVisible = () => {
      if (document.visibilityState === 'visible') maybeSoftPull();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    const interval = window.setInterval(maybeSoftPull, 20_000);

    return () => {
      unsub();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(interval);
    };
  }, [isAuthenticated, user?.$id, fetchBatch]);

  // Initial fetch logic - decoupled from reload if cache exists
  const hasInitiallyFetched = useRef(false);

  useEffect(() => {
    if (isAuthenticated && user?.$id && isCacheLoaded) {
      if (notes.length > 0 && !hasInitiallyFetched.current) {
        hasInitiallyFetched.current = true;
        console.log('Instant reload: Using cached notes with background refresh');
        setIsLoading(false);
        fetchBatch(true);
        return;
      }

      if (!hasInitiallyFetched.current) {
        fetchBatch(true);
        hasInitiallyFetched.current = true;
      }
    } else if (!isAuthLoading && !isAuthenticated) {
      setIsLoading(false);
      setHasMore(false);
      hasInitiallyFetched.current = false;
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
      if (prev.some((n) => n.$id === normalized.$id)) {
        return dedupeNotesById(prev.map((item) => (item.$id === normalized.$id ? normalized : item)));
      }
      added = true;
      return dedupeNotesById([normalized, ...prev]);
    });
    if (added && !isUnpersistedComposeDraft(normalized.$id)) {
      setTotalNotes((prev) => prev + 1);
      if (INITIAL_NOTES_CACHE_KEY) invalidate(INITIAL_NOTES_CACHE_KEY);
    } else if (added) {
      setTotalNotes((prev) => prev + 1);
    }
    setCachedData(`note_${normalized.$id}`, normalized);
  }, [setCachedData, INITIAL_NOTES_CACHE_KEY, invalidate]);

  const pushLiveNote = useCallback((note: Notes, options?: { pending?: boolean }) => {
    if (!note?.$id) return;
    const tags = Array.isArray(note.tags) ? note.tags : [];
    const cardTitle = resolveNoteCardTitle(note.title, note.content) || note.title || '';
    liveEditGuardsRef.current.set(note.$id, {
      title: cardTitle,
      content: note.content || '',
      tags,
      at: Date.now(),
    });
    const stamped: Notes = {
      ...note,
      title: cardTitle,
      content: note.content || '',
      tags,
      $updatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    upsertNote(stamped);
    // Sync engine is SoT for amber — enqueue live revision (never an Appwrite field).
    if (options?.pending !== false) {
      autonomicSyncEngine.markPending(stamped.$id, stamped.updatedAt);
      autonomicSyncEngine.runCycle();
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
    // Invalidate caches
    invalidate(`note_${noteId}`);
    if (INITIAL_NOTES_CACHE_KEY) invalidate(INITIAL_NOTES_CACHE_KEY);
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

    // Listen to the entire collection to catch all relevant changes
    const channel = `databases.${APPWRITE_DATABASE_ID}.collections.${APPWRITE_CONFIG.DATABASES.NOTE}.notes.documents`;
    
    const sub = realtime.subscribe(channel, (response) => {
      const payload = normalizeVisibility(response.payload as Notes);
      
      const isOwner = payload.userId === user.$id || (payload as any).owner_id === user.$id;
      if (!isOwner) return;

      const isCreate = response.events.some(e => e.endsWith('.create'));
      const isUpdate = response.events.some(e => e.endsWith('.update'));
      const isDelete = response.events.some(e => e.endsWith('.delete'));

      if (isCreate) {
        if (activeComposeNoteIdsRef.current.has(payload.$id) || notesRef.current.some(n => n.$id === payload.$id)) {
          // Update the existing card with guard-merged content, but do NOT add a new row.
          setNotes(prev => {
            const guard = liveEditGuardsRef.current.get(payload.$id);
            const merged = guard ? mergeServerWithLiveGuard(payload, guard) : normalizeVisibility(payload);
            return dedupeNotesById(prev.map(n => n.$id === payload.$id ? merged : n));
          });
          const guard = liveEditGuardsRef.current.get(payload.$id);
          const merged = guard ? mergeServerWithLiveGuard(payload, guard) : normalizeVisibility(payload);
          setCachedData(`note_${payload.$id}`, merged);
          return;
        }

        const liveComposeId = [...activeComposeNoteIdsRef.current].find(
          (id) => isUnpersistedComposeDraft(id) && notesRef.current.some((n) => n.$id === id),
        );
        if (liveComposeId) {
          transferComposeSession(liveComposeId, payload.$id);
          const guard = liveEditGuardsRef.current.get(payload.$id);
          const merged = guard ? mergeServerWithLiveGuard(payload, guard) : normalizeVisibility(payload);
          setNotes((prev) => dedupeNotesById([
            merged,
            ...prev.filter((n) => n.$id !== liveComposeId && n.$id !== payload.$id),
          ]));
          setCachedData(`note_${payload.$id}`, merged);
          if (INITIAL_NOTES_CACHE_KEY) invalidate(INITIAL_NOTES_CACHE_KEY);
          void opportunisticallyDecryptNote(payload);
          return;
        }

        setNotes(prev => {
          const guard = liveEditGuardsRef.current.get(payload.$id);
          const merged = guard ? mergeServerWithLiveGuard(payload, guard) : normalizeVisibility(payload);
          if (prev.some(n => n.$id === payload.$id)) {
            return dedupeNotesById(prev.map(n => n.$id === payload.$id ? merged : n));
          }
          return dedupeNotesById([merged, ...prev]);
        });
        const guard = liveEditGuardsRef.current.get(payload.$id);
        const merged = guard ? mergeServerWithLiveGuard(payload, guard) : normalizeVisibility(payload);
        const alreadyListed = notesRef.current.some(n => n.$id === payload.$id);
        if (!alreadyListed) {
          setTotalNotes(prev => prev + 1);
        }
        setCachedData(`note_${payload.$id}`, merged);
        if (INITIAL_NOTES_CACHE_KEY) invalidate(INITIAL_NOTES_CACHE_KEY);
        void opportunisticallyDecryptNote(payload);
      } else if (isUpdate) {
        if (activeComposeNoteIdsRef.current.has(payload.$id) && !liveEditGuardsRef.current.has(payload.$id)) {
          return;
        }
        setNotes(prev => prev.map(n => {
          if (n.$id !== payload.$id) return n;
          const guard = liveEditGuardsRef.current.get(payload.$id);
          if (!guard) return normalizeVisibility(payload);
          return mergeServerWithLiveGuard(payload, guard);
        }));
        const guard = liveEditGuardsRef.current.get(payload.$id);
        const merged = guard ? mergeServerWithLiveGuard(payload, guard) : normalizeVisibility(payload);
        setCachedData(`note_${payload.$id}`, merged);
        scheduleInvalidateInitialNotesPage();
        void opportunisticallyDecryptNote(payload);
      } else if (isDelete) {
        setNotes(prev => prev.filter(n => n.$id !== payload.$id));
        setTotalNotes(prev => Math.max(0, prev - 1));
        setPinnedIds(prev => prev.filter(id => id !== payload.$id));
        invalidate(`note_${payload.$id}`);
        if (INITIAL_NOTES_CACHE_KEY) invalidate(INITIAL_NOTES_CACHE_KEY);
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

    const handleGhostClaimed = () => {
      console.log('[NotesContext] Ghost items claimed. Refetching notes...');
      if (isAuthenticated) {
        refetchNotes();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('kylrix:ghost-claimed', handleGhostClaimed);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('kylrix:ghost-claimed', handleGhostClaimed);
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

  const missingPinnedKey = useMemo(
    () => effectivePinnedIds.filter((id) => !notes.some((n) => n.$id === id)).join(','),
    [effectivePinnedIds, notes],
  );

  useEffect(() => {
    if (!isAuthenticated || !user?.$id || !missingPinnedKey) return;

    const missingIds = missingPinnedKey.split(',').filter(Boolean);
    if (!missingIds.length) return;

    const mergeNotes = (incoming: Notes[]) => {
      if (!incoming.length) return;
      setNotes((prev) => {
        const existingIds = new Set(prev.map((n) => n.$id));
        const distinctNew = incoming.filter((n) => n.$id && !existingIds.has(n.$id));
        return distinctNew.length ? [...prev, ...distinctNew] : prev;
      });
      incoming.forEach((doc) => {
        if (doc?.$id) setCachedData(`note_${doc.$id}`, doc);
      });
    };

    const hydratePinnedNotes = async () => {
      try {
        const fromCache: Notes[] = [];
        for (const id of missingIds) {
          const cached = await getCachedDataAsync<Notes>(`note_${id}`);
          if (cached?.$id) fromCache.push(normalizeVisibility(cached));
        }
        mergeNotes(fromCache);

        const stillMissing = missingIds.filter(
          (id) =>
            !fromCache.some((n) => n.$id === id) &&
            !notesRef.current.some((n) => n.$id === id),
        );
        if (!stillMissing.length) return;

        const res = await listNotesPaginated({
          limit: Math.min(Math.max(stillMissing.length, 1), 100),
          queries: [Query.equal('$id', stillMissing)],
          hydrateTags: true,
        });

        let fetched = ((res?.rows || []) as Notes[]).map((note) => normalizeVisibility(note));

        if (fetched.length < stillMissing.length) {
          const fetchedIds = new Set(fetched.map((n) => n.$id));
          const perNote = await Promise.all(
            stillMissing
              .filter((id) => !fetchedIds.has(id))
              .map((id) => getNote(id).catch(() => null)),
          );
          fetched = [
            ...fetched,
            ...perNote
              .filter((n): n is Notes => Boolean(n))
              .map((note) => normalizeVisibility(note)),
          ];
        }

        mergeNotes(fetched);
      } catch (e) {
        console.error('[NotesContext] Failed to hydrate missing pinned notes:', e);
      }
    };

    void hydratePinnedNotes();
  }, [missingPinnedKey, isAuthenticated, user?.$id, setCachedData, getCachedDataAsync]);

  const applyNotePin = useCallback(async (noteId: string, pinned: boolean) => {
    const note = notes.find(n => n.$id === noteId);
    if (!note || !user?.$id) return;
    const ownerId = noteOwnerId(note);
    const currentlyPinned = isResourcePinned('note', noteId, ownerId, note.isPinned);
    if (currentlyPinned === pinned) return;

    const isOwner = user.$id === ownerId;

    try {
      await togglePin({
        resourceType: 'note',
        resourceId: noteId,
        ownerId,
        rowIsPinned: note.isPinned,
        setOwnerRowPin: async (nextPinned) => {
          await updateNote(noteId, { isPinned: nextPinned } as any);
        },
      });
      if (isOwner) {
        setNotes((prev) => prev.map((n) => (n.$id === noteId ? { ...n, isPinned: pinned } : n)));
      }
    } catch (err) {
      throw err;
    }
  }, [notes, user?.$id, noteOwnerId, isResourcePinned, togglePin]);

  const pinNote = useCallback(async (noteId: string) => {
    await applyNotePin(noteId, true);
  }, [applyNotePin]);

  const unpinNote = useCallback(async (noteId: string) => {
    await applyNotePin(noteId, false);
  }, [applyNotePin]);

  const sortedNotes = useMemo(() => {
    return sortPinnedThenCreatedAt(notes, (row) =>
      isResourcePinned('note', row.$id, noteOwnerId(row), row.isPinned),
    );
  }, [notes, isResourcePinned, noteOwnerId]);

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
      isUnpersistedComposeDraft: isUnpersistedComposeDraftLocal,
    }),
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
