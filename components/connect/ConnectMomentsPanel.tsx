'use client';

import React, { useState } from 'react';
import { PlusCircle, RefreshCw, Sparkles } from 'lucide-react';
import { MomentCard } from '@/components/connect/MomentCard';
import { useConnectMomentsFeed } from '@/components/connect/useConnectMomentsFeed';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';

interface ConnectMomentsPanelProps {
  onCreateMoment?: () => void;
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
    refresh} = useConnectMomentsFeed();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between p-4 md:p-5 bg-[#0A0908] border border-white/8 rounded-[32px] select-none">
        <div>
          <h1 className="text-white font-black text-xl md:text-3xl tracking-tight font-mono">Moments</h1>
          <p className="text-white/40 text-xs font-semibold mt-1">
            <span className="font-mono font-bold text-[#F59E0B]">{total}</span> updates
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-10 h-10 rounded-xl bg-[#121110] border border-white/8 flex items-center justify-center disabled:opacity-40"
          >
            <RefreshCw size={16} className={refreshing ? 'text-[#F59E0B]' : 'text-white/60'} />
          </button>
          {onCreateMoment && (
            <button
              type="button"
              onClick={onCreateMoment}
              className="hidden md:flex h-10 px-4 rounded-xl bg-[#121110] border border-[#F59E0B]/30 items-center gap-1.5 text-[#FBBF24] font-bold text-xs"
            >
              <PlusCircle size={16} />
              Create
            </button>
          )}
        </div>
      </header>

      {totalPages > 1 && items.length > 0 && (
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
      )}

      <div className="p-5 md:p-6 bg-[#0A0908] border border-white/5 rounded-[32px]">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-[196px] rounded-[32px] bg-[#161412] border border-white/5" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-[28px] bg-[#161412] border border-white/10 flex items-center justify-center mb-5">
              <Sparkles size={32} className="text-[#F59E0B]/60" />
            </div>
            <h4 className="text-white font-black text-lg mb-1">No moments yet</h4>
            <p className="text-white/40 text-xs max-w-xs mb-5">Share an update to kick off the feed.</p>
            {onCreateMoment && <Button onClick={onCreateMoment}>Create moment</Button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map((item) => (
              <MomentCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && items.length > 0 && (
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
      )}
    </div>
  );
}
