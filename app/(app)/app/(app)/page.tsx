"use client";

import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { deleteNote } from '@/lib/actions/client-ops';
import { useNotes } from '@/context/NotesContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Notes } from '@/types/appwrite';
import { NoteObjectRow } from '@/components/ui/NoteObjectRow';
import { TagObjectRow } from '@/components/ui/TagObjectRow';
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
  Info,
  Plus as PlusIcon,
  Loader2 as SpinnerIcon,
  ShieldCheck
} from 'lucide-react';
import { getSharedNotes, listTags, deleteTag } from '@/lib/appwrite';
import { useDataNexus } from '@/context/DataNexusContext';
import { useAuth } from '@/context/auth/AuthContext';
import {
  getSessionSharedNotes,
  setSessionSharedNotes,
  sharedNotesCacheKey} from '@/lib/note/shared-notes-cache';
import {
  getSessionProjectsList,
  setSessionProjectsList,
  projectsListCacheKey} from '@/lib/projects/projects-cache';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useSidebar } from '@/components/ui/SidebarContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { NoteObjectDetail } from '@/components/objects/NoteObjectDetail';
import { NotesErrorBoundary } from '@/components/ui/ErrorBoundary';
import { PinnedNotesSidebar } from '@/components/ui/PinnedNotesSidebar';
import { isClientEncryptedNote, resolvePinnedNoteRows } from '@/lib/note/note-visibility';
import { useSudo } from '@/context/SudoContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useLayout } from '@/context/LayoutContext';
import { useToast } from '@/components/ui/Toast';
import { TaggedResourcesTabs } from '@/components/share/TaggedResourcesTabs';
import { useWorkspace } from '@/context/WorkspaceContext';
import { isDefaultWorkspaceObject } from '@/lib/workspaces/is-default-workspace-object';
import { useProjectObjects } from '@/hooks/useProjectObjects';


