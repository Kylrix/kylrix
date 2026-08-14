'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Tag, X, ChevronRight, Plus } from 'lucide-react';
import { NoteObjectRow } from '@/components/ui/NoteObjectRow';
import { useNotes } from '@/context/NotesContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { PinnedNotesSidebar } from '@/components/ui/PinnedNotesSidebar';
import { useFAB } from '@/context/FABContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { ObjectCreateDrawer } from '@/components/objects/ObjectCreateDrawer';
import { toast } from 'react-hot-toast';

import Link from 'next/link';

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
  const { notes: allNotes, isLoading: isContextLoading, upsertNote, removeNote } = useNotes();
  const { openSidebar } = useDynamicSidebar();
  const { open: openUnified } = useUnifiedDrawer();
  const { setConfiguration, resetConfiguration } = useFAB();
  const [isDesktop, setIsDesktop] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [ecosystemTagsList, setEcosystemTagsList] = useState<{ name: string; color?: string }[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Hydrate tags from LocalEngine / Nexus
  useEffect(() => {
    void (async () => {
      try {
        const { account } = await import('@/lib/appwrite/client');
        const user = await account.get().catch(() => null);
        if (user?.$id) {
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          const cachedTags = await LocalEngine.cacheGet<any>(`f_tags_${user.$id}`);
          if (cachedTags?.rows && Array.isArray(cachedTags.rows) && cachedTags.rows.length > 0) {
            setEcosystemTagsList(cachedTags.rows);
          } else if (Array.isArray(cachedTags) && cachedTags.length > 0) {
            setEcosystemTagsList(cachedTags);
          }
        }
      } catch {}
    })();
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

  const activeNotes = (allNotes || []).filter((n) => !n.isTrash);
  const pinnedNotes = activeNotes.filter((n) => n.isPinned);
  const unpinnedNotes = activeNotes.filter((n) => !n.isPinned);

  const tags = React.useMemo(() => {
    const fromNotes = (allNotes || []).flatMap((n: any) => n.tags || []).filter(Boolean);
    const fromEcosystem = ecosystemTagsList.map((t) => t.name).filter(Boolean);
    return Array.from(new Set([...fromEcosystem, ...fromNotes])).slice(0, 16);
  }, [allNotes, ecosystemTagsList]);

  const displayPinned = selectedTag ? pinnedNotes.filter((n: any) => n.tags?.includes(selectedTag)) : pinnedNotes;
  const displayUnpinned = selectedTag ? unpinnedNotes.filter((n: any) => n.tags?.includes(selectedTag)) : unpinnedNotes;

  const loading = isContextLoading && activeNotes.length === 0;

  const handleDeleteNote = useCallback((noteId: string) => {
    removeNote(noteId);
  }, [removeNote]);

  return (
    <div className="flex-1 min-h-screen pointer-events-auto">
      <div className="w-full max-w-[1440px] mx-auto p-4 md:p-8">
        <div className="min-w-0 w-full flex flex-col gap-6">
          {/* Top Nav Switcher (Goals-inspired structure) */}
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
            <Link
              href="/tags"
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all text-white/50 hover:text-white hover:bg-white/5"
            >
              Tags
            </Link>
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
        <div className="p-8 text-center text-white/40">No ideas found.</div>
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

      <ObjectCreateDrawer
        open={createOpen}
        kind="note"
        onClose={() => setCreateOpen(false)}
        onNoteCreated={(note) => {
          if (!note?.$id) return;
          upsertNote(note as any);
          toast.success('Idea saved locally');
        }}
      />
    </div>
  );
}
