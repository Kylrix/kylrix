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
 * Communicative object detail — mural chat UI for chats, threads, and (later) calls.
 * Mobile: overlay object detail. Desktop: embed inside fused secondary+main layout.
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
  const [booting, setBooting] = useState(true);

  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else router.push('/connect/chats');
  }, [onClose, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (kind === 'call') {
        if (!cancelled) setBooting(false);
        return;
      }

      const cached = await LocalEngine.cacheGet<{
        isHuddle?: boolean;
        title?: string;
      }>(chatConversationCacheKey(conversationId));
      if (cached && !cancelled) {
        if (cached.isHuddle) {
          setIsHuddle(true);
          setHuddleTitle(cached.title || title || 'Thread');
        }
        setBooting(false);
      }

      try {
        const note = (await getNote(conversationId)) as any;
        if (!cancelled && note && (note.isChat || note.isThread || note.isGhost)) {
          setIsHuddle(true);
          setHuddleTitle(note.title || title || 'Thread');
          void LocalEngine.cacheSet(chatConversationCacheKey(conversationId), {
            isHuddle: true,
            title: note.title || title || 'Thread',
          });
        } else if (!cancelled) {
          setIsHuddle(false);
          void LocalEngine.cacheSet(chatConversationCacheKey(conversationId), {
            isHuddle: false,
          });
        }
      } catch {
        if (!cancelled) setIsHuddle(false);
      } finally {
        if (!cancelled) setBooting(false);
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

  const body = booting ? (
    <div className="flex h-full min-h-[320px] items-center justify-center bg-[#0A0908]">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#F59E0B]" />
    </div>
  ) : kind === 'call' ? (
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
    <ObjectDetailHost item={item} open onClose={handleClose} embedded={false} chrome="panel">
      <div className="relative h-full min-h-0 w-full overflow-hidden">{body}</div>
    </ObjectDetailHost>
  );
}
