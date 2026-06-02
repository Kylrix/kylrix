'use client';

import React, { useState } from 'react';
import { Box, Typography, IconButton, Button, Stack } from '@/lib/mui-tailwind/material';
import { X, Trash2 } from 'lucide-react';
import Drawer from '@/lib/mui-tailwind/material/Drawer';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import toast from 'react-hot-toast';

const DRAWER_SX = {
  borderTopLeftRadius: '24px',
  borderTopRightRadius: '24px',
  bgcolor: '#161412',
  borderTop: '1px solid #34322F',
  maxWidth: 720,
  width: '100%',
  mx: 'auto'
};

export function DeleteNoteDrawer({ isOpen, onClose, onConfirm, noteTitle }: { 
    isOpen: boolean, 
    onClose: () => void,
    onConfirm: () => Promise<void>,
    noteTitle: string
}) {
  const { setIsDrawerOpen } = useDrawerState();
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setIsDrawerOpen(isOpen);
  }, [isOpen, setIsDrawerOpen]);

  const handleDelete = async () => {
    setLoading(true);
    try {
        await onConfirm();
        toast.success('Note deleted');
        onClose();
    } catch {
        toast.error('Failed to delete note');
    } finally {
        setLoading(false);
    }
  };

  return (
    <Drawer 
        anchor="bottom" 
        open={isOpen} 
        onClose={onClose} 
        PaperProps={{ sx: DRAWER_SX }} 
        ModalProps={{ keepMounted: false, disableScrollLock: false, disablePortal: true }}
    >
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-clash)' }}>
            Delete Note?
          </Typography>
          <IconButton onClick={onClose} sx={{ color: '#9B9691' }}><X size={20} /></IconButton>
        </Box>
        
        <Typography sx={{ color: '#9B9691', mb: 3, fontWeight: 500 }}>
          Are you sure you want to permanently delete &quot;{noteTitle}&quot;? This action cannot be undone.
        </Typography>
        
        <Stack direction="row" spacing={2}>
            <Button fullWidth variant="outlined" onClick={onClose} sx={{ borderRadius: '12px', py: 1.5 }}>Cancel</Button>
            <Button fullWidth variant="contained" color="error" onClick={handleDelete} disabled={loading} sx={{ borderRadius: '12px', py: 1.5, bgcolor: '#FF4D4D' }}>
                {loading ? 'Deleting...' : 'Delete Permanently'}
            </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
