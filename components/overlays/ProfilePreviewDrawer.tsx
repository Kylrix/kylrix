'use client';

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
  Repeat,
  Sparkles
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { NostrRelayPool, type NostrEvent } from '@/lib/nostr/nostr';
import { getNostrReadRelays } from '@/lib/connect/feed-settings';
import { extractPostImages, truncateMomentBody } from '@/lib/connect/moment-media';
import { bytesToNpub, hexToBytes, npubToBytes, bytesToHex } from '@/lib/nostr/crypto';
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
            }
          }
        });

        pool.subscribe('profile-feed', [{ kinds: [1, 6, 7, 9735], authors: [hex], limit: 60 }]);
        pool.subscribe('profile-meta', [{ kinds: [0], authors: [hex], limit: 1 }]);
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

  // Tab Filtering
  const posts = useMemo(() => {
    return nostrPosts.filter((ev) => {
      if (ev.kind === 6) return true; // Reposts shown in posts
      if (ev.kind === 1) {
        const eTags = ev.tags?.filter(t => t[0] === 'e') || [];
        return eTags.length === 0 || eTags.every(t => t[3] === 'mention');
      }
      return false;
    });
  }, [nostrPosts]);

  const replies = useMemo(() => {
    return nostrPosts.filter((ev) => {
      if (ev.kind === 1) {
        const eTags = ev.tags?.filter(t => t[0] === 'e') || [];
        return eTags.length > 0 && eTags.some(t => t[3] !== 'mention');
      }
      return false;
    });
  }, [nostrPosts]);

  const likes = useMemo(() => {
    return nostrPosts.filter((ev) => ev.kind === 7);
  }, [nostrPosts]);

  const zaps = useMemo(() => {
    return nostrPosts.filter((ev) => ev.kind === 9735);
  }, [nostrPosts]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`Copied ${label}`);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const displayName = resolvedProfile.name || name || username || (resolvedNpub ? `Nostr ${resolvedNpub.slice(0, 10)}…` : 'Kylrix User');
  const displayHandle = resolvedProfile.username || username || (resolvedNpub ? `@${resolvedNpub.slice(0, 12)}…` : '');

  const currentTabItems = activeTab === 'posts' ? posts : activeTab === 'replies' ? replies : activeTab === 'likes' ? likes : zaps;

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
            Posts {posts.length > 0 && `(${posts.length})`}
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
            Replies {replies.length > 0 && `(${replies.length})`}
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
            Likes {likes.length > 0 && `(${likes.length})`}
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
            Zaps {zaps.length > 0 && `(${zaps.length})`}
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
            const { text: postBody, images: postImages } = extractPostImages(item.content, item.tags);
            const targetNoteTag = item.tags?.find((t) => t[0] === 'e');
            const targetId = targetNoteTag ? targetNoteTag[1] : item.id;
            
            const openItem = () => {
              onClose();
              router.push(`/moment/nostr_${targetId}`);
            };

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={openItem}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItem(); } }}
                className="rounded-xl bg-[#0A0908] border border-white/[0.04] p-3.5 space-y-2 hover:border-[#F59E0B]/30 hover:bg-[#161412] transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-white/40">
                  <span className="flex items-center gap-1.5">
                    {item.kind === 1 && activeTab === 'posts' && <MessageSquare size={12} className="text-[#F59E0B]" />}
                    {item.kind === 1 && activeTab === 'replies' && <MessageCircle size={12} className="text-[#6366F1]" />}
                    {item.kind === 6 && <Repeat size={12} className="text-[#10B981]" />}
                    {item.kind === 7 && <Heart size={12} className="text-[#EC4899]" />}
                    {item.kind === 9735 && <Zap size={12} className="text-[#F59E0B]" />}
                    <span className="capitalize">
                      {item.kind === 1 && activeTab === 'posts' ? 'Post' :
                       item.kind === 1 && activeTab === 'replies' ? 'Reply' :
                       item.kind === 6 ? 'Repost' :
                       item.kind === 7 ? 'Reaction' :
                       item.kind === 9735 ? 'Zap' : `Kind ${item.kind}`}
                    </span>
                  </span>
                  <span>{formatRelative(item.created_at)}</span>
                </div>

                {item.kind === 7 && (
                  <p className="text-xs text-[#EC4899] font-mono m-0">
                    Reacted {item.content && item.content !== '+' ? item.content : '❤️'} to note {targetId.slice(0, 8)}…
                  </p>
                )}

                {item.kind === 9735 && (
                  <p className="text-xs text-[#F59E0B] font-mono m-0">
                    ⚡ Lightning Zap on note {targetId ? `${targetId.slice(0, 8)}…` : ''}
                  </p>
                )}

                {postBody && item.kind !== 7 && (
                  <p className="text-xs leading-relaxed text-white/85 font-satoshi whitespace-pre-wrap break-words m-0">
                    {truncateMomentBody(postBody)}
                  </p>
                )}

                {postImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-1 rounded-lg overflow-hidden max-h-40">
                    {postImages.slice(0, 2).map((img, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={img} alt="" className="w-full h-28 object-cover rounded-md" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

