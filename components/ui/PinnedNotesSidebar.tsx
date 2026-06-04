'use client';

import React, { useMemo } from 'react';
import { Box, Typography, Stack, IconButton, useTheme, alpha, Tooltip, CircularProgress } from '@/lib/mui-tailwind/material';
import { Close as CloseIcon, PushPin as PinIcon } from '@/lib/mui-tailwind/icons';
import { useNotes } from '@/context/NotesContext';
import NoteCard from '@/components/ui/NoteCard';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { Notes } from '@/types/appwrite';

export function PinnedNotesSidebar() {
  const theme = useTheme();
  const { notes: allNotes, pinnedIds, upsertNote, removeNote, isPinned } = useNotes();
  const { closeSidebar } = useDynamicSidebar();

  const pinnedNotes = useMemo(() => {
    return allNotes.filter((n: any) => {
      try {
        const meta = JSON.parse(n.metadata || '{}');
        const isEncrypted = meta.isEncrypted === true || meta.isEncrypted === 'true' || n.isEncrypted === true;
        return isPinned(n.$id) && !isEncrypted;
      } catch {
        return isPinned(n.$id) && !n.isEncrypted;
      }
    });
  }, [allNotes, isPinned]);

  const isHydrating = useMemo(() => {
    return pinnedIds.some(id => !allNotes.some(n => n.$id === id));
  }, [pinnedIds, allNotes]);

  const handleNoteUpdated = (updatedNote: Notes) => {
    upsertNote(updatedNote);
  };

  const handleNoteDeleted = (noteId: string) => {
    removeNote(noteId);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#161412', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: { xs: 2, md: 2.5 }, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', bgcolor: '#161412' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box 
            sx={{ 
              p: 1, 
              bgcolor: alpha(theme.palette.primary.main, 0.08), 
              borderRadius: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center'
            }}
          >
            <PinIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
          </Box>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 900, 
              fontFamily: '"Space Grotesk", sans-serif',
              color: 'white',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontSize: '1.1rem'
            }}
          >
            Pinned Notes ({pinnedIds.length})
          </Typography>
        </Stack>
        <Tooltip title="Close">
          <IconButton onClick={closeSidebar} sx={{ color: 'rgba(255, 255, 255, 0.4)', '&:hover': { color: 'white' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {pinnedNotes.length === 0 ? (
          isHydrating ? (
            <Box sx={{ py: 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
              <CircularProgress size={24} sx={{ color: theme.palette.primary.main }} />
              <Typography variant="body2" sx={{ ml: 2, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>Hydrating secure pins...</Typography>
            </Box>
          ) : (
            <Box sx={{ py: 8, textAlign: 'center', opacity: 0.5 }}>
              <Typography variant="body2">No pinned notes</Typography>
            </Box>
          )
        ) : (
          <>
            {pinnedNotes.map((note: any) => (
              <NoteCard
                key={note.$id}
                note={note}
                onUpdate={handleNoteUpdated}
                onDelete={handleNoteDeleted}
              />
            ))}
            {isHydrating && (
              <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={16} sx={{ color: theme.palette.primary.main }} />
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
