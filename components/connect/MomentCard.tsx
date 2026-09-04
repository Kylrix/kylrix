import React, { useMemo, useState } from 'react';
import { Globe, Heart, MessageCircle, Repeat2, Share, Shield, Zap, Copy, Bookmark, User, Trash2, EyeOff, MoreHorizontal } from 'lucide-react';
import type { UnifiedFeedItem } from '@/components/connect/useConnectMomentsFeed';
import { toggleMomentLike } from '@/lib/connect/moment-engagement';
import { extractPostImages, truncateMomentBody } from '@/lib/connect/moment-media';
import { openMomentObjectDetail } from '@/components/objects/MomentObjectDetail';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useAuth } from '@/context/auth/AuthContext';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useContextMenu } from '@/components/ui/ContextMenuContext';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import toast from 'react-hot-toast';

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
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

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

  // Feed settings are hydrated once by the connect feed hooks — avoid N× getConnectFeedSettings per card grid.
  const [feedSettings, setFeedSettings] = React.useState<any>(() =>
    typeof window !== 'undefined' ? (window as any).__KylrixConnectFeedSettings ?? null : null,
  );
  React.useEffect(() => {
    let cancelled = false;
    const onSettings = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!cancelled && detail) setFeedSettings(detail);
    };
    window.addEventListener('kylrix-connect-feed-settings', onSettings as any);
    return () => {
      cancelled = true;
      window.removeEventListener('kylrix-connect-feed-settings', onSettings as any);
    };
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

  const openWithAffinity = (isConscious = false) => {
    try {
      const words = `${item.content || ''}`.toLowerCase().match(/#?\w{3,}/g) || [];
      const topics = Array.from(new Set(words.slice(0, 10)));
      const mediaKind = images.length ? 'image' : bodyText ? 'text' : 'other';
      void import('@/lib/connect/feed-settings').then(({ recordFeedInteraction }) =>
        recordFeedInteraction({
          topics,
          mediaKind,
          searchWeight: isConscious ? 3 : 1,
          isConsciousAction: isConscious,
        }),
      );
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
    openWithAffinity(true);

    try {
      await toggleMomentLike({
        source: item.source,
        id: momentId,
        userId: user?.$id,
        creatorId: item.rawEvent?.userId || item.rawEvent?.creatorId,
        contentSnippet: preview.slice(0, 80),
        privateKeyBytes: identity?.privateKeyBytes,
        nsec: identity?.nsec,
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
    openWithAffinity(true);

    try {
      const { repostMoment } = await import('@/lib/connect/moment-engagement');
      await repostMoment({
        source: item.source,
        id: momentId,
        userId: user?.$id,
        creatorId: item.rawEvent?.userId || item.rawEvent?.creatorId,
        privateKeyBytes: identity?.privateKeyBytes,
        nsec: identity?.nsec,
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

  const onShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!momentId) return;
    openUnifiedDrawer('share-context', {
      resourceType: 'moment',
      resourceId: item.source === 'nostr' ? `nostr_${momentId}` : momentId,
      resourceTitle: item.authorName ? `${item.authorName.replace(/^@/, '')}'s Moment` : 'Moment',
      content: item.content || (item as any).caption || '',
      accentColor: '#F59E0B',
    });
  };

  const onBookmark = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!momentId || bookmarkBusy) return;
    if (!user?.$id) {
      toast.error('Sign in to bookmark');
      return;
    }
    setBookmarkBusy(true);
    try {
      const { bookmarkToSelfChat } = await import('@/lib/chat/bookmark-to-self-chat');
      const url =
        item.source === 'nostr'
          ? `${window.location.origin}/moment/nostr_${momentId}`
          : buildPublicResourceUrl('moment', momentId);
      const title = preview
        ? `Moment — ${preview.slice(0, 80)}`
        : `Moment by ${item.authorName.replace(/^@/, '')}`;
      await bookmarkToSelfChat({
        userId: user.$id,
        kind: 'moment',
        objectId: momentId,
        title,
        url,
        snippet: preview && preview.length > 80 ? preview : undefined,
      });
      toast.success('Saved to your personal chat');
    } catch (err) {
      console.error(err);
      toast.error('Could not save bookmark');
    } finally {
      setBookmarkBusy(false);
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

  const contextMenu = useContextMenu();
  const openMenu = contextMenu?.openMenu;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!openMenu) return;

    const isAuthor = Boolean(user?.$id && item.rawEvent?.userId === user.$id);
    const postUrl = item.source === 'nostr'
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/moment/nostr_${momentId}`
      : buildPublicResourceUrl('moment', momentId || item.id);

    const menuItems: Parameters<typeof openMenu>[0]['items'] = [
      {
        label: 'Open Thread & Comments',
        icon: <MessageCircle size={16} />,
        onClick: () => { open(); },
      },
      {
        label: liked ? 'Unlike Moment' : 'Like Moment',
        icon: <Heart size={16} className={liked ? 'text-pink-500 fill-pink-500' : ''} />,
        onClick: (event: any) => { void onLike(event || e); },
      },
      {
        label: reposted ? 'Reposted' : 'Pulse / Repost',
        icon: <Repeat2 size={16} className={reposted ? 'text-emerald-400' : ''} />,
        onClick: (event: any) => { void onRepost(event || e); },
      },
      {
        label: 'Zap Creator',
        icon: <Zap size={16} className="text-amber-400" />,
        onClick: (event: any) => { void onZap(event || e); },
      },
      {
        label: 'Copy Post Link',
        icon: <Share size={16} />,
        onClick: () => {
          navigator.clipboard.writeText(postUrl);
          toast.success('Post link copied');
        },
      },
      {
        label: 'Copy Post Text',
        icon: <Copy size={16} />,
        onClick: () => {
          navigator.clipboard.writeText(item.content || '');
          toast.success('Post text copied');
        },
      },
      {
        label: 'Save to Bookmarks',
        icon: <Bookmark size={16} />,
        onClick: () => { void onBookmark(); },
      },
      {
        label: 'See Less Like This',
        icon: <EyeOff size={16} className="text-amber-500" />,
        onClick: async () => {
          try {
            const { extractNegativeTopics, addSeeLessTopics, hideMomentLocally } = await import('@/lib/connect/feed-settings');
            const topics = extractNegativeTopics(item.content || '', item.authorUsername || item.authorName, item.rawEvent?.tags);
            if (momentId) hideMomentLocally(momentId);
            if (topics.length) await addSeeLessTopics(topics);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('kylrix:see-less', {
                detail: {
                  id: momentId,
                  topics,
                  author: item.authorUsername || item.authorName,
                }
              }));
            }
            toast.success("We'll show fewer posts like this");
          } catch (err) {
            console.error(err);
            toast.error("Could not update preferences");
          }
        },
      },
      {
        label: `View ${item.authorName.replace(/^@/, '')}'s Profile`,
        icon: <User size={16} />,
        onClick: () => openProfilePreview(e),
      },
    ];

    if (item.source === 'ecosystem' && isAuthor && momentId) {
      menuItems.push({
        label: 'Delete Moment',
        icon: <Trash2 size={16} />,
        variant: 'destructive' as const,
        onClick: async () => {
          try {
            const { SocialService } = await import('@/lib/services/social');
            await SocialService.deleteMoment(momentId);
            toast.success('Moment deleted');
          } catch {
            toast.error('Failed to delete moment');
          }
        },
      });
    }

    openMenu({
      x: e.clientX,
      y: e.clientY,
      title: `${item.authorName.replace(/^@/, '')}'s Moment`,
      appType: 'connect',
      items: menuItems,
    });
  };

  const isSyncedToNostr = !isNostr && Boolean(item.rawEvent?.nostrId);

  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = React.useRef(false);

  const clearLongPress = React.useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchStart = React.useCallback(
    (e: React.TouchEvent) => {
      longPressFired.current = false;
      clearLongPress();
      const touch = e.touches[0];
      longPressTimer.current = setTimeout(() => {
        longPressFired.current = true;
        handleContextMenu({
          preventDefault: () => {},
          stopPropagation: () => {},
          clientX: touch?.clientX ?? 0,
          clientY: touch?.clientY ?? 0,
        } as unknown as React.MouseEvent);
      }, 480);
    },
    [clearLongPress, handleContextMenu],
  );

  const handleCardClick = React.useCallback(() => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    open();
  }, [open]);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onTouchCancel={clearLongPress}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      className="w-full text-left rounded-[26px] bg-[#161412] border border-[#34322F] hover:border-[#3C3A38] hover:bg-[#1C1A18] hover:-translate-y-px p-5 space-y-3.5 transition-all duration-200 shadow-sm cursor-pointer select-none relative focus:outline-none focus-visible:border-[#F59E0B]/40 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={openProfilePreview}
            className="shrink-0 cursor-pointer"
            title={`View ${item.authorName}'s profile`}
          >
            {item.authorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.authorAvatar}
                alt=""
                className="w-8 h-8 rounded-xl object-cover border border-white/10"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center text-white text-xs font-bold font-clash">
                {initials(item.authorName)}
              </div>
            )}
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={openProfilePreview}
                className="text-sm font-bold text-white truncate hover:underline hover:text-emerald-400 text-left transition-colors"
              >
                {item.authorName.replace(/^@/, '')}
              </button>
              <span className="text-xs text-white/40 truncate font-mono">{handle}</span>
            </div>
            <span className="text-[10px] text-white/30 font-mono">
              {formatRelative(item.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0A0908] border border-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-white/45"
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
            <span>{isNostr ? 'Nostr' : isSyncedToNostr ? 'Synced' : 'Kylrix'}</span>
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleContextMenu(e);
            }}
            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="More actions"
            aria-label="More actions"
          >
            <MoreHorizontal size={15} />
          </button>
        </div>
      </div>

      {/* Content */}
      {preview ? (
        <p className="text-sm text-white/90 leading-relaxed break-words whitespace-pre-wrap font-satoshi m-0">
          {preview}
        </p>
      ) : null}

      {/* Media Attachments */}
      {images.length > 0 ? (
        <div
          className={`rounded-xl overflow-hidden border border-white/[0.06] bg-[#0A0908] grid ${
            images.length > 1 ? 'grid-cols-2 gap-1' : 'grid-cols-1'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {images.slice(0, 4).map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src || i}
              src={src}
              alt=""
              className="w-full h-36 sm:h-44 object-cover bg-white/5"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ))}
        </div>
      ) : null}

      {/* Interactive Action Strip */}
      <div
        className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-white/40 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
          className="flex items-center gap-1.5 hover:text-[#6366F1] transition-colors cursor-pointer"
          aria-label="Comments"
        >
          <MessageCircle size={15} />
          <span>{(item.repliesCount || 0) > 0 ? item.repliesCount : ''}</span>
        </button>

        <button
          type="button"
          disabled={busy || reposted}
          onClick={onRepost}
          className={`flex items-center gap-1.5 hover:text-emerald-400 transition-colors cursor-pointer ${
            reposted ? 'text-emerald-400' : ''
          }`}
          aria-label="Repost"
        >
          <Repeat2 size={15} />
          <span>{reposts > 0 ? reposts : ''}</span>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={onLike}
          className={`flex items-center gap-1.5 hover:text-pink-400 transition-colors cursor-pointer ${
            liked ? 'text-pink-400' : ''
          }`}
          aria-label="Like"
        >
          <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
          <span>{likes > 0 ? likes : ''}</span>
        </button>

        <button
          type="button"
          onClick={onZap}
          className={`flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer ${
            zaps > 0 ? 'text-amber-400' : ''
          }`}
          aria-label="Zap"
        >
          <Zap size={15} fill={zaps > 0 ? 'currentColor' : 'none'} />
          <span>{zaps > 0 ? zaps : ''}</span>
        </button>

        <button
          type="button"
          disabled={bookmarkBusy}
          onClick={onBookmark}
          className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer disabled:opacity-40"
          title="Save to your personal chat"
          aria-label="Bookmark"
        >
          <Bookmark size={15} />
        </button>

        <button
          type="button"
          onClick={onShare}
          className="flex items-center gap-1.5 hover:text-[#60A5FA] transition-colors cursor-pointer"
          title="Share"
          aria-label="Share"
        >
          <Share size={15} />
        </button>
      </div>
    </article>
  );
}

export const MomentCard = React.memo(MomentCardInner, (prev, next) =>
  itemsEqual(prev.item, next.item),
);
