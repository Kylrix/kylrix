"use client";


import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode, useMemo } from 'react';
import { 
  listNotesPaginated, 
  getPinnedNoteIds, 
  pinNote as appwritePinNote, 
  unpinNote as appwriteUnpinNote,
  realtime,
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ID_NOTES,
  getNotePublicState,
  decryptPublicEncryptedNote
} from '@/lib/appwrite';
import type { Notes } from '@/types/appwrite';
import { useAuth } from '@/components/ui/AuthContext';
import { useDataNexus } from './DataNexusContext';

interface NotesContextType {
  notes: Notes[];
  totalNotes: number;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetchNotes: () => void;
  upsertNote: (note: Notes) => void;
  removeNote: (noteId: string) => void;
  pinnedIds: string[];
  pinNote: (noteId: string) => Promise<void>;
  unpinNote: (noteId: string) => Promise<void>;
  isPinned: (noteId: string) => boolean;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

function normalizeVisibility(note: Notes): Notes {
  return {
    ...note,
    isPublic: getNotePublicState(note)
  };
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Notes[]>([]);
  const [totalNotes, setTotalNotes] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null); // last fetched document id
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [isCacheLoaded, setIsCacheLoaded] = useState(false);

  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { fetchOptimized, setCachedData, invalidate, getCachedData } = useDataNexus();
  const sweepInFlightRef = useRef(false);
  
  // Plan-based pinning limits for UI
  const effectivePinnedIds = useMemo(() => {
    if (!user) return [];
    const plan = user.prefs?.subscriptionTier || 'FREE';
    const limit = (plan === 'PRO' || plan === 'ORG' || plan === 'LIFETIME') ? 10 : 3;
    return pinnedIds.slice(0, limit);
  }, [pinnedIds, user]);

  const PINNED_CACHE_KEY = useMemo(() => user?.$id ? `pinned_ids_${user.$id}` : null, [user?.$id]);
  const INITIAL_NOTES_CACHE_KEY = useMemo(() => user?.$id ? `initial_notes_${user.$id}` : null, [user?.$id]);

  // Load from cache on mount
  useEffect(() => {
    if (!user?.$id || isCacheLoaded) return;

    // Fast hydrate from DataNexus (which handles localStorage internaly)
    if (PINNED_CACHE_KEY && INITIAL_NOTES_CACHE_KEY) {
      const cachedPinned = getCachedData<string[]>(PINNED_CACHE_KEY);
      const cachedNotes = getCachedData<{
        notes: Notes[];
        totalNotes: number;
        cursor: string | null;
        hasMore: boolean;
      }>(INITIAL_NOTES_CACHE_KEY);

      if (cachedPinned && Array.isArray(cachedPinned)) setPinnedIds(cachedPinned);
      if (cachedNotes && Array.isArray(cachedNotes.notes)) {
        setNotes(cachedNotes.notes);
        setTotalNotes(cachedNotes.totalNotes || 0);
        setCursor(cachedNotes.cursor || null);
        setHasMore(cachedNotes.hasMore ?? true);
        setIsLoading(false);
      }
    }
    
    setIsCacheLoaded(true);
  }, [user?.$id, isCacheLoaded, getCachedData, PINNED_CACHE_KEY, INITIAL_NOTES_CACHE_KEY]);

