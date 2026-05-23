'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  CircularProgress,
  IconButton,
  alpha,
} from '@mui/material';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

export interface DeleteConfirmData {
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  resourceName?: string;
}

export function DeleteConfirmDrawer() {
  const { drawerData, close } = useUnifiedDrawer();
  const [loading, setLoading] = useState(false);

  const data = drawerData as DeleteConfirmData;

  if (!data) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await data.onConfirm();
      close();
    } catch (err) {
      console.error('[DeleteConfirm] Action failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 3, md: 4 }, bgcolor: '#0A0908', color: '#fff' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: alpha('#EF4444', 0.1), color: '#EF4444' }}>
            <AlertTriangle size={24} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', lineHeight: 1.2 }}>
            Confirm Deletion
          </Typography>
        </Stack>
        <IconButton onClick={close} sx={{ color: 'rgba(255,255,255,0.3)' }}>
          <X size={20} />
        </IconButton>
      </Stack>

      <Box sx={{ mb: 4 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: '1.1rem', mb: 1 }}>
          {data.title}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', lineHeight: 1.6 }}>
          {data.description || `This action is permanent and cannot be undone. All data associated with ${data.resourceName || 'this resource'} will be wiped from the ecosystem.`}
        </Typography>
      </Box>

      <Stack spacing={2}>
        <Button
          fullWidth
          variant="contained"
          onClick={handleConfirm}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Trash2 size={18} />}
          sx={{
            py: 2,
            borderRadius: '16px',
            fontWeight: 900,
            textTransform: 'none',
            fontSize: '1rem',
            bgcolor: '#EF4444',
            color: '#fff',
            '&:hover': { bgcolor: '#DC2626', transform: 'translateY(-2px)' },
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: '0 8px 16px rgba(239, 68, 68, 0.15)'
          }}
        >
          {loading ? 'Processing...' : data.confirmLabel || 'Delete Permanently'}
        </Button>
        
        <Button
          fullWidth
          variant="text"
          onClick={close}
          disabled={loading}
          sx={{
            py: 1.5,
            borderRadius: '12px',
            fontWeight: 800,
            textTransform: 'none',
            color: 'rgba(255,255,255,0.4)',
            '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.04)' }
          }}
        >
          Cancel
        </Button>
      </Stack>
    </Box>
  );
}
