'use client';

import React, { useCallback } from 'react';
import { ObjectCreateDrawer } from '@/components/objects/ObjectCreateDrawer';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useNotes } from '@/context/NotesContext';
import { useAuth } from '@/context/auth/AuthContext';
import { useDataNexus } from '@/context/DataNexusContext';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { buildNoteShell } from '@/lib/objects/create';
import { useSection } from '@/context/SectionContext';
import { toast } from 'react-hot-toast';

/**
 * Unified note create — mounted only while unified drawer content is `note`.
 * drawerData: { isPublic?, isGuest?, copyShareLink? }
 */
export function NoteDrawer() {
  const { close, drawerData } = useUnifiedDrawer();
  const { setIsDrawerOpen } = useDrawerState();
  const { pushLiveNote } = useNotes();
  const { user } = useAuth();
  const { setCachedData } = useDataNexus();
  const { setActiveDetail } = useSection();

  const isPublic = Boolean(drawerData?.isPublic);
  const isGuest = Boolean(drawerData?.isGuest);
  const copyShareLink = Boolean(drawerData?.copyShareLink);

  React.useEffect(() => {
    setIsDrawerOpen(true);
    return () => setIsDrawerOpen(false);
  }, [setIsDrawerOpen]);

  const handleClose = useCallback(() => {
    setIsDrawerOpen(false);
    close();
  }, [close, setIsDrawerOpen]);

  const handleSubmit = useCallback(
    async (draft: { kind: string; title: string; body: string }) => {
      const shell = buildNoteShell(
        { kind: 'note', title: draft.title, body: draft.body },
        user?.$id,
        { isPublic, isGuest });
      pushLiveNote(shell);
      setCachedData(`note_${shell.$id}`, shell);
      setActiveDetail({ type: 'note', id: shell.$id });

      if (copyShareLink && typeof window !== 'undefined') {
        const shareUrl = `${window.location.origin}/idea/${shell.$id}`;
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast.success('Public link copied');
        } catch {
          toast.success('Idea created');
        }
      }
    },
    [copyShareLink, isGuest, isPublic, pushLiveNote, setActiveDetail, setCachedData, user?.$id]);

  return (
    <ObjectCreateDrawer
      open
      kind="note"
      onClose={handleClose}
      onSubmit={handleSubmit}
      submitLabel={isPublic ? 'Create & share' : 'Create'}
    />
  );
}
