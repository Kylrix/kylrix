'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, 
  ExternalLink, 
  Globe, 
  Copy, 
  Check, 
  MessageSquare,
  MessageCircle,
  Heart,
  Zap,
  Repeat2,
  Share2,
  Edit3,
  Settings,
  ShieldCheck,
  UserPlus,
  UserCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { NostrRelayPool, type NostrEvent } from '@/lib/nostr/nostr';
import { getNostrReadRelays } from '@/lib/connect/feed-settings';
import { extractPostImages, truncateMomentBody } from '@/lib/connect/moment-media';
import { bytesToNpub, hexToBytes, npubToBytes, bytesToHex } from '@/lib/nostr/crypto';
import { getCachedNostrProfile, queueNostrProfileFetch } from '@/lib/nostr/metadata';
import { fetchNostrEngagement } from '@/lib/nostr/thread';
import { fetchNostrEventsByIds } from '@/lib/nostr/user-activity';
import { useAuth } from '@/context/auth/AuthContext';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { toggleMomentLike, repostMoment } from '@/lib/connect/moment-engagement';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
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

export interface UnifiedProfileViewProps {
  userId?: string;
  username?: string;
  name?: string;
  avatar?: string;
  npub?: string;
  pubkey?: string;
  bio?: string;
  source?: 'ecosystem' | 'nostr';
  initialProfile?: any;
  onClose?: () => void;
}