// Client-side persistence cache to resist reload flicker

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
    pushLiveNote,
    removeNote,
    refetchNotes,
    isPinned,
    pinnedIds,
    hasMore: _hasMore,
    loadMore: _loadMore
  } = useNotes();
  const { promptSudo } = useSudo();
  const { openOverlay, closeOverlay } = useOverlay();
  const { setConfiguration, resetConfiguration } = useFAB();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const { isOpen: isDynamicSidebarOpen, openSidebar, activeContentKey } = useDynamicSidebar();
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const openNoteIdParam = searchParams.get('openNoteId');

  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const { setCachedData } = useDataNexus();

  // Collapsible accordion state for the desktop right pane
  const [_sharedNotesOpen, _setSharedNotesOpen] = useState(true);
  const [_projectsOpen, _setProjectsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'notes' | 'tags'>('notes');

  // Tags data state
  const [globalTags, setGlobalTags] = useState<any[]>([]);
  const [globalTagsLoading, setGlobalTagsLoading] = useState(true);
  const [globalTagsError, setGlobalTagsError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<any | null>(null);
  const [taggedResources, setTaggedResources] = useState<any>({
    notes: [],
    tasks: [],
    credentials: [],
    totps: [],
    events: [],
    forms: [],
    moments: []
  });
  const [resolvingResources, setResolvingResources] = useState(false);

  const { open: openUnified } = useUnifiedDrawer();
  const { openSecondarySidebar } = useLayout();
  const { showError } = useToast();

  const fetchTags = useCallback(async () => {
    if (!user) return;
    try {
      setGlobalTagsLoading(true);
      const response = await listTags();
      setGlobalTags(response.rows);
    } catch (err: any) {
      setGlobalTagsError(err instanceof Error ? err.message : 'Failed to fetch tags');
    } finally {
      setGlobalTagsLoading(false);
    }
  }, [user]);

  const resolveTaggedResources = useCallback(async (tag: any) => {
    setResolvingResources(true);
    try {
      const res = await ProjectsService.listTaggedResources([tag.$id]);
      setTaggedResources(res);
    } catch (err) {
      console.error('Failed to resolve tagged resources:', err);
    } finally {
      setResolvingResources(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'tags') {
      fetchTags();
    }
  }, [activeTab, fetchTags]);

  useEffect(() => {
    if (selectedTag) {
      resolveTaggedResources(selectedTag);
    }
  }, [selectedTag, resolveTaggedResources]);

  const handleCreateNewTag = useCallback(() => {
    openUnified('new-tag', { onSuccess: fetchTags });
  }, [openUnified, fetchTags]);

  const handleEditTag = (tag: any) => {
    openUnified('new-tag', { tag, onSuccess: fetchTags });
  };

  const handleDeleteTag = async (tag: any) => {
    openUnified('delete-confirm', {
      title: `Delete tag "${tag.name}"?`,
      description: 'This will remove the tag from all associated resources. The objects themselves will not be deleted.',
      resourceName: 'this tag',
      confirmLabel: 'Delete Tag',
      onConfirm: async () => {
        try {
          await deleteTag(tag.$id);
          await fetchTags();
          if (selectedTag?.$id === tag.$id) setSelectedTag(null);
        } catch (err: any) {
          setGlobalTagsError(err instanceof Error ? err.message : 'Failed to delete tag');
        }
      }
    });
  };

  // Projects data state
  const [_projects, setProjects] = useState<any[]>(() => getSessionProjectsList() || []);
  const [_projectsLoading, setProjectsLoading] = useState(() => !getSessionProjectsList());

  // Shared Notes data state
  const [_sharedNotes, setSharedNotes] = useState<any[]>(() => getSessionSharedNotes() || []);
  const [_sharedNotesLoading, setSharedNotesLoading] = useState(() => !getSessionSharedNotes());

  useEffect(() => {
    let mounted = true;
    
    async function loadRightPaneData() {
      try {
        // Fetch projects
        ProjectsService.listProjects()
          .then(res => {
            if (mounted) {
              const rows = res.rows || [];
              setSessionProjectsList(rows);
              if (user?.$id) {
                void setCachedData(projectsListCacheKey(user.$id), rows);
              }
              setProjects(rows);
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
              const rows = res.rows || [];
              setSessionSharedNotes(rows);
              if (user?.$id) {
                void setCachedData(sharedNotesCacheKey(user.$id), rows);
              }
              setSharedNotes(rows);
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
  }, [setCachedData, user?.$id]);

  const { activeWorkspace } = useWorkspace();

  // Canonical workspace membership: project_objects table (join table for workspace ↔ entity)
  const isCustomWorkspace = Boolean(activeWorkspace && !activeWorkspace.isPersonal);
  const customWorkspaceId = isCustomWorkspace ? activeWorkspace?.id : null;
  const { rows: workspaceProjectObjects } = useProjectObjects(customWorkspaceId, 'note');

  // State to hold extra notes fetched directly by entityId from project_objects
  const [extraWorkspaceNotes, setExtraWorkspaceNotes] = useState<Notes[]>([]);

  useEffect(() => {
    if (!isCustomWorkspace || !workspaceProjectObjects.length) {
      setExtraWorkspaceNotes([]);
      return;
    }

    const safeNotes = Array.isArray(allNotes) ? allNotes : [];
    const knownIds = new Set(safeNotes.map((n) => n.$id));
    const missingIds = workspaceProjectObjects
      .map((po) => po.entityId)
      .filter((id): id is string => Boolean(id) && !knownIds.has(id));

    if (!missingIds.length) return;

    let mounted = true;
    import('@/lib/appwrite/note').then(({ listNotes }) => {
      import('appwrite').then(({ Query }) => {
        listNotes([Query.equal('$id', missingIds)], 100)
          .then((res) => {
            if (mounted && res?.rows?.length) {
              setExtraWorkspaceNotes(res.rows as Notes[]);
            }
          })
          .catch(() => {});
      });
    });

    return () => {
      mounted = false;
    };
  }, [isCustomWorkspace, workspaceProjectObjects, allNotes]);

  const visibleNotes = useMemo(() => {
    const safeNotes = Array.isArray(allNotes) ? allNotes : [];
    const combinedNotes = [...safeNotes, ...extraWorkspaceNotes];
    const decrypted = combinedNotes.filter((n) => !isClientEncryptedNote(n));

    if (!activeWorkspace || activeWorkspace.isPersonal) {
      return decrypted.filter(isDefaultWorkspaceObject);
    }

    // Build a set of note IDs registered in project_objects for this workspace
    const registeredIds = new Set(workspaceProjectObjects.map((po) => po.entityId).filter(Boolean));
    const pid = activeWorkspace.id;

    return decrypted.filter((n: any) =>
      // Primary: note ID is in the project_objects join table
      registeredIds.has(n.$id) ||
      // Fallback: local draft not yet written to project_objects but has projectId in metadata
      n.projectId === pid
    );
  }, [allNotes, extraWorkspaceNotes, activeWorkspace, workspaceProjectObjects]);









  const pinnedNotes = useMemo(() => {
    if (searchParams.get('query')) return [];
    return resolvePinnedNoteRows(pinnedIds, visibleNotes);
  }, [pinnedIds, visibleNotes, searchParams]);

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


  const openComposer = useCallback((kind: 'note' | 'project') => {
    if (kind === 'project') {
      openUnified('new-project');
      return;
    }
    openUnified('note');
  }, [openUnified]);

  useEffect(() => {
    if (isDynamicSidebarOpen || isDesktop) {
      setConfiguration({ isVisible: false });
    } else {
      setConfiguration({
        isVisible: true,
        mainColor: '#EC4899',
        onMainClick: () => openComposer('note'),
        actions: [
          { id: 'new-note', label: 'NEW NOTE', icon: <NoteIcon size={16} />, onClick: () => openComposer('note') },
          { id: 'new-project', label: 'NEW PROJECT', icon: <ProjectIcon size={16} />, onClick: () => openComposer('project') },
          { id: 'manage-tags', label: 'MANAGE TAGS', icon: <TagIcon size={16} />, onClick: () => router.push('/tags') }
        ]
      });
    }
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, openComposer, router, isDynamicSidebarOpen, isDesktop]);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (activeWorkspace && !activeWorkspace.isPersonal) {
        const { ProjectsService } = await import('@/lib/appwrite/projects');
        await ProjectsService.listProjectObjectsByKind(activeWorkspace.id, 'note');
      }
      await refetchNotes();
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  }, [refetchNotes, activeWorkspace]);

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

  const handleNoteUpdated = useCallback((updatedNote: Notes) => {
    if (!updatedNote.$id) {
      console.error('Cannot update note: missing ID');
      return;
    }
    pushLiveNote(updatedNote);
  }, [pushLiveNote]);

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

  const openNoteDetailSurface = useCallback(async (note: Notes | any) => {
    const isLocked = !!note.dek || (() => {
      try {
        const meta = JSON.parse(note.metadata || '{}');
        // T4 public-share encryption (legacy metadata) still needs vault; lock uses dek only
        return !!meta.dek || (meta.encryptionVersion === 'T4' && !!meta.isEncrypted);
      } catch {
        return false;
      }
    })();

    if (isLocked && !ecosystemSecurity.status.isUnlocked) {
      const unlocked = await promptSudo();
      if (!unlocked) return;
    }

    if (isDesktop) {
      openSidebar(
        <NoteObjectDetail
          note={note}
          onUpdate={handleNoteUpdated}
          onDelete={handleNoteDeleted}
          embedded
        />,
        note.$id || 'note-detail',
        { hideHeader: true }
      );
      return;
    }

    openOverlay(
      <NoteObjectDetail
        note={note}
        onUpdate={handleNoteUpdated}
        onDelete={handleNoteDeleted}
        onClose={closeOverlay}
        embedded
      />
    );
  }, [isDesktop, openSidebar, openOverlay, closeOverlay, handleNoteUpdated, handleNoteDeleted, promptSudo]);


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
      const path = `/app${params.toString() ? `?${params.toString()}` : ''}`;
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
    openUnified('note');
  };


  const tags = useMemo(() => {
    const existingTags = Array.from(new Set(visibleNotes.flatMap(note => note.tags || [])));
    return existingTags.length > 0 ? existingTags.slice(0, 8) : ['Personal', 'Work', 'Ideas', 'To-Do'];
  }, [visibleNotes]);

  const tagsGridContent = (
    <div className="flex flex-col gap-6">
      {/* Desktop Header */}
      <header className="hidden md:flex items-center justify-between p-5 bg-white/[0.01] border border-white/8 rounded-[32px] shadow-2xl relative select-none">
        <div className="absolute top-[-1px] left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-[#10B981] to-transparent" />
        <div className="flex items-center gap-4">
          {selectedTag && (
            <button
              onClick={() => setSelectedTag(null)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/6 transition-all"
            >
              <ArrowLeftIcon size={18} />
            </button>
          )}
          <div>
            <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight leading-tight mb-1 font-mono tracking-tighter">
              {selectedTag ? `# ${selectedTag.name?.toUpperCase() || ''}` : 'Global Tags'}
            </h1>
            <p className="text-white/40 text-xs font-semibold leading-normal font-sans">
              {selectedTag ? `Sweeping ecosystem resources with this tag` : 'Organize and sweep resources across the ecosystem'}
            </p>
          </div>
        </div>
        
        {!selectedTag && (
          <button 
            onClick={handleCreateNewTag}
            className="h-10 px-4 rounded-xl bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/20 hover:border-[#10B981]/40 flex items-center justify-center text-[#34D399] font-bold text-xs gap-1.5 transition-all"
          >
            <PlusIcon size={16} />
            <span>Create Tag</span>
          </button>
        )}
      </header>

      {globalTagsError && (
        <div className="p-4 mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-[#ff4444] text-sm font-semibold">
          {globalTagsError}
        </div>
      )}

      {!selectedTag ? (
        <>
          {/* Tags Grid */}
          {globalTagsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div 
                  key={i} 
                  className="p-6 rounded-[32px] bg-[#161412] border border-white/5 animate-pulse min-h-[180px]"
                />
              ))}
            </div>
          ) : globalTags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center select-none">
              <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[28px] flex items-center justify-center mb-6 shadow-2xl">
                <TagIcon size={38} className="text-white/30" />
              </div>
              <h4 className="text-white font-black text-lg tracking-tight mb-2">No Tags Yet</h4>
              <p className="text-white/40 text-xs font-semibold max-w-xs leading-relaxed mb-6">
                Create your first tag to start organizing your ecosystem
              </p>
              <Button onClick={handleCreateNewTag}>
                Create First Tag
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 items-stretch [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
              {globalTags.map((tag) => (
                <TagObjectRow
                  key={tag.$id}
                  tag={tag}
                  onClick={() => setSelectedTag(tag)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onEdit={() => handleEditTag(tag)}
                  onDelete={() => handleDeleteTag(tag)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Tagged Resources Section */}
          <div className="bg-[#161412] border border-white/6 rounded-[32px] overflow-hidden shadow-2xl">
            <div className="border-b border-white/6 px-6 py-5 bg-white/[0.01] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <TagIcon size={18} className="text-[#10B981] flex-shrink-0" />
                <span className="text-white font-black text-base tracking-tight leading-none block uppercase">
                  Swept Resources
                </span>
              </div>
              <span className="bg-[#10B981]/10 text-[#10B981] text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-[#10B981]/20">
                AUTO-SWEPT
              </span>
            </div>
            
            <div className="px-6 py-3 bg-[#10B981]/5 border-b border-white/4 flex items-center gap-2.5">
              <ShieldCheck size={14} className="text-[#10B981] flex-shrink-0" />
              <p className="text-[10px] text-white/50 font-bold leading-tight">
                By default, tagged items keep their permissions. Global sweeping respects resource owner privacy.
              </p>
            </div>

            <div className="p-4 md:p-8">
              {resolvingResources ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <SpinnerIcon className="animate-spin text-[#10B981]" size={24} />
                  <span className="text-white/30 text-xs font-bold font-mono">Resolving ecosystem items...</span>
                </div>
              ) : Object.values(taggedResources).every((arr: any) => arr.length === 0) ? (
                <div className="py-20 text-center select-none">
                  <p className="text-white/20 italic text-sm font-semibold">
                    No resources found with tag #{selectedTag.name}
                  </p>
                </div>
              ) : (
                <TaggedResourcesTabs 
                  resources={taggedResources} 
                  openSidebar={openSidebar}
                  openSecondarySidebar={openSecondarySidebar}
                  openOverlay={openOverlay}
                  closeOverlay={closeOverlay}
                  fetchProjectData={async () => {}} // No project to refresh
                  handleRemoveObject={async () => {}} // Cannot remove from global swept list
                  router={router}
                  showError={showError}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const mainNotesContent = (
    <div className="flex flex-col gap-6">
      {/* Desktop Header */}
      <header className="hidden md:flex items-center justify-between p-5 bg-white/[0.01] border border-white/8 rounded-[32px] shadow-2xl relative select-none">
        <div className="absolute top-[-1px] left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-[#EC4899] to-transparent" />
        <div>
          <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight leading-tight mb-1 font-mono tracking-tighter">
            Ideas
          </h1>
          <p className="text-white/40 text-xs font-semibold leading-normal font-sans">
            {visibleNotes.length < totalNotes && !hasSearchResults ? (
              <span>Syncing <span className="font-mono font-bold text-[#EC4899]">{visibleNotes.length}</span> of <span className="font-mono font-bold">{totalNotes}</span> ideas</span>
            ) : (
              hasSearchResults ? (
                <span><span className="font-mono font-bold text-[#EC4899]">{totalCount}</span> {totalCount === 1 ? 'result' : 'results'} found</span>
              ) : (
                <span><span className="font-mono font-bold text-[#EC4899]">{totalNotes}</span> {totalNotes === 1 ? 'idea' : 'ideas'}</span>
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
      {paginatedNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center select-none">
          <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[28px] flex items-center justify-center mb-6 shadow-2xl">
            {hasSearchResults ? (
              <SearchIcon size={38} className="text-white/30" />
            ) : (
              <PlusCircleIcon size={38} className="text-white/30" />
            )}
          </div>
          <h4 className="text-white font-black text-lg tracking-tight mb-2">
            {hasSearchResults ? 'No Results' : 'No Ideas Yet'}
          </h4>
          <p className="text-white/40 text-xs font-semibold max-w-xs leading-relaxed mb-6">
            {hasSearchResults
              ? `No matches found for "${searchQuery}". Try adjusting your query.`
              : 'Capture your thoughts and tasks here.'
            }
          </p>
          {hasSearchResults ? (
              <div className="flex items-center gap-3">
                <Button variant="outlined" onClick={clearSearch}>
                  Clear Search
                </Button>
                <Button onClick={handleCreateNoteClick}>
                  New Idea
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
          {pinnedIds.length > 0 && (
            <div className="p-5 md:p-6 bg-white/[0.01] border border-white/5 rounded-[32px] shadow-lg">
              <div className="flex items-center justify-between gap-4 mb-5 px-1 select-none">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#EC4899]/10 border border-[#EC4899]/20 rounded-xl flex items-center justify-center text-[#EC4899]">
                    <PinIcon size={14} className="rotate-45" />
                  </div>
                  <span className="font-black text-[10px] tracking-widest uppercase text-[#EC4899] font-mono leading-none">
                    Pinned Ideas ({pinnedIds.length})
                  </span>
                </div>

                {pinnedIds.length > 3 && (
                  <button 
                    onClick={() => openSidebar(<PinnedNotesSidebar />, 'pinned-notes', { hideHeader: true })}
                    className="text-xs font-black text-[#EC4899] hover:text-[#f472b6] bg-[#EC4899]/5 hover:bg-[#EC4899]/10 border border-[#EC4899]/10 hover:border-[#EC4899]/20 px-3 py-1.5 rounded-xl transition-all"
                  >
                    See More ({pinnedIds.length - 3})
                  </button>
                )}
              </div>
              
              <div className="grid gap-6 items-stretch [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
                {pinnedNotes.slice(0, 3).map((note) => (
                  <NoteObjectRow
                    key={note.$id}
                    note={note}
                    onSelect={openNoteDetailSurface}
                    onUpdate={handleNoteUpdated}
                    onDelete={handleNoteDeleted}
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
                    All Ideas
                  </span>
                </div>
              )}
              
              <div className="grid gap-6 items-stretch [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
                {regularNotes.map((note) => (
                  <NoteObjectRow
                    key={note.$id}
                    note={note}
                    onSelect={openNoteDetailSurface}
                    onUpdate={handleNoteUpdated}
                    onDelete={handleNoteDeleted}
                  />
                ))}
              </div>
            </div>
          )}
          
          {hasNextPage && !hasSearchResults && (
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
          <div className="w-full">
            {/* Left Pane: Main Notes Content */}
            <div className="min-w-0 w-full">
              {/* Tab Switcher */}
              <div className="flex items-center gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl w-fit select-none mb-6">
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                    activeTab === 'notes'
                      ? 'bg-[#EC4899] text-white shadow-[0_4px_12px_rgba(236,72,153,0.25)]'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Ideas
                </button>
                <button
                  onClick={() => router.push('/forms')}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all text-white/50 hover:text-white hover:bg-white/5"
                >
                  Forms
                </button>
                <button
                  onClick={() => router.push('/tags')}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all text-white/50 hover:text-white hover:bg-white/5"
                >
                  Tags
                </button>
              </div>

              {activeTab === 'notes' ? mainNotesContent : tagsGridContent}
            </div>
          </div>
        ) : (
          <>
            {/* Tab Switcher & Reload Line */}
            <div className="flex items-center justify-between gap-2 mb-6 select-none w-full">
              <div className="flex items-center gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl w-fit">
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                    activeTab === 'notes'
                      ? 'bg-[#EC4899] text-white shadow-[0_4px_12px_rgba(236,72,153,0.25)]'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Ideas
                </button>
                <button
                  onClick={() => router.push('/forms')}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all text-white/50 hover:text-white hover:bg-white/5"
                >
                  Forms
                </button>
                <button
                  onClick={() => router.push('/tags')}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all text-white/50 hover:text-white hover:bg-white/5"
                >
                  Tags
                </button>
              </div>

              {activeTab === 'notes' && (
                <button 
                  onClick={handleManualRefresh} 
                  disabled={isRefreshing}
                  className="w-10 h-10 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 flex items-center justify-center transition-all duration-300 disabled:opacity-40"
                >
                  <RefreshIcon size={14} className={isRefreshing ? 'animate-spin text-[#EC4899]' : 'text-white/60'} />
                </button>
              )}
            </div>

            {activeTab === 'notes' ? mainNotesContent : tagsGridContent}
          </>
        )}
      </div>
    </NotesErrorBoundary>
  );
}
