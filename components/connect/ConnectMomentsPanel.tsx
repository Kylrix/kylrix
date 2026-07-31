'use client';

import React, { useMemo, useState } from 'react';
import { PlusCircle, RefreshCw, Sparkles } from 'lucide-react';
import { MomentCard } from '@/components/connect/MomentCard';
import { useConnectMomentsFeed } from '@/components/connect/useConnectMomentsFeed';
import { Pagination } from '@/components/ui/Pagination';

interface ConnectMomentsPanelProps {
  onCreateMoment?: () => void;
}

const GRID =
  'grid gap-4 items-stretch [grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]';

function SectionHeader({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 px-1 mb-2">
      <span
        className="text-[10px] font-black uppercase tracking-[0.2em] font-mono"
        style={{ color: accent }}
      >
        {label} ({count})
      </span>
      <div
        className="flex-1 h-px"
        style={{
          background: `linear-gradient(to right, ${accent}33, transparent)`,
        }}
      />
    </div>
  );
}

export function ConnectMomentsPanel({ onCreateMoment }: ConnectMomentsPanelProps) {
  const {
    items,
    total,
    loading,
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    pageSize,
    goToPage,
    nextPage,
    previousPage,
    refresh,
  } = useConnectMomentsFeed();
  const [refreshing, setRefreshing] = useState(false);

  const kylrixItems = useMemo(
    () => items.filter((item) => item.source === 'ecosystem'),
    [items],
  );
  const nostrItems = useMemo(
    () => items.filter((item) => item.source === 'nostr'),
    [items],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight font-clash">
            Moments
          </h1>
          <p className="text-white/45 text-xs font-semibold mt-1 font-satoshi">
            <span className="font-mono font-bold text-[#F59E0B]">{total}</span> updates across
            Kylrix and Nostr
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-10 h-10 rounded-xl bg-[#161412] border border-[#34322F] flex items-center justify-center disabled:opacity-40 hover:border-white/15 transition-colors"
            aria-label="Refresh moments"
          >
            <RefreshCw
              size={16}
              className={refreshing ? 'text-[#F59E0B] animate-spin' : 'text-white'}
            />
          </button>
          {onCreateMoment ? (
            <button
              type="button"
              onClick={onCreateMoment}
              className="hidden sm:inline-flex h-10 px-4 rounded-xl bg-[#F59E0B] text-black items-center gap-1.5 font-extrabold text-xs"
            >
              <PlusCircle size={16} />
              Create
            </button>
          ) : null}
        </div>
      </header>

      {totalPages > 1 && items.length > 0 ? (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          onPageChange={goToPage}
          onNextPage={nextPage}
          onPreviousPage={previousPage}
          totalCount={total}
          pageSize={pageSize}
        />
      ) : null}

      {loading ? (
        <div className={GRID}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="min-h-[152px] rounded-[26px] bg-[#161412] border border-[#34322F] animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-[28px] bg-[#161412] border border-dashed border-[#34322F]">
          <div className="w-16 h-16 rounded-2xl bg-[#0A0908] border border-white/8 flex items-center justify-center mb-4">
            <Sparkles size={28} className="text-[#F59E0B]/70" />
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
        <div className="flex flex-col gap-8">
          {kylrixItems.length > 0 ? (
            <section className="space-y-4">
              <SectionHeader label="Kylrix" count={kylrixItems.length} accent="#10B981" />
              <div className={GRID}>
                {kylrixItems.map((item) => (
                  <MomentCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          ) : null}

          {nostrItems.length > 0 ? (
            <section className="space-y-4">
              <SectionHeader label="Nostr" count={nostrItems.length} accent="#F59E0B" />
              <div className={GRID}>
                {nostrItems.map((item) => (
                  <MomentCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {totalPages > 1 && items.length > 0 ? (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          onPageChange={goToPage}
          onNextPage={nextPage}
          onPreviousPage={previousPage}
          totalCount={total}
          pageSize={pageSize}
        />
      ) : null}
    </div>
  );
}
