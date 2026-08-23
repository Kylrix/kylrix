import React from 'react';
import { HangoutsDrawer } from '@/components/hangout/HangoutsDrawer';

export function openHangouts(opts: {
  workspaceId?: string;
  workspaceTitle?: string;
  initialConversationId?: string;
  openSidebar: (content: React.ReactNode, key?: string, options?: { hideHeader?: boolean }) => void;
  openOverlay: (content: React.ReactNode) => void;
  closeSidebar: () => void;
  closeOverlay: () => void;
}) {
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;
  const node = (
    <HangoutsDrawer
      mode="browse"
      workspaceId={opts.workspaceId}
      workspaceTitle={opts.workspaceTitle}
      initialConversationId={opts.initialConversationId}
      onClose={isDesktop ? opts.closeSidebar : opts.closeOverlay}
    />
  );
  const key = `hangouts-drawer-${opts.workspaceId || 'global'}`;
  if (isDesktop) opts.openSidebar(node, key, { hideHeader: true });
  else opts.openOverlay(node);
}
