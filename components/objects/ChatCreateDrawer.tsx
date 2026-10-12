'use client';

import React, { useCallback, useEffect } from 'react';
import { ObjectCreateDrawer } from '@/components/objects/ObjectCreateDrawer';
import type { ChatCreateMode } from '@/components/objects/CreateChatComposer';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';

type Props = {
  open?: boolean;
  onClose?: () => void;
  initialMode?: ChatCreateMode;
  /** Legacy unified-drawer modes */
  legacyMode?: 'secure' | 'thread';
};

/**
 * Create chat / hangout — forks ObjectCreateDrawer (same shell as notes/goals/events).
 */
export function ChatCreateDrawer({
  open = true,
  onClose,
  initialMode = 'chat',
  legacyMode,
}: Props) {
  const { close, drawerData } = useUnifiedDrawer();
  const { setIsDrawerOpen } = useDrawerState();
  const { closeSidebar } = useDynamicSidebar();
  const { closeOverlay } = useOverlay();

  const resolvedLegacy =
    legacyMode ||
    (drawerData?.mode === 'thread' || drawerData?.mode === 'secure'
      ? (drawerData.mode as 'secure' | 'thread')
      : undefined);

  const mode: ChatCreateMode =
    initialMode === 'hangout' || drawerData?.mode === 'hangout' ? 'hangout' : 'chat';

  const handleClose = useCallback(() => {
    setIsDrawerOpen(false);
    onClose?.();
    try { closeSidebar(); } catch {}
    try { closeOverlay(); } catch {}
    close();
  }, [close, onClose, setIsDrawerOpen, closeSidebar, closeOverlay]);

  useEffect(() => {
    if (!open) return;
    setIsDrawerOpen(true);
    return () => setIsDrawerOpen(false);
  }, [open, setIsDrawerOpen]);

  if (!open) return null;

  return (
    <ObjectCreateDrawer
      open={open}
      kind="chat"
      onClose={handleClose}
      defaultHeight="partial"
      chatInitialMode={mode}
      chatLegacyThread={resolvedLegacy === 'thread'}
    />
  );
}
