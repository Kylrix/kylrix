'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Heart, MessageCircle, Shield } from 'lucide-react';
import type { UnifiedFeedItem } from '@/components/connect/useConnectMomentsFeed';
import { ObjectCard } from '@/components/objects/ObjectCard';
import type { UnifiedObjectCardModel } from '@/lib/objects/types';

const PREVIEW_CHARS = 160;

function stripUrls(text: string) {
  return text.replace(/(https?:\/\/[^\s]+)/g, '').replace(/\s+/g, ' ').trim();
}

function itemsEqual(a: UnifiedFeedItem, b: UnifiedFeedItem) {
  return (
    a.id === b.id &&
    a.authorName === b.authorName &&
    a.content === b.content &&
    a.createdAt === b.createdAt &&
    (a.likesCount || 0) === (b.likesCount || 0) &&
    (a.repliesCount || 0) === (b.repliesCount || 0)
  );
}

function MomentCardInner({ item }: { item: UnifiedFeedItem }) {
  const router = useRouter();
  const body = useMemo(() => stripUrls(item.content), [item.content]);
  const preview =
    body.length > PREVIEW_CHARS ? `${body.slice(0, PREVIEW_CHARS).trimEnd()}…` : body;
  const momentId = item.rawEvent?.$id || item.rawEvent?.id;
  const canOpen = item.source === 'ecosystem' && momentId;
  const isNostr = item.source === 'nostr';

  const cardItem = useMemo<UnifiedObjectCardModel>(
    () => ({
      kind: 'moment',
      id: item.id,
      title: item.authorName || 'Someone',
      subtitle: preview || 'Shared an update',
      updatedAt: item.createdAt ? new Date(item.createdAt) : null,
      accent: '#F59E0B',
      status: isNostr ? 'nostr' : 'kylrix',
    }),
    [item.authorName, item.createdAt, item.id, isNostr, preview],
  );

  const open = () => {
    if (canOpen) router.push(`/connect/post/${momentId}`);
  };

  return (
    <ObjectCard
      item={cardItem}
      density="uniform"
      onOpen={canOpen ? open : undefined}
      trailing={
        <span className="shrink-0 px-2 py-1 rounded-lg bg-[#0A0908] border border-white/8 text-[10px] font-mono text-white/55 flex items-center gap-1">
          {isNostr ? (
            <Globe size={11} className="text-[#F59E0B]" />
          ) : (
            <Shield size={11} className="text-emerald-400" />
          )}
          {isNostr ? 'Nostr' : 'Kylrix'}
        </span>
      }
      footer={
        <div className="flex items-center justify-between gap-3 pt-3">
          <div className="flex items-center gap-4 text-[11px] font-bold text-white/45">
            <span className="flex items-center gap-1">
              <Heart size={13} className="text-[#F59E0B]/80" />
              {item.likesCount || 0}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={13} />
              {item.repliesCount || 0}
            </span>
          </div>
          <span className="text-[10px] font-mono text-white/35">
            {item.createdAt
              ? new Date(item.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              : ''}
          </span>
        </div>
      }
    >
      <p className="text-white/70 font-satoshi text-sm font-medium leading-relaxed line-clamp-3 break-words m-0">
        {preview || 'Shared an update'}
      </p>
    </ObjectCard>
  );
}

export const MomentCard = React.memo(MomentCardInner, (prev, next) =>
  itemsEqual(prev.item, next.item),
);
