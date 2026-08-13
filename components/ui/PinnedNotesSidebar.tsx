'use client';

import React, { useMemo } from 'react';
import { Query } from 'appwrite';
import { Box, Typography, Stack, IconButton, useTheme, CircularProgress, useMediaQuery } from '@/lib/openbricks/primitives';
import { Close as CloseIcon, PushPin as PinIcon } from '@/lib/openbricks/icons';
import { useNotes } from '@/context/NotesContext';
import { NoteObjectRow } from '@/components/ui/NoteObjectRow';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { Notes } from '@/types/appwrite';
import { listNotes, getNote } from '@/lib/appwrite';
import { isClientEncryptedNote } from '@/lib/note/note-visibility';
import { useWorkspaceFilteredItems } from '@/hooks/useWorkspaceFilteredItems';
import { NoteObjectDetail } from '@/components/objects/NoteObjectDetail';
import { useOverlay } from '@/components/ui/OverlayContext';

async function _fetchPinnedNoteRows(ids: string[], seed: Notes[]): Promise<Notes[]> {
  if (!ids.length) return [];

  const byId = new Map<string, Notes>();
  for (const note of seed) {
    if (note?.$id) byId.set(note.$id, note);
  }

  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    try {
      const res = await listNotes([Query.equal('$id', missing)], Math.max(missing.length, 1));
      for (const row of (res.rows || []) as Notes[]) {
        if (row?.$id) byId.set(row.$id, row);
      }
    } catch {
      // fall through to per-note fetch
    }

    const stillMissing = missing.filter((id) => !byId.has(id));
    if (stillMissing.length) {
      const rows = await Promise.all(stillMissing.map((id) => getNote(id).catch(() => null)));
      for (const row of rows) {
        if (row?.$id) byId.set(row.$id, row);
      }
    }
  }

  return ids
    .map((id) => byId.get(id))
    .filter((n): n is Notes => Boolean(n && !isClientEncryptedNote(n)));
}

export function PinnedNotesSidebar({ offset = 0 }: { offset?: number }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { notes: allNotes, isPinned } = useNotes();
  const { closeSidebar, openSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();
  // Single fetch — pinned repatriated to top in-memory (goals pattern), no separate pinnedIds query.
  const { filteredItems: scopedAllNotes } = useWorkspaceFilteredItems(allNotes ?? [], 'note');
  const pinnedNotes = useMemo(() => {
    const pinned = scopedAllNotes.filter((n: any) => isPinned(n.$id));
    return [...pinned].sort((a: any, b: any) => new Date(b.$updatedAt || b.$createdAt || 0).getTime() - new Date(a.$updatedAt || a.$createdAt || 0).getTime());
  }, [scopedAllNotes, isPinned]);
  const displayNotes = useMemo(() => pinnedNotes.slice(offset), [pinnedNotes, offset]);
  const loading = false;

  const handleNoteSelect = (n: Notes) => {
    if (isDesktop) {
      openSidebar(
        <NoteObjectDetail note={n} embedded />,
        n.$id || 'note-detail',
        { hideHeader: true }
      );
    } else {
      closeSidebar();
      openOverlay(
        <NoteObjectDetail note={n} onClose={closeOverlay} embedded />
      );
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0A0908', overflow: 'hidden' }}>
      {/* Header - Sticky/Fixed at Top with Unified #0A0908 pitch dark fill */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 2.5, md: 3 },
          py: 2.5,
          pt: { xs: 'max(20px, env(safe-area-inset-top))', md: 2.5 },
          flexShrink: 0,
          bgcolor: '#0A0908',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton
            onClick={closeSidebar}
            sx={{
              color: 'rgba(255,255,255,0.55)',
              p: 1,
              borderRadius: '12px',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
            }}
            size="small"
            aria-label="Close pinned notes"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
          <Box
            sx={{
              p: 1,
              bgcolor: 'rgba(99, 102, 241, 0.12)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PinIcon sx={{ fontSize: 18, color: '#6366F1' }} />
          </Box>
          <Typography
            sx={{
              fontWeight: 800,
              fontFamily: 'var(--font-clash), sans-serif',
              color: '#F5F2ED',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              fontSize: '1rem',
            }}
          >
            Pinned ({displayNotes.length})
          </Typography>
        </Stack>
      </Box>

      {/* List Container - Inset padding so cards do not touch component edges */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2.5, md: 3 }, py: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {loading && pinnedNotes.length === 0 ? (
          <Box sx={{ py: 8, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <CircularProgress size={22} sx={{ color: '#6366F1' }} />
            <Typography variant="body2" sx={{ ml: 2, color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontFamily: 'var(--font-satoshi), sans-serif' }}>
              Loading pinned notes...
            </Typography>
          </Box>
        ) : !loading && displayNotes.length === 0 ? (
          <Box sx={{ py: 8, px: 2, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', fontFamily: 'var(--font-satoshi), sans-serif' }}>
              No additional pinned notes in this workspace.
            </Typography>
          </Box>
        ) : (
          <>
            {displayNotes.map((note) => (
              <NoteObjectRow
                key={note.$id}
                note={note}
                onSelect={handleNoteSelect}
              />
            ))}
            {loading && (
              <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={16} sx={{ color: '#6366F1' }} />
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
