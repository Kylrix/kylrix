'use client';

import { ChatList } from '@/components/chat/ChatList';
import { useFAB } from '@/context/FABContext';
import { Plus, MessageCircle, ChevronLeft } from 'lucide-react';
import { useCallback, useEffect, useRef, Suspense, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { ChatService } from '@/lib/services/chat';
import { useAuth } from '@/context/auth/AuthContext';
import { UsersService } from '@/lib/services/users';
import toast from 'react-hot-toast';
import { useSudo } from '@/context/SudoContext';
import { KeychainService } from '@/lib/appwrite/keychain';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { FusedSecondarySidebar } from '@/components/layout/FusedSecondarySidebar';
import { ConnectCommRail } from '@/components/connect/ConnectCommRail';
import { CommObjectDetail } from '@/components/objects/CommObjectDetail';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useNativeSidebar } from '@/context/RightRailContext';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 900px)');
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return isDesktop;
}

function useSelectedChatId() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selectedId = searchParams.get('c');

  const selectChat = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('userId');
      if (id) params.set('c', id);
      else params.delete('c');
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { selectedId, selectChat };
}

function ChatHandler({ onResolved }: { onResolved: (id: string) => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { requestSudo } = useSudo();
  const userId = searchParams.get('userId');

  useEffect(() => {
    if (userId && user) {
      const initChat = async () => {
        try {
          await UsersService.ensureProfileForUser(user);
          const targetProfile = await UsersService.getProfileById(userId);
          if (!targetProfile) {
            toast.error('User profile not found.');
            router.replace('/connect/chats');
            return;
          }

          if (!targetProfile.publicKey) {
            toast.error(
              `${targetProfile.displayName || targetProfile.username} hasn't set up their account for secure chatting yet.`,
            );
            router.replace('/connect/chats');
            return;
          }

          const actualTargetUserId = targetProfile.userId || userId;
          const existing = await ChatService.getConversations(user.$id);
          const found = existing.rows.find(
            (c: any) => c.type === 'direct' && c.participants.includes(actualTargetUserId),
          );

          if (found) {
            onResolved(found.$id);
            return;
          }

          if (ecosystemSecurity.status.isUnlocked) {
            try {
              await ecosystemSecurity.ensureE2EIdentity(user.$id);
              const newConv = await ChatService.createConversation(
                [user.$id, actualTargetUserId],
                'direct',
              );
              onResolved(newConv.$id);
            } catch (err: any) {
              console.error('Failed to create chat:', err);
              toast.error(`Failed to create chat: ${err?.message || 'Unknown error'}`);
              router.replace('/connect/chats');
            }
          } else {
            const hasMaster = await KeychainService.hasMasterpass(user.$id);
            requestSudo({
              intent: hasMaster ? undefined : 'initialize',
              onSuccess: async () => {
                try {
                  await UsersService.ensureProfileForUser(user);
                  await ecosystemSecurity.ensureE2EIdentity(user.$id);
                  const newConv = await ChatService.createConversation(
                    [user.$id, actualTargetUserId],
                    'direct',
                  );
                  onResolved(newConv.$id);
                } catch (err: any) {
                  console.error('Failed to create chat:', err);
                  toast.error(`Failed to create chat: ${err?.message || 'Unknown error'}`);
                  router.replace('/connect/chats');
                }
              },
              onCancel: () => router.replace('/connect/chats'),
            });
          }
        } catch (e) {
          console.error('Failed to auto-init chat', e);
          toast.error('Failed to initialize chat.');
          router.replace('/connect/chats');
        }
      };
      initChat();
    }
  }, [userId, user, router, requestSudo, onResolved]);

  return null;
}

function ConnectChatsBody() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { selectedId, selectChat } = useSelectedChatId();
  const [activeTab, setActiveTab] = useState<'secure' | 'public'>(() => 'secure');
  const { isOpen: isRightRailOpen } = useNativeSidebar();
  // Stackable right detail: push previous ?c onto stack so back pops rather than clears
  const chatStackRef = useRef<string[]>([]);
  const selectChatStackable = useCallback(
    (id: string | null) => {
      if (id) {
        if (selectedId && selectedId !== id) chatStackRef.current.push(selectedId);
        selectChat(id);
        return;
      }
      const prev = chatStackRef.current.pop();
      if (prev) {
        selectChat(prev);
        return;
      }
      selectChat(null);
    },
    [selectedId, selectChat],
  );
  const handleDetailClose = useCallback(() => {
    const prev = chatStackRef.current.pop();
    if (prev) selectChat(prev);
    else selectChat(null);
  }, [selectChat]);

  const { setConfiguration, resetConfiguration } = useFAB();
  const { open: openUnified } = useUnifiedDrawer();
  const { openOverlay, closeOverlay } = useOverlay();

  const openCreate = useCallback(() => {
    openUnified('new-chat', {
      mode: activeTab === 'public' ? 'thread' : 'secure',
    });
  }, [openUnified, activeTab]);

  /** Mobile: fullscreen overlay. Desktop: fused right pane via ?c= (stackable per ui.chrome-surfaces). */
  const openChatDetail = useCallback(
    (conversationId: string, kind: 'chat' | 'thread' = 'chat') => {
      if (isDesktop) {
        selectChatStackable(conversationId);
        return;
      }
      openOverlay(
        <CommObjectDetail
          conversationId={conversationId}
          kind={kind}
          embedded
          onClose={closeOverlay}
        />,
      );
    },
    [isDesktop, selectChatStackable, openOverlay, closeOverlay],
  );

  const onResolved = useCallback(
    (id: string) => {
      openChatDetail(id);
    },
    [openChatDetail],
  );

  useEffect(() => {
    if (selectedId && isDesktop) {
      setConfiguration({ isVisible: false });
      return () => resetConfiguration();
    }

    setConfiguration({
      isVisible: !isDesktop,
      mainColor: '#F59E0B',
      mainIcon: <Plus size={28} strokeWidth={2.5} />,
      onMainClick: openCreate,
    });
    return () => resetConfiguration();
  }, [selectedId, isDesktop, openCreate, setConfiguration, resetConfiguration]);

  useEffect(() => {
    const unsubscribe = ecosystemSecurity.onStatusChange((_status) => {
      // Unlocked state change listener
    });
    return unsubscribe;
  }, []);

  // Mobile deep-link ?c= → overlay once (list stays; no page navigation)
  const deepLinkHandled = useRef<string | null>(null);
  useEffect(() => {
    if (isDesktop || !selectedId) return;
    if (deepLinkHandled.current === selectedId) return;
    deepLinkHandled.current = selectedId;
    const id = selectedId;
    openOverlay(
      <CommObjectDetail
        conversationId={id}
        embedded
        onClose={() => {
          closeOverlay();
          deepLinkHandled.current = null;
        }}
      />,
    );
    selectChat(null);
  }, [isDesktop, selectedId, openOverlay, closeOverlay, selectChat]);

  const railDensity = selectedId ? 'compact' : 'full';

  return (
    <div className="bg-[#000000] pointer-events-auto min-h-[calc(100dvh-96px)]">
      <Suspense fallback={null}>
        <ChatHandler onResolved={onResolved} />
      </Suspense>

      {isDesktop ? (
        <div className="flex h-[calc(100dvh-96px)] min-h-0 w-full overflow-hidden">
          {/* Chat list is part of chat native layout, not a push sidebar — hide entirely when a real right rail is open */}
          {!isRightRailOpen && (
            <FusedSecondarySidebar density={railDensity} label="Chats">
              <ConnectCommRail
                mode={railDensity}
                activeId={selectedId}
                onSelect={selectChatStackable}
              />
            </FusedSecondarySidebar>
          )}
          <div className="relative flex-1 min-w-0 min-h-0 bg-[#0A0908] border-l border-[#34322F]">
            {selectedId ? (
              <CommObjectDetail
                key={selectedId}
                conversationId={selectedId}
                embedded
                onClose={handleDetailClose}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#161412] border border-[#34322F] flex items-center justify-center">
                  <MessageCircle size={28} className="text-[#F59E0B]" />
                </div>
                <h1 className="text-white font-black text-xl font-clash m-0">Select a chat</h1>
                <p className="text-white/40 text-xs font-semibold max-w-xs m-0">
                  Pick a conversation from the list, or start a new one.
                </p>
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-2 h-10 px-4 rounded-xl bg-[#F59E0B] text-black text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <Plus size={14} strokeWidth={3} />
                  New chat
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col w-full max-w-2xl mx-auto pt-4 md:pt-6 pb-28 px-3 sm:px-4">
          <header className="mb-5 px-1 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => router.back()}
                className="p-2 rounded-xl bg-[#161412] border border-[#34322F] text-white/70 hover:text-white transition-colors"
                aria-label="Back"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black font-clash text-white m-0 tracking-tight truncate">
                  Chats
                </h1>
                <p className="text-white/45 text-xs font-semibold mt-0.5 font-satoshi truncate">
                  Messages and hangouts
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="h-9 px-3 rounded-xl bg-[#F59E0B] text-black text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0"
            >
              <Plus size={14} strokeWidth={3} />
              <span>New</span>
            </button>
          </header>
          <ChatList
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onOpenConversation={openChatDetail}
          />
        </div>
      )}
    </div>
  );
}

export default function ConnectChatsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100dvh-96px)] items-center justify-center bg-[#000000]">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#F59E0B]" />
        </div>
      }
    >
      <ConnectChatsBody />
    </Suspense>
  );
}
