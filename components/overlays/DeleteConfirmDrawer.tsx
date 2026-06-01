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
  Paper,
} from '@mui/material';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

export interface DeleteConfirmData {
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: (deleteMode?: 'detach' | 'created_within' | 'all') => Promise<void> | void;
  resourceName?: string;
  isProject?: boolean;
}

export function DeleteConfirmDrawer() {
  const { drawerData, close } = useUnifiedDrawer();
  const [loading, setLoading] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'detach' | 'created_within' | 'all'>('detach');

  const data = drawerData as DeleteConfirmData;

  if (!data) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (data.isProject) {
        await data.onConfirm(deleteMode);
      } else {
        await data.onConfirm();
      }
      close();
    } catch (err) {
      console.error('[DeleteConfirm] Action failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 3, md: 4 }, bgcolor: 'transparent', color: '#fff' }}>
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

      {data.isProject && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2, display: 'block' }}>
            Choose Deletion Mode
          </Typography>
          <Stack spacing={2}>
            {[
              {
                value: 'detach',
                title: 'Detach resources untouched (Safe)',
                desc: 'Keep all associated notes, tasks, and credentials intact. Only unlink and delete the project wrapper.',
                color: '#10B981'
              },
              {
                value: 'created_within',
                title: 'Delete project-created resources only',
                desc: 'Delete only resources that were created directly inside this project workspace. External linked resources remain untouched.',
                color: '#F59E0B'
              },
              {
                value: 'all',
                title: 'Delete all cascading resources (Dangerous)',
                desc: 'Permanently wipe all linked resources and their sub-objects (including comment reactions, chats, and physical voice notes).',
                color: '#EF4444'
              }
            ].map((option) => {
              const selected = deleteMode === option.value;
              return (
                <Paper
                  key={option.value}
                  variant="outlined"
                  onClick={() => setDeleteMode(option.value as any)}
                  sx={{
                    p: 2,
                    borderRadius: '16px',
                    bgcolor: selected ? alpha(option.color, 0.05) : 'rgba(255,255,255,0.01)',
                    borderColor: selected ? option.color : 'rgba(255,255,255,0.06)',
                    borderWidth: selected ? '2px' : '1px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                    '&:hover': {
                      borderColor: selected ? option.color : 'rgba(255,255,255,0.15)',
                      bgcolor: selected ? alpha(option.color, 0.07) : 'rgba(255,255,255,0.02)'
                    }
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" sx={{ fontWeight: 900, color: selected ? option.color : 'white' }}>
                      {option.title}
                    </Typography>
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: `2px solid ${selected ? option.color : 'rgba(255,255,255,0.3)'}`,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: selected ? option.color : 'transparent'
                      }}
                    >
                      {selected && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#000' }} />}
                    </Box>
                  </Stack>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                    {option.desc}
                  </Typography>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      )}

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
