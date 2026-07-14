'use client';

import { ChatList } from '@/components/chat/ChatList';
import { useFAB } from '@/context/FABContext';
import { MessageSquare, Phone, Hash } from 'lucide-react';
import { useEffect, Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChatService } from '@/lib/services/chat';
import { useAuth } from '@/context/auth/AuthContext';
import { UsersService } from '@/lib/services/users';
import toast from 'react-hot-toast';
import { useSudo } from '@/context/SudoContext';
import { KeychainService } from '@/lib/appwrite/keychain';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { ArrowLeft, Plus } from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { MultiSectionContainer } from '@/context/SectionContext';

function ChatHandler() {
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
            toast.error("User profile not found.");
            router.replace('/connect/chats');
            return;
          }

          if (!targetProfile.publicKey) {
            toast.error(`${targetProfile.displayName || targetProfile.username} hasn't set up their account for secure chatting yet.`);
            router.replace('/connect/chats');
            return;
          }

          const actualTargetUserId = targetProfile.userId || userId;
          const existing = await ChatService.getConversations(user.$id);
          const found = existing.rows.find(
            (c: any) => c.type === 'direct' && c.participants.includes(actualTargetUserId)
          );

          if (found) {
            router.push(`/connect/chat/${found.$id}`);
            return;
          }

          if (ecosystemSecurity.status.isUnlocked) {
            try {
              await ecosystemSecurity.ensureE2EIdentity(user.$id);
              const newConv = await ChatService.createConversation([user.$id, actualTargetUserId], 'direct');
              router.push(`/connect/chat/${newConv.$id}`);
            } catch (err: any) {
              console.error("Failed to create chat:", err);
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
                  const newConv = await ChatService.createConversation([user.$id, actualTargetUserId], 'direct');
                  router.push(`/connect/chat/${newConv.$id}`);
                } catch (err: any) {
                  console.error("Failed to create chat:", err);
                  toast.error(`Failed to create chat: ${err?.message || 'Unknown error'}`);
                  router.replace('/connect/chats');
                }
              },
              onCancel: () => router.replace('/connect/chats')
            });
          }
        } catch (e) {
          console.error("Failed to auto-init chat", e);
          toast.error("Failed to initialize chat.");
          router.replace('/connect/chats');
        }
      };
      initChat();
    }
  }, [userId, user, router, requestSudo]);

  return null;
}

export default function Home() {
  const router = useRouter();
  const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
  const [activeTab, setActiveTab] = useState<'secure' | 'public'>(() => {
    return ecosystemSecurity.status.isUnlocked ? 'secure' : 'public';
  });

  const { setConfiguration, resetConfiguration } = useFAB();
  const { open: openUnified } = useUnifiedDrawer();

  useEffect(() => {
    if (activeTab === 'public') {
      // Threads tab active
      setConfiguration({
        isVisible: true,
        mainColor: '#F59E0B',
        mainIcon: <Plus size={32} strokeWidth={3} />,
        onMainClick: () => openUnified('new-chat', { mode: 'thread' }),
        actions: [
          { id: 'new-thread', label: 'NEW THREAD', icon: <Hash size={20} />, onClick: () => openUnified('new-chat', { mode: 'thread' }) }
        ]
      });
    } else {
      // Secure tab active
      setConfiguration({
        isVisible: true,
        mainColor: '#F59E0B',
        mainIcon: <Plus size={32} strokeWidth={3} />,
        onMainClick: () => openUnified('new-chat', { mode: 'secure' }),
        actions: [
          { id: 'secret-chat', label: 'SECURE CHAT', icon: <MessageSquare size={20} />, onClick: () => openUnified('new-chat', { mode: 'secure' }) },
          { id: 'channel', label: 'NEW CHANNEL', icon: <Plus size={20} />, onClick: () => openUnified('new-channel') },
          { id: 'huddle', label: 'START HUDDLE', icon: <Phone size={20} />, onClick: () => router.push('/connect/calls?start=1') }]
      });
    }
    return () => resetConfiguration();
  }, [activeTab, setConfiguration, resetConfiguration, router, openUnified]);

  useEffect(() => {
    const unsubscribe = ecosystemSecurity.onStatusChange((status) => {
      setIsUnlocked(status.isUnlocked);
      if (status.isUnlocked) {
        setActiveTab('secure');
      } else {
        setActiveTab('public');
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isUnlocked) {
      setActiveTab('secure');
    } else {
      setActiveTab('public');
    }
  }, [isUnlocked]);

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0908] relative pointer-events-auto pt-4 md:pt-8">
      <Suspense fallback={null}>
        <ChatHandler />
      </Suspense>
      
      <MultiSectionContainer panels={['projects', 'huddles', 'note']}>
        <div className="w-full">
          <div className="flex items-center gap-3.5 mb-8">
            <button 
              onClick={() => router.back()} 
              className="p-2 text-white bg-[#161412] border border-[#1C1A18] rounded-xl hover:bg-[#1C1A18] transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-black font-clash text-white">
              Connect Chats
            </h1>
          </div>

          {/* Desktop Stacked View */}
          <div className="hidden lg:flex flex-col gap-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black font-clash text-white">
                  Secret Chats
                </h2>
                <button
                  type="button"
                  onClick={() => openUnified('new-chat', { mode: 'secure' })}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F59E0B] text-black text-xs font-extrabold hover:brightness-110 transition"
                >
                  <Plus size={14} strokeWidth={3} />
                  New secure chat
                </button>
              </div>
              <ChatList activeTab="secure" hideTabs={true} skipThreadsLoad />
            </div>
            <hr className="border-white/5 my-4" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black font-clash text-white">
                  Threads
                </h2>
                <button
                  type="button"
                  onClick={() => openUnified('new-chat', { mode: 'thread' })}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F59E0B] text-black text-xs font-extrabold hover:brightness-110 transition"
                >
                  <Plus size={14} strokeWidth={3} />
                  New thread
                </button>
              </div>
              <ChatList activeTab="public" hideTabs={true} skipSecureLoad />
            </div>
          </div>

          {/* Mobile Tabbed View */}
          <div className="block lg:hidden">
            <ChatList activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
        </div>
      </MultiSectionContainer>
    </div>
  );
}
