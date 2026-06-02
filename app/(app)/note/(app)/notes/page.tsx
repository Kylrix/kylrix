"use client";

import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { Box, Typography, Stack, IconButton, Alert,  alpha, useMediaQuery, useTheme } from '@/lib/mui-tailwind/material';
import { deleteNote } from '@/lib/actions/client-ops';
import { useNotes } from '@/context/NotesContext';

import { useOverlay } from '@/components/ui/OverlayContext';

import { useSearchParams, useRouter } from 'next/navigation';
import type { Notes } from '@/types/appwrite';
import NoteCard from '@/components/ui/NoteCard';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { useSearch } from '@/hooks/useSearch';
import {
  Search as MagnifyingGlassIcon,
  AddCircleOutline as PlusCircleIcon,
  Logout as ArrowLeftOnRectangleIcon,
  Login as ArrowRightOnRectangleIcon,
  PushPin as PinIcon,
  Refresh as RefreshIcon,
  FolderSpecial as ProjectIcon,
  Description as NoteIcon,
  Tag as TagIcon,
} from '@/lib/mui-tailwind/icons';
import { useFAB } from '@/context/FABContext';

import { ChevronDown, ChevronUp, Maximize2, FolderKanban, Share2 } from 'lucide-react';
import { getSharedNotes } from '@/lib/appwrite';
import { ProjectsService } from '@/lib/appwrite/projects';

// Client-side persistence cache to resist reload flicker
let cachedSharedNotes: any[] | null = null;
let cachedProjects: any[] | null = null;
import CreateNoteForm from './CreateNoteForm';
import { useSidebar } from '@/components/ui/SidebarContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { NoteDetailSidebar } from '@/components/ui/NoteDetailSidebar';
import { sidebarIgnoreProps } from '@/constants/sidebar';

import { NotesErrorBoundary } from '@/components/ui/ErrorBoundary';
import { PinnedNotesSidebar } from '@/components/ui/PinnedNotesSidebar';

