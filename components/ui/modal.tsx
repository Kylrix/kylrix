import React from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Typography, Box, alpha } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#161412',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.4)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.02)',
          borderRight: '1px solid rgba(255, 255, 255, 0.02)',
          borderRadius: '24px',
          backgroundImage: 'none',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)',
        }
      }}
    >
      <DialogTitle sx={{ m: 0, p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 900, 
            fontFamily: 'var(--font-clash)',
            color: '#EC4899',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          {title}
        </Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            color: 'rgba(255, 255, 255, 0.5)',
            transition: 'all 0.2s ease',
            '&:hover': { 
              color: '#EC4899',
              bgcolor: alpha('#EC4899', 0.1)
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 3, pt: 1 }}>
        <Box sx={{ color: '#FFFFFF', fontFamily: 'var(--font-satoshi)' }}>
          {children}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
