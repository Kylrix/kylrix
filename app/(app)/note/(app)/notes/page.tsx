"use client";

import React, { useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { Box, Typography, Stack, IconButton, Alert, CircularProgress } from '@mui/material';
import { deleteNote } from '@/lib/appwrite';
import { useNotes } from '@/context/NotesContext';

import { useOverlay } from '@/components/ui/OverlayContext';

import { useSearchParams, useRouter } from 'next/navigation';
import type { Notes } from '@/types/appwrite';
import NoteCard from '@/components/ui/NoteCard';
import { NoteGridSkeleton } from '@/components/ui/NoteCardSkeleton';
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
} from '@mui/icons-material';
import { useFAB } from '@/context/FABContext';
import CreateNoteForm from './CreateNoteForm';
import { useSidebar } from '@/components/ui/SidebarContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { NoteDetailSidebar } from '@/components/ui/NoteDetailSidebar';
import { sidebarIgnoreProps } from '@/constants/sidebar';

import { NotesErrorBoundary } from '@/components/ui/ErrorBoundary';

function NotesContent() {
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
  const { openOverlay } = useOverlay();
  const { setConfiguration, resetConfiguration } = useFAB();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const { isOpen: isDynamicSidebarOpen, openSidebar, activeContentKey } = useDynamicSidebar();
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const openNoteIdParam = searchParams.get('openNoteId');

  // Fetch notes action for the search hook
  const fetchNotesAction = useCallback(async () => {
    const safeNotes = Array.isArray(allNotes) ? allNotes : [];
    return {
      documents: safeNotes,
      total: safeNotes.length
    };
  }, [allNotes]);

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
    data: allNotes,
    fetchDataAction: fetchNotesAction,
    searchConfig,
    paginationConfig
  });

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
    setConfiguration({
      isVisible: true,
      mainColor: '#EC4899',
      actions: [
        { id: 'new-note', label: 'NEW NOTE', icon: <NoteIcon />, onClick: () => openComposer('note') },
        { id: 'new-project', label: 'NEW PROJECT', icon: <ProjectIcon />, onClick: () => openComposer('project') },
        { id: 'manage-tags', label: 'MANAGE TAGS', icon: <TagIcon />, onClick: () => router.push('/note/tags') },
      ]
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, openComposer, router]);

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

  const hasReopenedRef = useRef(false);
  useEffect(() => {
    if (!activeContentKey || isDynamicSidebarOpen || !allNotes.length || hasReopenedRef.current) return;
    
    const targetNote = allNotes.find((candidate) => candidate.$id === activeContentKey);
    if (targetNote) {
      hasReopenedRef.current = true;
      openSidebar(
        <NoteDetailSidebar
          note={targetNote}
          onUpdate={handleNoteUpdated}
          onDelete={handleNoteDeleted}
        />,
        targetNote.$id || null
      );
    }
  }, [activeContentKey, allNotes, isDynamicSidebarOpen, openSidebar, handleNoteUpdated, handleNoteDeleted]);

  useEffect(() => {
    if (!openNoteIdParam) return;

    const targetNote = allNotes.find((candidate) => candidate.$id === openNoteIdParam);
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

    openSidebar(
      <NoteDetailSidebar
        note={targetNote}
        onUpdate={handleNoteUpdated}
        onDelete={handleNoteDeleted}
      />,
      targetNote.$id || null
    );

    cleanParams();
  }, [openNoteIdParam, allNotes, openSidebar, handleNoteUpdated, handleNoteDeleted, router]);

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
    const existingTags = Array.from(new Set(allNotes.flatMap(note => note.tags || [])));
    return existingTags.length > 0 ? existingTags.slice(0, 8) : ['Personal', 'Work', 'Ideas', 'To-Do'];
  }, [allNotes]);

  const pinnedNotes = useMemo(() => {
    if (hasSearchResults) return [];
    return allNotes.filter(n => isPinned(n.$id));
  }, [allNotes, isPinned, hasSearchResults]);

  const regularNotes = useMemo(() => {
    if (hasSearchResults) return paginatedNotes;
    return currentPage === 1 ? paginatedNotes.filter(n => !isPinned(n.$id)) : paginatedNotes;
  }, [paginatedNotes, isPinned, hasSearchResults, currentPage]);

  return (
    <Box sx={{ flex: 1, minHeight: '100vh', pointerEvents: 'auto' }}>
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
            {allNotes.length < totalNotes && !hasSearchResults ? (
              <>Syncing <Box component="span" sx={{ fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 700, color: 'secondary.main', fontSize: '0.85rem' }}>{allNotes.length}</Box> of <Box component="span" sx={{ fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 700, fontSize: '0.85rem' }}>{totalNotes}</Box> notes</>
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
            totalCount={hasSearchResults ? totalCount : allNotes.length}
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
        <NoteGridSkeleton count={12} />
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
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3, px: 1 }}>
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
              <Box sx={gridSx}>
                {pinnedNotes.map((note) => (
                  <NoteCard
                    key={note.$id}
                    note={note}
                    onUpdate={handleNoteUpdated}
                    onDelete={handleNoteDeleted}
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
            totalCount={hasSearchResults ? totalCount : (allNotes || []).length}
            pageSize={paginationConfig.pageSize}
            compact={false}
          />
        </Box>
      )}
    </Box>
  );
}

export default function NotesPage() {
  return (
    <NotesErrorBoundary>
      <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}>
        <NotesContent />
      </Suspense>
    </NotesErrorBoundary>
  );
}
