import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  ExternalLink, 
  Globe, 
  Copy, 
  Check, 
  Maximize2, 
  Minimize2, 
  MessageSquare,
  MessageCircle,
  Heart,
  Zap,
  Repeat2,
  Share2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { NostrRelayPool, type NostrEvent } from '@/lib/nostr/nostr';
import { getNostrReadRelays } from '@/lib/connect/feed-settings';
import { extractPostImages, truncateMomentBody } from '@/lib/connect/moment-media';
import { bytesToNpub, hexToBytes, npubToBytes, bytesToHex } from '@/lib/nostr/crypto';
import { getCachedNostrProfile, queueNostrProfileFetch } from '@/lib/nostr/metadata';
import { fetchNostrEngagement } from '@/lib/nostr/thread';
import { useAuth } from '@/context/auth/AuthContext';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { toggleMomentLike, repostMoment } from '@/lib/connect/moment-engagement';
import toast from 'react-hot-toast';

export type ProfileTab = 'posts' | 'replies' | 'likes' | 'zaps';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://purplepag.es',
];

function formatRelative(ts: number | string) {
  const timeMs = typeof ts === 'string' ? new Date(ts).getTime() : ts * 1000;
  if (!timeMs) return '';
  const diff = Date.now() - timeMs;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${Math.max(1, sec)}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(timeMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface UnpackedPost {
  id: string;
  targetId: string;
  isRepost: boolean;
  repostAuthor?: string;
  authorPubkey: string;
  content: string;
  createdAt: number;
  images: string[];
  kind: number;
  reactionEmoji?: string;
  zapAmount?: string;
}

function unpackNostrEvent(item: NostrEvent, reposterName?: string): UnpackedPost {
  const isRepost = item.kind === 6;
  let targetId = item.id;
  let rawContent = item.content || '';
  let authorPubkey = item.pubkey;
  let createdAt = item.created_at;
  let reactionEmoji: string | undefined;
  let zapAmount: string | undefined;

  // Handle Reposts (NIP-18 kind 6)
  if (isRepost) {
    const trimmed = rawContent.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          targetId = parsed.id || item.tags?.find(t => t[0] === 'e')?.[1] || item.id;
          rawContent = parsed.content || '';
          authorPubkey = parsed.pubkey || item.pubkey;
          if (parsed.created_at) createdAt = parsed.created_at;
        }
      } catch {}
    } else {
      const eTag = item.tags?.find(t => t[0] === 'e');
      if (eTag) targetId = eTag[1];
      const pTag = item.tags?.find(t => t[0] === 'p');
      if (pTag) authorPubkey = pTag[1];
    }
  }

  // Handle Reactions (kind 7)
  if (item.kind === 7) {
    reactionEmoji = rawContent && rawContent !== '+' ? rawContent : '❤️';
    const eTag = item.tags?.find(t => t[0] === 'e');
    if (eTag) targetId = eTag[1];
    rawContent = '';
  }

  // Handle Zaps (kind 9735)
  if (item.kind === 9735) {
    const eTag = item.tags?.find(t => t[0] === 'e');
    if (eTag) targetId = eTag[1];
    const descTag = item.tags?.find(t => t[0] === 'description');
    if (descTag?.[1]) {
      try {
        const descObj = JSON.parse(descTag[1]);
        if (descObj.content) rawContent = descObj.content;
      } catch {}
    }
  }

  // Fallback: If content is still stringified JSON, unpack the text
  const trimmedFinal = rawContent.trim();
  if (trimmedFinal.startsWith('{') && trimmedFinal.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmedFinal);
      if (parsed.content) rawContent = parsed.content;
    } catch {}
  }

  const { text: cleanText, images } = extractPostImages(rawContent, item.tags);

  return {
    id: item.id,
    targetId: targetId || item.id,
    isRepost,
    repostAuthor: isRepost ? reposterName : undefined,
    authorPubkey,
    content: cleanText,
    createdAt,
    images,
    kind: item.kind,
    reactionEmoji,
    zapAmount,
  };
}

