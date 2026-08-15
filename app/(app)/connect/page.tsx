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

  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScroll = () => {
      if (window.scrollY > 200) {
        setIsScrolling(true);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 2500);
      } else {
        setIsScrolling(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'mail') {
      setConfiguration({ isVisible: false });
      return () => resetConfiguration();
    }

    if (activeTab === 'chats') {
      if (isDesktop) {
        setConfiguration({ isVisible: false });
        return () => resetConfiguration();
      }
      setConfiguration({
        isVisible: true,
        mainColor: '#F59E0B',
        mainIcon: <Plus size={28} strokeWidth={2.5} />,
        onMainClick: chatsActiveTab === 'public' ? openThread : openSecureChat,
        actions:
          chatsActiveTab === 'public'
            ? [{ id: 'thread', label: 'NEW THREAD', icon: <Hash size={18} />, onClick: openThread }]
            : [
                {
                  id: 'chat',
                  label: 'SECURE CHAT',
                  icon: <MessageSquare size={18} />,
                  onClick: openSecureChat,
                },
                {
                  id: 'huddle',
                  label: 'START HUDDLE',
                  icon: <Phone size={18} />,
                  onClick: () => router.push('/connect/calls?start=1'),
                },
              ],
      });
      return () => resetConfiguration();
    }

    // Moments: When scrolling, morph FAB to Back-to-Top & Refresh
    if (isScrolling) {
      setConfiguration({
        isVisible: true,
        mainColor: '#10B981',
        mainIcon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m18 15-6-6-6 6"/>
          </svg>
        ),
        onMainClick: () => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setIsScrolling(false);
          // Trigger soft refresh
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kylrix:refresh-feed'));
          }
        },
        actions: [],
      });
      return () => resetConfiguration();
    }

    // Moments default: bottom FAB on all viewports → expandable create sheet
    setConfiguration({
      isVisible: true,
      mainColor: '#F59E0B',
      mainIcon: <Plus size={28} strokeWidth={2.5} />,
      onMainClick: openMomentComposer,
      actions: [
        {
          id: 'moment',
          label: 'CREATE MOMENT',
          icon: <PlusCircle size={18} />,
          onClick: openMomentComposer,
        },
        {
          id: 'chat',
          label: 'SECURE CHAT',
          icon: <MessageSquare size={18} />,
          onClick: openSecureChat,
        },
      ],
    });
    return () => resetConfiguration();
  }, [
    activeTab,
    chatsActiveTab,
    isDesktop,
    isScrolling,
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
    <div className="flex-1 min-h-screen bg-[#000000] pointer-events-auto px-3 sm:px-4 md:px-0 pt-6 md:pt-8 pb-10 min-w-0 max-w-full overflow-hidden">
      <div className="flex items-center gap-2 p-1 bg-[#161412] border border-[#34322F] rounded-2xl w-fit select-none mb-8">
        {[
          { id: 'moments', label: 'moments' },
          { id: 'chats', label: 'hangout' },
          { id: 'mail', label: 'mail' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as ConnectTab)}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold capitalize transition-colors cursor-pointer select-none ${
              activeTab === tab.id
                ? 'bg-[#F59E0B] text-black'
                : 'text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'moments' ? (
        <ConnectMomentsPanel onCreateMoment={openMomentComposer} />
      ) : null}

      {activeTab === 'chats' ? (
        <div className="flex flex-col gap-6 w-full">
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-white font-black text-2xl md:text-3xl font-clash tracking-tight">
                Chats
              </h1>
              <p className="text-white/45 text-xs font-semibold mt-1 font-satoshi">
                Secure messages and public threads
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openSecureChat}
                className="h-10 px-4 rounded-xl bg-[#F59E0B] text-black text-xs font-extrabold inline-flex items-center gap-1.5"
              >
                <Plus size={14} strokeWidth={3} />
                New chat
              </button>
            </div>
          </header>
          <div className="p-4 md:p-5 bg-[#161412] border border-[#34322F] rounded-[28px]">
            <ChatList activeTab={chatsActiveTab} onTabChange={setChatsActiveTab} />
          </div>
        </div>
      ) : null}

      {activeTab === 'mail' ? (
        <div className="flex flex-col gap-6 w-full">
          <header>
            <h1 className="text-white font-black text-2xl md:text-3xl font-clash tracking-tight">
              Mail
            </h1>
            <p className="text-white/45 text-xs font-semibold mt-1 font-satoshi">
              Inbound messages and delivery
            </p>
          </header>
          <div className="p-4 md:p-5 bg-[#161412] border border-[#34322F] rounded-[28px]">
            <MailBox />
          </div>
        </div>
      ) : null}
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