export function UnifiedProfileView({
  userId,
  username,
  name,
  avatar,
  npub: initialNpub,
  pubkey: initialPubkey,
  bio,
  source = 'ecosystem',
  initialProfile,
  onClose,
}: UnifiedProfileViewProps) {
  const { user } = useAuth();
  const { identity, isVaultLocked, unlockAndLoad } = useNostrIdentity();
  const { open: openUnifiedDrawer } = useUnifiedDrawer();
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const router = useRouter();

  const [resolvedNpub, setResolvedNpub] = useState<string | null>(initialNpub || null);
  const [resolvedPubkey, setResolvedPubkey] = useState<string | null>(initialPubkey || null);
  const [resolvedProfile, setResolvedProfile] = useState<{ 
    name?: string; 
    username?: string; 
    avatar?: string; 
    bio?: string;
    links?: Array<{ title?: string; url: string }>;
    createdAt?: string;
  }>({
    name: name || initialProfile?.displayName || initialProfile?.name,
    username: username || initialProfile?.username,
    avatar: avatar || initialProfile?.avatar || initialProfile?.avatarUrl,
    bio: bio || initialProfile?.bio,
    links: initialProfile?.preferences?.links || [],
    createdAt: initialProfile?.$createdAt || initialProfile?.createdAt,
  });

  const [nostrPosts, setNostrPosts] = useState<NostrEvent[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
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
  const [parentEvents, setParentEvents] = useState<Record<string, NostrEvent>>({});

  const currentUserId = user?.$id;
  const isOwnProfile = Boolean(
    (currentUserId && userId && currentUserId === userId) ||
    (user?.name && username && user.name.toLowerCase() === username.toLowerCase()) ||
    (user?.prefs?.username && username && user.prefs.username.toLowerCase() === username.toLowerCase())
  );

  // Derive hex/npub pairs
  useEffect(() => {
    if (initialPubkey && !resolvedNpub) {
      try {
        setResolvedNpub(bytesToNpub(hexToBytes(initialPubkey)));
      } catch {}
    }
  }, [initialPubkey, resolvedNpub]);

  useEffect(() => {
    if (initialNpub && !resolvedPubkey) {
      try {
        setResolvedPubkey(bytesToHex(npubToBytes(initialNpub)));
      } catch {}
    }
  }, [initialNpub, resolvedPubkey]);

  // Lookup profile by userId or username from local DB / LocalEngine
  useEffect(() => {
    let cancelled = false;
    const lookup = async () => {
      try {
        if (userId) {
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          const localIdentity = await LocalEngine.cacheGet<any>(`identity:${userId}`).catch(() => null);
          if (localIdentity && !cancelled) {
            const storedNpub = localIdentity.nostrNpub || localIdentity.npub || (localIdentity.publicKey?.startsWith('npub') ? localIdentity.publicKey : undefined);
            const storedPubkey = localIdentity.nostrPubkey || localIdentity.pubkey || (localIdentity.publicKey && !localIdentity.publicKey.startsWith('npub') ? localIdentity.publicKey : undefined);
            if (storedNpub && !resolvedNpub) setResolvedNpub(storedNpub);
            if (storedPubkey && !resolvedPubkey) setResolvedPubkey(storedPubkey);
            setResolvedProfile(prev => ({
              name: prev.name || localIdentity.displayName || localIdentity.name,
              username: prev.username || localIdentity.username,
              avatar: prev.avatar || localIdentity.avatar || localIdentity.avatarUrl,
              bio: prev.bio || localIdentity.bio,
              links: prev.links?.length ? prev.links : localIdentity.links,
              createdAt: prev.createdAt || localIdentity.createdAt,
            }));
            return;
          }

          const { UsersService } = await import('@/lib/services/users');
          const prof = await UsersService.getProfileById(userId).catch(() => null);
          if (cancelled || !prof) return;
          const storedNpub = (prof as any).nostrNpub || (prof as any).npub;
          const storedPubkey = (prof as any).nostrPubkey || (prof as any).pubkey;
          if (storedNpub && !resolvedNpub) setResolvedNpub(storedNpub);
          if (storedPubkey && !resolvedPubkey) setResolvedPubkey(storedPubkey);
          setResolvedProfile(prev => ({
            name: prev.name || prof.displayName || prof.name,
            username: prev.username || prof.username,
            avatar: prev.avatar || prof.avatar || prof.avatarUrl,
            bio: prev.bio || prof.bio,
            createdAt: prev.createdAt || (prof as any).$createdAt,
          }));
        } else if (username && !resolvedPubkey && !resolvedNpub) {
          const { UsersService } = await import('@/lib/services/users');
          const prof = await UsersService.getProfile(username).catch(() => null);
          if (cancelled || !prof) return;
          const storedNpub = (prof as any).nostrNpub || (prof as any).npub;
          const storedPubkey = (prof as any).nostrPubkey || (prof as any).pubkey;
          if (storedNpub) setResolvedNpub(storedNpub);
          if (storedPubkey) setResolvedPubkey(storedPubkey);
          setResolvedProfile(prev => ({
            name: prev.name || prof.displayName || prof.name,
            username: prev.username || prof.username,
            avatar: prev.avatar || prof.avatar || prof.avatarUrl,
            bio: prev.bio || prof.bio,
            createdAt: prev.createdAt || (prof as any).$createdAt,
          }));
        }
      } catch {}
    };
    lookup();
    return () => { cancelled = true; };
  }, [userId, username, resolvedNpub, resolvedPubkey]);

  // Check Follow status
  useEffect(() => {
    const targetKey = resolvedNpub || resolvedPubkey || userId;
    if (!targetKey) return;
    import('@/lib/services/LocalEngine').then(({ LocalEngine }) => {
      LocalEngine.cacheGet<string[]>('kylrix:follows').then((follows) => {
        if (follows && Array.isArray(follows)) {
          setIsFollowing(follows.includes(targetKey));
        }
      }).catch(() => {});
    });
  }, [userId, resolvedNpub, resolvedPubkey]);

  // Fetch Nostr Activity
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
        console.warn('[UnifiedProfile] Failed to fetch Nostr activity:', err);
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

  // Fetch live engagement counts
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
        if (ev.kind === 6) return true;
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

  // Fetch Parent Events for threaded replies view
  useEffect(() => {
    if (!unpackedReplies.length) return;
    let cancelled = false;

    const parentIdsToFetch = Array.from(new Set(
      unpackedReplies
        .map(r => r.targetId)
        .filter(id => id && id !== r.id && !parentEvents[id])
    ));

    if (!parentIdsToFetch.length) return;

    void (async () => {
      try {
        const fetchedMap = await fetchNostrEventsByIds(parentIdsToFetch, 3500);
        if (!cancelled && fetchedMap.size > 0) {
          const newEntries: Record<string, NostrEvent> = {};
          const parentPubkeys: string[] = [];
          fetchedMap.forEach((ev, id) => {
            newEntries[id] = ev;
            if (ev.pubkey) parentPubkeys.push(ev.pubkey);
          });
          setParentEvents(prev => ({ ...prev, ...newEntries }));
          if (parentPubkeys.length) {
            void queueNostrProfileFetch(Array.from(new Set(parentPubkeys)));
          }
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [unpackedReplies, parentEvents]);

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

  const handleToggleFollow = async () => {
    const targetKey = resolvedNpub || resolvedPubkey || userId;
    if (!targetKey) return;
    try {
      const { LocalEngine } = await import('@/lib/services/LocalEngine');
      const follows = (await LocalEngine.cacheGet<string[]>('kylrix:follows')) || [];
      const nextFollows = isFollowing ? follows.filter(k => k !== targetKey) : [...follows, targetKey];
      await LocalEngine.cacheSet('kylrix:follows', nextFollows);
      setIsFollowing(!isFollowing);
      toast.success(isFollowing ? 'Unfollowed' : 'Following');
      window.dispatchEvent(new CustomEvent('kylrix:follows-updated', { detail: nextFollows }));
    } catch {
      toast.error('Could not update follow');
    }
  };

  const currentTabItems: UnpackedPost[] =
    activeTab === 'posts' ? unpackedPosts :
    activeTab === 'replies' ? unpackedReplies :
    activeTab === 'likes' ? unpackedLikes : unpackedZaps;

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-full h-[100dvh] max-h-[100dvh] bg-[#161412] text-white overflow-hidden select-none animate-in fade-in duration-150">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.08] bg-[#161412] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-xs font-mono font-bold text-white/70 truncate">
            {displayHandle || displayName}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Own Profile Actions */}
          {isOwnProfile ? (
            <>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-[#6366F1] text-white hover:bg-[#5254D8] active:scale-95 transition-all shadow-[0_4px_12px_rgba(99,102,241,0.25)] cursor-pointer"
                title="Edit"
                aria-label="Edit"
              >
                <Edit3 size={14} />
                <span className="hidden sm:inline">Edit</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onClose) onClose();
                  router.push('/settings');
                }}
                className="p-2 rounded-xl bg-[#0A0908] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                title="Settings"
                aria-label="Settings"
              >
                <Settings size={15} />
              </button>
            </>
          ) : (
            <>
              {/* Other User Actions */}
              <button
                type="button"
                onClick={handleToggleFollow}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  isFollowing
                    ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30'
                    : 'bg-[#F59E0B] text-black hover:bg-[#d97706]'
                }`}
                title={isFollowing ? 'Following' : 'Follow'}
                aria-label={isFollowing ? 'Following' : 'Follow'}
              >
                {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
                <span className="hidden sm:inline">{isFollowing ? 'Following' : 'Follow'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  openUnifiedDrawer('new-chat', { recipientId: userId, recipientName: displayName });
                }}
                className="p-2 rounded-xl bg-[#0A0908] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                title="Direct Message"
                aria-label="Direct Message"
              >
                <MessageSquare size={15} />
              </button>

              <button
                type="button"
                onClick={() => {
                  openUnifiedDrawer('zap', {
                    recipientName: displayName,
                    recipientNpub: resolvedNpub,
                    recipientPubkey: resolvedPubkey,
                  });
                }}
                className="p-2 rounded-xl bg-[#0A0908] border border-white/[0.08] text-amber-400 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
                title="Tip / Zap"
                aria-label="Tip / Zap"
              >
                <Zap size={15} fill="currentColor" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              const url = window.location.origin + (displayHandle ? `/u/${displayHandle.replace(/^@/, '')}` : `/moment/profile/${resolvedNpub || resolvedPubkey || userId}`);
              navigator.clipboard.writeText(url);
              toast.success('Link copied!');
            }}
            className="p-2 rounded-xl bg-[#0A0908] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Share"
            aria-label="Share"
          >
            <Share2 size={15} />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/[0.06] hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer ml-1"
              title="Close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 overflow-y-auto min-h-0 select-text bg-[#161412]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Identity Card (OpenBricks 4.0 Inset Surface) */}
          <div className="rounded-3xl bg-[#0A0908] border border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                {resolvedProfile.avatar ? (
                  <img 
                    src={resolvedProfile.avatar} 
                    alt={displayName} 
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-white/10 shadow-md"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-[#EC4899] to-[#8B5CF6] flex items-center justify-center text-white text-2xl font-black font-clash shadow-md">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-[#0A0908]" />
              </div>

              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold font-clash text-white tracking-tight truncate">
                  {displayName}
                </h1>
                <p className="text-xs sm:text-sm font-mono text-white/50 truncate mt-0.5">
                  {displayHandle}
                </p>
              </div>
            </div>

            {/* Bio */}
            {resolvedProfile.bio && (
              <p className="text-sm text-white/80 leading-relaxed font-satoshi">
                {resolvedProfile.bio}
              </p>
            )}

            {/* Keys & ID Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.06]">
              {resolvedNpub && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(resolvedNpub, 'npub')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161412] border border-white/[0.08] hover:border-white/20 text-xs font-mono text-white/70 transition-colors cursor-pointer"
                  title="Copy npub"
                >
                  <Globe size={13} className="text-[#A855F7]" />
                  <span>{resolvedNpub.slice(0, 10)}…{resolvedNpub.slice(-4)}</span>
                  {copiedKey === 'npub' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-white/40" />}
                </button>
              )}

              {userId && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(userId, 'Ecosystem ID')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161412] border border-white/[0.08] hover:border-white/20 text-xs font-mono text-white/70 transition-colors cursor-pointer"
                  title="Copy ID"
                >
                  <ShieldCheck size={13} className="text-[#10B981]" />
                  <span>ID: {userId.slice(0, 8)}…</span>
                  {copiedKey === 'Ecosystem ID' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-white/40" />}
                </button>
              )}
            </div>
          </div>

          {/* Activity Tabs */}
          <div className="space-y-4">
            <nav className="p-1.5 rounded-2xl bg-[#0A0908] border border-white/[0.08] flex gap-1 shadow-sm">
              {(
                [
                  { id: 'posts', label: 'Posts', count: unpackedPosts.length },
                  { id: 'replies', label: 'Replies', count: unpackedReplies.length },
                  { id: 'likes', label: 'Likes', count: unpackedLikes.length },
                  { id: 'zaps', label: 'Zaps', count: unpackedZaps.length },
                ] as const
              ).map((t) => {
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                      active
                        ? 'bg-[#161412] text-white shadow-sm border border-white/10'
                        : 'text-white/50 hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    <span>{t.label}</span>
                    <span className={`ml-1 text-[10px] ${active ? 'text-white/80' : 'text-white/30'}`}>
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </nav>


            {/* Posts / Activity Stream */}
            <div className="space-y-3">
              {loadingPosts && nostrPosts.length === 0 ? (
                <div className="py-12 text-center text-white/40 text-xs font-mono animate-pulse">
                  Querying Nostr relays for activity…
                </div>
              ) : currentTabItems.length === 0 ? (
                <div className="py-12 text-center text-white/40 text-xs font-mono">
                  No {activeTab} found on relays
                </div>
              ) : (
                currentTabItems.map((post) => {
                  const targetId = post.targetId;
                  const likeCount = engagement.likeCount[targetId] || 0;
                  const replyCount = engagement.replyCount[targetId] || 0;
                  const zapCount = engagement.zapCount[targetId] || 0;
                  const repostCount = engagement.repostCount[targetId] || 0;
                  const parentNote = activeTab === 'replies' && parentEvents[targetId];

                  return (
                    <div
                      key={post.id}
                      className="rounded-[22px] bg-[#0A0908] border border-white/[0.08] p-4 sm:p-5 space-y-3.5 hover:border-white/15 transition-all shadow-sm"
                    >
                      {/* Context Banner */}
                      {post.isRepost && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 font-mono pb-1 border-b border-white/[0.04]">
                          <Repeat2 size={13} />
                          <span>{post.repostAuthor || displayName} reposted</span>
                        </div>
                      )}
                      {post.kind === 7 && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-pink-400 font-mono pb-1 border-b border-white/[0.04]">
                          <Heart size={13} fill="currentColor" />
                          <span>{displayName} liked</span>
                        </div>
                      )}
                      {post.kind === 9735 && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 font-mono pb-1 border-b border-white/[0.04]">
                          <Zap size={13} fill="currentColor" />
                          <span>{displayName} zapped</span>
                        </div>
                      )}

                      {/* Threaded Parent Note */}
                      {activeTab === 'replies' && parentNote && (
                        <div className="flex gap-3 relative pb-2">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/60 text-xs font-bold shrink-0">
                              {parentNote.pubkey.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="w-0.5 min-h-[22px] bg-white/20 my-1 rounded-full flex-1" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <span className="text-xs font-bold text-white/60">
                              @{parentNote.pubkey.slice(0, 8)}…
                            </span>
                            <p className="text-xs text-white/70 line-clamp-2">
                              {truncateMomentBody(parentNote.content, 120)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Header */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center text-white text-xs font-bold font-clash shrink-0">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm font-bold text-white truncate">{displayName}</span>
                              <span className="text-xs text-white/40 truncate font-mono">{displayHandle}</span>
                            </div>
                            <span className="text-[10px] text-white/30 font-mono">
                              {formatRelative(post.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      {post.content && (
                        <p className="text-sm text-white/90 leading-relaxed break-words whitespace-pre-wrap font-satoshi">
                          {post.content}
                        </p>
                      )}

                      {/* Media Attachments */}
                      {post.images.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 rounded-2xl overflow-hidden border border-white/[0.06]">
                          {post.images.slice(0, 4).map((img, i) => (
                            <img
                              key={i}
                              src={img}
                              alt="Attachment"
                              className="w-full h-40 object-cover bg-white/5"
                              loading="lazy"
                            />
                          ))}
                        </div>
                      )}

                      {/* Interactive Action Strip */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-white/40 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            openUnifiedDrawer('moment-composer', {
                              replyToId: post.targetId,
                              replyToPubkey: post.authorPubkey,
                            });
                          }}
                          className="flex items-center gap-1.5 hover:text-[#6366F1] transition-colors cursor-pointer"
                        >
                          <MessageCircle size={15} />
                          <span>{replyCount || ''}</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await repostMoment(post.targetId, post.authorPubkey);
                            if (ok) toast.success('Reposted to Nostr');
                          }}
                          className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors cursor-pointer"
                        >
                          <Repeat2 size={15} />
                          <span>{repostCount || ''}</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await toggleMomentLike(post.targetId, post.authorPubkey, false);
                            if (ok) toast.success('Liked');
                          }}
                          className="flex items-center gap-1.5 hover:text-pink-400 transition-colors cursor-pointer"
                        >
                          <Heart size={15} />
                          <span>{likeCount || ''}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            openUnifiedDrawer('zap', {
                              targetEventId: post.targetId,
                              recipientPubkey: post.authorPubkey,
                              recipientName: displayName,
                            });
                          }}
                          className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer"
                        >
                          <Zap size={15} />
                          <span>{zapCount || ''}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onProfileUpdated={(updated) => {
            setResolvedProfile(prev => ({
              ...prev,
              name: updated.name || prev.name,
              avatar: updated.avatar || prev.avatar,
              bio: updated.bio || prev.bio,
            }));
            setIsEditModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
