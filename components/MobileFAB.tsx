"use client";

import React from 'react';
import { Box, Fab } from '@mui/material';
import { Add as PlusIcon } from '@mui/icons-material';
import { useNoteDrawer } from '@/context/NoteDrawerContext';
import { useNotes } from '@/context/NotesContext';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { sidebarIgnoreProps } from '@/constants/sidebar';

interface MobileFABProps {
  className?: string;
}

export const MobileFAB: React.FC<MobileFABProps> = ({ className: _className = '' }) => {
  const { open: openNoteDrawer } = useNoteDrawer();
  const { upsertNote } = useNotes();
  const { isDrawerOpen } = useDrawerState();

  if (isDrawerOpen) return null;

  const handleCreateNoteClick = () => {
    openNoteDrawer();
  };

  return (
    <Box

      sx={{
        position: 'fixed',
        bottom: 100, // Above MobileBottomNav
        right: 24,
        zIndex: 1400,
        display: { xs: 'flex', md: 'none' },
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 2
      }}
      {...sidebarIgnoreProps}
    >
      <Fab
        onClick={handleCreateNoteClick}
        sx={{
          width: 64,
          height: 64,
          bgcolor: '#6366F1',
          color: '#000',
          borderRadius: '20px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            bgcolor: '#EC4899',
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 24px rgba(99, 102, 241, 0.4)'
          }
        }}
      >
        <PlusIcon sx={{ fontSize: 32 }} />
      </Fab>
    </Box>
  );
};

export default MobileFAB;