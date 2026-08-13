'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Tag, X, ChevronRight, Plus } from 'lucide-react';
import { NoteObjectRow } from '@/components/ui/NoteObjectRow';
import { useNotes } from '@/context/NotesContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { PinnedNotesSidebar } from '@/components/ui/PinnedNotesSidebar';
import { useFAB } from '@/context/FABContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { ObjectCreateDrawer } from '@/components/objects/ObjectCreateDrawer';
import { toast } from 'react-hot-toast';

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
  const { upsertNote } = useNotes();
  const { openSidebar } = useDynamicSidebar();

  const fetchNotesBarebones = async () => {
    setLoading(true);
    setError(null);

    try {
      const { Query, Client, TablesDB } = await import('appwrite');
      const { account, databases } = await import('@/lib/appwrite/client');
      const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');

      const user = await account.get().catch(() => null);
      if (!user?.$id) {
        setError('Unauthenticated user session');
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
      const sorted = [...rows].sort((a: any, b: any) => {
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
        } catch {}
      })();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const { open: openUnified } = useUnifiedDrawer();
  const { setConfiguration, resetConfiguration } = useFAB();
  const [isDesktop, setIsDesktop] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const openCreateNote = useCallback(() => {
    setCreateOpen(true);
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
    // Fast initial render from LocalEngine cache if available (Goals/Vault local-first pattern)
    void (async () => {
      try {
        const { account } = await import('@/lib/appwrite/client');
        const user = await account.get().catch(() => null);
        if (user?.$id) {
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          const cached = await LocalEngine.cacheGet<{ rows: any[] }>(`f_ideas_${user.$id}`);
          if (cached?.rows && Array.isArray(cached.rows) && cached.rows.length > 0) {
            setNotes((prev) => (prev.length === 0 ? cached.rows : prev));
            setLoading(false);
          }
        }
      } catch {}
    })();

    void fetchNotesBarebones();
  }, []);

  const pinnedNotes = notes.filter((n) => n.isPinned);
  const unpinnedNotes = notes.filter((n) => !n.isPinned);

  const tags = React.useMemo(() => {
    const allTags = notes.flatMap((n: any) => n.tags || []).filter(Boolean);
    return Array.from(new Set(allTags)).slice(0, 8);
  }, [notes]);

  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const displayPinned = selectedTag ? pinnedNotes.filter((n: any) => n.tags?.includes(selectedTag)) : pinnedNotes;
  const displayUnpinned = selectedTag ? unpinnedNotes.filter((n: any) => n.tags?.includes(selectedTag)) : unpinnedNotes;

  const [activeMainTab, setActiveMainTab] = useState<'ideas' | 'forms' | 'tags'>('ideas');

  return (
    <div className="flex-1 min-h-screen pointer-events-auto">
      <div className="w-full max-w-[1440px] mx-auto p-4 md:p-8">
        <div className="min-w-0 w-full flex flex-col gap-6">
          {/* Top Nav Switcher (Goals-inspired structure) */}
          <div className="flex items-center gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl w-fit select-none">
            <button
              type="button"
              onClick={() => setActiveMainTab('ideas')}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                activeMainTab === 'ideas'
                  ? 'bg-[#EC4899] text-white shadow-[0_4px_12px_rgba(236,72,153,0.25)]'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              Ideas
            </button>
            <button
              type="button"
              onClick={() => setActiveMainTab('forms')}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                activeMainTab === 'forms'
                  ? 'bg-[#EC4899] text-white shadow-[0_4px_12px_rgba(236,72,153,0.25)]'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              Forms
            </button>
            <button
              type="button"
              onClick={() => setActiveMainTab('tags')}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                activeMainTab === 'tags'
                  ? 'bg-[#EC4899] text-white shadow-[0_4px_12px_rgba(236,72,153,0.25)]'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              Tags
            </button>
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

          {activeMainTab === 'forms' ? (
            <div className="p-12 text-center rounded-[32px] bg-[#161412] border border-white/5 text-white/40 font-mono text-sm">
              Forms Tab View
            </div>
          ) : activeMainTab === 'tags' ? (
            <div className="p-12 text-center rounded-[32px] bg-[#161412] border border-white/5 text-white/40 font-mono text-sm">
              Global Tags Sweeper View
            </div>
          ) : (
            <>
              {/* Header Bar */}
              <header className="flex items-center justify-between p-5 bg-white/[0.01] border border-white/8 rounded-[32px] shadow-2xl relative select-none">
                <div className="flex items-center gap-3">
                  <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight leading-tight font-mono tracking-tighter">
                    Ideas
                  </h1>
                  <button
                    onClick={() => void fetchNotesBarebones()}
                    disabled={loading}
                    className="w-9 h-9 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 flex items-center justify-center transition-all duration-300 disabled:opacity-40"
                    title="Refresh Ideas"
                  >
                    <RefreshCw size={15} className={`transition-all ${loading ? 'animate-spin text-[#EC4899]' : 'text-white/60'}`} />
                  </button>
                </div>

                <p className="text-white/40 text-xs font-semibold leading-normal font-sans">
                  <span className="font-mono font-bold text-[#EC4899]">{notes.length}</span> {notes.length === 1 ? 'idea' : 'ideas'}
                </p>
              </header>
            </>
          )}

      {error && (
        <div className="p-4 bg-red-950/60 border border-red-500/50 rounded-2xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-white/40">Loading ideas...</div>
      ) : notes.length === 0 ? (
        <div className="p-8 text-center text-white/40">No ideas found.</div>
      ) : (
        <div className="space-y-8">
          {/* Pinned Section */}
          {displayPinned.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-mono font-bold text-white/40 uppercase tracking-wider">
                  Pinned ({displayPinned.length})
                </h2>
                {displayPinned.length > 3 && (
                  <button
                    type="button"
                    onClick={() => openSidebar(<PinnedNotesSidebar offset={3} />, 'pinned-notes', { hideHeader: true })}
                    className="text-xs font-bold text-[#EC4899] hover:text-[#f472b6] transition-colors flex items-center gap-1 font-mono select-none"
                  >
                    <span>See More ({displayPinned.length - 3})</span>
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayPinned.slice(0, 3).map((note) => (
                  <NoteObjectRow key={note.$id} note={note} />
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
                  <NoteObjectRow key={note.$id} note={note} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
        </div>
      </div>

      <ObjectCreateDrawer
        open={createOpen}
        kind="note"
        onClose={() => setCreateOpen(false)}
        onNoteCreated={(note) => {
          if (!note?.$id) return;
          upsertNote(note as any);
          setNotes((prev) => {
            if (prev.some((n) => n.$id === note.$id)) {
              return prev.map((n) => (n.$id === note.$id ? { ...n, ...note } : n));
            }
            return [note, ...prev];
          });
          toast.success('Idea saved locally');
        }}
      />
    </div>
  );
}
