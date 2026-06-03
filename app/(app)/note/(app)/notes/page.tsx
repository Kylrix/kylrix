"use client";

import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { deleteNote } from '@/lib/actions/client-ops';
import { useNotes } from '@/context/NotesContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Notes } from '@/types/appwrite';
import NoteCard from '@/components/ui/NoteCard';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { useSearch } from '@/hooks/useSearch';
import { useFAB } from '@/context/FABContext';
import { 
  Search as SearchIcon, 
  PlusCircle as PlusCircleIcon, 
  ArrowLeft as ArrowLeftIcon, 
  ArrowRight as ArrowRightIcon, 
  Pin as PinIcon, 
  RefreshCw as RefreshIcon, 
  FolderKanban as ProjectIcon, 
  FileText as NoteIcon, 
  Tag as TagIcon,
  ChevronDown, 
  ChevronUp, 
  Maximize2, 
  Share2,
  Info
} from 'lucide-react';
import { getSharedNotes } from '@/lib/appwrite';
import { ProjectsService } from '@/lib/appwrite/projects';
import CreateNoteForm from './CreateNoteForm';
import { useSidebar } from '@/components/ui/SidebarContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { NoteDetailSidebar } from '@/components/ui/NoteDetailSidebar';
import { sidebarIgnoreProps } from '@/constants/sidebar';
import { NotesErrorBoundary } from '@/components/ui/ErrorBoundary';
import { PinnedNotesSidebar } from '@/components/ui/PinnedNotesSidebar';

// Client-side persistence cache to resist reload flicker
let cachedSharedNotes: any[] | null = null;
let cachedProjects: any[] | null = null;

// Lightweight custom hook to track responsive breakpoint without MUI
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 768px)');
    const listener = () => setIsDesktop(media.matches);
    listener();
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);
  return isDesktop;
}

