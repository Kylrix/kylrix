"use client";

import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { deleteNote } from '@/lib/actions/client-ops';
import { useNotes } from '@/context/NotesContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Notes } from '@/types/appwrite';
import { NoteObjectRow } from '@/components/ui/NoteObjectRow';
import { TagObjectRow } from '@/components/ui/TagObjectRow';
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

import { useSudo } from '@/context/SudoContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useLayout } from '@/context/LayoutContext';
import { useToast } from '@/components/ui/Toast';
import { TaggedResourcesTabs } from '@/components/share/TaggedResourcesTabs';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useWorkspaceFilteredItems } from '@/hooks/useWorkspaceFilteredItems';
import { useProjectObjects } from '@/hooks/useProjectObjects';
import { isDefaultWorkspaceObject } from '@/lib/workspaces/is-default-workspace-object';


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
    pinnedIds: _pinnedIds,
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
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { account } = await import('@/lib/appwrite/client');
        const prefs = await account.getPrefs();
        if ((prefs as any)?.developerMode) setIsDevMode(true);
      } catch {}
    })();
  }, []);

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

  const combinedNotes = useMemo(() => {
    const safeNotes = Array.isArray(allNotes) ? allNotes : [];
    // Vault-like: show all notes including encrypted; unlock is prompted on open, not filtered from list
    return [...safeNotes, ...extraWorkspaceNotes];
  }, [allNotes, extraWorkspaceNotes]);

  const { filteredItems: visibleNotes } = useWorkspaceFilteredItems(combinedNotes, 'note');









  // Local-first: NotesContext is SoT via RxDB (note.shared-cache, architecture.local-first). No second LocalEngine/RxDB fetch here — that duplicated and clobbered isPinned/tags.
  const unifiedSorted = useMemo(() => {
    const src = visibleNotes.length ? visibleNotes : combinedNotes.filter(isDefaultWorkspaceObject as any);
    // Secondary pin sort — pinned first, then newest (like TaskContext getFilteredTasks / NotesContext sortedNotes)
    return [...src].sort((a: any, b: any) => {
      const aPinned = isPinned(a.$id) ? 1 : 0;
      const bPinned = isPinned(b.$id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(b.$updatedAt || (b as any).updatedAt || b.$createdAt || 0).getTime() - new Date(a.$updatedAt || (a as any).updatedAt || a.$createdAt || 0).getTime();
    });
  }, [visibleNotes, combinedNotes, isPinned]);
  const pinnedNotes = useMemo(() => unifiedSorted.filter((n: any) => isPinned(n.$id)), [unifiedSorted, isPinned]);
  const regularSourceNotes = useMemo(() => unifiedSorted.filter((n: any) => !isPinned(n.$id)), [unifiedSorted, isPinned]);

  // Fetch notes action for the search hook
  const fetchNotesAction = useCallback(async () => {
    const safeNotes = Array.isArray(regularSourceNotes) ? regularSourceNotes : [];
    return {
      documents: safeNotes,
      total: safeNotes.length
    };
  }, [regularSourceNotes]);

  const PAGE_SIZE = 20;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError] = useState<string | null>(null);
  const error = searchError;
  const hasSearchResults = searchQuery.trim().length > 0;
  const clearSearch = useCallback(() => setSearchQuery(''), []);
  // LocalEngine is SoT — UI paginates local copy only (sync SKILL.md). Engine background-fills LocalEngine decoupled.
  // Search must include pinned so pinned recent edit is findable; when searching, regular+ pinned are searched together
  const allSearchableNotes = useMemo(() => {
    const map = new Map<string, any>();
    for (const n of [...pinnedNotes, ...regularSourceNotes]) if (n?.$id) map.set(n.$id, n);
    return Array.from(map.values());
  }, [pinnedNotes, regularSourceNotes]);
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return regularSourceNotes;
    const q = searchQuery.toLowerCase();
    const src = hasSearchResults ? allSearchableNotes : regularSourceNotes;
    return src.filter((n: any) =>
      ['title', 'content', 'tags'].some((f) => String(n[f] ?? '').toLowerCase().includes(q))
    );
  }, [regularSourceNotes, allSearchableNotes, searchQuery, hasSearchResults]);
  const sortedFilteredNotes = useMemo(() => {
    return [...filteredNotes].sort((a: any, b: any) => {
      const aPinned = isPinned(a.$id) ? 0 : 1;
      const bPinned = isPinned(b.$id) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      const aT = new Date(a.$updatedAt || a.updatedAt || a.$createdAt || 0).getTime();
      const bT = new Date(b.$updatedAt || b.updatedAt || b.$createdAt || 0).getTime();
      return bT - aT;
    });
  }, [filteredNotes, isPinned]);
  const [page, setPage] = useState(1);
  const totalCount = sortedFilteredNotes.length;
  const paginatedNotes = useMemo(() => sortedFilteredNotes.slice(0, page * PAGE_SIZE), [sortedFilteredNotes, page]);
  const hasNextPage = paginatedNotes.length < sortedFilteredNotes.length;
  // Callback ref prevents stale-null + unobserve stutter; throttle via hasNextPage gate
  const [sentinelNode, setSentinelNode] = useState<HTMLDivElement | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => setSentinelNode(node), []);
  useEffect(() => {
    setPage(1);
  }, [searchQuery, regularSourceNotes]);
  useEffect(() => {
    if (!sentinelNode || !hasNextPage) return;
    let ticking = false;
    const obs = new IntersectionObserver(
      (entries) => {
        if (ticking) return;
        if (entries[0]?.isIntersecting) {
          ticking = true;
          setPage((p) => p + 1);
          setTimeout(() => { ticking = false; }, 300);
        }
      },
      { rootMargin: '400px', threshold: 0.1 }
    );
    obs.observe(sentinelNode);
    return () => obs.disconnect();
  }, [sentinelNode, hasNextPage]);
  const regularNotes = useMemo(() => paginatedNotes, [paginatedNotes]);
  void fetchNotesAction;


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
    // CoD: tags from LocalEngine direct — not limited to currently paginated UI page; avoids 0-ideas haphazard zombie
    const localTags = combinedNotes.flatMap((n: any) => n.tags || []);
    const fromGlobal = (globalTags || []).map((t: any) => t.name).filter(Boolean);
    const fromLocal = localTags.filter(Boolean) as string[];
    // Prefer recently edited note's tags first so it doesn't get excluded
    const merged = Array.from(new Set([...fromGlobal, ...fromLocal].filter(Boolean) as string[])).slice(0, 8);
    if (merged.length) return merged;
    // Fallback to visible/combined only if LocalEngine empty (first load)
    if (activeWorkspace.isPersonal) {
      const scopedForTags = visibleNotes.length ? visibleNotes : combinedNotes.filter(isDefaultWorkspaceObject as any);
      const src = scopedForTags.length ? scopedForTags : visibleNotes;
      const fromScoped = src.flatMap((note: any) => note.tags || []);
      const fromCombined = combinedNotes.filter(isDefaultWorkspaceObject as any).flatMap((n: any) => n.tags || []);
      const m2 = Array.from(new Set([...fromGlobal, ...fromScoped, ...fromCombined].filter(Boolean) as string[])).slice(0, 8);
      return m2.length ? m2 : ['Personal', 'Work', 'Ideas', 'To-Do'];
    }
    const fromVisible = visibleNotes.flatMap((note: any) => note.tags || []);
    const m2 = Array.from(new Set([...fromGlobal, ...fromVisible].filter(Boolean) as string[])).slice(0, 8);
    return m2.length ? m2 : ['Personal', 'Work', 'Ideas', 'To-Do'];
  }, [visibleNotes, combinedNotes, globalTags, activeWorkspace.isPersonal]);

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
              <button 
                onClick={handleCreateNewTag}
                className="h-10 px-4 rounded-xl bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/20 hover:border-[#10B981]/40 flex items-center justify-center text-[#34D399] font-bold text-xs gap-1.5 transition-all"
              >
                <PlusIcon size={16} />
                <span>Create First Tag</span>
              </button>
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
          {isDevMode && (
            <button
              onClick={() => router.push('/app/test')}
              className="h-10 px-3.5 rounded-xl bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 text-xs font-bold transition-all"
            >
              Test (Raw)
            </button>
          )}
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
      <div className="overflow-x-auto scrollbar-none p-2 bg-white/[0.01] border border-white/5 rounded-[24px] flex items-center gap-2 select-none">
        {isDevMode && (
          <button
            onClick={() => router.push('/app/test')}
            className="whitespace-nowrap px-4 py-2 rounded-xl text-xs font-black transition-all bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/40"
          >
            Test (Raw)
          </button>
        )}
        {tags.length > 0 && tags.map((tag, index) => (
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

      {/* Infinite scroll sentinel (top not needed) */}

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
                <button 
                  onClick={clearSearch}
                  className="h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white font-bold text-xs transition-all"
                >
                  Clear Search
                </button>
                <button 
                  onClick={handleCreateNoteClick}
                  className="h-10 px-4 rounded-xl bg-[#6366F1]/10 hover:bg-[#6366F1]/20 border border-[#6366F1]/20 hover:border-[#6366F1]/40 flex items-center justify-center text-[#818CF8] font-bold text-xs gap-1.5 transition-all"
                >
                  <PlusCircleIcon size={16} />
                  <span>New Idea</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={handleCreateNoteClick}
                className="h-10 px-4 rounded-xl bg-[#6366F1]/10 hover:bg-[#6366F1]/20 border border-[#6366F1]/20 hover:border-[#6366F1]/40 flex items-center justify-center text-[#818CF8] font-bold text-xs gap-1.5 transition-all"
              >
                <PlusCircleIcon size={16} />
                <span>Open Composer</span>
              </button>
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
                    Pinned Ideas ({pinnedNotes.length})
                  </span>
                </div>

                {pinnedNotes.length > 3 && (
                  <button 
                    onClick={() => openSidebar(<PinnedNotesSidebar offset={3} />, 'pinned-notes', { hideHeader: true })}
                    className="text-xs font-black text-[#EC4899] hover:text-[#f472b6] bg-[#EC4899]/5 hover:bg-[#EC4899]/10 border border-[#EC4899]/10 hover:border-[#EC4899]/20 px-3 py-1.5 rounded-xl transition-all"
                  >
                    See More ({pinnedNotes.length - 3})
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
          
          {hasNextPage && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              <span className="text-xs font-bold tracking-widest uppercase text-white/25">Loading more…</span>
            </div>
          )}
          {!hasNextPage && paginatedNotes.length > 0 && (
            <div className="flex justify-center py-4">
              <span className="text-[10px] font-bold tracking-widest uppercase text-white/15">End of list</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <NotesErrorBoundary>
      <div className="flex-1 min-h-screen pointer-events-auto pt-6 md:pt-8">
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
