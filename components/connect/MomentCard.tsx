'use client';

import React, { useMemo, useState } from 'react';
import { Globe, Heart, MessageCircle, Repeat2, Share, Shield } from 'lucide-react';
import type { UnifiedFeedItem } from '@/components/connect/useConnectMomentsFeed';
import { toggleMomentLike } from '@/lib/connect/moment-engagement';
import { extractPostImages, truncateMomentBody } from '@/lib/connect/moment-media';
import { openMomentObjectDetail } from '@/components/objects/MomentObjectDetail';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useAuth } from '@/context/auth/AuthContext';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import toast from 'react-hot-toast';

/** Fixed image band ≈ 3/4 of usable post content area (header+text+actions consume the rest). */
const IMAGE_BAND_H = 'h-[160px]';

function formatRelative(ts: number) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${Math.max(1, sec)}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function itemsEqual(a: UnifiedFeedItem, b: UnifiedFeedItem) {
  return (
    a.id === b.id &&
    a.authorName === b.authorName &&
    a.content === b.content &&
    a.createdAt === b.createdAt &&
    (a.likesCount || 0) === (b.likesCount || 0) &&
    (a.repliesCount || 0) === (b.repliesCount || 0) &&
    Boolean(a.isLiked) === Boolean(b.isLiked)
  );
}

function initials(name: string) {
  const parts = name.replace(/^@/, '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function MomentCardInner({ item }: { item: UnifiedFeedItem }) {
  const { user } = useAuth();
  const { identity, isVaultLocked, unlockAndLoad } = useNostrIdentity();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();
  const [likes, setLikes] = useState(item.likesCount || 0);
  const [liked, setLiked] = useState(Boolean(item.isLiked));
  const [busy, setBusy] = useState(false);

  const { text: bodyText, images } = useMemo(
    () => extractPostImages(item.content || ''),
    [item.content],
  );
  const preview = truncateMomentBody(bodyText || '');
  const isNostr = item.source === 'nostr';
  const momentId =
    item.source === 'ecosystem'
      ? item.rawEvent?.$id || item.rawEvent?.id
      : item.rawEvent?.id;

  const handle = item.authorUsername
    ? `@${item.authorUsername.replace(/^@/, '')}`
    : item.authorName;

  const open = () => {
    if (!momentId) return;
    openMomentObjectDetail({
      momentId,
      source: item.source,
      preview: {
        authorName: item.authorName,
        authorAvatar: item.authorAvatar,
        content: bodyText,
      },
      openSidebar,
      openOverlay,
      closeSidebar,
      closeOverlay,
    });
  };

  const onLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!momentId || busy) return;

    if (isNostr) {
      if (isVaultLocked || !identity) {
        toast.error('Unlock vault to like on Nostr');
        void unlockAndLoad();
        return;
      }
    } else if (!user?.$id) {
      toast.error('Sign in to like');
      return;
    }

    setBusy(true);
    const prevLiked = liked;
    const prevLikes = likes;
    setLiked(!prevLiked);
    setLikes(prevLiked ? Math.max(0, prevLikes - 1) : prevLikes + 1);
    try {
      await toggleMomentLike({
        source: item.source,
        id: momentId,
        userId: user?.$id,
        creatorId: item.rawEvent?.userId || item.rawEvent?.creatorId,
        contentSnippet: preview.slice(0, 80),
        privateKeyBytes: identity?.privateKeyBytes,
        rootPubkey: item.rawEvent?.pubkey,
      });
    } catch (err) {
      setLiked(prevLiked);
      setLikes(prevLikes);
      console.error(err);
      toast.error('Could not update like');
    } finally {
      setBusy(false);
    }
  };

  const onShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!momentId) return;
    try {
      const url =
        item.source === 'nostr'
          ? `${window.location.origin}/moment/nostr_${momentId}`
          : buildPublicResourceUrl('moment', momentId);
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      /* ignore */
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className="w-full max-w-full min-w-0 text-left rounded-[22px] bg-[#161412] border border-[#34322F] hover:border-[#3C3A38] hover:bg-[#1C1A18] transition-colors cursor-pointer focus:outline-none focus-visible:border-[#F59E0B]/40 overflow-hidden"
    >
      <div className="flex gap-3 p-4 min-w-0 max-w-full">
        <div
          className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-[11px] font-black border border-white/[0.06] overflow-hidden bg-[#0A0908]"
          style={{ color: isNostr ? '#F59E0B' : '#34D399' }}
        >
          {item.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.authorAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            initials(item.authorName)
          )}
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[15px] font-extrabold text-white font-satoshi truncate">
              {item.authorName.replace(/^@/, '')}
            </span>
            <span className="text-[13px] text-white/40 font-medium truncate min-w-0">
              {handle}
            </span>
            <span className="text-white/25 text-[13px] shrink-0">·</span>
            <time className="text-[13px] text-white/40 font-medium tabular-nums shrink-0">
              {formatRelative(item.createdAt)}
            </time>
            <span
              className="ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0A0908] border border-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-white/45"
              title={isNostr ? 'From Nostr relays' : 'From Kylrix'}
            >
              {isNostr ? (
                <Globe size={11} className="text-[#F59E0B]" />
              ) : (
                <Shield size={11} className="text-emerald-400" />
              )}
              {isNostr ? 'Nostr' : 'Kylrix'}
            </span>
          </div>

          {preview ? (
            <p className="mt-1.5 text-[15px] leading-relaxed text-white/[0.88] font-satoshi whitespace-pre-wrap break-words [overflow-wrap:anywhere] m-0 max-w-full">
              {preview}
            </p>
          ) : null}

          {images.length > 0 ? (
            <div
              className={`mt-3 w-full max-w-full ${IMAGE_BAND_H} rounded-xl overflow-hidden border border-white/[0.06] bg-[#0A0908] grid ${
                images.length > 1 ? 'grid-cols-2 gap-0.5' : 'grid-cols-1'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {images.slice(0, 2).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="w-full h-full max-w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ))}
            </div>
          ) : null}

          <div
            className="mt-3 flex items-center justify-between max-w-md text-white/40"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                open();
              }}
              className="group inline-flex items-center gap-1.5 text-[13px] font-semibold hover:text-[#1D9BF0] transition-colors"
              aria-label="Comments"
            >
              <span className="p-1.5 rounded-full group-hover:bg-[#0A0908]">
                <MessageCircle size={16} />
              </span>
              {(item.repliesCount || 0) > 0 ? item.repliesCount : ''}
            </button>

            <button
              type="button"
              className="group inline-flex items-center gap-1.5 text-[13px] font-semibold hover:text-[#00BA7C] transition-colors"
              aria-label="Repost"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="p-1.5 rounded-full group-hover:bg-[#0A0908]">
                <Repeat2 size={16} />
              </span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={onLike}
              className={`group inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors ${
                liked ? 'text-[#F91880]' : 'hover:text-[#F91880]'
              }`}
              aria-label="Like"
            >
              <span className="p-1.5 rounded-full group-hover:bg-[#0A0908]">
                <Heart size={16} className={liked ? 'fill-[#F91880]' : ''} />
              </span>
              {likes > 0 ? likes : ''}
            </button>

            <button
              type="button"
              onClick={onShare}
              className="group inline-flex items-center gap-1.5 text-[13px] font-semibold hover:text-[#1D9BF0] transition-colors"
              aria-label="Share"
            >
              <span className="p-1.5 rounded-full group-hover:bg-[#0A0908]">
                <Share size={16} />
              </span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export const MomentCard = React.memo(MomentCardInner, (prev, next) =>
  itemsEqual(prev.item, next.item),
);