export default function NotesPage() {
  const { 
    notes: allNotes, 
    totalNotes, 
    isLoading: isInitialLoading, 
    upsertNote, 
    removeNote,
    refetchNotes,
    isPinned
  } = useNotes();
  const { openOverlay, closeOverlay } = useOverlay();
  const { setConfiguration, resetConfiguration } = useFAB();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const { isOpen: isDynamicSidebarOpen, openSidebar, activeContentKey } = useDynamicSidebar();
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const openNoteIdParam = searchParams.get('openNoteId');

  const isDesktop = useIsDesktop();

  // Collapsible accordion state for the desktop right pane
  const [sharedNotesOpen, setSharedNotesOpen] = useState(true);
  const [projectsOpen, setProjectsOpen] = useState(true);

  // Projects data state
  const [projects, setProjects] = useState<any[]>(() => cachedProjects || []);
  const [projectsLoading, setProjectsLoading] = useState(() => !cachedProjects);

  // Shared Notes data state
  const [sharedNotes, setSharedNotes] = useState<any[]>(() => cachedSharedNotes || []);
  const [sharedNotesLoading, setSharedNotesLoading] = useState(() => !cachedSharedNotes);

  useEffect(() => {
    let mounted = true;
    
    async function loadRightPaneData() {
      try {
        // Fetch projects
        ProjectsService.listProjects()
          .then(res => {
            if (mounted) {
              cachedProjects = res.rows || [];
              setProjects(res.rows || []);
              setProjectsLoading(false);
            }
          })
          .catch(err => {
            console.error('Failed to load projects inside Notes page:', err);
            if (mounted) setProjectsLoading(false);
          });

        // Fetch shared notes
        getSharedNotes()
          .then(res => {
            if (mounted) {
              cachedSharedNotes = res.rows || [];
              setSharedNotes(res.rows || []);
              setSharedNotesLoading(false);
            }
          })
          .catch(err => {
            console.error('Failed to load shared notes inside Notes page:', err);
            if (mounted) setSharedNotesLoading(false);
          });
      } catch (err) {
        console.error('Error fetching right-pane data:', err);
      }
    }

    loadRightPaneData();

    return () => {
      mounted = false;
    };
  }, []);

  const visibleNotes = useMemo(() => {
    const safeNotes = Array.isArray(allNotes) ? allNotes : [];
    return safeNotes.filter((n: any) => {
      try {
        const meta = JSON.parse(n.metadata || '{}');
        const isEncrypted = meta.isEncrypted === true || meta.isEncrypted === 'true' || n.isEncrypted === true;
        return !isEncrypted;
      } catch {
        return !n.isEncrypted;
      }
    });
  }, [allNotes]);

  // Pinned Notes are filtered cleanly using the native boolean column and preference/fallback checking
  const pinnedNotes = useMemo(() => {
    if (searchParams.get('query')) return [];
    return visibleNotes.filter(n => isPinned(n.$id));
  }, [visibleNotes, searchParams, isPinned]);

  // Regular source notes exclude pinned notes when there is no active search query
  const regularSourceNotes = useMemo(() => {
    const hasSearch = searchParams.get('query');
    if (hasSearch) return visibleNotes;
    return visibleNotes.filter(n => !isPinned(n.$id));
  }, [visibleNotes, searchParams, isPinned]);

  // Fetch notes action for the search hook
  const fetchNotesAction = useCallback(async () => {
    const safeNotes = Array.isArray(regularSourceNotes) ? regularSourceNotes : [];
    return {
      documents: safeNotes,
      total: safeNotes.length
    };
  }, [regularSourceNotes]);

  // Search and pagination configuration
  const searchConfig = useMemo(() => ({
    searchFields: ['title', 'content', 'tags'],
    localSearch: true,
    threshold: 500,
    debounceMs: 300
  }), []);

  // Derive UI page size from viewport
  const derivedPageSize = useMemo(() => {
    if (typeof window === 'undefined') return 12;
    const width = window.innerWidth;
    if (width < 640) return 8;
    if (width < 1024) return 12;
    if (width < 1440) return 16;
    return 20;
  }, []);

  const paginationConfig = useMemo(() => ({
    pageSize: derivedPageSize
  }), [derivedPageSize]);

  // Use the search hook
  const {
    items: paginatedNotes,
    totalCount,
    error,
    searchQuery,
    setSearchQuery,
    hasSearchResults,
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    goToPage,
    nextPage,
    previousPage,
    clearSearch
  } = useSearch({
    data: regularSourceNotes,
    fetchDataAction: fetchNotesAction,
    searchConfig,
    paginationConfig
  });

  const regularNotes = useMemo(() => {
    return paginatedNotes;
  }, [paginatedNotes]);

  const handleNoteCreated = useCallback((newNote: Notes) => {
    upsertNote(newNote);
    clearSearch();
    goToPage(1);
  }, [upsertNote, clearSearch, goToPage]);

  const openComposer = useCallback((kind: 'note' | 'project', format: 'text' | 'doodle' = 'text') => {
    openOverlay(
      <CreateNoteForm
        onNoteCreated={handleNoteCreated}
        initialFormat={format}
        noteKind={kind}
      />
    );
  }, [handleNoteCreated, openOverlay]);

  useEffect(() => {
    if (isDynamicSidebarOpen) {
      setConfiguration({ isVisible: false });
    } else {
      setConfiguration({
        isVisible: true,
        mainColor: '#EC4899',
        actions: [
          { id: 'new-note', label: 'NEW NOTE', icon: <NoteIcon size={16} />, onClick: () => openComposer('note') },
          { id: 'new-project', label: 'NEW PROJECT', icon: <ProjectIcon size={16} />, onClick: () => openComposer('project') },
          { id: 'manage-tags', label: 'MANAGE TAGS', icon: <TagIcon size={16} />, onClick: () => router.push('/note/tags') }
        ]
      });
    }
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, openComposer, router, isDynamicSidebarOpen]);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetchNotes();
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  }, [refetchNotes]);

  useEffect(() => {
    const openCreateNote = typeof window !== 'undefined' ? sessionStorage.getItem('open-create-note') : null;
    if (openCreateNote) {
      try { sessionStorage.removeItem('open-create-note'); } catch { }
      openComposer('note');
    }
  }, [openComposer]);

  useEffect(() => {
    const openCreateProject = typeof window !== 'undefined' ? sessionStorage.getItem('open-create-project') : null;
    if (openCreateProject) {
      try { sessionStorage.removeItem('open-create-project'); } catch { }
      openComposer('project');
    }
  }, [openComposer]);

  useEffect(() => {
    const format = searchParams.get('format');
    if (format === 'doodle') {
      window.history.replaceState({}, '', '/note/notes');
      openOverlay(<CreateNoteForm initialFormat="doodle" onNoteCreated={handleNoteCreated} noteKind="note" />);
    }
  }, [searchParams, openOverlay, handleNoteCreated]);

  const handleNoteUpdated = useCallback((updatedNote: Notes) => {
    if (!updatedNote.$id) {
      console.error('Cannot update note: missing ID');
      return;
    }
    upsertNote(updatedNote);
  }, [upsertNote]);

  const handleToggleSidebar = useCallback(() => {
    setIsCollapsed((prev: boolean) => !prev);
  }, [setIsCollapsed]);

  const handleNoteDeleted = useCallback(async (noteId: string) => {
    if (!noteId) {
      console.error('Cannot delete note: missing ID');
      return;
    }
    await deleteNote(noteId);
    removeNote(noteId);
  }, [removeNote]);

  const openNoteDetailSurface = useCallback((note: Notes | any) => {
    if (isDesktop) {
      openSidebar(
        <NoteDetailSidebar
          note={note}
          onUpdate={handleNoteUpdated}
          onDelete={handleNoteDeleted}
        />,
        note.$id || null,
        { hideHeader: true }
      );
      return;
    }

    openOverlay(
      <NoteDetailSidebar
        note={note}
        onUpdate={handleNoteUpdated}
        onDelete={handleNoteDeleted}
        onBack={closeOverlay}
      />
    );
  }, [isDesktop, openSidebar, openOverlay, closeOverlay, handleNoteUpdated, handleNoteDeleted]);

  const handleSharedNoteClick = useCallback((note: any) => {
    openNoteDetailSurface(note);
  }, [openNoteDetailSurface]);

  const hasReopenedRef = useRef(false);
  useEffect(() => {
    if (!activeContentKey || isDynamicSidebarOpen || !visibleNotes.length || hasReopenedRef.current) return;
    
    const targetNote = visibleNotes.find((candidate) => candidate.$id === activeContentKey);
    if (targetNote) {
      hasReopenedRef.current = true;
      openNoteDetailSurface(targetNote);
    }
  }, [activeContentKey, visibleNotes, isDynamicSidebarOpen, openNoteDetailSurface]);

  useEffect(() => {
    if (!openNoteIdParam) return;

    const targetNote = visibleNotes.find((candidate) => candidate.$id === openNoteIdParam);
    const cleanParams = () => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      params.delete('openNoteId');
      const path = `/note/notes${params.toString() ? `?${params.toString()}` : ''}`;
      router.replace(path);
    };

    if (!targetNote) {
      cleanParams();
      return;
    }

    openNoteDetailSurface(targetNote);
    cleanParams();
  }, [openNoteIdParam, visibleNotes, openNoteDetailSurface, router]);

  const handleCreateNoteClick = () => {
    openOverlay(<CreateNoteForm onNoteCreated={handleNoteCreated} />);
  };


  const tags = useMemo(() => {
    const existingTags = Array.from(new Set(visibleNotes.flatMap(note => note.tags || [])));
    return existingTags.length > 0 ? existingTags.slice(0, 8) : ['Personal', 'Work', 'Ideas', 'To-Do'];
  }, [visibleNotes]);

  const mainNotesContent = (
    <div className="flex flex-col gap-6">
      {/* Desktop Header */}
      <header className="hidden md:flex items-center justify-between p-5 bg-white/[0.01] border border-white/8 rounded-[32px] shadow-2xl relative select-none">
        <div className="absolute top-[-1px] left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-[#EC4899] to-transparent" />
        <div>
          <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight leading-tight mb-1 font-mono tracking-tighter">
            Notes
          </h1>
          <p className="text-white/40 text-xs font-semibold leading-normal font-sans">
            {visibleNotes.length < totalNotes && !hasSearchResults ? (
              <span>Syncing <span className="font-mono font-bold text-[#EC4899]">{visibleNotes.length}</span> of <span className="font-mono font-bold">{totalNotes}</span> notes</span>
            ) : (
              hasSearchResults ? (
                <span><span className="font-mono font-bold text-[#EC4899]">{totalCount}</span> {totalCount === 1 ? 'result' : 'results'} found</span>
              ) : (
                <span><span className="font-mono font-bold text-[#EC4899]">{totalNotes}</span> {totalNotes === 1 ? 'note' : 'notes'}</span>
              )
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="w-10 h-10 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 flex items-center justify-center transition-all duration-300 disabled:opacity-40"
          >
            <RefreshIcon size={16} className={`transition-all ${isRefreshing ? 'animate-spin text-[#EC4899]' : 'text-white/60'}`} />
          </button>
          <button
            onClick={handleToggleSidebar}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-10 h-10 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all"
          >
            {isCollapsed ? <ArrowRightIcon size={16} /> : <ArrowLeftIcon size={16} />}
          </button>
          <button 
            onClick={handleCreateNoteClick}
            className="h-10 px-4 rounded-xl bg-[#6366F1]/10 hover:bg-[#6366F1]/20 border border-[#6366F1]/20 hover:border-[#6366F1]/40 flex items-center justify-center text-[#818CF8] font-bold text-xs gap-1.5 transition-all"
          >
            <PlusCircleIcon size={16} />
            <span>Create</span>
          </button>
        </div>
      </header>

      {/* Tags Filter */}
      {tags.length > 0 && (
        <div className="overflow-x-auto scrollbar-none p-2 bg-white/[0.01] border border-white/5 rounded-[24px] flex items-center gap-2 select-none">
          {tags.map((tag, index) => (
            <button
              key={index}
              aria-pressed={searchQuery === tag}
              onClick={() => searchQuery === tag ? clearSearch() : setSearchQuery(tag)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                searchQuery === tag 
                  ? 'bg-[#EC4899] border-[#EC4899] text-white shadow-[0_4px_12px_rgba(236,72,153,0.2)]' 
                  : 'bg-white/3 border-white/8 text-white/60 hover:text-white hover:border-white/15'
              }`}
            >
              {tag}
            </button>
          ))}

          {hasSearchResults && (
            <button 
              onClick={clearSearch} 
              className="ml-2 px-3 py-1.5 text-xs text-[#EC4899] hover:text-[#f472b6] font-mono font-bold tracking-wider"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Top Pagination */}
      {totalPages > 1 && (
        <div className="mb-2">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
            onPageChange={goToPage}
            onNextPage={nextPage}
            onPreviousPage={previousPage}
            totalCount={hasSearchResults ? totalCount : visibleNotes.length}
            pageSize={paginationConfig.pageSize}
            compact={false}
          />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-[16px] bg-red-500/10 border border-red-500/20 text-[#ff5252] text-sm font-bold flex items-center gap-2">
          <Info size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Notes Grid */}
      {isInitialLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <NoteCard key={`skeleton-${index}`} note={{ $id: `skeleton-${index}`, title: 'Loading...', content: '', tags: [], isPublic: false, status: 'loading' } as any} />
          ))}
        </div>
      ) : paginatedNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center select-none">
          <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[28px] flex items-center justify-center mb-6 shadow-2xl">
            {hasSearchResults ? (
              <SearchIcon size={38} className="text-white/30" />
            ) : (
              <PlusCircleIcon size={38} className="text-white/30" />
            )}
          </div>
          <h4 className="text-white font-black text-lg tracking-tight mb-2">
            {hasSearchResults ? 'No Results' : 'No Notes Yet'}
          </h4>
          <p className="text-white/40 text-xs font-semibold max-w-xs leading-relaxed mb-6">
            {hasSearchResults
              ? `No matches found for "${searchQuery}". Try adjusting your query.`
              : 'Capture your thoughts and tasks here. Notes are securely sealed in your vault.'
            }
          </p>
          {hasSearchResults ? (
            <div className="flex items-center gap-3">
              <Button variant="outlined" onClick={clearSearch}>
                Clear Search
              </Button>
              <Button onClick={handleCreateNoteClick}>
                New Note
              </Button>
            </div>
          ) : (
            <Button onClick={handleCreateNoteClick}>
              Open Composer
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Pinned Notes Section */}
          {pinnedNotes.length > 0 && (
            <div className="p-5 md:p-6 bg-white/[0.01] border border-white/5 rounded-[32px] shadow-lg">
              <div className="flex items-center justify-between gap-4 mb-5 px-1 select-none">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#EC4899]/10 border border-[#EC4899]/20 rounded-xl flex items-center justify-center text-[#EC4899]">
                    <PinIcon size={14} className="rotate-45" />
                  </div>
                  <span className="font-black text-[10px] tracking-widest uppercase text-[#EC4899] font-mono leading-none">
                    Pinned Notes
                  </span>
                </div>

                {pinnedNotes.length > 3 && (
                  <button 
                    onClick={() => openSidebar(<PinnedNotesSidebar />, 'pinned-notes')}
                    className="text-xs font-black text-[#EC4899] hover:text-[#f472b6] bg-[#EC4899]/5 hover:bg-[#EC4899]/10 border border-[#EC4899]/10 hover:border-[#EC4899]/20 px-3 py-1.5 rounded-xl transition-all"
                  >
                    See More ({pinnedNotes.length - 3})
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {pinnedNotes.slice(0, 3).map((note) => (
                  <NoteCard
                    key={note.$id}
                    note={note}
                    onUpdate={handleNoteUpdated}
                    onDelete={handleNoteDeleted}
                    onNoteSelect={openNoteDetailSurface}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Regular Notes Section */}
          {regularNotes.length > 0 && (
            <div className="p-5 md:p-6 bg-white/[0.01] border border-white/5 rounded-[32px] shadow-lg">
              {pinnedNotes.length > 0 && (
                <div className="flex items-center gap-2 mb-5 px-1 select-none">
                  <div className="p-2 bg-white/3 border border-white/8 rounded-xl flex items-center justify-center text-white/50">
                    <SearchIcon size={14} />
                  </div>
                  <span className="font-black text-[10px] tracking-widest uppercase text-white/50 font-mono leading-none">
                    All Notes
                  </span>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {regularNotes.map((note) => (
                  <NoteCard
                    key={note.$id}
                    note={note}
                    onUpdate={handleNoteUpdated}
                    onDelete={handleNoteDeleted}
                    onNoteSelect={openNoteDetailSurface}
                  />
                ))}
              </div>
            </div>
          )}
          
          {hasNextPage && !isInitialLoading && !hasSearchResults && (
            <div className="flex justify-center mt-2">
              <Button variant="outlined" onClick={nextPage}>
                Load More
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Bottom Pagination */}
      {totalPages > 1 && paginatedNotes.length > 0 && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
            onPageChange={goToPage}
            onNextPage={nextPage}
            onPreviousPage={previousPage}
            totalCount={hasSearchResults ? totalCount : (visibleNotes || []).length}
            pageSize={paginationConfig.pageSize}
            compact={false}
          />
        </div>
      )}
    </div>
  );

  return (
    <NotesErrorBoundary>
      <div className="flex-1 min-h-screen pointer-events-auto">
        {isDesktop ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">
            
            {/* Left Pane: Main Notes Content */}
            <div className="min-w-0">
              {mainNotesContent}
            </div>

            {/* Right Pane: Sticky side column */}
            <div className="h-[calc(100vh-120px)] flex flex-col gap-6 sticky top-[108px]">
              
              {/* Section 1: Shared Notes Accordion */}
              <div 
                className={`bg-[#161412] border border-white/5 p-5 rounded-[24px] flex flex-col overflow-hidden transition-all duration-300 ${
                  sharedNotesOpen && projectsOpen 
                    ? 'flex-1 h-[50%]' 
                    : sharedNotesOpen 
                      ? 'flex-1 h-full' 
                      : 'h-[68px] flex-none'
                }`}
              >
                <div className="flex justify-between items-center mb-4 flex-shrink-0 select-none">
                  <h3 className="text-white text-base font-black tracking-tight leading-tight">
                    Shared Notes
                  </h3>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setSharedNotesOpen(!sharedNotesOpen)} 
                      className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
                    >
                      {sharedNotesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button 
                      onClick={() => router.push('/note/shared')} 
                      className="p-1.5 rounded-lg text-white/40 hover:text-[#EC4899] hover:bg-white/5 transition-all"
                    >
                      <Maximize2 size={14} />
                    </button>
                  </div>
                </div>

                {sharedNotesOpen && (
                  <div className="flex-1 overflow-y-auto pr-0.5 scrollbar-thin">
                    {sharedNotesLoading ? (
                      <div className="flex flex-col gap-3">
                        {[1, 2, 3].map((n) => (
                          <div key={n} className="flex gap-3 p-3.5 rounded-xl bg-white/[0.01] border border-white/3 animate-pulse">
                            <div className="w-9 h-9 rounded-lg bg-white/5" />
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-white/5 rounded w-3/4" />
                              <div className="h-3 bg-white/5 rounded w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : sharedNotes.length === 0 ? (
                      <div className="text-center py-6 select-none">
                        <p className="text-white/40 text-xs italic font-bold">
                          No shared notes.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {sharedNotes.map((note) => (
                          <button
                            key={note.$id}
                            onClick={() => handleSharedNoteClick(note)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/3 hover:border-white/10 text-left transition-all duration-300 hover:translate-x-1 group"
                          >
                            <div className="w-9 h-9 rounded-lg bg-[#EC4899]/10 text-[#EC4899] flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105">
                              <Share2 size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="block text-white font-extrabold text-xs truncate">
                                {note.title || 'Untitled Note'}
                              </span>
                              <span className="block text-white/40 text-[9px] font-black uppercase tracking-wider font-mono mt-0.5">
                                BY: {note.userId === 'system' ? 'SYSTEM' : (note.userName || 'Collaborator').toUpperCase()}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 2: Projects Accordion */}
              <div 
                className={`bg-[#161412] border border-white/5 p-5 rounded-[24px] flex flex-col overflow-hidden transition-all duration-300 ${
                  sharedNotesOpen && projectsOpen 
                    ? 'flex-1 h-[50%]' 
                    : projectsOpen 
                      ? 'flex-1 h-full' 
                      : 'h-[68px] flex-none'
                }`}
              >
                <div className="flex justify-between items-center mb-4 flex-shrink-0 select-none">
                  <h3 className="text-white text-base font-black tracking-tight leading-tight">
                    Projects
                  </h3>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setProjectsOpen(!projectsOpen)} 
                      className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
                    >
                      {projectsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button 
                      onClick={() => router.push('/projects')} 
                      className="p-1.5 rounded-lg text-white/40 hover:text-[#EC4899] hover:bg-white/5 transition-all"
                    >
                      <Maximize2 size={14} />
                    </button>
                  </div>
                </div>

                {projectsOpen && (
                  <div className="flex-1 overflow-y-auto pr-0.5 scrollbar-thin">
                    {projectsLoading ? (
                      <div className="flex flex-col gap-3">
                        {[1, 2, 3].map((n) => (
                          <div key={n} className="flex gap-3 p-3.5 rounded-xl bg-white/[0.01] border border-white/3 animate-pulse">
                            <div className="w-9 h-9 rounded-lg bg-white/5" />
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-white/5 rounded w-3/4" />
                              <div className="h-3 bg-white/5 rounded w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : projects.length === 0 ? (
                      <div className="text-center py-6 select-none">
                        <p className="text-white/40 text-xs italic font-bold">
                          No active projects.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {projects.map((proj) => (
                          <button
                            key={proj.$id}
                            onClick={() => router.push(`/projects/${proj.$id}`)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/3 hover:border-white/10 text-left transition-all duration-300 hover:translate-x-1 group"
                          >
                            <div 
                              style={{ 
                                backgroundColor: `${proj.color || '#6366F1'}1a`,
                                color: proj.color || '#6366F1'
                              }}
                              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                            >
                              <ProjectIcon size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="block text-white font-extrabold text-xs truncate">
                                {proj.name}
                              </span>
                              <span className="block text-white/40 text-[9px] font-black uppercase tracking-wider font-mono mt-0.5">
                                STATUS: {(proj.status || 'Active').toUpperCase()}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        ) : (
          <>
            {/* Mobile Header */}
            <header className="mb-4 flex md:hidden items-center justify-between px-3 py-2 bg-white/[0.01] border border-white/8 rounded-2xl select-none">
              <h1 className="text-white font-black text-xl tracking-tight leading-none font-mono">
                Notes
              </h1>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleManualRefresh} 
                  disabled={isRefreshing}
                  className="w-9 h-9 rounded-lg bg-white/3 border border-white/8 hover:border-white/15 flex items-center justify-center transition-all duration-300 disabled:opacity-40"
                >
                  <RefreshIcon size={14} className={isRefreshing ? 'animate-spin text-[#EC4899]' : 'text-white/60'} />
                </button>
              </div>
            </header>
            {mainNotesContent}
          </>
        )}
      </div>
    </NotesErrorBoundary>
  );
}
