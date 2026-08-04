'use client';

import React, { useCallback, useEffect } from 'react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import CreateNoteForm from '@/app/(app)/app/(app)/notes/CreateNoteForm';

/**
 * Unified note create — mirrors TaskDialog exactly:
 * - Desktop (≥768px): mounts directly into the native right sidebar (no Drawer backdrop)
 * - Mobile (<768px):  mounts directly into the overlay stack (no ObjectCreateDrawer / Drawer)
 * Returns null — the shell is provided by DynamicSidebar / OverlayContext.
 */
export function NoteDrawer() {
  const { activeContent, close, drawerData } = useUnifiedDrawer();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();

  const isOpen = activeContent === 'note';

  const isPublic = Boolean(drawerData?.isPublic);
  const isGuest = Boolean(drawerData?.isGuest);

  const handleClose = useCallback(() => {
    close();
    closeSidebar();
    closeOverlay();
  }, [close, closeSidebar, closeOverlay]);

  useEffect(() => {
    if (!isOpen) return;

    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

    const composer = (
      <CreateNoteForm
        initialContent={{ isPublic, isGuest }}
        onNoteCreated={drawerData?.onCreated}
        isExpanded={true}
        onClose={handleClose}
      />
    );

    if (isDesktop) {
      openSidebar(composer, 'create-note', { hideHeader: true });
    } else {
      openOverlay(composer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return null;
}
