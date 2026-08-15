'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Sliders, RefreshCw, Search } from 'lucide-react';
import { MomentCard } from '@/components/connect/MomentCard';
import { useConnectMomentsFeed } from '@/components/connect/useConnectMomentsFeed';
import { ConnectFeedSettingsPanel } from '@/components/connect/ConnectFeedSettingsPanel';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { requestSmartLocalRefresh } from '@/lib/sync/local-soft-refresh';

interface ConnectMomentsPanelProps {
  onCreateMoment?: () => void;
}

export function ConnectMomentsPanel({ onCreateMoment }: ConnectMomentsPanelProps) {
  const { items, total, loading, refreshing, hasMore, loadMore, refresh } =
    useConnectMomentsFeed();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [spinning, setSpinning] = useState(false);
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();

  const handleSmartReload = async () => {
    setSpinning(true);
    try {
      await requestSmartLocalRefresh({
        scope: 'moments',
        onLocalRefresh: () => refresh(),
        onRemoteFetch: () => refresh(),
        ephemeralItems: items,
      });
    } finally {
      setTimeout(() => setSpinning(false), 350);
    }
  };

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
  }, [onIntersect, hasMore, items.length]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto min-w-0 overflow-x-hidden">
      <header className="flex items-center justify-between gap-4 px-1 min-w-0">
        <div className="min-w-0">
          <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight font-clash truncate">
            Moments
          </h1>
          <p className="text-white/45 text-xs font-semibold mt-1 font-satoshi">
            <span className="font-mono font-bold text-[#F59E0B]">{total}</span> updates
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('kylrix:open-topbar-search', {
                    detail: { mode: 'feed', placeholder: 'Search feed moments, topics, and authors...' }
                  })
                );
              }
            }}
            className="w-10 h-10 shrink-0 rounded-xl bg-[#161412] border border-[#34322F] flex items-center justify-center hover:border-amber-400/40 hover:bg-white/5 transition-colors group"
            aria-label="Feed search"
            title="Search feed moments"
          >
            <Search size={16} className="text-white group-hover:text-[#F59E0B] transition-colors" />
          </button>
          <button
            type="button"
            onClick={() => {
              const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;
              const node = <ConnectFeedSettingsPanel onClose={isDesktop ? closeSidebar : closeOverlay} />;
              if (isDesktop) openSidebar(node, 'connect-feed-settings', { hideHeader: true });
              else openOverlay(node);
            }}
            className="w-10 h-10 shrink-0 rounded-xl bg-[#161412] border border-[#34322F] flex items-center justify-center hover:border-white/15 hover:bg-white/5 transition-colors"
            aria-label="Live feed settings"
          >
            <Sliders size={16} className="text-white" />
          </button>
          <button
            type="button"
            onClick={() => void handleSmartReload()}
            disabled={spinning || refreshing}
            className="w-10 h-10 shrink-0 rounded-xl bg-[#161412] border border-[#34322F] flex items-center justify-center disabled:opacity-40 hover:border-white/15 transition-colors"
            aria-label="Refresh moments"
          >
            <RefreshCw
              size={16}
              className={spinning || refreshing ? 'text-[#F59E0B] animate-spin' : 'text-white'}
            />
          </button>
        </div>
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
            <Sparkles size={24} className="text-[#F59E0B]/70" />
          </div>
          <h4 className="text-white font-black text-lg font-clash mb-1">No moments yet</h4>
          <p className="text-white/45 text-xs max-w-xs mb-5 font-satoshi">
            Share an update to kick off the feed.
          </p>
          {onCreateMoment ? (
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
              className="h-10 w-full flex items-center justify-center"
              aria-hidden
            >
              <span className="w-5 h-5 rounded-full border-2 border-white/15 border-t-[#F59E0B] animate-spin" />
            </div>
          ) : (
            <p className="text-center text-[11px] font-bold text-white/25 py-4 font-satoshi">
              End of feed
            </p>
          )}
        </div>
      )}
    </div>
  );
}
