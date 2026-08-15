'use client';

import React, { useMemo, useState } from 'react';
import { Globe, Heart, MessageCircle, Repeat2, Share, Shield, Zap } from 'lucide-react';
import type { UnifiedFeedItem } from '@/components/connect/useConnectMomentsFeed';
import { toggleMomentLike } from '@/lib/connect/moment-engagement';
import { extractPostImages, truncateMomentBody } from '@/lib/connect/moment-media';
import { openMomentObjectDetail } from '@/components/objects/MomentObjectDetail';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useAuth } from '@/context/auth/AuthContext';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
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
    (a.zapsCount || 0) === (b.zapsCount || 0) &&
    (a.repostsCount || 0) === (b.repostsCount || 0) &&
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
  const { open: openUnifiedDrawer } = useUnifiedDrawer();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();
  const [likes, setLikes] = useState(item.likesCount || 0);
  const [liked, setLiked] = useState(Boolean(item.isLiked));
  const [reposts, setReposts] = useState(item.repostsCount || 0);
  const [reposted, setReposted] = useState(false);
  const [zaps, setZaps] = useState(item.zapsCount || 0);
  const [busy, setBusy] = useState(false);
  const [feedSettings, setFeedSettings] = useState<any>(null);

  // Sync state if item updates from live stream
  React.useEffect(() => {
    if (item.likesCount !== undefined) setLikes(item.likesCount);
    if (item.isLiked !== undefined) setLiked(Boolean(item.isLiked));
    if (item.repostsCount !== undefined) setReposts(item.repostsCount);
    if (item.zapsCount !== undefined) setZaps(item.zapsCount);
  }, [item.likesCount, item.isLiked, item.repostsCount, item.zapsCount]);

  const { text: bodyText, images } = useMemo(
    () => extractPostImages(item.content || '', item.rawEvent?.tags),
    [item.content, item.rawEvent?.tags],
  );
  const preview = truncateMomentBody(bodyText || '');
  const isNostr = item.source === 'nostr';

  // Respect live settings — auto-preview off → hide media, auto-play off → never autoplay
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { getConnectFeedSettings, subscribeConnectFeedSettings } = await import('@/lib/connect/feed-settings');
        const s = await getConnectFeedSettings();
        if (!cancelled) setFeedSettings(s);
        const unsub = subscribeConnectFeedSettings((next) => { if (!cancelled) setFeedSettings(next); });
        return unsub;
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
  const _autoPreview = feedSettings ? (feedSettings as any).autoPreviewMedia !== false : true;
  const _autoPlay = feedSettings ? !!(feedSettings as any).autoPlayMedia : false;
  const momentId =
    item.source === 'ecosystem'
      ? item.rawEvent?.$id || item.rawEvent?.id
      : item.rawEvent?.id;

  const handle = item.authorUsername
    ? `@${item.authorUsername.replace(/^@/, '')}`
    : item.authorName;

  const open = () => {
    openWithAffinity();
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

  const openWithAffinity = () => {
    try {
      const words = `${item.content || ''}`.toLowerCase().match(/#?\w{3,}/g) || [];
      const topics = Array.from(new Set(words.slice(0, 5)));
      const mediaKind = images.length ? 'image' : bodyText ? 'text' : 'other';
      void import('@/lib/connect/feed-settings').then(({ recordFeedInteraction }) => recordFeedInteraction({ topics, mediaKind }));
    } catch {}
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
    openWithAffinity();

    try {
      await toggleMomentLike({
        source: item.source,
        id: momentId,
        userId: user?.$id,
        creatorId: item.rawEvent?.userId || item.rawEvent?.creatorId,
        contentSnippet: preview.slice(0, 80),
        privateKeyBytes: identity?.privateKeyBytes,
        rootPubkey: item.rawEvent?.pubkey,
        nostrId: item.rawEvent?.nostrId,
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

  const onRepost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!momentId || busy || reposted) return;

    if (isNostr) {
      if (isVaultLocked || !identity) {
        toast.error('Unlock vault to pulse on Nostr');
        void unlockAndLoad();
        return;
      }
    } else if (!user?.$id) {
      toast.error('Sign in to pulse');
      return;
    }

    setBusy(true);
    setReposted(true);
    setReposts((prev) => prev + 1);
    openWithAffinity();

    try {
      const { repostMoment } = await import('@/lib/connect/moment-engagement');
      await repostMoment({
        source: item.source,
        id: momentId,
        userId: user?.$id,
        creatorId: item.rawEvent?.userId || item.rawEvent?.creatorId,
        privateKeyBytes: identity?.privateKeyBytes,
        rootPubkey: item.rawEvent?.pubkey,
        nostrId: item.rawEvent?.nostrId,
      });
      toast.success('Pulsed to feed!');
    } catch (err: any) {
      setReposted(false);
      setReposts((prev) => Math.max(0, prev - 1));
      console.error(err);
      toast.error(err?.message || 'Could not pulse moment');
    } finally {
      setBusy(false);
    }
  };

  const onZap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!momentId) return;
    openUnifiedDrawer('zap', {
      targetId: momentId,
      source: item.source,
      targetKind: 'moment',
      targetOwnerId: item.rawEvent?.userId || item.rawEvent?.creatorId,
      targetPubkey: item.rawEvent?.pubkey,
      authorName: item.authorName,
      onZapSuccess: (amount: number) => {
        setZaps((prev) => prev + amount);
      },
    });
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

  const openProfilePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    openUnifiedDrawer('profile-preview', {
      userId: item.rawEvent?.userId || item.rawEvent?.authorId,
      username: item.authorUsername || item.authorName,
      name: item.authorName,
      avatar: item.authorAvatar,
      npub: item.source === 'nostr' ? item.authorUsername : undefined,
      pubkey: item.source === 'nostr' ? item.rawEvent?.pubkey : undefined,
      source: item.source
    });
  };

  const isSyncedToNostr = !isNostr && Boolean(item.rawEvent?.nostrId);

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
      className="w-full max-w-full min-w-[280px] sm:min-w-[320px] h-full flex flex-col justify-between text-left rounded-[22px] bg-[#161412] border border-[#34322F] hover:border-[#3C3A38] hover:bg-[#1C1A18] transition-all duration-200 hover:-translate-y-px cursor-pointer focus:outline-none focus-visible:border-[#F59E0B]/40 overflow-hidden"
    >
      <div className="flex gap-3 p-4 min-w-0 max-w-full">
        <button
          type="button"
          onClick={openProfilePreview}
          className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-[11px] font-black border border-white/[0.06] overflow-hidden bg-[#0A0908] hover:ring-2 hover:ring-emerald-400/40 transition-all cursor-pointer"
          style={{ color: isNostr ? '#F59E0B' : '#34D399' }}
          title={`View ${item.authorName}'s profile`}
        >
          {item.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.authorAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            initials(item.authorName)
          )}
        </button>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={openProfilePreview}
              className="text-[15px] font-extrabold text-white font-satoshi truncate hover:underline hover:text-emerald-400 text-left transition-colors"
            >
              {item.authorName.replace(/^@/, '')}
            </button>
            <span className="text-[13px] text-white/40 font-medium truncate min-w-0">
              {handle}
            </span>
            <span className="text-white/25 text-[13px] shrink-0">·</span>
            <time className="text-[13px] text-white/40 font-medium tabular-nums shrink-0">
              {formatRelative(item.createdAt)}
            </time>
            <span
              className="ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0A0908] border border-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-white/45"
              title={isNostr ? 'From Nostr relays' : isSyncedToNostr ? 'Kylrix + Nostr Synced' : 'From Kylrix'}
            >
              {isNostr ? (
                <Globe size={11} className="text-[#F59E0B]" />
              ) : isSyncedToNostr ? (
                <>
                  <Shield size={11} className="text-emerald-400" />
                  <Globe size={10} className="text-[#F59E0B]" />
                </>
              ) : (
                <Shield size={11} className="text-emerald-400" />
              )}
              {isNostr ? 'Nostr' : isSyncedToNostr ? 'Kylrix & Nostr' : 'Kylrix'}
            </span>
          </div>

          {preview ? (
            <p className="mt-1.5 text-[15px] leading-relaxed text-white/[0.88] font-satoshi whitespace-pre-wrap break-words [overflow-wrap:anywhere] m-0 max-w-full">
              {preview}
            </p>
          ) : null}

          {/* Media Container — Data Saver mode uses lightweight previews and on-demand reveal */}
          {images.length > 0 ? (
            <div
              className={`mt-3 w-full max-w-full ${IMAGE_BAND_H} rounded-xl overflow-hidden border border-white/[0.06] bg-[#0A0908] grid ${
                images.length > 1 ? 'grid-cols-2 gap-0.5' : 'grid-cols-1'
              } relative group/media`}
              onClick={(e) => e.stopPropagation()}
            >
              {images.slice(0, 2).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="w-full h-full max-w-full object-cover transition-opacity duration-300"
                  loading="lazy"
                  decoding="async"
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
            {/* Replies */}
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
              <span className="text-xs font-mono">{(item.repliesCount || 0) > 0 ? item.repliesCount : ''}</span>
            </button>

            {/* Reposts (Pulse) */}
            <button
              type="button"
              disabled={busy || reposted}
              className={`group inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors ${
                reposted ? 'text-[#00BA7C]' : 'hover:text-[#00BA7C]'
              }`}
              aria-label="Repost"
              onClick={onRepost}
            >
              <span className="p-1.5 rounded-full group-hover:bg-[#0A0908]">
                <Repeat2 size={16} className={reposted ? 'text-[#00BA7C]' : ''} />
              </span>
              <span className="text-xs font-mono">{reposts > 0 ? reposts : ''}</span>
            </button>

            {/* Zaps (Nostr Lightning / Ecosystem Rix) */}
            <button
              type="button"
              className="group inline-flex items-center gap-1.5 text-[13px] font-semibold hover:text-[#F59E0B] transition-colors"
              aria-label="Zap"
              onClick={onZap}
            >
              <span className="p-1.5 rounded-full group-hover:bg-[#0A0908]">
                <Zap size={16} className={zaps > 0 ? 'text-[#F59E0B] fill-[#F59E0B]' : ''} />
              </span>
              <span className="text-xs font-mono">{zaps > 0 ? zaps : ''}</span>
            </button>

            {/* Likes / Reactions */}
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
              <span className="text-xs font-mono">{likes > 0 ? likes : ''}</span>
            </button>

            {/* Share */}
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
