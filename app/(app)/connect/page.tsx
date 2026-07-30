'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Hash, MessageSquare, Phone, Plus, PlusCircle } from 'lucide-react';
import { ChatList } from '@/components/chat/ChatList';
import { MailBox } from '@/components/connect/MailBox';
import { ConnectMomentsPanel } from '@/components/connect/ConnectMomentsPanel';
import { useFAB } from '@/context/FABContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

type ConnectTab = 'moments' | 'chats' | 'mail';

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

function ConnectHomeContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useIsDesktop();
  const { setConfiguration, resetConfiguration } = useFAB();
  const { open: openUnified } = useUnifiedDrawer();
  const [activeTab, setActiveTab] = useState<ConnectTab>('moments');
  const [chatsActiveTab, setChatsActiveTab] = useState<'secure' | 'public'>('secure');

  const openMomentComposer = useCallback(() => {
    openUnified('moment-composer');
  }, [openUnified]);

  const openSecureChat = useCallback(() => {
    openUnified('new-chat', { mode: 'secure' });
  }, [openUnified]);

  const openThread = useCallback(() => {
    openUnified('new-chat', { mode: 'thread' });
  }, [openUnified]);

  useEffect(() => {
    if (isDesktop) {
      setConfiguration({ isVisible: false });
      return () => resetConfiguration();
    }

    if (activeTab === 'mail') {
      setConfiguration({ isVisible: false });
      return () => resetConfiguration();
    }

    if (activeTab === 'chats') {
      setConfiguration({
        isVisible: true,
        mainColor: '#F59E0B',
        mainIcon: <Plus size={28} strokeWidth={2.5} />,
        onMainClick: chatsActiveTab === 'public' ? openThread : openSecureChat,
        actions:
          chatsActiveTab === 'public'
            ? [{ id: 'thread', label: 'NEW THREAD', icon: <Hash size={18} />, onClick: openThread }]
            : [
                { id: 'chat', label: 'SECURE CHAT', icon: <MessageSquare size={18} />, onClick: openSecureChat },
                { id: 'huddle', label: 'START HUDDLE', icon: <Phone size={18} />, onClick: () => router.push('/connect/calls?start=1') },
              ]});
      return () => resetConfiguration();
    }

    setConfiguration({
      isVisible: true,
      mainColor: '#F59E0B',
      mainIcon: <Plus size={28} strokeWidth={2.5} />,
      onMainClick: openMomentComposer,
      actions: [
        { id: 'moment', label: 'CREATE MOMENT', icon: <PlusCircle size={18} />, onClick: openMomentComposer },
        { id: 'chat', label: 'SECURE CHAT', icon: <MessageSquare size={18} />, onClick: openSecureChat },
      ]});
    return () => resetConfiguration();
  }, [
    activeTab,
    chatsActiveTab,
    isDesktop,
    openMomentComposer,
    openSecureChat,
    openThread,
    resetConfiguration,
    router,
    setConfiguration,
  ]);

  useEffect(() => {
    if (searchParams.get('compose') !== '1') return;
    openMomentComposer();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('compose');
    params.delete('noteId');
    params.delete('noteTitle');
    params.delete('noteContent');
    params.delete('noteLink');
    params.delete('draftText');
    params.delete('composeKey');
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }, [openMomentComposer, pathname, router, searchParams]);

  return (
    <div className="flex-1 min-h-screen pointer-events-auto">
      <div className="flex items-center gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl w-fit select-none mb-6">
        {(['moments', 'chats', 'mail'] as ConnectTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold capitalize ${
              activeTab === tab
                ? 'bg-[#F59E0B] text-white'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'moments' && (
        <ConnectMomentsPanel onCreateMoment={openMomentComposer} />
      )}

      {activeTab === 'chats' && (
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          <header className="hidden md:flex items-center justify-between p-5 bg-white/[0.01] border border-white/8 rounded-[32px]">
            <div>
              <h1 className="text-white font-black text-2xl font-mono">Chats</h1>
              <p className="text-white/40 text-xs font-semibold mt-1">Secure messages and public threads</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={openSecureChat}
                className="h-10 px-4 rounded-xl bg-[#F59E0B] text-black text-xs font-extrabold flex items-center gap-1.5"
              >
                <Plus size={14} strokeWidth={3} />
                New chat
              </button>
              <button
                type="button"
                onClick={() => router.push('/connect/chats')}
                className="h-10 px-4 rounded-xl border border-white/10 text-white/70 text-xs font-bold hover:border-white/20"
              >
                Open full view
              </button>
            </div>
          </header>
          <div className="p-5 md:p-6 bg-white/[0.01] border border-white/5 rounded-[32px]">
            <ChatList activeTab={chatsActiveTab} onTabChange={setChatsActiveTab} />
          </div>
        </div>
      )}

      {activeTab === 'mail' && (
        <div className="max-w-4xl mx-auto p-5 md:p-6 bg-white/[0.01] border border-white/5 rounded-[32px]">
          <MailBox />
        </div>
      )}
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={null}>
      <ConnectHomeContent />
    </Suspense>
  );
}
