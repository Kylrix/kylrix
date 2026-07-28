'use client';

import React, { useState } from 'react';
import { PlusCircle, RefreshCw, Sparkles } from 'lucide-react';
import { MomentCard } from '@/components/connect/MomentCard';
import { useConnectMomentsFeed } from '@/components/connect/useConnectMomentsFeed';
import { Button } from '@/components/ui/Button';

interface ConnectMomentsPanelProps {
  onCreateMoment?: () => void;
}

export function ConnectMomentsPanel({ onCreateMoment }: ConnectMomentsPanelProps) {
  const { items, total, loading, hasMore, loadMore, refresh } = useConnectMomentsFeed();
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
      <header className="hidden md:flex items-center justify-between p-5 bg-white/[0.01] border border-white/8 rounded-[32px] relative select-none">
        <div className="absolute top-[-1px] left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent" />
        <div>
          <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight font-mono">Moments</h1>
          <p className="text-white/40 text-xs font-semibold mt-1">
            <span className="font-mono font-bold text-[#F59E0B]">{total}</span> updates in your feed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-10 h-10 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 flex items-center justify-center disabled:opacity-40"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-[#F59E0B]' : 'text-white/60'} />
          </button>
          {onCreateMoment && (
            <button
              type="button"
              onClick={onCreateMoment}
              className="h-10 px-4 rounded-xl bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 border border-[#F59E0B]/20 hover:border-[#F59E0B]/40 flex items-center gap-1.5 text-[#FBBF24] font-bold text-xs"
            >
              <PlusCircle size={16} />
              Create
            </button>
          )}
        </div>
      </header>

      <div className="p-5 md:p-6 bg-white/[0.01] border border-white/5 rounded-[32px]">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-48 rounded-[32px] bg-[#161412] border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-[28px] bg-white/5 border border-white/10 flex items-center justify-center mb-5">
              <Sparkles size={32} className="text-[#F59E0B]/60" />
            </div>
            <h4 className="text-white font-black text-lg mb-1">No moments yet</h4>
            <p className="text-white/40 text-xs max-w-xs mb-5">Share an update to kick off the feed.</p>
            {onCreateMoment && (
              <Button onClick={onCreateMoment}>Create moment</Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {items.map((item) => (
                <MomentCard key={item.id} item={item} />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button variant="outlined" onClick={loadMore}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
