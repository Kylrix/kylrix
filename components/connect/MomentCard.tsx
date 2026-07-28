'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Heart, MessageCircle, Shield } from 'lucide-react';
import type { UnifiedFeedItem } from '@/components/connect/useConnectMomentsFeed';

const PREVIEW_CHARS = 180;

function stripUrls(text: string) {
  return text.replace(/(https?:\/\/[^\s]+)/g, '').replace(/\s+/g, ' ').trim();
}

export const MomentCard = React.memo(function MomentCard({ item }: { item: UnifiedFeedItem }) {
  const router = useRouter();
  const body = useMemo(() => stripUrls(item.content), [item.content]);
  const preview = body.length > PREVIEW_CHARS ? `${body.slice(0, PREVIEW_CHARS).trimEnd()}…` : body;
  const momentId = item.rawEvent?.$id || item.rawEvent?.id;
  const canOpen = item.source === 'ecosystem' && momentId;

  const open = () => {
    if (canOpen) router.push(`/connect/post/${momentId}`);
  };

  return (
    <article
      role={canOpen ? 'button' : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onClick={canOpen ? open : undefined}
      onKeyDown={
        canOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
              }
            }
          : undefined
      }
      className={`p-6 rounded-[32px] bg-[#161412] border border-white/5 flex flex-col gap-4 min-h-[196px] ${
        canOpen ? 'cursor-pointer hover:border-white/10 hover:bg-[#1C1A18]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-white truncate">{item.authorName}</p>
          <p className="text-[10px] font-mono text-white/35 mt-0.5">
            {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </p>
        </div>
        <span className="shrink-0 px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] font-mono text-white/45 flex items-center gap-1">
          {item.source === 'nostr' ? <Globe size={11} className="text-[#F59E0B]" /> : <Shield size={11} className="text-emerald-400" />}
          {item.source === 'nostr' ? 'Nostr' : 'Kylrix'}
        </span>
      </div>

      {preview ? (
        <p className="text-sm text-white/75 leading-relaxed break-words">{preview}</p>
      ) : (
        <p className="text-sm text-white/30 italic">Shared an update</p>
      )}

      <div className="mt-auto flex items-center gap-4 text-[11px] font-bold text-white/35 pt-2 border-t border-white/5">
        <span className="flex items-center gap-1">
          <Heart size={13} />
          {item.likesCount || 0}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle size={13} />
          {item.repliesCount || 0}
        </span>
      </div>
    </article>
  );
});
