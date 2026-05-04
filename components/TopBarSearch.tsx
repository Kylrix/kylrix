"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Notes } from '@/types/appwrite';
import { formatNoteCreatedDate } from '@/lib/date-utils';
import { useNotes } from '@/context/NotesContext';
import { useSearch } from '@/hooks/useSearch';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { NoteDetailSidebar } from '@/components/ui/NoteDetailSidebar';
import { deleteNote } from '@/lib/appwrite';
import { Button } from '@/components/ui/Button';
import { sidebarIgnoreProps } from '@/constants/sidebar';

import { Box, InputBase, Paper, List, ListItemButton, Typography, Chip, CircularProgress, IconButton } from '@mui/material';
import { Search, X } from 'lucide-react';

export function TopBarSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { notes, upsertNote, removeNote } = useNotes();

  const searchConfig = {
    searchFields: ['title', 'content', 'tags'],
    localSearch: true,
    debounceMs: 300,
  };

  const paginationConfig = {
    pageSize: 10,
  };

  const fetchDataAction = useCallback(async () => {
    return { documents: notes, total: notes.length };
  }, [notes]);

  const {
    items: searchResults,
    isSearching,
    searchQuery,
    setSearchQuery,
    clearSearch,
  } = useSearch({
    data: notes,
    fetchDataAction,
    searchConfig,
    paginationConfig,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        clearSearch();
        inputRef.current?.blur();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [clearSearch]);

  const handleClear = () => {
    clearSearch();
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleNoteUpdated = useCallback(
    (updatedNote: Notes) => {
      upsertNote(updatedNote);
    },
    [upsertNote]
  );

  const handleNoteDeleted = useCallback(
    async (noteId: string) => {
      if (!noteId) return;
      try {
        await deleteNote(noteId);
        removeNote(noteId);
      } catch (error: any) {
        console.error('Failed to delete note from search sidebar:', error);
      }
    },
    [removeNote]
  );

  const { openSidebar } = useDynamicSidebar();

  const handleResultSelect = useCallback(
    (note: Notes) => {
      openSidebar(
        <NoteDetailSidebar
          note={note}
          onUpdate={handleNoteUpdated}
          onDelete={handleNoteDeleted}
        />,
        note.$id || null
      );
      setIsOpen(false);
      clearSearch();
      inputRef.current?.blur();
    },
    [clearSearch, handleNoteDeleted, handleNoteUpdated, openSidebar]
  );

  const hasSearchResults = searchResults.length > 0;
  const showDropdown = isOpen && searchQuery.length > 0;

  return (
    <Box
      ref={searchRef}
      sx={{ position: 'relative', width: '100%' }}
      {...sidebarIgnoreProps}
    >
      {/* Search Input */}
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          bgcolor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid',
          borderColor: isOpen ? 'primary.main' : 'rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          px: 2,
          py: 0.5,
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.2)',
            bgcolor: 'rgba(255, 255, 255, 0.05)',
          },
          boxShadow: isOpen ? '0 0 0 4px rgba(0, 240, 255, 0.1)' : 'none',
        }}
      >
        <Search size={18} strokeWidth={1.5} color={isOpen ? '#00f0ff' : 'rgba(255, 255, 255, 0.4)'} />
        <Box sx={{ width: 12 }} />
        <InputBase
          inputRef={inputRef}
          placeholder="Search Notes..."
          value={searchQuery}
          onChange={ (e) => setSearchQuery(e.target.value)}
          onFocus={handleFocus}
          fullWidth
          sx={{
            color: 'text.primary',
            fontSize: '0.9375rem',
            fontWeight: 500,
            '& .MuiInputBase-input::placeholder': {
              color: 'text.secondary',
              opacity: 0.5,
            },
          }}
        />
        {searchQuery && (
          <IconButton size="small" onClick={handleClear} sx={{ color: 'text.secondary' }}>
            <X size={16} strokeWidth={1.5} />
          </IconButton>
        )}
      </Box>

      {/* Search Results Dropdown */}
      {showDropdown && (
        <Paper
          elevation={0}
          sx={{
            position: 'absolute',
            top: 'calc(100% + 12px)',
            left: 0,
            right: 0,
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '16px',
            overflow: 'hidden',
            zIndex: 1300,
            maxHeight: '70vh',
            backdropFilter: 'blur(20px)',
            backgroundColor: 'rgba(10, 10, 10, 0.8)',
          }}
        >
          {isSearching ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress size={24} sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">Searching...</Typography>
            </Box>
          ) : hasSearchResults ? (
            <Box>
              <Box sx={{ px: 2, py: 1, bgcolor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.1em', color: 'text.secondary', textTransform: 'uppercase' }}>
                  {searchResults.length} {searchResults.length !== 1 ? 'results' : 'result'} found
                </Typography>
              </Box>
              <List sx={{ p: 0, maxHeight: 400, overflowY: 'auto' }}>
                {searchResults.map((note: Notes) => (
                  <ListItemButton
                    key={note.$id}
                    onClick={() => handleResultSelect(note)}
                    sx={{
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      px: 2.5,
                      py: 2,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 'none' },
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                        '& .note-title': { color: 'primary.main' }
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, transition: 'color 0.2s' }}>
                        {note.title || 'Untitled Note'}
                      </Typography>
                      <Typography variant="caption" sx={{ 
                        fontFamily: 'monospace', 
                        color: 'text.secondary',
                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                        px: 1,
                        borderRadius: '4px',
                        border: '1px solid',
                        borderColor: 'divider'
                      }}>
                        {formatNoteCreatedDate(note, { year: '2-digit', month: 'short', day: '2-digit' })}
                      </Typography>
                    </Box>
                    {note.content && (
                      <Typography variant="caption" color="text.secondary" sx={{ 
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        mb: 1.5
                      }}>
                        {note.content.substring(0, 100)}
                      </Typography>
                    )}
                    {note.tags && note.tags.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {note.tags.slice(0, 3).map((tag: string) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '9px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              bgcolor: 'rgba(0, 240, 255, 0.05)',
                              color: 'primary.main',
                              border: '1px solid',
                              borderColor: 'rgba(0, 240, 255, 0.2)',
                              borderRadius: '4px',
                              '& .MuiChip-label': { px: 1 }
                            }}
                          />
                        ))}
                      </Box>
                    )}
                  </ListItemButton>
                ))}
              </List>
            </Box>
          ) : (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Box sx={{ 
                width: 64, 
                height: 64, 
                bgcolor: 'rgba(255, 255, 255, 0.03)', 
                border: '1px solid', 
                borderColor: 'divider', 
                borderRadius: '16px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                mx: 'auto',
                mb: 2
              }}>
                <Search size={32} strokeWidth={1} color="rgba(255,255,255,0.2)" />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: '-0.02em', mb: 0.5 }}>NO_RESULTS</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                No results matched &quot;{searchQuery}&quot;
              </Typography>
              <Button size="small" variant="outlined" onClick={handleClear}>
                Reset Search
              </Button>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}