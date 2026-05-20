import React, { useState, useCallback } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { X, Check } from 'lucide-react';
import Drawer from '@mui/material/Drawer';
import { useNoteDrawer } from '@/context/NoteDrawerContext';
import { useNotes } from '@/context/NotesContext';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import CreateNoteForm from '@/app/(app)/note/(app)/notes/CreateNoteForm';

const DRAWER_SX = {
  borderTopLeftRadius: '24px',
  borderTopRightRadius: '24px',
  bgcolor: '#161412',
  borderTop: '1px solid #34322F',
  backgroundImage: 'none',
  maxWidth: 720,
  width: '100%',
  mx: 'auto'
};

export function NoteDrawer() {
  const { isOpen, close } = useNoteDrawer();
  const { upsertNote } = useNotes();
  const { setIsDrawerOpen } = useDrawerState();
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleClose = useCallback(() => {
    setIsDrawerOpen(false);
    close();
  }, [close, setIsDrawerOpen]);

  React.useEffect(() => {
    setIsDrawerOpen(isOpen);
  }, [isOpen, setIsDrawerOpen]);

  return (
    <Drawer 
      anchor="bottom" 
      open={isOpen} 
      onClose={handleClose}
      PaperProps={{ 
          sx: { 
            ...DRAWER_SX,
            height: isExpanded ? '92dvh' : '60dvh',
            transition: 'height 0.3s ease-in-out',
            pointerEvents: 'auto'
          }
      }}
      ModalProps={{
          keepMounted: false,
          disableScrollLock: false,
          disablePortal: true,
      }}
    >
      <Box 
        sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            py: 1.5, 
            cursor: 'pointer',
            borderBottom: '1px solid #34322F',
            pointerEvents: 'auto'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#3D3A36' }} aria-hidden />
      </Box>

      <Box sx={{ p: 3, flex: 1, overflowY: 'auto', pointerEvents: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-clash)' }}>
            {isExpanded ? 'Full Screen Note' : 'New Note'}
          </Typography>
          <IconButton onClick={handleClose} sx={{ color: '#9B9691' }}>
            <Check size={20} />
          </IconButton>
        </Box>

        <CreateNoteForm
            onNoteCreated={(newNote) => {
              upsertNote(newNote);
              setIsExpanded(false);
              close();
            }}
        />
      </Box>
    </Drawer>
  );
}
