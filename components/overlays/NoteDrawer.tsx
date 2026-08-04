'use client';

import React, { useCallback, useEffect } from 'react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import CreateNoteForm from '@/app/(app)/app/(app)/notes/CreateNoteForm';
import { ObjectCreateDrawer } from '@/components/objects/ObjectCreateDrawer';

/**
 * Unified note create — live-copy CreateNoteForm in native right sidebar (desktop) or bottom sheet (mobile).
 */
export function NoteDrawer() {
  const { close, drawerData } = useUnifiedDrawer();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();

  const isPublic = Boolean(drawerData?.isPublic);
  const isGuest = Boolean(drawerData?.isGuest);

  const handleClose = useCallback(() => {
    close();
    closeSidebar();
    closeOverlay();
  }, [close, closeSidebar, closeOverlay]);

  useEffect(() => {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

    if (isDesktop) {
      openSidebar(
        <div className="h-full min-h-0 flex flex-col bg-[#161412] overflow-hidden">
          <CreateNoteForm
            initialContent={{ isPublic, isGuest }}
            onNoteCreated={drawerData?.onCreated}
            isExpanded={true}
            onClose={handleClose}
          />
        </div>,
        'create-note',
        { hideHeader: true },
      );
    }
  }, [isPublic, isGuest, drawerData?.onCreated, handleClose, openSidebar]);

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  if (isDesktop) return null;

  return (
    <ObjectCreateDrawer
      open
      kind="note"
      onClose={handleClose}
      onNoteCreated={drawerData?.onCreated}
      initialContent={{
        isPublic,
        isGuest,
      }}
    />
  );
}
