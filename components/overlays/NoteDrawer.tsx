'use client';

import React, { useCallback } from 'react';
import { ObjectCreateDrawer } from '@/components/objects/ObjectCreateDrawer';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useDrawerState } from '@/components/ui/DrawerStateContext';

/**
 * Unified note create — live-copy CreateNoteForm inside ObjectCreateDrawer shell.
 * drawerData: { isPublic?, isGuest?, copyShareLink? }
 */
export function NoteDrawer() {
  const { close, drawerData } = useUnifiedDrawer();
  const { setIsDrawerOpen } = useDrawerState();

  const isPublic = Boolean(drawerData?.isPublic);
  const isGuest = Boolean(drawerData?.isGuest);

  React.useEffect(() => {
    setIsDrawerOpen(true);
    return () => setIsDrawerOpen(false);
  }, [setIsDrawerOpen]);

  const handleClose = useCallback(() => {
    setIsDrawerOpen(false);
    close();
  }, [close, setIsDrawerOpen]);

  return (
    <ObjectCreateDrawer
      open
      kind="note"
      onClose={handleClose}
      onNoteCreated={drawerData?.onCreated || (() => {})}
      initialContent={{
        isPublic,
        isGuest,
      }}
    />
  );
}
