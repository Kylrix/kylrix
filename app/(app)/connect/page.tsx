'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MessageSquare, Plus, PlusCircle } from 'lucide-react';
import { ConnectMomentsPanel } from '@/components/connect/ConnectMomentsPanel';
import { useFAB } from '@/context/FABContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

function ConnectHomeContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setConfiguration, resetConfiguration } = useFAB();
  const { open: openUnified } = useUnifiedDrawer();

  const openMomentComposer = useCallback(() => {
    openUnified('moment-composer');
  }, [openUnified]);

  const openSecureChat = useCallback(() => {
    openUnified('new-chat', { mode: 'secure' });
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
    isScrolling,
    openMomentComposer,
    openSecureChat,
    resetConfiguration,
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
      <ConnectMomentsPanel onCreateMoment={openMomentComposer} />
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
