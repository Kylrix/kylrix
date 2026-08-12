'use client';

import React, { useState } from 'react';
import { Box, Typography, IconButton, Button, Stack } from '@/lib/openbricks/primitives';
import { X } from 'lucide-react';
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
    <Box sx={{ p: 3, color: '#fff' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', color: '#fff', fontFamily: 'var(--font-clash)' }}>
          {data.title || 'Confirm Deletion'}
        </Typography>
        <IconButton onClick={close} sx={{ color: '#9B9691' }}>
          <X size={20} />
        </IconButton>
      </Box>

      <Typography sx={{ color: '#9B9691', mb: 3, fontWeight: 500, fontSize: '0.9rem', lineHeight: 1.5 }}>
        {data.description || `Are you sure you want to permanently erase ${data.resourceName || 'this item'}? This action cannot be undone.`}
      </Typography>

      {data.isProject && (
        <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9B9691', fontFamily: 'var(--font-clash)' }}>
            Deletion Scope
          </Typography>

          {[
            {
              id: 'detach',
              title: 'Keep Linked Items (Unlink Only)',
              desc: 'Removes the workspace row, leaving linked notes, forms, and goals intact.'
            },
            {
              id: 'created_within',
              title: 'Delete Workspace-Created Items Only',
              desc: 'Purges notes/tasks created directly inside this workspace. Pre-existing linked items remain untouched.'
            },
            {
              id: 'all',
              title: 'Nuclear Wipe (Delete Everything)',
              desc: 'Permanently destroys the workspace AND all linked notes, forms, goals, and thread histories.'
            }
          ].map((option) => {
            const isSelected = deleteMode === option.id;
            return (
              <Box
                key={option.id}
                onClick={() => setDeleteMode(option.id as any)}
                sx={{
                  p: 2,
                  borderRadius: '14px',
                  border: isSelected ? '1px solid #FF4D4D' : '1px solid #34322F',
                  bgcolor: isSelected ? 'rgba(255, 77, 77, 0.08)' : '#1C1A18',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    borderColor: isSelected ? '#FF4D4D' : 'rgba(255, 255, 255, 0.2)',
                  }
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff', fontFamily: 'var(--font-clash)' }}>
                    {option.title}
                  </Typography>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      border: isSelected ? '2px solid #FF4D4D' : '2px solid #34322F',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSelected && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#FF4D4D' }} />}
                  </Box>
                </Box>
                <Typography sx={{ color: '#9B9691', fontSize: '0.75rem', lineHeight: 1.4 }}>
                  {option.desc}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={close}
          disabled={loading}
          sx={{
            borderRadius: '12px',
            py: 1.5,
            borderColor: '#34322F',
            color: '#fff',
            fontWeight: 700,
            textTransform: 'none',
            '&:hover': { borderColor: 'rgba(255, 255, 255, 0.3)', bgcolor: 'rgba(255, 255, 255, 0.05)' }
          }}
        >
          Cancel
        </Button>
        <Button
          fullWidth
          variant="contained"
          onClick={handleConfirm}
          disabled={loading}
          sx={{
            borderRadius: '12px',
            py: 1.5,
            bgcolor: '#FF4D4D',
            color: '#fff',
            fontWeight: 700,
            textTransform: 'none',
            '&:hover': { bgcolor: '#E63939' }
          }}
        >
          {loading ? 'Deleting...' : (data.confirmLabel || 'Delete Permanently')}
        </Button>
      </Stack>
    </Box>
  );
}
