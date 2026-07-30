'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Query } from 'appwrite';
import { Box, Typography, Stack, IconButton, useTheme, alpha, CircularProgress } from '@/lib/openbricks/primitives';
import { Close as CloseIcon, PushPin as PinIcon } from '@/lib/openbricks/icons';
import { useNotes } from '@/context/NotesContext';
import { NoteObjectRow } from '@/components/ui/NoteObjectRow';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { Notes } from '@/types/appwrite';
import { getPinnedNoteIds, listNotes, getNote } from '@/lib/appwrite';
import { isClientEncryptedNote, resolvePinnedNoteRows } from '@/lib/note/note-visibility';
import { useSection } from '@/context/SectionContext';

async function fetchPinnedNoteRows(ids: string[], seed: Notes[]): Promise<Notes[]> {
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

export function PinnedNotesSidebar() {
  const theme = useTheme();
  const { notes: allNotes, pinnedIds } = useNotes();
  const { closeSidebar } = useDynamicSidebar();
  const { setActiveDetail } = useSection();
  const safePinnedIds = useMemo(() => pinnedIds ?? [], [pinnedIds]);

  const contextPinned = useMemo(
    () => resolvePinnedNoteRows(safePinnedIds, allNotes ?? []),
    [safePinnedIds, allNotes]);

  const [pinnedNotes, setPinnedNotes] = useState<Notes[]>(contextPinned);
  const [loading, setLoading] = useState(
    () => safePinnedIds.length > 0 && contextPinned.length < safePinnedIds.length);

  useEffect(() => {
    setPinnedNotes(contextPinned);
  }, [contextPinned]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const ids = safePinnedIds.length ? safePinnedIds : await getPinnedNoteIds();
      if (!ids.length) {
        setPinnedNotes([]);
        setLoading(false);
        return;
      }

      const seeded = resolvePinnedNoteRows(ids, allNotes ?? []);
      if (seeded.length >= ids.length) {
        setPinnedNotes(seeded);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const rows = await fetchPinnedNoteRows(ids, [...(allNotes ?? []), ...seeded]);
        if (!cancelled) setPinnedNotes(rows);
      } catch (error) {
        console.error('[PinnedNotesSidebar] Failed to load pinned notes:', error);
        if (!cancelled) setPinnedNotes(seeded);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [safePinnedIds, allNotes]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#161412', overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: { xs: 2, md: 2.5 },
          pt: { xs: 'max(16px, env(safe-area-inset-top))', md: 2.5 },
          flexShrink: 0,
          bgcolor: '#161412',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)'}}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton
            onClick={closeSidebar}
            sx={{
              color: 'rgba(255,255,255,0.55)',
              '&:hover': { color: '#fff', bgcolor: '#1C1A18' }}}
            size="small"
            aria-label="Close pinned notes"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
          <Box
            sx={{
              p: 1,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'}}
          >
            <PinIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 900,
              fontFamily: '"Space Grotesk", sans-serif',
              color: 'white',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontSize: '1.1rem'}}
          >
            Pinned Notes ({safePinnedIds.length || pinnedNotes.length})
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading && pinnedNotes.length === 0 ? (
          <Box sx={{ py: 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            <CircularProgress size={24} sx={{ color: theme.palette.primary.main }} />
            <Typography variant="body2" sx={{ ml: 2, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
              Loading pinned notes...
            </Typography>
          </Box>
        ) : pinnedNotes.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center', opacity: 0.5 }}>
            <Typography variant="body2">No pinned notes</Typography>
          </Box>
        ) : (
          <>
            {pinnedNotes.map((note) => (
              <NoteObjectRow
                key={note.$id}
                note={note}
                onSelect={(n) => {
                  setActiveDetail({ type: 'note', id: n.$id });
                  closeSidebar();
                }}
              />
            ))}
            {loading && (
              <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={16} sx={{ color: theme.palette.primary.main }} />
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
