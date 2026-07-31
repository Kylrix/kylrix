'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FusedSecondarySidebar } from '@/components/layout/FusedSecondarySidebar';
import { ConnectCommRail } from '@/components/connect/ConnectCommRail';
import { CommObjectDetail } from '@/components/objects/CommObjectDetail';
import { UsersService } from '@/lib/services/users';
import { ChatService } from '@/lib/services/chat';
import { useAuth } from '@/context/auth/AuthContext';
import { getNote } from '@/lib/appwrite/note';
import { createGhostNoteChat } from '@/lib/actions/client-ops';
import { ecosystemSecurity } from '@/lib/ecosystem/security';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return isDesktop;
}

/**
 * Chat detail — desktop: fused compact rail + mural chat.
 * Mobile: communicative object detail (same shell for threads/calls later).
 */
function ChatDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const rawId = params.id as string;
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    if (!rawId) return;
    if (!user?.$id) return;
    let cancelled = false;

    (async () => {
      try {
        const targetProfile = await UsersService.getProfileById(rawId).catch(() => null);
        if (targetProfile) {
          const hasLocalKeys =
            ecosystemSecurity.status.hasIdentity && ecosystemSecurity.status.isUnlocked;
          const targetHasPublicKey = !!targetProfile.publicKey;

          if (hasLocalKeys && targetHasPublicKey) {
            try {
              const participants =
                targetProfile.$id === user.$id
                  ? [user.$id]
                  : [user.$id, targetProfile.$id];
              const conv = await ChatService.createConversation(participants);
              const nextId = conv?.$id || conv?.id;
              if (nextId && nextId !== rawId) {
                router.replace(`/connect/chats/${nextId}`);
                return;
              }
              if (nextId && !cancelled) {
                setConversationId(nextId);
                setResolving(false);
                return;
              }
            } catch {
              /* fall through to ghost */
            }
          }

          const sorted = [user.$id, targetProfile.$id].sort();
          const deterministicId = `gchat-${sorted[0].slice(0, 14)}-${sorted[1].slice(0, 14)}`;
          try {
            await getNote(deterministicId);
            if (deterministicId !== rawId) {
              router.replace(`/connect/chats/${deterministicId}`);
              return;
            }
          } catch {
            await createGhostNoteChat(
              `@${targetProfile.username || 'user'}'s Discussion`,
              [user.$id, targetProfile.$id],
              deterministicId,
            );
            router.replace(`/connect/chats/${deterministicId}`);
            return;
          }
          if (!cancelled) {
            setConversationId(deterministicId);
            setResolving(false);
          }
          return;
        }

        if (!cancelled) {
          setConversationId(rawId);
          setResolving(false);
        }
      } catch {
        if (!cancelled) {
          setConversationId(rawId);
          setResolving(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rawId, user, router]);

  if (resolving || !conversationId) {
    return (
      <div className="flex h-[calc(100dvh-96px)] items-center justify-center bg-[#000000]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#F59E0B]" />
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <div className="relative h-[calc(100dvh-96px)] min-h-0 w-full overflow-hidden bg-[#000000]">
        <CommObjectDetail
          conversationId={conversationId}
          onClose={() => router.push('/connect/chats')}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-96px)] min-h-0 w-full overflow-hidden bg-[#000000]">
      <FusedSecondarySidebar density="compact" label="Chats">
        <ConnectCommRail mode="compact" activeId={conversationId} />
      </FusedSecondarySidebar>
      <div className="relative flex-1 min-w-0 min-h-0">
        <CommObjectDetail conversationId={conversationId} embedded />
      </div>
    </div>
  );
}

export default function ConnectChatDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100dvh-96px)] items-center justify-center bg-[#000000]">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#F59E0B]" />
        </div>
      }
    >
      <ChatDetailContent />
    </Suspense>
  );
}