  // Refs to avoid unnecessary re-creations / dependency loops
  const isFetchingRef = useRef(false);
  const notesRef = useRef<Notes[]>([]);
  const cursorRef = useRef<string | null>(null);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { cursorRef.current = cursor; }, [cursor]);

  const PAGE_SIZE = Number(process.env.NEXT_PUBLIC_NOTES_PAGE_SIZE || 50);

  const fetchBatch = useCallback(async (reset: boolean = false) => {
    if (isFetchingRef.current) return;

    if (!isAuthenticated) {
      if (!isAuthLoading) {
        setNotes([]);
        setTotalNotes(0);
        setIsLoading(false);
        setHasMore(false);
        setError(null);
        setPinnedIds([]);
      }
      return;
    }
    
    isFetchingRef.current = true;
    if (reset && notesRef.current.length === 0) {
      setIsLoading(true);
      setError(null);
    }

    try {
      // Fetch pinned IDs with optimization
      if (reset && PINNED_CACHE_KEY) {
        const pIds = await fetchOptimized(PINNED_CACHE_KEY, getPinnedNoteIds);
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
        const batch = (res?.documents || []).map((note: Notes) => normalizeVisibility(note)) as Notes[];
        setNotes(batch);
        setTotalNotes(res?.total || 0);
        setHasMore(!!res?.hasMore);
        setCursor(res?.nextCursor || null);

        // Also cache individual notes for NoteEditorPage
        batch.forEach(note => {
          if (note?.$id) setCachedData(`note_${note.$id}`, note);
        });

      } else {
        // Normal pagination or force refetch
        res = await listNotesPaginated({
          limit: PAGE_SIZE,
          cursor: reset ? null : (cursorRef.current || null),
          userId: user?.$id,
        });

        const batch = (res?.documents || []).map((note: Notes) => normalizeVisibility(note)) as Notes[];

        setNotes(prev => {
          if (reset) return batch;
          const safePrev = Array.isArray(prev) ? prev : [];
          const existingIds = new Set(safePrev.map(n => n.$id));
          const newOnes = batch.filter(n => !existingIds.has(n.$id));
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
                notes: batch,
                totalNotes: res?.total || 0,
                cursor: res?.nextCursor || null,
                hasMore: !!res?.hasMore
            });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch notes');
      if (reset && notesRef.current.length === 0) {
        setNotes([]);
        setTotalNotes(0);
      }
      setHasMore(false);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [isAuthenticated, isAuthLoading, user?.$id, PAGE_SIZE, fetchOptimized, setCachedData, PINNED_CACHE_KEY, INITIAL_NOTES_CACHE_KEY]);

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
      setNotes([]);
      setTotalNotes(0);
      setHasMore(false);
      setIsLoading(false);
      setError(null);
      setPinnedIds([]);
      hasInitiallyFetched.current = false;
    }
  }, [isAuthenticated, isAuthLoading, user?.$id, fetchBatch, isCacheLoaded, notes.length]);

  const upsertNote = useCallback((note: Notes) => {
    const normalized = normalizeVisibility(note);
    const existed = notesRef.current.some((n) => n.$id === note.$id);
    setNotes((prev) => {
      if (existed) {
        return prev.map((item) => (item.$id === normalized.$id ? normalized : item));
      }
      return [normalized, ...prev];
    });
    if (!existed) {
      setTotalNotes((prev) => prev + 1);
    }
    // Update individual note cache
    setCachedData(`note_${normalized.$id}`, normalized);
  }, [setCachedData]);

  const opportunisticallyDecryptNote = useCallback(async (note: Notes) => {
    if (!note?.$id) return;

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
  }, [invalidate]);

  // Realtime subscription
  useEffect(() => {
    if (!isAuthenticated || !user?.$id) return;

    // Listen to the entire collection to catch all relevant changes
    const channel = `databases.${APPWRITE_DATABASE_ID}.collections.${APPWRITE_TABLE_ID_NOTES}.documents`;
    
    const sub = realtime.subscribe(channel, (response) => {
      const payload = normalizeVisibility(response.payload as Notes);
      
      const isOwner = payload.userId === user.$id || (payload as any).owner_id === user.$id;
      if (!isOwner) return;

      const isCreate = response.events.some(e => e.endsWith('.create'));
      const isUpdate = response.events.some(e => e.endsWith('.update'));
      const isDelete = response.events.some(e => e.endsWith('.delete'));

      if (isCreate) {
        setNotes(prev => {
          if (prev.some(n => n.$id === payload.$id)) return prev;
          return [payload, ...prev];
        });
        setTotalNotes(prev => prev + 1);
        setCachedData(`note_${payload.$id}`, payload);
        void opportunisticallyDecryptNote(payload);
      } else if (isUpdate) {
        setNotes(prev => prev.map(n => n.$id === payload.$id ? payload : n));
        setCachedData(`note_${payload.$id}`, payload);
        void opportunisticallyDecryptNote(payload);
      } else if (isDelete) {
        setNotes(prev => prev.filter(n => n.$id !== payload.$id));
        setTotalNotes(prev => Math.max(0, prev - 1));
        setPinnedIds(prev => prev.filter(id => id !== payload.$id));
        invalidate(`note_${payload.$id}`);
      }
    });
    
    return () => {
      if (typeof sub === 'function') {
        (sub as any)();
      } else if (sub && typeof (sub as any).unsubscribe === 'function') {
        (sub as any).unsubscribe();
      }
    };
  }, [isAuthenticated, user?.$id, setCachedData, invalidate, opportunisticallyDecryptNote]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onVaultUnlocked = () => {
      void sweepEncryptedNotes();
    };
    window.addEventListener('kylrix:vault-unlocked', onVaultUnlocked);
    return () => window.removeEventListener('kylrix:vault-unlocked', onVaultUnlocked);
  }, [sweepEncryptedNotes]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!notesRef.current.length) return;
    if (!sweepInFlightRef.current) {
      void sweepEncryptedNotes();
    }
  }, [isAuthenticated, notes.length, sweepEncryptedNotes]);

  const pinNote = useCallback(async (noteId: string) => {
    try {
      const newPins = await appwritePinNote(noteId);
      setPinnedIds(newPins);
      if (PINNED_CACHE_KEY) setCachedData(PINNED_CACHE_KEY, newPins);
    } catch (err: any) {
      throw err;
    }
  }, [PINNED_CACHE_KEY, setCachedData]);

  const unpinNote = useCallback(async (noteId: string) => {
    try {
      const newPins = await appwriteUnpinNote(noteId);
      setPinnedIds(newPins);
      if (PINNED_CACHE_KEY) setCachedData(PINNED_CACHE_KEY, newPins);
    } catch (err: any) {
      throw err;
    }
  }, [PINNED_CACHE_KEY, setCachedData]);

  const isPinned = useCallback((noteId: string) => {
    return effectivePinnedIds.includes(noteId);
  }, [effectivePinnedIds]);

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      const aPinned = effectivePinnedIds.includes(a.$id);
      const bPinned = effectivePinnedIds.includes(b.$id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [notes, effectivePinnedIds]);

  return (
    <NotesContext.Provider
      value={{
        notes: sortedNotes,
        totalNotes: totalNotes || 0,
        isLoading,
        error,
        hasMore,
        loadMore,
        refetchNotes,
        upsertNote,
        removeNote,
        pinnedIds: effectivePinnedIds,
        pinNote,
        unpinNote,
        isPinned,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (context === undefined) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
}
