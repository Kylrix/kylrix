'use client';

import React, { useCallback, useMemo } from 'react';
import { MessageCircleMore, Sparkles } from 'lucide-react';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { HangoutsDrawer } from '@/components/hangout/HangoutsDrawer';
import { useChatNotifications } from '@/components/providers/ChatNotificationProvider';
import {
  useNativeSidebarApiOptional,
  NATIVE_SIDEBAR_WIDTHS,
} from '@/context/RightRailContext';

export interface HangoutTabTriggerProps {
  className?: string;
  variant?: 'pill' | 'icon' | 'header';
}

export function HangoutTabTrigger({
  className = '',
  variant = 'icon',
}: HangoutTabTriggerProps) {
  const { openOverlay, closeOverlay } = useOverlay();
  const native = useNativeSidebarApiOptional();
  const { activeWorkspace } = useWorkspace();
  const { unreadConversations } = useChatNotifications();
  const hasUnread = unreadConversations.size > 0;

  const isRealWorkspace = activeWorkspace && !activeWorkspace.isPersonal;
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  const handleOpenHangouts = useCallback(() => {
    const wsId = isRealWorkspace ? activeWorkspace.id : undefined;
    const wsTitle = isRealWorkspace ? (activeWorkspace.title || (activeWorkspace as any)?.name) : undefined;

    const panel = (
      <HangoutsDrawer
        mode="browse"
        workspaceId={wsId}
        workspaceTitle={wsTitle}
        onClose={() => {
          if (isDesktop && native) {
            native.close('hangouts-drawer');
          } else {
            closeOverlay();
          }
        }}
      />
    );

    if (isDesktop && native) {
      native.open(panel, {
        key: 'hangouts-drawer',
        width: NATIVE_SIDEBAR_WIDTHS.default,
        title: isRealWorkspace ? `${wsTitle || 'Workspace'} Discussion` : 'Hangouts',
      });
    } else {
      openOverlay(panel);
    }
  }, [isRealWorkspace, activeWorkspace, isDesktop, native, closeOverlay, openOverlay]);

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleOpenHangouts}
        className={`relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-[#161412] border border-white/[0.08] text-white/70 hover:text-white hover:bg-[#1C1A18] hover:border-white/15 active:scale-95 transition-all select-none cursor-pointer ${className}`}
        title={isRealWorkspace ? 'Workspace Discussion & Hangouts' : 'Hangouts & Discussions'}
      >
        <MessageCircleMore size={16} className="text-[#A855F7]" />
        <span>{isRealWorkspace ? 'Discussion' : 'Hangouts'}</span>
        {hasUnread && (
          <span className="h-2 w-2 rounded-full bg-[#EC4899] animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpenHangouts}
      className={`relative inline-flex items-center justify-center p-2.5 rounded-xl bg-[#161412] border border-white/[0.08] text-white/70 hover:text-white hover:bg-[#1C1A18] hover:border-white/15 active:scale-95 transition-all select-none cursor-pointer ${className}`}
      title={isRealWorkspace ? 'Workspace Discussion & Hangouts' : 'Hangouts & Discussions'}
      aria-label="Hangouts"
    >
      <MessageCircleMore size={16} className="text-white/80 group-hover:text-white" />
      {isRealWorkspace && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-[#A855F7] text-[8px] font-black text-white">
          •
        </span>
      )}
      {hasUnread && !isRealWorkspace && (
        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[#EC4899] border-2 border-[#0A0908]" />
      )}
    </button>
  );
}
