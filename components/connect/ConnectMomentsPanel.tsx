'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, Heart, MessageCircle, Sliders, Sparkles } from 'lucide-react';
import { MomentCard } from '@/components/connect/MomentCard';
import { useConnectMomentsFeed } from '@/components/connect/useConnectMomentsFeed';
import { ConnectFeedSettingsPanel } from '@/components/connect/ConnectFeedSettingsPanel';
import { HangoutTabTrigger } from '@/components/hangout/HangoutTabTrigger';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useConnectPersonalTab } from '@/hooks/useConnectPersonalTab';

export type ConnectTab = 'moments' | 'replies' | 'likes' | 'bookmarks';

const TABS: { id: ConnectTab; label: string }[] = [
  { id: 'moments', label: 'Moments' },
  { id: 'replies', label: 'Replies' },
  { id: 'likes', label: 'Likes' },
  { id: 'bookmarks', label: 'Bookmarks' },
];

const TAB_META: Record<
  ConnectTab,
  { title: string; emptyTitle: string; emptyBody: string; icon: React.ReactNode }
> = {
  moments: {
    title: 'Moments',
    emptyTitle: 'No moments yet',
    emptyBody: 'Share an update to kick off the feed.',
    icon: <Sparkles size={24} className="text-[#F59E0B]/70" />,
  },
  replies: {
    title: 'Replies',
    emptyTitle: 'No replies yet',
    emptyBody: 'Your replies on Kylrix and Nostr will show up here.',
    icon: <MessageCircle size={24} className="text-[#6366F1]/70" />,
  },
  likes: {
    title: 'Likes',
    emptyTitle: 'No likes yet',
    emptyBody: 'Posts you like across Kylrix and Nostr appear here.',
    icon: <Heart size={24} className="text-rose-400/80" />,
  },
  bookmarks: {
    title: 'Bookmarks',
    emptyTitle: 'Nothing saved yet',
    emptyBody: 'Bookmark moments to find them here — saved to your personal chat.',
    icon: <Bookmark size={24} className="text-[#F59E0B]/70" />,
  },
};

interface ConnectMomentsPanelProps {
  onCreateMoment?: () => void;
}

export function ConnectMomentsPanel({ onCreateMoment }: ConnectMomentsPanelProps) {
  const [tab, setTab] = useState<ConnectTab>('moments');
  const momentsFeed = useConnectMomentsFeed();
  const repliesFeed = useConnectPersonalTab('replies', tab === 'replies');
  const likesFeed = useConnectPersonalTab('likes', tab === 'likes');
  const bookmarksFeed = useConnectPersonalTab('bookmarks', tab === 'bookmarks');

  const activeFeed =
    tab === 'moments'
      ? momentsFeed
      : tab === 'replies'
        ? repliesFeed
        : tab === 'likes'
          ? likesFeed
          : bookmarksFeed;

  const { items, total, loading, hasMore, loadMore } = activeFeed;
  const meta = TAB_META[tab];
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();

  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    },
    [loadMore],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(onIntersect, {
      root: null,
      rootMargin: '320px 0px',
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [onIntersect, hasMore, items.length, tab]);

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto min-w-0 overflow-x-hidden">
      <header className="flex flex-col gap-4 px-1 min-w-0">
        <div className="flex items-center justify-between gap-4 min-w-0">
          <div className="min-w-0">
            <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight font-clash truncate">
              {meta.title}
            </h1>
            <p className="text-white/45 text-xs font-semibold mt-1 font-satoshi">
              <span className="font-mono font-bold text-[#F59E0B]">{total}</span>{' '}
              {tab === 'moments' ? 'updates' : tab === 'bookmarks' ? 'saved' : 'items'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <HangoutTabTrigger />
            <button
              type="button"
              onClick={() => {
                const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;
                const node = <ConnectFeedSettingsPanel onClose={isDesktop ? closeSidebar : closeOverlay} />;
                if (isDesktop) openSidebar(node, 'connect-feed-settings', { hideHeader: true });
                else openOverlay(node);
              }}
              className="w-10 h-10 shrink-0 rounded-xl bg-[#161412] border border-white/[0.08] flex items-center justify-center hover:border-white/15 hover:bg-white/[0.05] transition-colors"
              aria-label="Feed settings"
              title="Feed settings"
            >
              <Sliders size={16} className="text-white/80" />
            </button>
          </div>
        </div>

        <nav
          className="p-1 rounded-2xl bg-[#0A0908] border border-white/[0.08] flex gap-1 overflow-x-auto scrollbar-none"
          aria-label="Connect feed tabs"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex-1 min-w-[4.5rem] px-3 py-2.5 rounded-xl text-[11px] sm:text-xs font-extrabold font-satoshi transition-colors whitespace-nowrap',
                  active
                    ? 'bg-[#161412] text-white border border-white/[0.08] shadow-sm'
                    : 'text-white/45 hover:text-white/75 border border-transparent',
                ].join(' ')}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      {loading ? (
        <div className="flex flex-col gap-3 min-w-0">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-[140px] rounded-[22px] bg-[#161412] border border-[#34322F] animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-[22px] bg-[#161412] border border-dashed border-[#34322F] px-4">
          <div className="w-14 h-14 rounded-2xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-center mb-4">
            {meta.icon}
          </div>
          <h4 className="text-white font-black text-lg font-clash mb-1">{meta.emptyTitle}</h4>
          <p className="text-white/45 text-xs max-w-xs mb-5 font-satoshi">{meta.emptyBody}</p>
          {tab === 'moments' && onCreateMoment ? (
            <button
              type="button"
              onClick={onCreateMoment}
              className="h-10 px-5 rounded-xl bg-[#F59E0B] text-black font-extrabold text-xs"
            >
              Create moment
            </button>
          ) : null}
        </div>
      ) : (
        <div
          className="grid gap-6 items-stretch [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))] min-w-0 w-full max-w-full overflow-hidden"
          style={{ overflowAnchor: 'none' }}
        >
          {items.map((item) => (
            <MomentCard key={item.id} item={item} />
          ))}
          {hasMore ? (
            <div
              ref={sentinelRef}
              className="h-12 w-full flex items-center justify-center py-4 col-span-full"
              aria-hidden
            >
              <span className="w-5 h-5 rounded-full border-2 border-white/10 border-t-[#F59E0B] animate-spin" />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
