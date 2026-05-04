"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getNote, updateNote, deleteNote } from '@/lib/appwrite';
import type { Notes } from '@/types/appwrite';
import { NoteDetailSidebar } from '@/components/ui/NoteDetailSidebar';
import { 
  Box, 
  Typography, 
  Button, 
  IconButton, 
  CircularProgress, 
  Container, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  useTheme, 
  useMediaQuery,
  alpha
} from '@mui/material';
import { 
  Delete as TrashIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';
import { useToast } from '@/components/ui/Toast';
import CommentsSection from '@/app/(app)/note/(app)/notes/Comments';
import NoteReactions from '@/app/(app)/note/(app)/notes/NoteReactions';
import SudoGuard from '@/components/ui/SudoGuard';
import { useDataNexus } from '@/context/DataNexusContext';

export default function NoteEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const [note, setNote] = useState<Notes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { showSuccess, showError } = useToast();
  const theme = useTheme();
  const isMobileViewport = useMediaQuery(theme.breakpoints.down('md'));
  const { fetchOptimized, setCachedData, invalidate, getCachedData } = useDataNexus();

  const CACHE_KEY = useMemo(() => id ? `note_${id}` : null, [id]);

  useEffect(() => {
    let mounted = true;

    if (!id || !CACHE_KEY) {
      setIsLoading(false);
      return;
    }

    // Try to get from cache first for instant UI
    const cached = getCachedData<Notes>(CACHE_KEY);
    if (cached) {
      setNote(cached);
      setIsLoading(false);
    }

    (async () => {
      if (!cached) setIsLoading(true);
      try {
        const fetched = await fetchOptimized(CACHE_KEY, () => getNote(id as string));
        if (mounted) {
          setNote(fetched);
        }
      } catch (error: any) {
        console.error('Failed to load note', error);
        showError('Failed to load note', 'Please try again later.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, CACHE_KEY, showError, fetchOptimized, getCachedData]);

  const handleUpdate = async (updated: Notes) => {
    try {
      const saved = await updateNote(updated.$id || (id as string) || '', updated);
      setNote(saved);
      // Update cache
      if (CACHE_KEY) setCachedData(CACHE_KEY, saved);
      showSuccess('Saved', 'Note updated successfully');
    } catch (error: any) {
      console.error('Update failed', error);
      showError('Update failed', 'Could not save your changes.');
    }
  };

  const handleDelete = async (noteId: string) => {
    setIsDeleting(true);
    try {
      await deleteNote(noteId);
      // Invalidate cache
      if (CACHE_KEY) invalidate(CACHE_KEY);
      showSuccess('Deleted', 'Note removed');
      router.push('/notes');
    } catch (error: any) {
      console.error('Delete failed', error);
      showError('Delete failed', 'Could not delete the note.');
    } finally {
      setIsDeleting(false);
    }
  };

  const title = useMemo(() => note?.title || 'Untitled note', [note]);

  const handleMinimize = () => {
    if (!note?.$id) return;
    const target = isMobileViewport ? '/notes' : `/notes?openNoteId=${note.$id}`;
    router.push(target);
  };

  if (isLoading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!note) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <Typography color="text.secondary">Note not found.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          gap: 2, 
          bgcolor: 'rgba(28, 26, 24, 0.95)',
          borderRadius: '32px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          p: 4,
          mb: 6,
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <IconButton
              onClick={handleMinimize}
              disabled={isDeleting}
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.03)',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.05)',
                p: 1.5,
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                '&:hover': { 
                  bgcolor: 'rgba(255,255,255,0.08)',
                  borderColor: 'rgba(255,255,255,0.2)',
                  transform: 'translateX(-4px)'
                }
              }}
            >
              <BackIcon sx={{ fontSize: 28 }} />
            </IconButton>
            <Box>
              <Typography 
                variant="h2" 
                sx={{ 
                  fontWeight: 900, 
                  letterSpacing: '-0.04em',
                  fontFamily: 'var(--font-clash-display)',
                  lineHeight: 1,
                  mb: 0.5
                }}
              >
                {title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Note Editor
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="contained"
              color="error"
              startIcon={<TrashIcon />}
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              sx={{ 
                borderRadius: '14px',
                px: 3,
                py: 1.2,
                fontWeight: 800,
                bgcolor: alpha(theme.palette.error.main, 0.1),
                color: 'error.main',
                border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                '&:hover': {
                  bgcolor: alpha(theme.palette.error.main, 0.2),
                  borderColor: 'error.main',
                  transform: 'translateY(-2px)'
                }
              }}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </Box>
        </Box>
        
        <Box component="main" sx={{ 
          perspective: '1200px',
          '& > *': {
            transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }
        }}>
          <SudoGuard>
            <NoteDetailSidebar
              note={note}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              showExpandButton={false}
              showHeaderDeleteButton={false}
            />
          </SudoGuard>
        </Box>

        <Box sx={{ 
          mt: 8, 
          pt: 6, 
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }}>
          <Box sx={{ 
            p: 4, 
            bgcolor: alpha('#161412', 0.02),
            borderRadius: '32px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            <NoteReactions targetId={id as string} />
          </Box>
          
          <Box sx={{ 
            p: 4, 
            bgcolor: alpha('#161412', 0.02),
            borderRadius: '32px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            <CommentsSection noteId={id as string} />
          </Box>
        </Box>
      </Container>

      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        PaperProps={{
          sx: {
            borderRadius: 6,
            bgcolor: 'rgba(28, 26, 24, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundImage: 'none',
            p: 2
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: '1.5rem' }}>Confirm delete</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary' }}>
            Deleting this note is permanent. Are you sure?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button 
            variant="contained" 
            color="error"
            fullWidth
            onClick={() => {
              if (note?.$id) {
                handleDelete(note.$id);
              }
              setShowDeleteConfirm(false);
            }}
            disabled={isDeleting}
            sx={{ borderRadius: 3 }}
          >
            Delete note
          </Button>
          <Button 
            variant="outlined" 
            fullWidth
            onClick={() => setShowDeleteConfirm(false)}
            sx={{ 
              borderRadius: 3,
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: 'text.primary'
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

