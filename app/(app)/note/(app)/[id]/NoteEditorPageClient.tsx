"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getNote, cachePublicNoteDecryptionKey } from '@/lib/appwrite';
import { deleteNote } from '@/lib/actions/client-ops';
import type { Notes } from '@/types/appwrite';
import { NoteDetailSidebar } from '@/components/ui/NoteDetailSidebar';
import { 
  Box, 
  Typography, 
  Button, 
  Container,
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
} from '@/lib/mui-tailwind/material';
import { useToast } from '@/components/ui/Toast';
import CommentsSection from '@/app/(app)/note/(app)/notes/Comments';
import NoteReactions from '@/app/(app)/note/(app)/notes/NoteReactions';
import { useDataNexus } from '@/context/DataNexusContext';

export default function NoteEditorPageClient() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const decryptionKey = searchParams.get('key');

  const [rawNote, setRawNote] = useState<Notes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { showSuccess, showError } = useToast();
  const { fetchOptimized, setCachedData, invalidate, getCachedData } = useDataNexus();

  const CACHE_KEY = useMemo(() => id ? `note_${id}` : null, [id]);

  useEffect(() => {
    if (id && decryptionKey) {
      cachePublicNoteDecryptionKey(id as string, decryptionKey);
    }
  }, [id, decryptionKey]);

  const note = rawNote || (isLoading ? {
    $id: id as string,
    title: 'Loading Note...',
    content: 'Fetching secure note contents and decryption keys...',
    tags: [],
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
  } as any : null);

  useEffect(() => {
    let mounted = true;
  
    if (!id || !CACHE_KEY) {
      setIsLoading(false);
      return;
    }
  
    // Try to get from cache first for instant UI
    const cached = getCachedData<Notes>(CACHE_KEY);
    if (cached) {
      setRawNote(cached);
      setIsLoading(false);
    }
  
    (async () => {
      if (!cached) setIsLoading(true);
      try {
        const fetched = await fetchOptimized(CACHE_KEY, () => getNote(id as string));
        if (mounted) {
          setRawNote(fetched);
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

  const handleUpdate = (updated: Notes) => {
    setRawNote(updated);
    if (CACHE_KEY) setCachedData(CACHE_KEY, updated);
  };

  const handleDelete = async (noteId: string) => {
    setIsDeleting(true);
    try {
      await deleteNote(noteId);
      if (CACHE_KEY) invalidate(CACHE_KEY);
      showSuccess('Deleted', 'Note removed');
      router.push('/note');
    } catch (error: any) {
      console.error('Delete failed', error);
      showError('Delete failed', 'Could not delete the note.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isLoading && !note) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <Typography color="text.secondary">Note not found.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#161412' }}>
      <Container maxWidth={false} disableGutters sx={{ px: { xs: 0.5, sm: 1, md: 1.5 }, py: 1.25 }}>
        <Box component="main" sx={{ 
          perspective: '1200px',
          '& > *': {
            transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }
        }}>
          <NoteDetailSidebar
            note={note}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            showExpandButton={false}
            showHeaderDeleteButton={false}
            isLoading={isLoading}
          />
        </Box>

        <Box sx={{ 
          mt: 5, 
          pt: 4, 
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 3
        }}>
          <Box sx={{ 
            p: 4, 
            bgcolor: '#0A0908',
            borderRadius: '32px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            <NoteReactions targetId={id as string} />
          </Box>
          
          <Box sx={{ 
            p: 4, 
            bgcolor: '#0A0908',
            borderRadius: '32px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            <CommentsSection noteId={id as string} decryptionKey={decryptionKey || undefined} />
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