export default function NotesPage() {
  const { 
    notes: allNotes, 
    totalNotes, 
    isLoading: isInitialLoading, 
    hasMore, 
    loadMore, 
    upsertNote, 
    removeNote,
    isPinned,
    refetchNotes
  } = useNotes();
  const { openOverlay, closeOverlay } = useOverlay();
  const { setConfiguration, resetConfiguration } = useFAB();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const { isOpen: isDynamicSidebarOpen, openSidebar, activeContentKey } = useDynamicSidebar();
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const openNoteIdParam = searchParams.get('openNoteId');

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

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

  // Fetch notes action for the search hook
  const fetchNotesAction = useCallback(async () => {
    const safeNotes = Array.isArray(visibleNotes) ? visibleNotes : [];
    return {
      documents: safeNotes,
      total: safeNotes.length
    };
  }, [visibleNotes]);

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
    data: visibleNotes,
    fetchDataAction: fetchNotesAction,
    searchConfig,
    paginationConfig
  });

  const regularSourceNotes = useMemo(() => {
    if (hasSearchResults) return visibleNotes;
    return visibleNotes.filter(n => !n.isPinned);
  }, [visibleNotes, hasSearchResults]);

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
          { id: 'new-note', label: 'NEW NOTE', icon: <NoteIcon />, onClick: () => openComposer('note') },
          { id: 'new-project', label: 'NEW PROJECT', icon: <ProjectIcon />, onClick: () => openComposer('project') },
          { id: 'manage-tags', label: 'MANAGE TAGS', icon: <TagIcon />, onClick: () => router.push('/note/tags') }]
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

  const gridSx = useMemo(() => {
    if (!isCollapsed && isDynamicSidebarOpen) {
      return {
        display: 'grid',
        gap: 2,
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        perspective: '1200px'
      };
    } else if (!isCollapsed || isDynamicSidebarOpen) {
      return {
        display: 'grid',
        gap: 2,
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        perspective: '1200px'
      };
    } else {
      return {
        display: 'grid',
        gap: 2,
        perspective: '1200px',
        '@media (min-width: 600px)': { gap: 2.5 },
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          sm: 'repeat(auto-fill, minmax(260px, 1fr))',
          md: 'repeat(auto-fill, minmax(280px, 1fr))',
          lg: 'repeat(auto-fill, minmax(300px, 1fr))',
          xl: 'repeat(auto-fill, minmax(320px, 1fr))'
        }
      };
    }
  }, [isCollapsed, isDynamicSidebarOpen]);

  const tags = useMemo(() => {
    const existingTags = Array.from(new Set(visibleNotes.flatMap(note => note.tags || [])));
    return existingTags.length > 0 ? existingTags.slice(0, 8) : ['Personal', 'Work', 'Ideas', 'To-Do'];
  }, [visibleNotes]);

  const pinnedNotes = useMemo(() => {
    if (hasSearchResults) return [];
    return visibleNotes.filter(n => !!n.isPinned);
  }, [visibleNotes, hasSearchResults]);

  const regularNotes = useMemo(() => {
    return paginatedNotes;
  }, [paginatedNotes]);

  const mainNotesContent = (
    <>
      {/* Desktop Header */}
      <Box
        component="header"
        sx={{
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 6,
          p: 4,
          bgcolor: 'rgba(255, 255, 255, 0.01)',
          borderRadius: '32px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '-1px',
            left: '10%',
            right: '10%',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, secondary.main, primary.main, transparent)',
          }
        }}
      >
        <Box>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 900,
              fontFamily: 'var(--font-clash-display)',
              color: 'text.primary',
              mb: 1,
              letterSpacing: '-0.04em',
            }}
          >
            Notes
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              fontWeight: 500,
              fontFamily: 'var(--font-satoshi)',
              opacity: 0.8
            }}
          >
            {visibleNotes.length < totalNotes && !hasSearchResults ? (
              <>Syncing <Box component="span" sx={{ fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 700, color: 'secondary.main', fontSize: '0.85rem' }}>{visibleNotes.length}</Box> of <Box component="span" sx={{ fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 700, fontSize: '0.85rem' }}>{totalNotes}</Box> notes</>
            ) : (
              hasSearchResults ? (
                <><Box component="span" sx={{ fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 700, color: 'secondary.main', fontSize: '0.85rem' }}>{totalCount}</Box> {totalCount === 1 ? 'result' : 'results'} found</>
              ) : (
                <><Box component="span" sx={{ fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 700, color: 'secondary.main', fontSize: '0.85rem' }}>{totalNotes}</Box> {totalNotes === 1 ? 'note' : 'notes'}</>
              )
            )}
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton
            onClick={handleManualRefresh}
            {...sidebarIgnoreProps}
            sx={{ 
              color: isRefreshing ? 'secondary.main' : 'text.secondary',
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.15)',
              },
              transition: 'all 0.3s ease',
              '& svg': {
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' }
                }
              }
            }}
            disabled={isRefreshing}
          >
            <RefreshIcon />
          </IconButton>
          <IconButton
            onClick={handleToggleSidebar}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            {...sidebarIgnoreProps}
            sx={{ 
              color: 'text.secondary',
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.15)',
              }
            }}
          >
            {isCollapsed ? (
              <ArrowRightOnRectangleIcon />
            ) : (
              <ArrowLeftOnRectangleIcon />
            )}
          </IconButton>
          <IconButton 
            onClick={handleCreateNoteClick} 
            {...sidebarIgnoreProps} 
            sx={{ 
              color: 'primary.main',
              bgcolor: 'rgba(99, 102, 241, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(99, 102, 241, 0.1)',
              px: 2,
              '&:hover': {
                bgcolor: 'rgba(99, 102, 241, 0.1)',
                borderColor: 'rgba(99, 102, 241, 0.2)',
              }
            }}
          >
            <PlusCircleIcon />
          </IconButton>
        </Stack>
      </Box>

      {/* Tags Filter */}
      {tags.length > 0 && (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            mb: 6,
            overflowX: 'auto',
            p: 1.5,
            bgcolor: 'rgba(255, 255, 255, 0.01)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            alignItems: 'center',
            '&::-webkit-scrollbar': { display: 'none' },
            msOverflowStyle: 'none',
            scrollbarWidth: 'none'
          }}
        >
          {tags.map((tag, index) => (
            <Button
              key={index}
              variant={searchQuery === tag ? 'contained' : 'outlined'}
              size="small"
              sx={{ 
                whiteSpace: 'nowrap',
                borderRadius: '12px',
                fontFamily: 'var(--font-satoshi)',
                fontWeight: 700,
                fontSize: '0.85rem',
                textTransform: 'none',
                py: 1,
                px: 2.5,
                bgcolor: searchQuery === tag ? 'secondary.main' : 'rgba(255, 255, 255, 0.03)',
                borderColor: searchQuery === tag ? 'secondary.main' : 'rgba(255, 255, 255, 0.08)',
                color: searchQuery === tag ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                '&:hover': {
                  bgcolor: searchQuery === tag ? 'secondary.light' : 'rgba(255, 255, 255, 0.05)',
                  borderColor: searchQuery === tag ? 'secondary.light' : 'rgba(255, 255, 255, 0.15)',
                }
              }}
              aria-pressed={searchQuery === tag}
              onClick={() => searchQuery === tag ? clearSearch() : setSearchQuery(tag)}
              {...sidebarIgnoreProps}
            >
              {tag}
            </Button>
          ))}

          {hasSearchResults && (
            <Button 
              variant="text" 
              size="small" 
              onClick={clearSearch} 
              sx={{ 
                ml: 1, 
                color: 'primary.main',
                fontFamily: 'var(--font-jetbrains-mono)',
                fontSize: '0.75rem',
                letterSpacing: '0.05em'
              }} 
              {...sidebarIgnoreProps}
            >
              Clear
            </Button>
          )}
        </Stack>
      )}

      {/* Top Pagination */}
      {totalPages > 1 && (
        <Box sx={{ mb: 3 }}>
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
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            borderRadius: '16px',
            bgcolor: 'rgba(211, 47, 47, 0.1)',
            color: '#ff5252',
            border: '1px solid rgba(211, 47, 47, 0.2)',
            '& .MuiAlert-icon': { color: '#ff5252' }
          }}
        >
          {error}
        </Alert>
      )}

      {/* Notes Grid */}
      {isInitialLoading ? (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr', xl: '1fr 1fr 1fr 1fr' },
          gap: 3,
        }}>
          {Array.from({ length: 12 }).map((_, index) => (
            <NoteCard key={`skeleton-${index}`} note={{ $id: `skeleton-${index}`, title: 'Loading...', content: '', tags: [], isPublic: false, status: 'loading' } as any} />
          ))}
        </Box>
      ) : paginatedNotes.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 10,
            textAlign: 'center'
          }}
        >
          <Box
            sx={{
              width: 96,
              height: 96,
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            {hasSearchResults ? (
              <MagnifyingGlassIcon sx={{ fontSize: 48, color: 'text.disabled', opacity: 0.5 }} />
            ) : (
              <PlusCircleIcon sx={{ fontSize: 48, color: 'text.disabled', opacity: 0.5 }} />
            )}
          </Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 900,
              fontFamily: 'var(--font-space-grotesk)',
              color: 'text.primary',
              mb: 1.5
            }}
          >
            {hasSearchResults ? 'No Results' : 'Empty'}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              mb: 4,
              maxWidth: 400,
              fontWeight: 500
            }}
          >
            {hasSearchResults
              ? `No matches found for "${searchQuery}". Try a different search term.`
              : 'Capture your thoughts and ideas here. Your notes are private and secure.'
            }
          </Typography>
          {hasSearchResults ? (
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" onClick={clearSearch}>
                Clear Search
              </Button>
              <Button onClick={handleCreateNoteClick} startIcon={<PlusCircleIcon />}>
                New Note
              </Button>
            </Stack>
          ) : (
            <Button onClick={handleCreateNoteClick} startIcon={<PlusCircleIcon />}>
              Open Composer
            </Button>
          )}
        </Box>
      ) : (
        <Stack spacing={4}>
          {pinnedNotes.length > 0 && (
            <Box 
              sx={{ 
                p: { xs: 2, md: 3 }, 
                bgcolor: 'rgba(255, 255, 255, 0.01)', 
                borderRadius: '32px', 
                border: '1px solid rgba(255, 255, 255, 0.05)' 
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ mb: 3, px: 1 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box 
                    sx={{ 
                      p: 1, 
                      bgcolor: 'rgba(236, 72, 153, 0.05)', 
                      borderRadius: '10px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      border: '1px solid rgba(236, 72, 153, 0.1)'
                    }}
                  >
                    <PinIcon sx={{ fontSize: 16, color: 'secondary.main', transform: 'rotate(45deg)' }} />
                  </Box>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 800, 
                      fontFamily: 'var(--font-clash-display)', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.15em', 
                      fontSize: '0.75rem', 
                      color: 'secondary.main',
                    }}
                  >
                    Pinned Notes
                  </Typography>
                </Stack>

                {pinnedNotes.length > 3 && (
                  <Button 
                    size="small" 
                    onClick={() => openSidebar(<PinnedNotesSidebar />, 'pinned-notes')}
                    sx={{ 
                      color: 'secondary.main', 
                      fontWeight: 800, 
                      textTransform: 'none',
                      fontSize: '0.75rem',
                      '&:hover': { bgcolor: 'rgba(236, 72, 153, 0.05)' }
                    }}
                  >
                    See More ({pinnedNotes.length - 3})
                  </Button>
                )}
              </Stack>
              <Box sx={gridSx}>
                {pinnedNotes.slice(0, 3).map((note) => (
                  <NoteCard
                    key={note.$id}
                    note={note}
                    onUpdate={handleNoteUpdated}
                    onDelete={handleNoteDeleted}
                    onNoteSelect={openNoteDetailSurface}
                  />
                ))}
              </Box>
            </Box>
          )}

          {regularNotes.length > 0 && (
            <Box 
              sx={{ 
                p: { xs: 2, md: 3 }, 
                bgcolor: 'rgba(255, 255, 255, 0.01)', 
                borderRadius: '32px', 
                border: '1px solid rgba(255, 255, 255, 0.05)' 
              }}
            >
              {pinnedNotes.length > 0 && (
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3, px: 1 }}>
                  <Box 
                    sx={{ 
                      p: 1, 
                      bgcolor: 'rgba(255, 255, 255, 0.03)', 
                      borderRadius: '10px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <MagnifyingGlassIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  </Box>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 800, 
                      fontFamily: 'var(--font-clash-display)', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.15em', 
                      fontSize: '0.75rem', 
                      color: 'text.secondary',
                      opacity: 0.6
                    }}
                  >
                    All Notes
                  </Typography>
                </Stack>
              )}
              <Box sx={gridSx}>
                {regularNotes.map((note) => (
                  <NoteCard
                    key={note.$id}
                    note={note}
                    onUpdate={handleNoteUpdated}
                    onDelete={handleNoteDeleted}
                    onNoteSelect={openNoteDetailSurface}
                  />
                ))}
              </Box>
            </Box>
          )}
          
          {hasMore && !isInitialLoading && !hasSearchResults && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button variant="outlined" onClick={loadMore} {...sidebarIgnoreProps}>
                Load More
              </Button>
            </Box>
          )}
        </Stack>
      )}

      {/* Bottom Pagination */}
      {totalPages > 1 && paginatedNotes.length > 0 && (
        <Box sx={{ mt: 4 }}>
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
        </Box>
      )}
    </>
  );

  return (
    <NotesErrorBoundary>
      <Box sx={{ flex: 1, minHeight: '100vh', pointerEvents: 'auto' }}>
        {isDesktop ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 4, alignItems: 'flex-start' }}>
            {/* Left Pane: Main Notes Content */}
            <Box sx={{ minWidth: 0 }}>
              {mainNotesContent}
            </Box>

            {/* Right Pane: Sticky interactive side column */}
            <Box sx={{
              height: 'calc(100vh - 120px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              position: 'sticky',
              top: '108px',
            }}>
              {/* Section 1: Shared Notes Accordion */}
              <Box sx={{
                bgcolor: '#161412',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'flex 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: sharedNotesOpen && projectsOpen ? '1 1 50%' : sharedNotesOpen ? '1 1 100%' : '0 0 68px',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: sharedNotesOpen ? 2 : 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
                    Shared Notes
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton onClick={() => setSharedNotesOpen(!sharedNotesOpen)} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
                      {sharedNotesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </IconButton>
                    <IconButton onClick={() => router.push('/note/shared')} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#EC4899' } }}>
                      <Maximize2 size={14} />
                    </IconButton>
                  </Box>
                </Box>

                {sharedNotesOpen && (
                  <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                    {sharedNotesLoading ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {[1, 2, 3].map((n) => (
                          <Box key={n} sx={{ display: 'flex', gap: 1.5, p: 1.5, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
                            <></>
                            <Box sx={{ flex: 1 }}>
                              <></>
                              <></>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    ) : sharedNotes.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                          No shared notes.
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {sharedNotes.map((note) => (
                          <Box
                            key={note.$id}
                            onClick={() => handleSharedNoteClick(note)}
                            sx={{
                              display: 'flex',
                              gap: 1.5,
                              p: 1.5,
                              borderRadius: '16px',
                              bgcolor: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.03)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                bgcolor: 'rgba(255,255,255,0.04)',
                                borderColor: 'rgba(255,255,255,0.08)',
                                transform: 'translateX(3px)',
                              }
                            }}
                          >
                            <Box sx={{
                              width: 36,
                              height: 36,
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: alpha('#EC4899', 0.12),
                              color: '#EC4899',
                              flexShrink: 0,
                            }}>
                              <Share2 size={18} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }} noWrap>
                                {note.title || 'Untitled Note'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }} noWrap>
                                BY: {note.userId === 'system' ? 'SYSTEM' : (note.userName || 'Collaborator').toUpperCase()}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>

              {/* Section 2: Projects Accordion */}
              <Box sx={{
                bgcolor: '#161412',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'flex 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: sharedNotesOpen && projectsOpen ? '1 1 50%' : projectsOpen ? '1 1 100%' : '0 0 68px',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: projectsOpen ? 2 : 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
                    Projects
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton onClick={() => setProjectsOpen(!projectsOpen)} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
                      {projectsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </IconButton>
                    <IconButton onClick={() => router.push('/projects')} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#EC4899' } }}>
                      <Maximize2 size={14} />
                    </IconButton>
                  </Box>
                </Box>

                {projectsOpen && (
                  <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                    {projectsLoading ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {[1, 2, 3].map((n) => (
                          <Box key={n} sx={{ display: 'flex', gap: 1.5, p: 1.5, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
                            <></>
                            <Box sx={{ flex: 1 }}>
                              <></>
                              <></>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    ) : projects.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                          No active projects.
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {projects.map((proj) => (
                          <Box
                            key={proj.$id}
                            onClick={() => router.push(`/projects/${proj.$id}`)}
                            sx={{
                              display: 'flex',
                              gap: 1.5,
                              p: 1.5,
                              borderRadius: '16px',
                              bgcolor: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.03)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                bgcolor: 'rgba(255,255,255,0.04)',
                                borderColor: 'rgba(255,255,255,0.08)',
                                transform: 'translateX(3px)',
                              }
                            }}
                          >
                            <Box sx={{
                              width: 36,
                              height: 36,
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: alpha(proj.color || '#6366F1', 0.12),
                              color: proj.color || '#6366F1',
                              flexShrink: 0,
                            }}>
                              <FolderKanban size={18} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }} noWrap>
                                {proj.name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }} noWrap>
                                STATUS: {(proj.status || 'Active').toUpperCase()}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        ) : (
          <>
            {/* Mobile Header */}
            <Box
              component="header"
              sx={{
                mb: 4,
                display: { xs: 'flex', md: 'none' },
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 1.5,
                bgcolor: 'rgba(255, 255, 255, 0.01)',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 900,
                  fontFamily: 'var(--font-clash-display)',
                  color: 'text.primary',
                  letterSpacing: '-0.04em',
                }}
              >
                Notes
              </Typography>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <IconButton 
                  onClick={handleManualRefresh} 
                  {...sidebarIgnoreProps} 
                  sx={{ 
                    color: isRefreshing ? 'secondary.main' : 'text.secondary',
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.05)',
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                    },
                    transition: 'all 0.3s ease',
                    '& svg': {
                      animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' }
                      }
                    }
                  }}
                  disabled={isRefreshing}
                >
                  <RefreshIcon />
                </IconButton>
              </Stack>
            </Box>
            {mainNotesContent}
          </>
        )}
      </Box>
    </NotesErrorBoundary>
  );
}
