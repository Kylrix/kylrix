'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Tag, X, ChevronRight, Plus, FileText, FileSpreadsheet } from 'lucide-react';

import { NoteObjectRow } from '@/components/ui/NoteObjectRow';
import { useNotes } from '@/context/NotesContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { PinnedNotesSidebar } from '@/components/ui/PinnedNotesSidebar';
import { useFAB } from '@/context/FABContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useWorkspaceFilteredItems } from '@/hooks/useWorkspaceFilteredItems';
import Link from 'next/link';
import { HangoutTabTrigger } from '@/components/hangout/HangoutTabTrigger';
import { FlowTabTrigger } from '@/components/flows/FlowTabTrigger';

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
  const { notes, isLoading: loading, error, removeNote } = useNotes();
  const { openSidebar } = useDynamicSidebar();
  const { open: openUnified } = useUnifiedDrawer();
  const { setConfiguration, resetConfiguration } = useFAB();

  const openCreateNote = useCallback(() => {
    openUnified('note', { isPublic: false, isGuest: false });
  }, [openUnified]);

  useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: '#EC4899',
      mainIcon: <Plus size={26} strokeWidth={3} />,
      onMainClick: openCreateNote,
      suppressWorkflow: true,
      actions: [],
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, openCreateNote]);

  const activeNotes = useMemo(() => (notes || []).filter((n: any) => n && n.isTrash !== true && n.isDeleted !== true), [notes]);
  const { filteredItems: workspaceScopedNotes } = useWorkspaceFilteredItems(activeNotes, 'note');

  const pinnedNotes = useMemo(() => workspaceScopedNotes.filter((n: any) => Boolean(n.isPinned)), [workspaceScopedNotes]);
  const unpinnedNotes = useMemo(() => workspaceScopedNotes.filter((n: any) => !n.isPinned), [workspaceScopedNotes]);

  const tags = useMemo(() => {
    const fromNotes = workspaceScopedNotes.flatMap((n: any) => n.tags || []).filter(Boolean);
    return Array.from(new Set(fromNotes)).slice(0, 16);
  }, [workspaceScopedNotes]);

  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const displayPinned = useMemo(() => {
    return selectedTag ? pinnedNotes.filter((n: any) => n.tags?.includes(selectedTag)) : pinnedNotes;
  }, [pinnedNotes, selectedTag]);

  const displayUnpinned = useMemo(() => {
    return selectedTag ? unpinnedNotes.filter((n: any) => n.tags?.includes(selectedTag)) : unpinnedNotes;
  }, [unpinnedNotes, selectedTag]);

  const handleDeleteNote = useCallback((noteId: string) => {
    removeNote(noteId);
  }, [removeNote]);

  return (
    <div className="flex-1 min-h-screen pointer-events-auto">
      <div className="w-full max-w-[1440px] mx-auto p-4 md:p-8">
        <div className="min-w-0 w-full flex flex-col gap-6">
          {/* Top Nav Switcher */}
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 bg-[#000000] border-2 border-white/20 rounded-2xl w-fit select-none shadow-md">
              <Link
                href="/app"
                className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-extrabold transition-all bg-[#EC4899] text-white border border-[#EC4899] shadow-[0_4px_12px_rgba(236,72,153,0.25)]"
                title="Ideas"
                aria-label="Ideas"
              >
                <FileText size={15} />
                <span className="hidden sm:inline">Ideas</span>
              </Link>
              <Link
                href="/forms"
                className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-extrabold transition-all text-white border border-white/10 hover:border-white/30 hover:bg-white/[0.06]"
                title="Forms"
                aria-label="Forms"
              >
                <FileSpreadsheet size={15} />
                <span className="hidden sm:inline">Forms</span>
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <FlowTabTrigger />
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

          {/* Tags Filter Row */}
          {tags.length > 0 && (
            <div className="overflow-x-auto scrollbar-none p-2 bg-[#000000] border-2 border-white/20 rounded-[24px] flex items-center gap-2 select-none shadow-md">
              <Tag size={14} className="text-[#EC4899] ml-2 shrink-0" />
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
                        ? 'bg-[#EC4899] border-2 border-[#FFFFFF] text-white shadow-[0_4px_12px_rgba(236,72,153,0.2)]' 
                        : 'bg-[#161412] border border-white/25 text-white hover:border-white/60 hover:bg-[#201D1A]'
                    }`}
                    style={
                      !isSelected && tagColor
                        ? { borderColor: `${tagColor}99`, color: '#FFFFFF' }
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

          {loading && workspaceScopedNotes.length === 0 ? (
            <div className="p-8 text-center text-white text-sm font-semibold">Loading ideas...</div>
          ) : workspaceScopedNotes.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-4 bg-[#000000] border border-white/[0.08] rounded-3xl">
              <p className="text-white text-sm font-semibold">No ideas found.</p>
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
                    <h2 className="text-[11px] font-mono font-bold text-white uppercase tracking-wider">
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
                    <h2 className="text-[11px] font-mono font-bold text-white uppercase tracking-wider px-1 pt-2">
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