export interface ProfilePreviewDrawerProps {
  isOpen?: boolean;
  onClose: () => void;
  userId?: string;
  username?: string;
  name?: string;
  avatar?: string;
  npub?: string;
  pubkey?: string;
  bio?: string;
  source?: 'ecosystem' | 'nostr';
}

export function ProfilePreviewDrawer({
  onClose,
  userId,
  username,
  name,
  avatar,
  npub: initialNpub,
  pubkey: initialPubkey,
  bio,
  source = 'ecosystem'
}: ProfilePreviewDrawerProps) {
  const { user } = useAuth();
  const { identity, isVaultLocked, unlockAndLoad } = useNostrIdentity();
  const { open: openUnifiedDrawer } = useUnifiedDrawer();
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const router = useRouter();
  const [resolvedNpub, setResolvedNpub] = useState<string | null>(initialNpub || null);
  const [resolvedPubkey, setResolvedPubkey] = useState<string | null>(initialPubkey || null);
  const [resolvedProfile, setResolvedProfile] = useState<{ name?: string; username?: string; avatar?: string; bio?: string }>({
    name,
    username,
    avatar,
    bio
  });
  const [nostrPosts, setNostrPosts] = useState<NostrEvent[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [engagement, setEngagement] = useState<{
    likeCount: Record<string, number>;
    replyCount: Record<string, number>;
    zapCount: Record<string, number>;
    repostCount: Record<string, number>;
  }>({
    likeCount: {},
    replyCount: {},
    zapCount: {},
    repostCount: {},
  });


  // If pubkey given, derive npub
  useEffect(() => {
    if (initialPubkey && !resolvedNpub) {
      try {
        const np = bytesToNpub(hexToBytes(initialPubkey));
        setResolvedNpub(np);
      } catch {}
    }
  }, [initialPubkey, resolvedNpub]);

  // If npub given, derive hex pubkey
  useEffect(() => {
    if (initialNpub && !resolvedPubkey) {
      try {
        const bytes = npubToBytes(initialNpub);
        setResolvedPubkey(bytesToHex(bytes));
      } catch {}
    }
  }, [initialNpub, resolvedPubkey]);

  // When an ecosystem userId is provided but no npub/pubkey was passed,
  // look up the user's linked Nostr identity from LocalEngine cache first, then profile record.
  useEffect(() => {
    if (!userId || resolvedNpub || resolvedPubkey) return;
    let cancelled = false;
    void (async () => {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const localIdentity = await LocalEngine.cacheGet<any>(`identity:${userId}`).catch(() => null);
        if (localIdentity && !cancelled) {
          const storedNpub: string | undefined = localIdentity.nostrNpub || localIdentity.npub || (localIdentity.publicKey?.startsWith('npub') ? localIdentity.publicKey : undefined);
          const storedPubkey: string | undefined = localIdentity.nostrPubkey || localIdentity.pubkey || (localIdentity.publicKey && !localIdentity.publicKey.startsWith('npub') ? localIdentity.publicKey : undefined);
          if (storedNpub && !resolvedNpub) setResolvedNpub(storedNpub);
          if (storedPubkey && !resolvedPubkey) setResolvedPubkey(storedPubkey);
          setResolvedProfile(prev => ({
            name: prev.name || localIdentity.displayName || localIdentity.name,
            username: prev.username || localIdentity.username,
            avatar: prev.avatar || localIdentity.avatar || localIdentity.avatarUrl,
            bio: prev.bio || localIdentity.bio,
          }));
          return;
        }

        const { UsersService } = await import('@/lib/services/users');
        const prof = await UsersService.getProfileById(userId).catch(() => null);
        if (cancelled || !prof) return;
        const storedNpub: string | undefined = (prof as any).nostrNpub || (prof as any).npub;
        const storedPubkey: string | undefined = (prof as any).nostrPubkey || (prof as any).pubkey;
        if (storedNpub && !resolvedNpub) setResolvedNpub(storedNpub);
        if (storedPubkey && !resolvedPubkey) setResolvedPubkey(storedPubkey);
        setResolvedProfile(prev => ({
          name: prev.name || prof.displayName || prof.name,
          username: prev.username || prof.username,
          avatar: prev.avatar || prof.avatar || prof.avatarUrl,
          bio: prev.bio || prof.bio,
        }));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [userId, resolvedNpub, resolvedPubkey]);

  // Fetch Nostr Activity (posts, replies, likes, zaps) with LocalEngine cache first
  useEffect(() => {
    if (!resolvedPubkey && !resolvedNpub) return;
    let cancelled = false;
    let pool: NostrRelayPool | null = null;

    const loadNostrActivity = async () => {
      setLoadingPosts(true);
      try {
        let hex = resolvedPubkey;
        if (!hex && resolvedNpub) {
          try {
            hex = bytesToHex(npubToBytes(resolvedNpub));
          } catch {
            hex = null;
          }
        }

        if (!hex) {
          setLoadingPosts(false);
          return;
        }

        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const cachedFeed = await LocalEngine.cacheGet<NostrEvent[]>(`nostr_profile_feed_${hex}`).catch(() => null);
        if (Array.isArray(cachedFeed) && cachedFeed.length > 0 && !cancelled) {
          setNostrPosts(cachedFeed);
          setLoadingPosts(false);
        }

        const readRelays = await getNostrReadRelays().catch(() => DEFAULT_RELAYS);
        const targets = readRelays.length ? readRelays : DEFAULT_RELAYS;
        pool = new NostrRelayPool(targets);
        await pool.connect();

        const fetchedEvents: NostrEvent[] = cachedFeed ? [...cachedFeed] : [];
        const authorsToFetch: string[] = [];

        pool.addListener((ev) => {
          if (cancelled) return;
          if (ev.kind === 0) {
            try {
              const meta = JSON.parse(ev.content);
              setResolvedProfile(prev => ({
                name: meta.display_name || meta.name || prev.name,
                username: meta.name || prev.username,
                avatar: meta.picture || prev.avatar,
                bio: meta.about || prev.bio
              }));
            } catch {}
          } else if ([1, 6, 7, 9735].includes(ev.kind)) {
            if (!fetchedEvents.some(e => e.id === ev.id)) {
              fetchedEvents.push(ev);
              fetchedEvents.sort((a, b) => b.created_at - a.created_at);
              setNostrPosts([...fetchedEvents]);
              void LocalEngine.cacheSet(`nostr_profile_feed_${hex}`, fetchedEvents).catch(() => {});
              if (ev.pubkey) authorsToFetch.push(ev.pubkey);
            }
          }
        });

        pool.subscribe('profile-feed', [{ kinds: [1, 6, 7, 9735], authors: [hex], limit: 60 }]);
        pool.subscribe('profile-meta', [{ kinds: [0], authors: [hex], limit: 1 }]);

        if (authorsToFetch.length > 0) {
          void queueNostrProfileFetch(Array.from(new Set(authorsToFetch)));
        }
      } catch (err) {
        console.warn('[ProfilePreview] Failed to fetch Nostr activity:', err);
      } finally {
        setTimeout(() => { if (!cancelled) setLoadingPosts(false); }, 1500);
      }
    };

    void loadNostrActivity();
    return () => {
      cancelled = true;
      if (pool) pool.close();
    };
  }, [resolvedPubkey, resolvedNpub]);

  // Fetch live engagement (likes, replies, reposts, zaps) across all fetched post and target IDs
  useEffect(() => {
    if (!nostrPosts.length) return;
    let cancelled = false;

    const ids = Array.from(new Set(nostrPosts.flatMap(p => {
      const eTag = p.tags?.find(t => t[0] === 'e')?.[1];
      return [p.id, eTag].filter(Boolean) as string[];
    })));

    if (!ids.length) return;

    void (async () => {
      try {
        const engData = await fetchNostrEngagement(ids, 3500);
        if (!cancelled && engData) {
          setEngagement(prev => ({
            likeCount: { ...prev.likeCount, ...engData.likeCount },
            replyCount: { ...prev.replyCount, ...engData.replyCount },
            zapCount: { ...prev.zapCount, ...engData.zapCount },
            repostCount: { ...prev.repostCount, ...engData.repostCount },
          }));
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [nostrPosts]);

  const displayName = resolvedProfile.name || name || username || (resolvedNpub ? `Nostr ${resolvedNpub.slice(0, 10)}…` : 'Kylrix User');

  const displayHandle = resolvedProfile.username || username || (resolvedNpub ? `@${resolvedNpub.slice(0, 12)}…` : '');

  // Tab Filtering and Unpacking
  const unpackedPosts = useMemo(() => {
    return nostrPosts
      .filter((ev) => {
        if (ev.kind === 6) return true; // Reposts shown in posts
        if (ev.kind === 1) {
          const eTags = ev.tags?.filter(t => t[0] === 'e') || [];
          return eTags.length === 0 || eTags.every(t => t[3] === 'mention');
        }
        return false;
      })
      .map((ev) => unpackNostrEvent(ev, displayName));
  }, [nostrPosts, displayName]);

  const unpackedReplies = useMemo(() => {
    return nostrPosts
      .filter((ev) => {
        if (ev.kind === 1) {
          const eTags = ev.tags?.filter(t => t[0] === 'e') || [];
          return eTags.length > 0 && eTags.some(t => t[3] !== 'mention');
        }
        return false;
      })
      .map((ev) => unpackNostrEvent(ev, displayName));
  }, [nostrPosts, displayName]);

  const unpackedLikes = useMemo(() => {
    return nostrPosts
      .filter((ev) => ev.kind === 7)
      .map((ev) => unpackNostrEvent(ev, displayName));
  }, [nostrPosts, displayName]);

  const unpackedZaps = useMemo(() => {
    return nostrPosts
      .filter((ev) => ev.kind === 9735)
      .map((ev) => unpackNostrEvent(ev, displayName));
  }, [nostrPosts, displayName]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`Copied ${label}`);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const currentTabItems: UnpackedPost[] =
    activeTab === 'posts' ? unpackedPosts :
    activeTab === 'replies' ? unpackedReplies :
    activeTab === 'likes' ? unpackedLikes : unpackedZaps;

  return (
    <div className={`flex flex-col bg-[#161412] text-white transition-all duration-300 w-full ${isExpanded ? 'h-[100dvh] max-h-[100dvh] rounded-none' : 'h-[60dvh] max-h-[60dvh] mt-auto rounded-t-[28px] border-t border-white/[0.08] shadow-[0_-24px_60px_rgba(0,0,0,0.85)]'}`}>
      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0 bg-[#161412]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider font-mono text-white/70">
            {source === 'nostr' && !userId ? 'Nostr Profile' : resolvedNpub && userId ? 'Kylrix · Nostr' : source === 'nostr' ? 'Nostr Profile' : 'Kylrix Member'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Follow / Unfollow Button */}
          {(userId || resolvedNpub || resolvedPubkey) && (
            <button
              type="button"
              onClick={async () => {
                const targetKey = resolvedNpub || resolvedPubkey || userId;
                if (!targetKey) return;
                try {
                  const { LocalEngine } = await import('@/lib/services/LocalEngine');
                  const follows = (await LocalEngine.cacheGet<string[]>('kylrix:follows')) || [];
                  const isFollowing = follows.includes(targetKey);
                  const nextFollows = isFollowing ? follows.filter(k => k !== targetKey) : [...follows, targetKey];
                  await LocalEngine.cacheSet('kylrix:follows', nextFollows);
                  toast.success(isFollowing ? 'Unfollowed' : 'Following');
                  window.dispatchEvent(new CustomEvent('kylrix:follows-updated', { detail: nextFollows }));
                } catch {
                  toast.error('Could not update follow');
                }
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 hover:bg-[#F59E0B] hover:text-black transition-colors"
            >
              Follow
            </button>
          )}
          {/* Popout to /u/username route if username exists */}
          {username && (
            <a
              href={`/u/${encodeURIComponent(username.replace(/^@/, ''))}`}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              title="Open full profile page"
            >
              <ExternalLink size={16} />
            </a>
          )}
          {/* Native Expand / Collapse Toggle without navigation */}
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand full screen'}
          >
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors ml-1"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Profile Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 min-h-0">
        {/* Profile Header Box */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#0A0908] border border-white/[0.08] flex items-center justify-center text-xl font-black shrink-0 overflow-hidden text-emerald-400">
            {resolvedProfile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolvedProfile.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              displayName.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-white font-satoshi truncate m-0">
              {displayName}
            </h2>
            {displayHandle && (
              <p className="text-xs text-white/40 font-mono truncate m-0 mt-0.5">
                {displayHandle.startsWith('@') ? displayHandle : `@${displayHandle}`}
              </p>
            )}
            {resolvedProfile.bio && (
              <p className="text-xs text-white/80 font-satoshi mt-2 leading-relaxed whitespace-pre-wrap break-words">
                {resolvedProfile.bio}
              </p>
            )}
          </div>
        </div>

        {/* Nostr Identity Card */}
        {resolvedNpub && (
          <div className="rounded-xl bg-[#0A0908] border border-[#F59E0B]/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#F59E0B] uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Globe size={12} /> Nostr Identity (npub)
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(resolvedNpub, 'npub')}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F59E0B] hover:text-[#F59E0B]/80 font-mono"
              >
                {copiedKey === 'npub' ? <Check size={12} /> : <Copy size={12} />}
                {copiedKey === 'npub' ? 'Copied' : 'Copy npub'}
              </button>
            </div>
            <div className="rounded-lg bg-[#161412] border border-white/[0.04] p-2 break-all text-xs font-mono text-white/90 select-all">
              {resolvedNpub}
            </div>
          </div>
        )}

        {/* Profile Tabs: Posts | Replies | Likes | Zaps */}
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] pb-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('posts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'posts'
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare size={13} />
            Posts {unpackedPosts.length > 0 && `(${unpackedPosts.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('replies')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'replies'
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageCircle size={13} />
            Replies {unpackedReplies.length > 0 && `(${unpackedReplies.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('likes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'likes'
                ? 'bg-white/10 text-[#EC4899]'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <Heart size={13} className={activeTab === 'likes' ? 'text-[#EC4899]' : ''} />
            Likes {unpackedLikes.length > 0 && `(${unpackedLikes.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('zaps')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'zaps'
                ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <Zap size={13} className={activeTab === 'zaps' ? 'text-[#F59E0B]' : ''} />
            Zaps {unpackedZaps.length > 0 && `(${unpackedZaps.length})`}
          </button>
        </div>

        {/* Tab Items Feed */}
        <div className="space-y-3">
          {loadingPosts && currentTabItems.length === 0 && (
            <div className="p-4 text-center text-xs text-white/40 font-mono">
              Fetching {activeTab} from relays & local engine…
            </div>
          )}

          {!loadingPosts && currentTabItems.length === 0 && (
            <div className="p-6 rounded-xl bg-[#0A0908] border border-white/[0.04] text-center text-xs text-white/40 font-mono space-y-1">
              <p className="m-0">No {activeTab} found for this identity.</p>
            </div>
          )}

          {currentTabItems.map((item) => {
            const authorMeta = getCachedNostrProfile(item.authorPubkey);
            let authorName = authorMeta?.name || authorMeta?.displayName;
            let authorHandle = authorMeta?.nip05 || (authorMeta?.name ? `@${authorMeta.name}` : undefined);
            let authorAvatar = authorMeta?.picture;

            if (!authorName) {
              if (item.authorPubkey === resolvedPubkey) {
                authorName = displayName;
                authorHandle = displayHandle;
                authorAvatar = resolvedProfile.avatar;
              } else {
                try {
                  const np = bytesToNpub(hexToBytes(item.authorPubkey));
                  authorName = `${np.slice(0, 10)}…${np.slice(-4)}`;
                } catch {
                  authorName = `${item.authorPubkey.slice(0, 8)}…`;
                }
              }
            }

            const openItem = () => {
              onClose();
              router.push(`/moment/nostr_${item.targetId}`);
            };

            return (
              <article
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={openItem}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItem(); } }}
                className="w-full max-w-full min-w-0 flex flex-col text-left rounded-[22px] bg-[#0A0908] border border-white/[0.08] hover:border-white/[0.14] hover:bg-[#12100E] transition-all duration-200 cursor-pointer overflow-hidden"
              >
                {/* Repost Header Indicator */}
                {item.isRepost && (
                  <div className="flex items-center gap-1.5 px-4 pt-3 pb-0 text-[12px] font-mono text-[#34D399] font-semibold">
                    <Repeat2 size={13} className="text-[#34D399]" />
                    <span>{displayName} reposted</span>
                  </div>
                )}

                {/* Like / Reaction Header Indicator */}
                {item.kind === 7 && (
                  <div className="flex items-center gap-1.5 px-4 pt-3 pb-0 text-[12px] font-mono text-[#EC4899] font-semibold">
                    <Heart size={13} fill="currentColor" className="text-[#EC4899]" />
                    <span>{displayName} liked</span>
                  </div>
                )}

                {/* Zap Header Indicator */}
                {item.kind === 9735 && (
                  <div className="flex items-center gap-1.5 px-4 pt-3 pb-0 text-[12px] font-mono text-[#F59E0B] font-semibold">
                    <Zap size={13} fill="currentColor" className="text-[#F59E0B]" />
                    <span>{displayName} zapped</span>
                  </div>
                )}

                {/* Main Card Content */}
                <div className="flex gap-3 p-4 min-w-0 max-w-full flex-1">
                  <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-[11px] font-black border border-white/[0.08] overflow-hidden bg-[#161412] text-white/70">
                    {authorAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={authorAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (authorName || '?').slice(0, 2).toUpperCase()
                    )}
                  </div>

                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[15px] font-extrabold text-white font-satoshi truncate">
                        {authorName.replace(/^@/, '')}
                      </span>
                      {authorHandle && (
                        <span className="text-[13px] text-white/40 font-medium truncate min-w-0">
                          {authorHandle.startsWith('@') ? authorHandle : `@${authorHandle}`}
                        </span>
                      )}
                      <span className="text-white/25 text-[13px] shrink-0">·</span>
                      <time className="text-[13px] text-white/40 font-medium tabular-nums shrink-0">
                        {formatRelative(item.createdAt)}
                      </time>
                      <span className="ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#161412] border border-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-white/45">
                        <Globe size={11} className="text-[#F59E0B]" />
                        Nostr
                      </span>
                    </div>

                    {item.content ? (
                      <p className="mt-1.5 text-[14px] sm:text-[15px] leading-relaxed text-white/[0.88] font-satoshi whitespace-pre-wrap break-words [overflow-wrap:anywhere] m-0 max-w-full">
                        {truncateMomentBody(item.content)}
                      </p>
                    ) : item.kind === 7 ? (
                      <p className="mt-1.5 text-[14px] text-white/60 font-satoshi italic m-0">
                        Reacted {item.reactionEmoji || '❤️'} to note #{item.targetId.slice(0, 8)}…
                      </p>
                    ) : null}

                    {/* Image Media Grid */}
                    {item.images.length > 0 && (
                      <div className={`mt-3 w-full max-w-full h-[160px] rounded-xl overflow-hidden border border-white/[0.06] bg-[#000] grid ${item.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2 gap-0.5'} relative`}>
                        {item.images.slice(0, 2).map((img, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={img} alt="" className="w-full h-full max-w-full object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Interaction Strip */}
                <div className="px-4 pb-3.5 pt-0 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {(() => {
                    const likesCount = engagement.likeCount[item.targetId] ?? (item.kind === 7 ? 1 : 0);
                    const repliesCount = engagement.replyCount[item.targetId] ?? (item.kind === 1 && activeTab === 'replies' ? 1 : 0);
                    const repostsCount = engagement.repostCount[item.targetId] ?? (item.isRepost ? 1 : 0);
                    const zapsCount = engagement.zapCount[item.targetId] ?? (item.kind === 9735 ? 1 : 0);

                    return (
                      <div className="grid grid-cols-4 gap-0.5 rounded-2xl border border-white/[0.08] bg-[#161412] p-1">
                        <button
                          type="button"
                          onClick={openItem}
                          className="flex items-center justify-center gap-1.5 min-h-[36px] rounded-xl text-white/60 hover:text-[#60A5FA] hover:bg-white/[0.04] transition-colors"
                          title="Reply"
                        >
                          <MessageCircle size={15} />
                          {repliesCount > 0 && (
                            <span className="text-[11px] font-mono font-bold tabular-nums text-white/70">
                              {repliesCount}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (isVaultLocked || !identity) {
                              toast.error('Unlock vault to repost on Nostr');
                              void unlockAndLoad();
                              return;
                            }
                            try {
                              setEngagement(prev => ({
                                ...prev,
                                repostCount: { ...prev.repostCount, [item.targetId]: (prev.repostCount[item.targetId] || 0) + 1 }
                              }));
                              await repostMoment({
                                source: 'nostr',
                                id: item.targetId,
                                userId: user?.$id,
                                privateKeyBytes: identity.privateKeyBytes,
                                nsec: identity.nsec,
                                rootPubkey: item.authorPubkey,
                                nostrId: item.targetId,
                              });
                              toast.success('Reposted to Nostr!');
                            } catch (err: any) {
                              toast.error(err?.message || 'Failed to repost');
                            }
                          }}
                          className="flex items-center justify-center gap-1.5 min-h-[36px] rounded-xl text-white/60 hover:text-[#34D399] hover:bg-white/[0.04] transition-colors"
                          title="Repost"
                        >
                          <Repeat2 size={15} />
                          {repostsCount > 0 && (
                            <span className="text-[11px] font-mono font-bold tabular-nums text-white/70">
                              {repostsCount}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (isVaultLocked || !identity) {
                              toast.error('Unlock vault to like on Nostr');
                              void unlockAndLoad();
                              return;
                            }
                            try {
                              setEngagement(prev => ({
                                ...prev,
                                likeCount: { ...prev.likeCount, [item.targetId]: (prev.likeCount[item.targetId] || 0) + 1 }
                              }));
                              await toggleMomentLike({
                                source: 'nostr',
                                id: item.targetId,
                                userId: user?.$id,
                                contentSnippet: item.content?.slice(0, 80),
                                privateKeyBytes: identity.privateKeyBytes,
                                nsec: identity.nsec,
                                rootPubkey: item.authorPubkey,
                                nostrId: item.targetId,
                              });
                              toast.success('Liked!');
                            } catch (err: any) {
                              toast.error(err?.message || 'Failed to like');
                            }
                          }}
                          className="flex items-center justify-center gap-1.5 min-h-[36px] rounded-xl text-white/60 hover:text-[#EC4899] hover:bg-white/[0.04] transition-colors"
                          title="Like"
                        >
                          <Heart size={15} />
                          {likesCount > 0 && (
                            <span className="text-[11px] font-mono font-bold tabular-nums text-white/70">
                              {likesCount}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openUnifiedDrawer('zap', {
                              targetId: item.targetId,
                              source: 'nostr',
                              targetKind: 'moment',
                              targetPubkey: item.authorPubkey,
                              authorName: authorName,
                              onZapSuccess: (amount: number) => {
                                setEngagement(prev => ({
                                  ...prev,
                                  zapCount: { ...prev.zapCount, [item.targetId]: (prev.zapCount[item.targetId] || 0) + 1 }
                                }));
                              },
                            });
                          }}
                          className="flex items-center justify-center gap-1.5 min-h-[36px] rounded-xl text-white/60 hover:text-[#F59E0B] hover:bg-white/[0.04] transition-colors"
                          title="Zap"
                        >
                          <Zap size={15} />
                          {zapsCount > 0 && (
                            <span className="text-[11px] font-mono font-bold tabular-nums text-white/70">
                              {zapsCount}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );

}


