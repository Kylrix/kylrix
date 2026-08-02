'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ObjectDetailHost } from '@/components/objects/ObjectDetailHost';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { HuddleChatWindow } from '@/components/chat/HuddleChatWindow';
import { useAuth } from '@/context/auth/AuthContext';
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
  const { user } = useAuth();
  const router = useRouter();
  const [isHuddle, setIsHuddle] = useState(kind === 'thread');
  const [huddleTitle, setHuddleTitle] = useState(title || 'Thread');

  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else router.push('/connect/chats');
  }, [onClose, router]);

  // Hydrate huddle flag from local copy first — never block mural paint.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (kind === 'call') return;

      try {
        const cached = await LocalEngine.cacheGet<{
          isHuddle?: boolean;
          title?: string;
        }>(chatConversationCacheKey(conversationId));
        if (!cancelled && cached?.isHuddle) {
          setIsHuddle(true);
          setHuddleTitle(cached.title || title || 'Thread');
        }
      } catch {
        /* ignore */
      }

      try {
        const note = (await getNote(conversationId)) as any;
        if (cancelled) return;
        if (note && (note.isChat || note.isThread || note.isGhost)) {
          setIsHuddle(true);
          setHuddleTitle(note.title || title || 'Thread');
          void LocalEngine.cacheSet(chatConversationCacheKey(conversationId), {
            isHuddle: true,
            title: note.title || title || 'Thread',
          });
        } else {
          setIsHuddle(false);
          void LocalEngine.cacheSet(chatConversationCacheKey(conversationId), {
            isHuddle: false,
          });
        }
      } catch {
        /* keep current surface */
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

  // Instant mural — ChatWindow / Huddle own their loading states.
  const body =
    kind === 'call' ? (
      <div className="flex h-full items-center justify-center bg-[#0A0908] text-white/50 text-sm font-bold">
        Call surface uses this same shell next.
      </div>
    ) : isHuddle ? (
      <HuddleChatWindow
        chatNoteId={conversationId}
        user={user}
        title={huddleTitle}
        onBack={handleClose}
        layout="fill"
      />
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
