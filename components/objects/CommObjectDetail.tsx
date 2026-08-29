'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ObjectDetailHost } from '@/components/objects/ObjectDetailHost';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { getNote } from '@/lib/appwrite/note';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { chatConversationCacheKey } from '@/lib/chat/local-chat-cache';
import type { UnifiedObjectDetailModel } from '@/lib/objects/types';

type CommKind = 'chat' | 'thread' | 'call';

type Props = {
  conversationId: string;
  /** chat | thread | call — same shell; call UI plugs in later */
  kind?: CommKind;
  onClose?: () => void;
  /** Desktop fused page fills parent; mobile overlay uses host */
  embedded?: boolean;
  title?: string;
};

/**
 * Communicative object detail — mural chat UI for chats, hangouts, threads.
 * Mobile: fullscreen overlay. Desktop: embed in right pane / sidebar.
 * Paints chat UI immediately (mosaic) while cache / network settles.
 */
export function CommObjectDetail({
  conversationId,
  kind = 'chat',
  onClose,
  embedded = false,
  title,
}: Props) {
  const router = useRouter();
  const [_isHuddle, setIsHuddle] = useState(kind === 'thread');
  const [huddleTitle, setHuddleTitle] = useState(title || 'Thread');

  const handleClose = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);

  // Instant mural — never wait on getNote / network before painting ChatWindow.
  // Resolve huddle/thread vs secure chat for any id (thread ids are thread notes, not conversations).
  useEffect(() => {
    let cancelled = false;
    const explicitThread = kind === 'thread';
    if (explicitThread) setIsHuddle(true);
    void (async () => {
      if (kind === 'call') return;
      // Try cache first
      try {
        const cached = await LocalEngine.cacheGet<{
          isHuddle?: boolean;
          title?: string;
        }>(chatConversationCacheKey(conversationId));
        if (!cancelled && cached?.isHuddle) {
          setIsHuddle(true);
          if (cached.title && cached.title !== 'Thread') setHuddleTitle(cached.title);
          if (explicitThread) return;
        }
        if (!cancelled && cached?.title && cached.title !== 'Thread' && explicitThread) {
          setHuddleTitle(cached.title);
          return;
        }
      } catch {
        /* ignore */
      }
      // Try canonical threads table (new substrate)
      try {
        const { ThreadService } = await import('@/lib/services/threads');
        const t = await (ThreadService as any).getById?.(conversationId).catch(() => null);
        if (!cancelled && t?.title) {
          setHuddleTitle(String(t.title));
          setIsHuddle(true);
          void LocalEngine.cacheSet(chatConversationCacheKey(conversationId), { isHuddle: true, title: String(t.title) });
          return;
        }
        if (!cancelled && t?.id) {
          setIsHuddle(true);
          return;
        }
      } catch {}
      if (explicitThread) {
        // keep title prop fallback; getNote will enrich via legacy path below if needed
        if (title && title !== 'Thread') setHuddleTitle(title);
      }

      // Soft probe — do not block UI; timeout so hung note fetch can't stall forever
      // Skip probe override for explicit thread callers — mural already correct via threads table
      if (!explicitThread) {
        try {
          const note = (await Promise.race([
            getNote(conversationId),
            new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
          ])) as any;
          if (cancelled || !note) return;
          if (note && (note.isChat || note.isThread || note.isthread)) {
            setIsHuddle(true);
            setHuddleTitle(note.title || title || 'Thread');
            void LocalEngine.cacheSet(chatConversationCacheKey(conversationId), {
              isHuddle: true,
              title: note.title || title || 'Thread',
            });
          } else if (note) {
            setIsHuddle(false);
            void LocalEngine.cacheSet(chatConversationCacheKey(conversationId), {
              isHuddle: false,
            });
          }
        } catch {
          /* keep chat surface */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, kind, title]);

  const item = useMemo<UnifiedObjectDetailModel>(
    () => ({
      kind: 'agent_session',
      id: conversationId,
      title: title || huddleTitle || 'Chat',
      accent: '#F59E0B',
      status: kind,
    }),
    [conversationId, huddleTitle, kind, title],
  );

  // All hangouts — secure (padlock) and threads/discussions (no padlock) — reuse the same secure ChatWindow UI.
  // HuddleChatWindow is deprecated (outdated threads UI) and no longer rendered.
  const body =
    kind === 'call' ? (
      <div className="flex h-full items-center justify-center bg-[#0A0908] text-white/50 text-sm font-bold">
        Call surface uses this same shell next.
      </div>
    ) : (
      <ChatWindow conversationId={conversationId} onBack={handleClose} layout="fill" />
    );

  if (embedded) {
    return (
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0A0908]">
        {body}
      </div>
    );
  }

  return (
    <ObjectDetailHost item={item} open onClose={handleClose} embedded chrome="panel">
      <div className="relative h-full min-h-0 w-full max-w-full min-w-0 overflow-hidden overflow-x-hidden">
        {body}
      </div>
    </ObjectDetailHost>
  );
}

CommObjectDetail.displayName = 'CommObjectDetail';

export function openCommObjectDetail(opts: {
  conversationId: string;
  kind?: CommKind;
  title?: string;
  openSidebar: (content: React.ReactNode, key?: string, options?: { hideHeader?: boolean }) => void;
  openOverlay: (content: React.ReactNode) => void;
  closeSidebar: () => void;
  closeOverlay: () => void;
}) {
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;
  const node = (
    <CommObjectDetail
      conversationId={opts.conversationId}
      kind={opts.kind}
      title={opts.title}
      embedded
      onClose={isDesktop ? opts.closeSidebar : opts.closeOverlay}
    />
  );
  if (isDesktop) {
    opts.openSidebar(node, opts.conversationId, { hideHeader: true });
  } else {
    opts.openOverlay(node);
  }
}
