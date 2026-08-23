'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Tag, X, ChevronRight, Plus } from 'lucide-react';
import { NoteObjectRow } from '@/components/ui/NoteObjectRow';
import { useNotes } from '@/context/NotesContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { PinnedNotesSidebar } from '@/components/ui/PinnedNotesSidebar';
import { useFAB } from '@/context/FABContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useWorkspace } from '@/context/WorkspaceContext';

import Link from 'next/link';
import { HangoutTabTrigger } from '@/components/hangout/HangoutTabTrigger';

const TAG_COLOR_MAP: Record<string, string> = {
  Personal: '#3B82F6',
  Work: '#F59E0B',
  Ideas: '#EC4899',
  'To-Do': '#10B981',
  Urgent: '#EF4444',
  Important: '#8B5CF6'
};

function getTagColor(tagName: string): string | null {
  if (TAG_COLOR_MAP[tagName]) return TAG_COLOR_MAP[tagName];
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 65%)`;
}

export default function IdeasPage() {
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { notes: contextNotes, upsertNote } = useNotes();
  const { activeWorkspace } = useWorkspace();
  const { openSidebar } = useDynamicSidebar();

  const { open: openUnified } = useUnifiedDrawer();
  const { setConfiguration, resetConfiguration } = useFAB();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const fetchNotesBarebones = async (hasLocal = false) => {
    if (!hasLocal) {
      setLoading(true);
    }
    setError(null);

    // If offline, don't stall on network
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false);
      return;
    }

    try {
      const { Query, Client, TablesDB } = await import('appwrite');
      const { account, databases, getCurrentUserSnapshot } = await import('@/lib/appwrite/client');
      const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');

      const user = (await account.get().catch(() => null)) || getCurrentUserSnapshot();
      if (!user?.$id) {
        if (!hasLocal) {
          setError('Unauthenticated user session');
        }
        setLoading(false);
        return;
      }

      const dbId = APPWRITE_CONFIG.DATABASES.NOTE;
      const tableId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

      const client = new Client()
        .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
        .setProject(APPWRITE_CONFIG.PROJECT_ID);
      const tablesDB = new TablesDB(client);

      const res = await tablesDB.listRows(dbId, tableId, [
        Query.equal('userId', user.$id),
        Query.limit(50),
        Query.orderDesc('$updatedAt')
      ]).catch(async () => {
        return await (databases as any).listDocuments(dbId, tableId, [
          Query.equal('userId', user.$id),
          Query.limit(50),
          Query.orderDesc('$updatedAt')
        ]);
      });

      const rows = Array.isArray(res?.rows) ? res.rows : Array.isArray(res?.documents) ? res.documents : [];
      const validRows = rows.filter((n: any) => n && n.isTrash !== true && n.isDeleted !== true && String(n.isTrash) !== 'true' && String(n.isDeleted) !== 'true');

      // Read local pins state directly from ResourcePinContext storage key
      let pinnedMap: Record<string, boolean> = {};
      try {
        const storedPins = localStorage.getItem(`kylrix_resource_pins_${user.$id}`);
        if (storedPins) {
          const parsed = JSON.parse(storedPins);
          if (Array.isArray(parsed)) {
            parsed.forEach((id: string) => { pinnedMap[id] = true; });
          }
        }
      } catch {}

      // Pure client-side sort: Pinned first, then newest updatedAt
      const sorted = [...validRows].sort((a: any, b: any) => {
        const aPinned = Boolean(a.isPinned || pinnedMap[a.$id]);
        const bPinned = Boolean(b.isPinned || pinnedMap[b.$id]);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        const aTime = new Date(a.$updatedAt || a.updatedAt || a.$createdAt || 0).getTime();
        const bTime = new Date(b.$updatedAt || b.updatedAt || b.$createdAt || 0).getTime();
        return bTime - aTime;
      });

      // Stamp isPinned and isGuest from local data, then feed into NotesContext
      // so NoteCard's liveNote lookup finds the correctly stamped object
      const stamped = sorted.map((n: any) => {
        const isShared = Boolean(n.isGuest || (n.$permissions && n.$permissions.some((p: string) => p.includes('user:') && !p.includes(`user:${n.userId}`))));
        return {
          ...n,
          isPinned: Boolean(n.isPinned || pinnedMap[n.$id]),
          isGuest: Boolean(n.isGuest || isShared),
        };
      });

      // Feed into NotesContext so NoteCard's liveNote resolves correctly
      stamped.forEach((n: any) => upsertNote(n));

      setNotes(stamped);

      // Non-blocking LocalEngine background copy write (Goals/Vault local-first pattern)
      void (async () => {
        try {
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          await LocalEngine.cacheSet(`f_ideas_${user.$id}`, { rows: stamped, total: stamped.length });
          await LocalEngine.cacheSet(`f_notes_list_${user.$id}`, stamped);
        } catch {}
      })();
    } catch (err: any) {
      if (!hasLocal) {
        setError(err?.message || String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const openCreateNote = useCallback(() => {
    openUnified('note', { isPublic: false, isGuest: false });
  }, [openUnified]);

  useEffect(() => {
    if (isDesktop) {
      resetConfiguration();
      return;
    }
    setConfiguration({
      isVisible: true,
      mainColor: '#EC4899',
      mainIcon: <Plus size={32} strokeWidth={3} />,
      onMainClick: openCreateNote,
      suppressWorkflow: true,
      actions: [],
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, openCreateNote, isDesktop]);

  useEffect(() => {
    let hasLocalCopy = false;

    // Instant local-first render (0ms) from LocalEngine, RxDB, and Nexus caches
    void (async () => {
      try {
        const { getCurrentUserSnapshot } = await import('@/lib/appwrite/client');
        const snap = getCurrentUserSnapshot();
        const userId = snap?.$id || (typeof window !== 'undefined' ? (localStorage.getItem('kylrix_last_logged_in_user_acc_default') ? JSON.parse(localStorage.getItem('kylrix_last_logged_in_user_acc_default') || '{}').$id : null) : null) || 'guest';

        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const [cachedIdeas, cachedNotesList, cachedInitial, cachedTags] = await Promise.all([
          LocalEngine.cacheGet<{ rows?: any[] } | any[]>(`f_ideas_${userId}`).catch(() => null),
          LocalEngine.cacheGet<any[]>(`f_notes_list_${userId}`).catch(() => null),
          LocalEngine.cacheGet<{ notes?: any[]; rows?: any[] } | any[]>(`initial_notes_${userId}`).catch(() => null),
          LocalEngine.cacheGet<any>(`f_tags_${userId}`).catch(() => null),
        ]);

        const rawRows =
          (Array.isArray(cachedIdeas) ? cachedIdeas : cachedIdeas?.rows) ||
          cachedNotesList ||
          (Array.isArray(cachedInitial) ? cachedInitial : cachedInitial?.notes || cachedInitial?.rows) ||
          [];

        const validRawRows = Array.isArray(rawRows)
          ? rawRows.filter((n: any) => n && n.isTrash !== true && n.isDeleted !== true && String(n.isTrash) !== 'true' && String(n.isDeleted) !== 'true')
          : [];

        if (validRawRows.length > 0) {
          hasLocalCopy = true;

          // Read local pins
          let pinnedMap: Record<string, boolean> = {};
          try {
            const storedPins = localStorage.getItem(`kylrix_resource_pins_${userId}`);
            if (storedPins) {
              const parsed = JSON.parse(storedPins);
              if (Array.isArray(parsed)) {
                parsed.forEach((id: string) => { pinnedMap[id] = true; });
              }
            }
          } catch {}

          const sorted = [...validRawRows].sort((a: any, b: any) => {
            const aPinned = Boolean(a.isPinned || pinnedMap[a.$id || a.id]);
            const bPinned = Boolean(b.isPinned || pinnedMap[b.$id || b.id]);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            const aTime = new Date(a.$updatedAt || a.updatedAt || a.$createdAt || 0).getTime();
            const bTime = new Date(b.$updatedAt || b.updatedAt || b.$createdAt || 0).getTime();
            return bTime - aTime;
          });

          const stamped = sorted.map((n: any) => ({
            ...n,
            $id: n.$id || n.id,
            isPinned: Boolean(n.isPinned || pinnedMap[n.$id || n.id]),
          }));

          stamped.forEach((n: any) => upsertNote(n));
          setNotes(stamped);
          setLoading(false);
        } else {
          // If no local copy exists, clear loading quickly so it never says loading forever
          setLoading(false);
        }

        if (cachedTags?.rows && Array.isArray(cachedTags.rows) && cachedTags.rows.length > 0) {
          setEcosystemTagsList(cachedTags.rows);
        } else if (Array.isArray(cachedTags) && cachedTags.length > 0) {
          setEcosystemTagsList(cachedTags);
        }
      } catch {
        setLoading(false);
      }

      void fetchNotesBarebones(hasLocalCopy);
    })();
  }, []);

  // Eagerly pull custom workspace notes into local notes state when switching workspaces
  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.isPersonal) return;
    const wsId = activeWorkspace.id;
    let cancelled = false;

    void (async () => {
      try {
        const { ProjectsService } = await import('@/lib/appwrite/projects');
        const tagged = await ProjectsService.listTaggedResources(wsId).catch(() => null);
        if (tagged?.notes && Array.isArray(tagged.notes) && tagged.notes.length > 0 && !cancelled) {
          setNotes((prev) => {
            const byId = new Map(prev.map((n) => [n.$id, n]));
            tagged.notes.forEach((n: any) => {
              const id = n.$id || n.id;
              if (id) byId.set(id, { ...byId.get(id), ...n, $id: id, projectId: wsId, isWorkspace: true });
            });
            return Array.from(byId.values());
          });
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.id]);

  // Instantly reflect any created / updated notes from NotesContext (0ms live-copy)
  useEffect(() => {
    if (contextNotes && contextNotes.length > 0) {
      setNotes((prev) => {
        const byId = new Map(prev.map((n) => [n.$id, n]));
        let hasChanges = false;
        for (const cn of contextNotes) {
          const existing = byId.get(cn.$id);
          if (!existing) {
            byId.set(cn.$id, cn);
            hasChanges = true;
          } else if (
            existing.title !== cn.title ||
            existing.content !== cn.content ||
            existing.isPinned !== cn.isPinned
          ) {
            byId.set(cn.$id, { ...existing, ...cn });
            hasChanges = true;
          }
        }
        if (!hasChanges && prev.length === byId.size) return prev;
        return Array.from(byId.values()).sort((a: any, b: any) => {
          const aPinned = Boolean(a.isPinned);
          const bPinned = Boolean(b.isPinned);
          if (aPinned && !bPinned) return -1;
          if (!aPinned && bPinned) return 1;
          const aTime = new Date(a.$updatedAt || a.updatedAt || a.$createdAt || 0).getTime();
          const bTime = new Date(b.$updatedAt || b.updatedAt || b.$createdAt || 0).getTime();
          return bTime - aTime;
        });
      });
      setLoading(false);
    }
  }, [contextNotes]);

  // Listen for instant live note creation and save events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleLiveNote = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      const note = detail?.note || detail?.syncedNote;
      if (!note?.$id && !note?.id) return;
      const id = note.$id || note.id;
      const stamped = { ...note, $id: id };
      setNotes((prev) => {
        const existing = prev.find((n) => n.$id === id);
        if (existing) {
          return prev.map((n) => (n.$id === id ? { ...existing, ...stamped } : n));
        }
        return [stamped, ...prev];
      });
      setLoading(false);
    };
    window.addEventListener('kylrix:live-note-saved', handleLiveNote);
    window.addEventListener('kylrix:sync-complete', handleLiveNote);
    return () => {
      window.removeEventListener('kylrix:live-note-saved', handleLiveNote);
      window.removeEventListener('kylrix:sync-complete', handleLiveNote);
    };
  }, []);

  // Listen for instant optimistic pin toggles across cards, sidebars, and drawers
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePinEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail?.noteId) return;
      setNotes((prev) =>
        prev.map((n) => (n.$id === detail.noteId ? { ...n, isPinned: detail.isPinned } : n))
      );
    };
    window.addEventListener('kylrix:note-pinned', handlePinEvent);
    return () => window.removeEventListener('kylrix:note-pinned', handlePinEvent);
  }, []);

  const [ecosystemTagsList, setEcosystemTagsList] = useState<{ name: string; color?: string }[]>([]);

  const activeNotes = (contextNotes || []).filter((n) => n);
  const pinnedNotes = activeNotes.filter((n) => n.isPinned);
  const unpinnedNotes = activeNotes.filter((n) => !n.isPinned);

  const tags = React.useMemo(() => {
    const fromNotes = notes.flatMap((n: any) => n.tags || []).filter(Boolean);
    const fromEcosystem = ecosystemTagsList.map((t) => t.name).filter(Boolean);
    return Array.from(new Set([...fromEcosystem, ...fromNotes])).slice(0, 16);
  }, [notes, ecosystemTagsList]);

  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const displayPinned = selectedTag ? pinnedNotes.filter((n: any) => n.tags?.includes(selectedTag)) : pinnedNotes;
  const displayUnpinned = selectedTag ? unpinnedNotes.filter((n: any) => n.tags?.includes(selectedTag)) : unpinnedNotes;

  const handleDeleteNote = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.$id !== noteId));
  }, []);

  return (
    <div className="flex-1 min-h-screen pointer-events-auto">
      <div className="w-full max-w-[1440px] mx-auto p-4 md:p-8">
        <div className="min-w-0 w-full flex flex-col gap-6">
          {/* Top Nav Switcher */}
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl w-fit select-none">
              <Link
                href="/app"
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all bg-[#EC4899] text-white shadow-[0_4px_12px_rgba(236,72,153,0.25)]"
              >
                Ideas
              </Link>
              <Link
                href="/forms"
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all text-white/50 hover:text-white hover:bg-white/5"
              >
                Forms
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <HangoutTabTrigger />
              <button
                type="button"
                onClick={openCreateNote}
                className="hidden md:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#EC4899] text-white hover:bg-[#db2777] active:scale-95 transition-all shadow-[0_4px_14px_rgba(236,72,153,0.3)] select-none shrink-0"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>New Idea</span>
              </button>
            </div>
          </div>

          {/* Tags Filter Row (positioned under top nav switcher like Goals) */}
          {tags.length > 0 && (
            <div className="overflow-x-auto scrollbar-none p-2 bg-white/[0.01] border border-white/5 rounded-[24px] flex items-center gap-2 select-none">
              <Tag size={14} className="text-[#EC4899]/60 ml-2 shrink-0" />
              {tags.map((tag: string, index: number) => {
                const tagColor = getTagColor(tag);
                const isSelected = selectedTag === tag;
                return (
                  <button
                    key={index}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedTag(isSelected ? null : tag)}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                      isSelected 
                        ? 'bg-[#EC4899] border-[#EC4899] text-white shadow-[0_4px_12px_rgba(236,72,153,0.2)]' 
                        : 'bg-white/3 border-white/8 text-white/60 hover:text-white hover:border-white/15'
                    }`}
                    style={
                      !isSelected && tagColor
                        ? { borderColor: `${tagColor}33`, color: tagColor }
                        : undefined
                    }
                  >
                    {tag}
                  </button>
                );
              })}
              {selectedTag && (
                <button
                  type="button"
                  onClick={() => setSelectedTag(null)}
                  className="ml-2 px-3 py-1.5 text-xs text-[#EC4899] hover:text-[#f472b6] font-mono font-bold tracking-wider flex items-center gap-1 shrink-0"
                >
                  <X size={12} />
                  Clear
                </button>
              )}
            </div>
          )}

      {error && (
        <div className="p-4 bg-red-950/60 border border-red-500/50 rounded-2xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-white/40">Loading ideas...</div>
      ) : notes.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center justify-center gap-4 bg-white/[0.01] border border-white/5 rounded-3xl">
          <p className="text-white/40 text-sm">No ideas found.</p>
          <button
            type="button"
            onClick={openCreateNote}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-[#EC4899] text-white hover:bg-[#db2777] transition-all shadow-[0_4px_12px_rgba(236,72,153,0.25)] select-none"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Create your first idea</span>
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pinned Section */}
          {displayPinned.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-mono font-bold text-white/40 uppercase tracking-wider">
                  Pinned ({Math.min(3, displayPinned.length)})
                </h2>
                {displayPinned.length > 3 && (
                  <button
                    type="button"
                    onClick={() => openSidebar(<PinnedNotesSidebar offset={3} notes={displayPinned} />, 'pinned-notes', { hideHeader: true })}
                    className="text-xs font-bold text-[#EC4899] hover:text-[#f472b6] transition-colors flex items-center gap-1 font-mono select-none"
                  >
                    <span>See More ({displayPinned.length - 3})</span>
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayPinned.slice(0, 3).map((note) => (
                  <NoteObjectRow key={note.$id} note={note} onDelete={handleDeleteNote} />
                ))}
              </div>
            </div>
          )}

          {/* All Ideas Section */}
          {displayUnpinned.length > 0 && (
            <div className="space-y-3">
              {displayPinned.length > 0 && (
                <h2 className="text-xs font-mono font-bold text-white/40 uppercase tracking-wider px-1 pt-2">
                  All Ideas ({displayUnpinned.length})
                </h2>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayUnpinned.map((note) => (
                  <NoteObjectRow key={note.$id} note={note} onDelete={handleDeleteNote} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
