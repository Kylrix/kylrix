'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Notes, Tags } from '@/types/appwrite';
import { getNotesByTag } from '@/lib/appwrite';
import { Box, Typography, IconButton, Stack, Alert } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { NoteDetailSidebar } from './NoteDetailSidebar';
import NoteCard from '@/components/ui/NoteCard';
import { NoteCardSkeleton } from './NoteCardSkeleton';
import { useNotes } from '@/context/NotesContext';

interface TagNotesListSidebarProps {
  tag: Tags;
  onBack: () => void;
  onNoteUpdate: (updatedNote: Notes) => void;
  onNoteDelete: (noteId: string) => void;
}

export function TagNotesListSidebar({
  tag,
  onBack,
  onNoteUpdate,
  onNoteDelete,
}: TagNotesListSidebarProps) {
  const [notes, setNotes] = useState<Notes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Notes | null>(null);
  const { isPinned } = useNotes();

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      const aPinned = isPinned(a.$id);
      const bPinned = isPinned(b.$id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [notes, isPinned]);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchedNotes = await getNotesByTag(tag.$id);
        setNotes(fetchedNotes || []);
      } catch (err: any) {
        setError(err instanceof Error ? err.message : 'Failed to fetch notes');
        setNotes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [tag.$id]);

  const handleHeaderBack = useCallback(() => {
    if (selectedNote) {
      setSelectedNote(null);
      return;
    }
    onBack();
  }, [selectedNote, onBack]);

  const handleNoteUpdate = (updatedNote: Notes) => {
    setNotes((prev) => prev.map((n) => (n.$id === updatedNote.$id ? updatedNote : n)));
    onNoteUpdate(updatedNote);
    if (selectedNote?.$id === updatedNote.$id) {
      setSelectedNote(updatedNote);
    }
  };

  const handleNoteDelete = (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.$id !== noteId));
    onNoteDelete(noteId);
    if (selectedNote?.$id === noteId) {
      setSelectedNote(null);
    }
  };

  const renderContent = () => {
    if (selectedNote) {
      return (
        <NoteDetailSidebar
          note={selectedNote}
          onUpdate={handleNoteUpdate}
          onDelete={handleNoteDelete}
          onBack={() => setSelectedNote(null)}
          showExpandButton={false}
        />
      );
    }

    return (
      <Box sx={{ py: 2 }}>
        {loading ? (
          <Stack spacing={2}>
            {Array.from({ length: 3 }).map((_, index) => (
              <NoteCardSkeleton key={index} />
            ))}
          </Stack>
        ) : error ? (
          <Alert 
            severity="error" 
            sx={{ 
              borderRadius: '16px',
              bgcolor: 'rgba(255, 69, 58, 0.1)',
              color: '#FF453A',
              border: '1px solid rgba(255, 69, 58, 0.2)',
              '& .MuiAlert-icon': { color: '#FF453A' }
            }}
          >
            {error}
          </Alert>
        ) : notes.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.4)',
                fontFamily: 'var(--font-satoshi), sans-serif',
                fontStyle: 'italic'
              }}
            >
              No notes with this tag
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {sortedNotes.map((note) => (
              <NoteCard
                key={note.$id}
                note={note}
                onUpdate={handleNoteUpdate}
                onDelete={handleNoteDelete}
                onNoteSelect={setSelectedNote}
              />
            ))}
          </Stack>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2 }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1, 
        pb: 2, 
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)', 
      }}>
        <IconButton 
          onClick={handleHeaderBack} 
          size="small"
          sx={{ 
            color: 'rgba(255, 255, 255, 0.5)', 
            '&:hover': { 
              color: '#6366F1',
              bgcolor: 'rgba(99, 102, 241, 0.1)'
            } 
          }}
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography 
          variant="subtitle2" 
          sx={{ 
            fontWeight: 900,
            fontFamily: '"Space Grotesk", sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '0.75rem'
          }}
        >
          {selectedNote ? 'Back to notes' : 'Back'}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {renderContent()}
      </Box>
    </Box>
  );
}

