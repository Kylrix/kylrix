'use client';

import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { X } from 'lucide-react';
import Drawer from '@mui/material/Drawer';
import { useNoteDrawer } from '@/context/NoteDrawerContext';
import { useNotes } from '@/context/NotesContext';
import CreateNoteForm from '@/app/(app)/note/(app)/notes/CreateNoteForm';

const DRAWER_SX = {
  borderTopLeftRadius: '26px',
  borderTopRightRadius: '26px',
  bgcolor: '#161412',
  borderTop: '1px solid #34322F',
  backgroundImage: 'none',
  pb: 'calc(1rem + env(safe-area-inset-bottom))',
  maxWidth: 720,
  width: '100%',
  mx: 'auto'
};

export function NoteDrawer() {
  const { isOpen, close } = useNoteDrawer();
  const { upsertNote } = useNotes();

  return (
    <Drawer 
      anchor="bottom" 
      open={isOpen} 
      onClose={close}
      PaperProps={{ sx: DRAWER_SX }}
      ModalProps={{
          keepMounted: false,
          disableScrollLock: true,
      }}
    >
      <Box sx={{ p: 2.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: '#fff' }}>New Note</Typography>
          <IconButton onClick={close} sx={{ color: 'rgba(255,255,255,0.5)' }}>
            <X size={20} />
          </IconButton>
        </Box>

        <CreateNoteForm
            onNoteCreated={(newNote) => {
              upsertNote(newNote);
              close();
            }}
        />
      </Box>
    </Drawer>
  );
}
