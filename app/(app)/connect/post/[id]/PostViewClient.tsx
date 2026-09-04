'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import {
  createMomentComment,
  loadMomentEngagement,
  parseMomentRouteId,
  toggleMomentLike,
  type MomentComment,
  type MomentSource,
} from '@/lib/connect/moment-engagement';
import { extractPostImages } from '@/lib/connect/moment-media';
import { SocialService } from '@/lib/services/social';
import { UsersService } from '@/lib/services/users';
import { fetchNostrEventById } from '@/lib/nostr/thread';
import type { NostrEvent } from '@/lib/nostr/nostr';
import {
  ArrowLeft, Globe, Heart, Lock, MessageCircle,
  Repeat2, Shield, Zap, X, Share2
} from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import toast from 'react-hot-toast';

type PreviewSeed = {
  authorName?: string;
  authorAvatar?: string;
  content?: string;
};

function initials(name: string) {
  const parts = name.replace(/^@/, '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatTs(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Derive the root/parent event ID from an 'e' tag array (NIP-10). */
function getRootParentId(tags: string[][]): string | null {
  // NIP-10: prefer 'root' marker, else first 'e' tag
  const root = tags.find(t => t[0] === 'e' && t[3] === 'root');
  if (root?.[1]) return root[1];
  const reply = tags.find(t => t[0] === 'e' && t[3] === 'reply');
  if (reply?.[1]) return reply[1];
  const first = tags.find(t => t[0] === 'e' && t[1]);
  return first?.[1] || null;
}

/** Map a reaction string to an emoji. */
function reactionEmoji(content: string): string {
  const c = (content || '').trim();
  if (!c || c === '+') return '❤️';
  if (c === '-') return '👎';
  // If it's already an emoji/string, use it directly (up to 4 chars)
  return c.slice(0, 4);
}

/** Resolve kind label for Nostr events. */
function kindLabel(kind: number): 'post' | 'reply' | 'repost' | 'reaction' | 'zap' {
  if (kind === 1) return 'post'; // could still be a reply if it has 'e' tags
  if (kind === 6) return 'repost';
  if (kind === 7) return 'reaction';
  if (kind === 9735) return 'zap';
  return 'post';
}

/** Tiny inline parent post stub shown above a reply/reaction/repost. */
function ParentPostStub({
  event,
  loading,
}: {
  event: NostrEvent | null;
  loading: boolean;
}) {
  const { text, images } = event
    ? extractPostImages(event.content || '', event.tags)
    : { text: '', images: [] as string[] };
  const preview = text.slice(0, 180) + (text.length > 180 ? '…' : '');

  return (
    <div className="relative pl-4">
      {/* Vertical thread line */}
      <div className="absolute left-[18px] top-0 bottom-0 w-[2px] bg-white/[0.10] rounded-full" />
      <div className="ml-6 rounded-[18px] border border-[#34322F] bg-[#0F0D0C] p-3.5 space-y-2 opacity-80">
        {loading && !event ? (
          <p className="text-xs text-white/35 font-mono">Loading parent post…</p>
        ) : !event ? (
          <p className="text-xs text-white/30 font-mono italic">Original post not found on active relays.</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#1C1A18] border border-white/[0.08] text-[10px] font-black text-[#F59E0B] flex items-center justify-center shrink-0">
                {initials(`npub…${event.pubkey.slice(-6)}`)}
              </div>
              <span className="text-[11px] font-mono text-white/50 truncate">
                npub…{event.pubkey.slice(-8)}
              </span>
              <Globe size={10} className="text-[#F59E0B] shrink-0" />
              <span className="ml-auto text-[10px] text-white/30 font-mono shrink-0">
                {formatTs(event.created_at * 1000)}
              </span>
            </div>
            {preview && (
              <p className="text-[13px] leading-relaxed text-white/70 font-satoshi whitespace-pre-wrap break-words m-0">
                {preview}
              </p>
            )}
            {images[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[0]} alt="" className="w-full h-24 object-cover rounded-lg border border-white/[0.06]" loading="lazy" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Bottom drawer shown for reactions and zaps to display the specific detail. */
function EngagementDetailDrawer({
  open,
  onClose,
  kind,
  content,
  zapAmount,
}: {
  open: boolean;
  onClose: () => void;
  kind: 'reaction' | 'zap' | 'repost';
  content?: string;
  zapAmount?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={ref}
        className="w-full max-w-lg bg-[#161412] border-t border-[#34322F] rounded-t-[24px] p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-200"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-white/50 font-mono">
            {kind === 'reaction' ? 'Reaction' : kind === 'zap' ? 'Zap' : 'Repost'}
          </span>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        {kind === 'reaction' && content && (
          <div className="flex flex-col items-center gap-3 py-4">
            <span className="text-6xl leading-none">{reactionEmoji(content)}</span>
            <p className="text-sm font-semibold text-white/60 font-satoshi">
              {content === '+' || !content ? 'Liked this post' : `Reacted with ${content}`}
            </p>
          </div>
        )}

        {kind === 'zap' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex items-center gap-2">
              <Zap size={32} className="text-[#F59E0B] fill-[#F59E0B]" />
              {zapAmount ? (
                <span className="text-3xl font-black text-[#F59E0B] font-mono">{zapAmount.toLocaleString()} sats</span>
              ) : (
                <span className="text-xl font-bold text-[#F59E0B]">Zapped</span>
              )}
            </div>
            <p className="text-sm text-white/50 font-satoshi">Lightning payment sent to this post&apos;s author</p>
          </div>
        )}

        {kind === 'repost' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Repeat2 size={32} className="text-[#00BA7C]" />
            <p className="text-sm font-semibold text-white/60 font-satoshi">Reposted this post to their followers</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Moment detail body — overflow-locked for mobile fullscreen object detail.
 */
export function PostViewClient({
  id: propId,
  onBack,
  preview,
}: {
  id?: string;
  onBack?: () => void;
  preview?: PreviewSeed;
} = {}) {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { open: openUnifiedDrawer } = useUnifiedDrawer();
  const { identity, isVaultLocked, unlockAndLoad } = useNostrIdentity();
  const rawId =
    propId || (Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined));
  
  const parsed = useMemo(() => (rawId ? parseMomentRouteId(rawId) : null), [rawId]);

  const [source, setSource] = useState<MomentSource>(parsed?.source || 'ecosystem');
  const [momentId, setMomentId] = useState(parsed?.id || '');
  const [moment, setMoment] = useState<any>(
    preview?.content ? { caption: preview.content, content: preview.content } : null,
  );
  const [creator, setCreator] = useState<any>(
    preview?.authorName ? { displayName: preview.authorName, avatarUrl: preview.authorAvatar } : null,
  );
  const [replies, setReplies] = useState<MomentComment[]>([]);
  const [likes, setLikes] = useState(0);
  const [zaps, setZaps] = useState(0);
  const [reposts, setReposts] = useState(0);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(!preview?.content);
  const [replyContent, setReplyContent] = useState('');
  const [busy, setBusy] = useState(false);

  // For Nostr event kind detection
  const [nostrEvent, setNostrEvent] = useState<NostrEvent | null>(null);
  const [parentEvent, setParentEvent] = useState<NostrEvent | null>(null);
  const [parentLoading, setParentLoading] = useState(false);
  const [engagementDrawer, setEngagementDrawer] = useState<{ open: boolean; kind: 'reaction' | 'zap' | 'repost'; content?: string; zapAmount?: number }>({ open: false, kind: 'reaction' });

  useEffect(() => {
    if (!parsed) return;
    setSource(parsed.source);
    setMomentId(parsed.id);
  }, [parsed?.source, parsed?.id]);

  useEffect(() => {
    if (!momentId) return;
    let cancelled = false;
    if (!preview?.content) setLoading(true);

    (async () => {
      try {
        if (source === 'ecosystem') {
          const data = await SocialService.getMomentById(momentId);
          if (cancelled) return;
          setMoment(data);
          const creatorId = data?.userId || data?.creatorId;
          if (creatorId) {
            try { 
              const profile = await UsersService.getProfileById(creatorId);
              if (!cancelled) setCreator(profile);
            } catch { /* keep preview */ }
          }
        } else {
          // Try local feed cache first
          let raw: NostrEvent | null = null;
          try {
            const cached = localStorage.getItem('kylrix_nostr_feed_cache');
            if (cached) {
              const events = JSON.parse(cached) as NostrEvent[];
              raw = events.find(e => e.id === momentId) || null;
            }
          } catch { /* ignore */ }

          if (!raw && !cancelled) {
            raw = await fetchNostrEventById(momentId, 2500);
          }

          if (raw && !cancelled) {
            setNostrEvent(raw);
            setMoment({
              id: raw.id,
              caption: raw.content,
              content: raw.content,
              pubkey: raw.pubkey,
              createdAt: raw.created_at * 1000,
              tags: raw.tags,
              kind: raw.kind,
            });

            // If this is a reply, reaction or repost — fetch the parent
            const eventKind = kindLabel(raw.kind);
            if (eventKind !== 'post' || (raw.kind === 1 && raw.tags.some(t => t[0] === 'e'))) {
              const parentId = getRootParentId(raw.tags);
              if (parentId && !cancelled) {
                setParentLoading(true);
                fetchNostrEventById(parentId, 2500)
                  .then(p => { 
                    if (!cancelled) {
                      setParentEvent(p); 
                      setParentLoading(false);
                    }
                  })
                  .catch(() => {
                    if (!cancelled) setParentLoading(false);
                  });
              }
            }
          }
        }

        if (!cancelled) {
          const engagement = await loadMomentEngagement({ source, id: momentId, userId: user?.$id });
          if (!cancelled) {
            setReplies(engagement.comments);
            setLikes(engagement.likesCount);
            setZaps(engagement.zapsCount || 0);
            setReposts(engagement.repostsCount || 0);
            setLiked(Boolean(engagement.isLiked));
          }
        }
      } catch (e) {
        console.error('Failed to load moment', e);
        if (!preview?.content && !cancelled) setMoment(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [momentId, source, user?.$id, preview?.content]);

  const handleBack = () => { if (onBack) onBack(); else router.back(); };

  const toggleLike = async () => {
    if (!momentId || busy) return;
    if (source === 'nostr' && (isVaultLocked || !identity)) {
      toast.error('Unlock vault to like on Nostr'); void unlockAndLoad(); return;
    }
    if (source === 'ecosystem' && !user?.$id) return;
    setBusy(true);
    const prevLiked = liked, prevLikes = likes;
    setLiked(!prevLiked);
    setLikes(prevLiked ? Math.max(0, prevLikes - 1) : prevLikes + 1);
    try {
      const words = `${moment?.caption || moment?.content || nostrEvent?.content || ''}`.toLowerCase().match(/#?\w{3,}/g) || [];
      const topics = Array.from(new Set(words.slice(0, 10)));
      void import('@/lib/connect/feed-settings').then(({ recordFeedInteraction }) =>
        recordFeedInteraction({ topics, searchWeight: 3, isConsciousAction: true }),
      );

      await toggleMomentLike({
        source,
        id: momentId,
        userId: user?.$id,
        creatorId: moment?.userId || moment?.creatorId,
        contentSnippet: moment?.caption || moment?.content,
        privateKeyBytes: identity?.privateKeyBytes,
        nsec: identity?.nsec,
        rootPubkey: moment?.pubkey || nostrEvent?.pubkey,
      });
    } catch (e) {
      setLiked(prevLiked); setLikes(prevLikes); console.error(e);
    } finally { setBusy(false); }
  };

  const sendReply = async () => {
    const text = replyContent.trim();
    if (!momentId || !text || busy) return;
    if (source === 'nostr' && (isVaultLocked || !identity)) {
      toast.error('Unlock vault to comment on Nostr'); void unlockAndLoad(); return;
    }
    if (source === 'ecosystem' && !user) return;
    setBusy(true);
    try {
      const words = `${text} ${moment?.caption || moment?.content || ''}`.toLowerCase().match(/#?\w{3,}/g) || [];
      const topics = Array.from(new Set(words.slice(0, 10)));
      void import('@/lib/connect/feed-settings').then(({ recordFeedInteraction }) =>
        recordFeedInteraction({ topics, searchWeight: 3, isConsciousAction: true }),
      );

      const created = await createMomentComment({
        source,
        id: momentId,
        content: text,
        userId: user?.$id,
        privateKeyBytes: identity?.privateKeyBytes,
        nsec: identity?.nsec,
        rootPubkey: moment?.pubkey || nostrEvent?.pubkey,
        nostrId: (moment as any)?.nostrId,
      });
      setReplyContent('');
      if (created) {
        setReplies(prev => [...prev, created]);
      } else {
        const refreshed = await loadMomentEngagement({ source, id: momentId, userId: user?.$id });
        setReplies(refreshed.comments);
      }
    } catch (e) {
      console.error(e); toast.error('Could not post reply');
    } finally { setBusy(false); }
  };

  const handleShare = () => {
    if (!momentId) return;
    openUnifiedDrawer('share-context', {
      resourceType: 'moment',
      resourceId: source === 'nostr' ? `nostr_${momentId}` : momentId,
      resourceTitle: creator?.displayName ? `${creator.displayName}'s Moment` : 'Moment',
      content: moment?.caption || moment?.content || nostrEvent?.content || '',
      accentColor: '#F59E0B',
    });
  };

  // Detect Nostr event kind
  const nostrKind = nostrEvent?.kind ?? (source === 'nostr' && moment?.kind ? moment.kind : 1);
  const eventType = source === 'nostr' ? kindLabel(nostrKind) : 'post';
  const isReply = eventType === 'post' && source === 'nostr' && (nostrEvent?.tags || moment?.tags || []).some((t: string[]) => t[0] === 'e');
  const isReaction = eventType === 'reaction';
  const isRepost = eventType === 'repost';
  const showParent = (isReply || isReaction || isRepost) && (parentLoading || parentEvent);

  const reactionContent = isReaction ? (moment?.content || '+') : undefined;

  const who = useMemo(() => {
    if (source === 'nostr') {
      if (preview?.authorName) return preview.authorName.replace(/^@/, '');
      if (moment?.pubkey) return `npub…${String(moment.pubkey).slice(-8)}`;
      return 'Nostr';
    }
    return creator?.displayName || creator?.username || preview?.authorName || 'Someone';
  }, [source, preview?.authorName, moment?.pubkey, creator]);

  const avatarUrl = creator?.avatarUrl || creator?.prefs?.avatarUrl || preview?.authorAvatar;
  const handle = creator?.username || (source === 'nostr' && moment?.pubkey ? `npub…${String(moment.pubkey).slice(-8)}` : who);
  const rawBody = isReaction
    ? '' // reactions show the parent post body, not the reaction content as body
    : (moment?.caption || moment?.content || preview?.content || '');
  const { text: body, images } = extractPostImages(rawBody, moment?.tags || nostrEvent?.tags);
  const isNostr = source === 'nostr';

  if (loading && !moment && !preview?.content) {
    return (
      <div className="h-full w-full max-w-full min-w-0 overflow-x-hidden overflow-y-auto text-white bg-[#0A0908]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-[#0A0908] border-b border-[#34322F]">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 rounded-xl bg-[#161412] border border-[#34322F] text-white/60 hover:text-white shrink-0"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="text-sm font-extrabold font-clash truncate">
            Moment
          </span>
        </div>

        <div className="px-3 sm:px-4 py-4 space-y-3 min-w-0 max-w-full">
          {/* Main post article skeleton */}
          <article className="rounded-[22px] border border-[#34322F] bg-[#161412] p-4 space-y-3 min-w-0 max-w-full overflow-hidden">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full shrink-0 bg-[#0A0908] border border-white/[0.06] flex items-center justify-center text-[11px] font-black text-white/20">
                ••
              </div>
              <div className="min-w-0 flex-1 overflow-hidden space-y-2 pt-1">
                <div className="h-3.5 w-32 rounded-md bg-white/[0.06]" />
                <div className="h-2.5 w-20 rounded-md bg-white/[0.03]" />
              </div>
            </div>

            <div className="space-y-2 py-1">
              <div className="h-4 w-full rounded-md bg-white/[0.05]" />
              <div className="h-4 w-5/6 rounded-md bg-white/[0.05]" />
              <div className="h-4 w-2/3 rounded-md bg-white/[0.05]" />
            </div>

            <div className="flex items-center gap-4 sm:gap-6 pt-3 border-t border-white/[0.06] min-w-0">
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white/30">
                <Heart size={16} /> <span className="font-mono">0</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white/30">
                <MessageCircle size={16} /> <span className="font-mono">0</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white/30">
                <Repeat2 size={16} /> <span className="font-mono">0</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white/30">
                <Zap size={16} /> <span className="font-mono">0</span>
              </span>
            </div>
          </article>

          {/* Reply composer skeleton */}
          <div className="flex gap-2 items-end min-w-0 max-w-full">
            <div className="min-w-0 flex-1 h-[42px] rounded-xl bg-[#161412] border border-[#34322F] px-4 flex items-center text-sm text-white/30 font-satoshi">
              Write a reply…
            </div>
            <div className="shrink-0 h-[42px] px-4 rounded-xl bg-[#F59E0B]/30 text-black/50 font-bold text-sm flex items-center">
              Reply
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!moment && !preview?.content && source === 'ecosystem') {
    return (
      <div className="h-full w-full max-w-full min-w-0 overflow-x-hidden flex flex-col items-center justify-center gap-3 text-white px-6">
        <p className="text-sm text-white/60">This post is not available.</p>
        <button type="button" onClick={handleBack} className="text-sm font-bold text-[#F59E0B]">Go back</button>
      </div>
    );
  }

  return (
    <div className="h-full w-full max-w-full min-w-0 overflow-x-hidden overflow-y-auto text-white bg-[#0A0908]">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-[#0A0908] border-b border-[#34322F]">
        <button
          type="button"
          onClick={handleBack}
          className="p-2 rounded-xl bg-[#161412] border border-[#34322F] text-white/60 hover:text-white shrink-0"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-sm font-extrabold font-clash truncate">
          {isReaction ? 'Reaction' : isRepost ? 'Repost' : isReply ? 'Reply' : 'Moment'}
        </span>
        {isReaction && (
          <span className="ml-auto text-2xl leading-none">{reactionEmoji(reactionContent || '+')}</span>
        )}
        {isRepost && (
          <Repeat2 size={16} className="ml-auto text-[#00BA7C]" />
        )}
        {isReply && (
          <div className="ml-auto flex items-center gap-1 text-[11px] text-white/40 font-mono">
            <MessageCircle size={12} /> Reply thread
          </div>
        )}
      </div>

      <div className="px-3 sm:px-4 py-4 space-y-3 min-w-0 max-w-full">

        {/* Parent post stub — shown above for replies/reactions/reposts */}
        {showParent && (
          <ParentPostStub event={parentEvent} loading={parentLoading} />
        )}

        {/* Connecting thread pip between parent and current post */}
        {showParent && (
          <div className="flex items-center gap-2 pl-5 py-1">
            <div className="h-4 w-[2px] bg-white/[0.10] rounded-full ml-[14px]" />
            <span className="text-[10px] text-white/30 font-mono">
              {isReaction ? 'reacted to' : isRepost ? 'reposted' : 'replied to'}
            </span>
          </div>
        )}

        {/* Reaction/Repost special banner */}
        {(isReaction || isRepost) && (
          <button
            type="button"
            onClick={() => setEngagementDrawer({ open: true, kind: isReaction ? 'reaction' : 'repost', content: reactionContent })}
            className="w-full flex items-center gap-3 rounded-[18px] border border-[#34322F] bg-[#161412] px-4 py-3 hover:bg-[#1C1A18] transition-colors"
          >
            {isReaction ? (
              <>
                <span className="text-3xl leading-none">{reactionEmoji(reactionContent || '+')}</span>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-bold text-white font-satoshi m-0">{who}</p>
                  <p className="text-xs text-white/40 m-0">reacted · tap for details</p>
                </div>
              </>
            ) : (
              <>
                <Repeat2 size={20} className="text-[#00BA7C] shrink-0" />
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-bold text-white font-satoshi m-0">{who}</p>
                  <p className="text-xs text-white/40 m-0">reposted · tap for details</p>
                </div>
              </>
            )}
          </button>
        )}

        {/* Main post article — always shown (for reaction/repost this shows the actor; the parent above shows the content) */}
        {(!isReaction && !isRepost) && (
          <article className="rounded-[22px] border border-[#34322F] bg-[#161412] p-4 space-y-3 min-w-0 max-w-full overflow-hidden">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-[11px] font-black border border-white/[0.06] overflow-hidden bg-[#0A0908]"
                style={{ color: isNostr ? '#F59E0B' : '#34D399' }}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials(who)
                )}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-[15px] font-extrabold text-white font-satoshi truncate m-0">{who}</p>
                  <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0A0908] border border-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-white/45">
                    {isNostr ? <Globe size={11} className="text-[#F59E0B]" /> : <Shield size={11} className="text-emerald-400" />}
                    {isNostr ? 'Nostr' : 'Kylrix'}
                  </span>
                </div>
                <p className="text-[13px] text-white/40 font-medium truncate m-0 mt-0.5">
                  {handle.startsWith('@') || handle.startsWith('npub') ? handle : `@${handle}`}
                </p>
              </div>
            </div>

            {body ? (
              <p className="text-[16px] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-satoshi text-white/[0.92] m-0 max-w-full">
                {body}
              </p>
            ) : null}

            {images.length > 0 ? (
              <div className={`w-full max-w-full rounded-xl overflow-hidden border border-white/[0.06] bg-[#0A0908] grid ${images.length > 1 ? 'grid-cols-2 gap-1' : 'grid-cols-1'}`}>
                {images.map(src => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={src}
                    src={src}
                    alt=""
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('kylrix:open-unified-media', {
                        detail: {
                          src,
                          type: 'image',
                          title: 'Moment photo',
                        }
                      }));
                    }}
                    className="w-full max-h-[65vh] object-contain cursor-pointer hover:opacity-95 transition-opacity"
                    loading="lazy"
                  />
                ))}
              </div>
            ) : null}

            {moment?.mediaUrl || moment?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={moment.mediaUrl || moment.imageUrl}
                alt=""
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('kylrix:open-unified-media', {
                    detail: {
                      src: moment.mediaUrl || moment.imageUrl,
                      type: 'image',
                      title: 'Moment photo',
                    }
                  }));
                }}
                className="w-full max-w-full max-h-[65vh] rounded-xl border border-white/[0.06] object-contain bg-[#0A0908] cursor-pointer hover:opacity-95 transition-opacity"
              />
            ) : null}

            <div className="flex items-center gap-4 sm:gap-6 pt-3 border-t border-white/[0.06] min-w-0 flex-wrap">
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleLike()}
                className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold disabled:opacity-40 shrink-0 ${liked ? 'text-[#F91880]' : 'text-white/60 hover:text-[#F91880]'}`}
              >
                <Heart size={16} className={liked ? 'fill-[#F91880]' : ''} />
                <span className="font-mono">{likes}</span>
              </button>
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white/40 shrink-0">
                <MessageCircle size={16} />
                <span className="font-mono">{replies.length}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white/40 shrink-0">
                <Repeat2 size={16} />
                <span className="font-mono">{reposts}</span>
              </span>
              <button
                type="button"
                onClick={() => setEngagementDrawer({ open: true, kind: 'zap' })}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white/40 hover:text-[#F59E0B] shrink-0"
              >
                <Zap size={16} className={zaps > 0 ? 'text-[#F59E0B] fill-[#F59E0B]' : ''} />
                <span className="font-mono">{zaps}</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white/60 hover:text-white ml-auto shrink-0 cursor-pointer"
              >
                <Share2 size={16} />
                <span className="hidden sm:inline">Share</span>
              </button>
            </div>
          </article>
        )}

        {/* Reply composer — shown for posts and replies, not reactions/reposts */}
        {!isReaction && !isRepost && (
          <div className="flex gap-2 items-end min-w-0 max-w-full">
            <textarea
              value={replyContent}
              onChange={e => {
                setReplyContent(e.target.value);
                const target = e.target;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 140)}px`;
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendReply();
                }
              }}
              rows={1}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              data-gramm="false"
              placeholder={source === 'nostr' && isVaultLocked ? 'Unlock vault to reply…' : 'Write a reply…'}
              className="min-w-0 flex-1 rounded-xl bg-[#161412] border border-[#34322F] px-4 py-2.5 text-sm outline-none focus:border-white/20 resize-none max-h-[140px] leading-relaxed text-white font-satoshi"
            />
            {source === 'nostr' && isVaultLocked ? (
              <button
                type="button"
                onClick={() => void unlockAndLoad()}
                className="shrink-0 h-[42px] rounded-xl bg-[#F59E0B]/15 text-[#F59E0B] font-bold text-sm px-3 inline-flex items-center gap-1.5 border border-[#F59E0B]/30"
              >
                <Lock size={14} /> Unlock
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || !replyContent.trim() || (source === 'ecosystem' && !user)}
                onClick={() => void sendReply()}
                className="shrink-0 h-[42px] rounded-xl bg-[#F59E0B] text-black font-bold text-sm px-4 disabled:opacity-40 transition-opacity"
              >
                Reply
              </button>
            )}
          </div>
        )}

        {/* Replies list */}
        {!isReaction && !isRepost && (
          <ul className="space-y-2 min-w-0 max-w-full list-none p-0 m-0">
            {replies.length === 0 ? (
              <li className="rounded-[18px] border border-[#34322F] bg-[#161412] px-4 py-8 text-center text-sm text-white/35">
                No comments yet
              </li>
            ) : (
              replies.map(r => (
                <li
                  key={r.id}
                  className="rounded-[18px] border border-[#34322F] bg-[#161412] px-4 py-3.5 min-w-0 max-w-full overflow-hidden"
                >
                  <div className="text-[11px] font-bold text-white/40 mb-1 truncate">{r.authorName}</div>
                  <p className="text-[14px] text-white/85 whitespace-pre-wrap break-words [overflow-wrap:anywhere] m-0 font-satoshi max-w-full">
                    {r.content}
                  </p>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* Engagement detail bottom drawer */}
      <EngagementDetailDrawer
        open={engagementDrawer.open}
        onClose={() => setEngagementDrawer(prev => ({ ...prev, open: false }))}
        kind={engagementDrawer.kind}
        content={engagementDrawer.content}
        zapAmount={engagementDrawer.zapAmount}
      />
    </div>
  );
}
