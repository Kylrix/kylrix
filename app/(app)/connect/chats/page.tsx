'use client';

import { ChatList } from '@/components/chat/ChatList';
import { useFAB } from '@/context/FABContext';
import { MessageSquare, Phone, Hash, Plus, MessageCircle } from 'lucide-react';
import { useCallback, useEffect, Suspense, useState } from 'react';
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
  const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
  const [activeTab, setActiveTab] = useState<'secure' | 'public'>(() =>
    ecosystemSecurity.status.isUnlocked ? 'secure' : 'public',
  );

  const { setConfiguration, resetConfiguration } = useFAB();
  const { open: openUnified } = useUnifiedDrawer();

  useEffect(() => {
    // FAB is mobile-only (UniversalFAB hides on desktop).
    if (activeTab === 'public') {
      setConfiguration({
        isVisible: true,
        mainColor: '#F59E0B',
        mainIcon: <Plus size={32} strokeWidth={3} />,
        onMainClick: () => openUnified('new-chat', { mode: 'thread' }),
        actions: [
          {
            id: 'new-thread',
            label: 'NEW THREAD',
            icon: <Hash size={20} />,
            onClick: () => openUnified('new-chat', { mode: 'thread' }),
          },
        ],
      });
    } else {
      setConfiguration({
        isVisible: true,
        mainColor: '#F59E0B',
        mainIcon: <Plus size={32} strokeWidth={3} />,
        onMainClick: () => openUnified('new-chat', { mode: 'secure' }),
        actions: [
          {
            id: 'secret-chat',
            label: 'SECURE CHAT',
            icon: <MessageSquare size={20} />,
            onClick: () => openUnified('new-chat', { mode: 'secure' }),
          },
          {
            id: 'channel',
            label: 'NEW CHANNEL',
            icon: <Plus size={20} />,
            onClick: () => openUnified('new-channel'),
          },
          {
            id: 'huddle',
            label: 'START HUDDLE',
            icon: <Phone size={20} />,
            onClick: () => router.push('/connect/calls?start=1'),
          },
        ],
      });
    }
    return () => resetConfiguration();
  }, [activeTab, setConfiguration, resetConfiguration, router, openUnified]);

  useEffect(() => {
    const unsubscribe = ecosystemSecurity.onStatusChange((status) => {
      setIsUnlocked(status.isUnlocked);
      setActiveTab(status.isUnlocked ? 'secure' : 'public');
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setActiveTab(isUnlocked ? 'secure' : 'public');
  }, [isUnlocked]);

  const railDensity = selectedId ? 'compact' : 'full';

  return (
    <div className="bg-[#000000] pointer-events-auto min-h-[calc(100dvh-96px)]">
      <Suspense fallback={null}>
        <ChatHandler onResolved={selectChat} />
      </Suspense>

      {isDesktop ? (
        <div className="flex h-[calc(100dvh-96px)] min-h-0 w-full overflow-hidden">
          <FusedSecondarySidebar density={railDensity} label="Chats">
            <ConnectCommRail
              mode={railDensity}
              activeId={selectedId}
              onSelect={selectChat}
            />
          </FusedSecondarySidebar>
          <div className="relative flex-1 min-w-0 min-h-0 bg-[#0A0908] border-l border-white/5">
            {selectedId ? (
              <CommObjectDetail
                conversationId={selectedId}
                embedded
                onClose={() => selectChat(null)}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#161412] border border-[#34322F] flex items-center justify-center">
                  <MessageCircle size={28} className="text-[#F59E0B]/80" />
                </div>
                <h1 className="text-white font-black text-xl font-clash m-0">Select a chat</h1>
                <p className="text-white/40 text-xs font-semibold max-w-xs m-0">
                  Pick a conversation from the list, or start a new one.
                </p>
                <button
                  type="button"
                  onClick={() => openUnified('new-chat', { mode: 'secure' })}
                  className="mt-2 h-10 px-4 rounded-xl bg-[#F59E0B] text-black text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <Plus size={14} strokeWidth={3} />
                  New chat
                </button>
              </div>
            )}
          </div>
        </div>
      ) : selectedId ? (
        <div className="relative h-[calc(100dvh-96px)] min-h-0 w-full overflow-hidden">
          <CommObjectDetail
            conversationId={selectedId}
            onClose={() => selectChat(null)}
          />
        </div>
      ) : (
        <div className="flex flex-col w-full pt-2 pb-8 px-1">
          <header className="mb-6">
            <h1 className="text-2xl font-black font-clash text-white m-0">Chats</h1>
            <p className="text-white/45 text-xs font-semibold mt-1">
              Secure messages and public threads
            </p>
          </header>
          <ChatList
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onOpenConversation={selectChat}
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
