'use client';

import React from 'react';
import { Box, Typography, IconButton, Stack } from '@/lib/openbricks/primitives';
import { X } from 'lucide-react';
import { Drawer } from '@/lib/openbricks/primitives';
import { useDrawerState } from '@/components/ui/DrawerStateContext';

export function DeleteNoteDrawer({ isOpen, onClose, onConfirm, noteTitle }: { 
    isOpen: boolean, 
    onClose: () => void,
    onConfirm: () => Promise<void>,
    noteTitle: string
}) {
  const { setIsDrawerOpen } = useDrawerState();

  React.useEffect(() => {
    setIsDrawerOpen(isOpen);
    return () => setIsDrawerOpen(false);
  }, [isOpen, setIsDrawerOpen]);

  const handleDelete = () => {
    // Close immediately — never block UI on remote call.
    onClose();
    void onConfirm().catch((err: unknown) => {
      console.warn('[DeleteNoteDrawer] Remote delete failed (best-effort):', err);
    });
  };

  return (
    <Drawer 
      anchor="bottom" 
      open={isOpen} 
      onClose={onClose} 
      PaperProps={{
        sx: {
          bgcolor: '#161412',
          backgroundImage: 'none',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          maxWidth: 600,
          width: '100%',
          mx: 'auto',
        }
      }} 
      ModalProps={{ keepMounted: false, disablePortal: true }}
    >
      <Box sx={{ px: 3, pt: 3, pb: 4, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Typography component="span" sx={{ fontWeight: 900, fontSize: '1.05rem', color: '#fff', fontFamily: 'var(--font-clash)', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
            Delete Note?
          </Typography>
          <IconButton 
            onClick={onClose} 
            sx={{ 
              color: 'rgba(255,255,255,0.4)', 
              bgcolor: '#0A0908', 
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              width: 34,
              height: 34,
              '&:hover': { color: '#fff', bgcolor: '#1C1A18' } 
            }}
          >
            <X size={15} />
          </IconButton>
        </Box>
        
        <Box sx={{ p: 2, bgcolor: '#0A0908', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
          <Typography component="span" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontFamily: 'var(--font-satoshi)', lineHeight: 1.5 }}>
            Are you sure you want to permanently delete &quot;{noteTitle}&quot;? This action cannot be undone.
          </Typography>
        </Box>
        
        <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
          <button 
            type="button" 
            onClick={onClose} 
            className="flex-1 py-3 rounded-xl border border-white/8 bg-[#0A0908] hover:bg-[#1C1A18] text-white font-satoshi font-bold text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="button" 
            onClick={handleDelete} 
            className="flex-1 py-3 rounded-xl border border-red-500/30 bg-red-600 hover:bg-red-700 text-white font-satoshi font-bold text-xs transition-all shadow-[0_4px_16px_rgba(220,38,38,0.3)] cursor-pointer"
          >
            Delete Permanently
          </button>
        </Stack>
      </Box>
    </Drawer>
  );
}
