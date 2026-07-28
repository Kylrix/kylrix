'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNostrFeed } from '@/hooks/useNostrFeed';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { resolveNostrPubkeysAction } from '@/lib/actions/secure-ops';
import { bytesToNpub, hexToBytes } from '@/lib/tmp/crypto';
import { SocialService } from '@/lib/services/social';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useAuth } from '@/context/auth/AuthContext';
import { Heart, MessageCircle, Lock, Sparkles, Globe, Share2, Shield, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

export interface UnifiedFeedItem {
  id: string;
  source: 'ecosystem' | 'nostr';
  authorName: string;
  authorAvatar?: string;
  authorUsername?: string;
  isEcosystemUser: boolean;
  content: string;
  createdAt: number; // Unix timestamp ms
  rawEvent?: any;
  likesCount?: number;
  pulsesCount?: number;
  repliesCount?: number;
}

interface ExtractedMedia {
  images: string[];
  videos: string[];
  audios: string[];
  webLinks: string[];
  cleanText: string;
}

const MAX_IMAGES = 4;
const MAX_VIDEOS = 1;
const MAX_AUDIOS = 1;

function extractMediaAndCleanText(content: string): ExtractedMedia {
  if (!content) {
    return { images: [], videos: [], audios: [], webLinks: [], cleanText: '' };
  }

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = content.match(urlRegex) || [];
  const seen = new Set<string>();

  const images: string[] = [];
  const videos: string[] = [];
  const audios: string[] = [];
  const webLinks: string[] = [];

  matches.forEach((url) => {
    const trimmed = url.replace(/[),.;!?]+$/g, '');
    if (seen.has(trimmed)) return;
    seen.add(trimmed);

    const cleanUrl = trimmed.split('?')[0].toLowerCase();

    if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(cleanUrl)) {
      if (images.length < MAX_IMAGES) images.push(trimmed);
    } else if (/\.(mp4|webm|mov)$/i.test(cleanUrl)) {
      if (videos.length < MAX_VIDEOS) videos.push(trimmed);
    } else if (/\.(mp3|wav|ogg|m4a)$/i.test(cleanUrl)) {
      if (audios.length < MAX_AUDIOS) audios.push(trimmed);
    } else if (
      trimmed.includes('nostr.build/i/') ||
      trimmed.includes('void.cat/') ||
      trimmed.includes('imgur.com/') ||
      trimmed.includes('i.postimg.cc/') ||
      trimmed.includes('images.unsplash.com/')
    ) {
      if (images.length < MAX_IMAGES) images.push(trimmed);
    } else if (webLinks.length < 24) {
      webLinks.push(trimmed);
    }
  });

  let cleanText = content;
  matches.forEach((url) => {
    cleanText = cleanText.replace(url, '').trim();
  });
  cleanText = cleanText.replace(/\s+/g, ' ').trim();

  return { images, videos, audios, webLinks, cleanText };
}

export function NostrFeed() {
  const { user } = useAuth();
  const { isVaultLocked, unlockAndLoad } = useNostrIdentity();
  const { feed: nostrFeed, loading: nostrLoading } = useNostrFeed();

  const [ecosystemMoments, setEcosystemMoments] = useState<any[]>([]);
  const [resolvedProfiles, setResolvedProfiles] = useState<Record<string, { username: string; avatarUrl?: string }>>({});
  const [visibleCount, setVisibleCount] = useState(20);
  const observerRef = useRef<HTMLDivElement | null>(null);
  const resolvedProfilesRef = useRef(resolvedProfiles);

  useEffect(() => {
    resolvedProfilesRef.current = resolvedProfiles;
  }, [resolvedProfiles]);

  // 1. Load Ecosystem Moments (0ms Local Copy Hydration)
  const loadEcosystemMoments = useCallback(async () => {
    try {
      const cached = await LocalEngine.cacheGet<any[]>('f_moments_list');
      if (cached && cached.length > 0) {
        setEcosystemMoments(cached);
      }

      const liveRes = await SocialService.getFeed(user?.$id);
      const liveMoments = Array.isArray(liveRes) ? liveRes : (liveRes as any)?.rows || [];
      if (liveMoments.length > 0) {
        setEcosystemMoments(liveMoments);
        await LocalEngine.cacheSet('f_moments_list', liveMoments);
      }
    } catch (err) {
      console.warn('[MomentsFeed] Failed to load ecosystem moments:', err);
    }
  }, [user]);

  useEffect(() => {
    void loadEcosystemMoments();
  }, [loadEcosystemMoments]);

  // 2. Resolve Nostr Pubkeys to Ecosystem Usernames
  useEffect(() => {
    if (nostrFeed.length === 0) return;

    const unresolvedNpubs = nostrFeed
      .map((event) => {
        try {
          return bytesToNpub(hexToBytes(event.pubkey));
        } catch {
          return null;
        }
      })
      .filter((n): n is string => !!n && !resolvedProfilesRef.current[n]);

    if (unresolvedNpubs.length === 0) return;

    let cancelled = false;
    resolveNostrPubkeysAction(unresolvedNpubs).then((res) => {
      if (cancelled || !res || Object.keys(res).length === 0) return;
      setResolvedProfiles((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [key, value] of Object.entries(res)) {
          if (!next[key]) {
            next[key] = value;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [nostrFeed]);

  // 3. Combine Ecosystem Moments & Nostr Feed into Unified Stream
  const unifiedStream = useMemo<UnifiedFeedItem[]>(() => {
    const items: UnifiedFeedItem[] = [];

    // Add Ecosystem local copy moments
    ecosystemMoments.forEach((m) => {
      const rawDateStr = m.createdAt || m.$createdAt;
      const createdAtMs = rawDateStr ? new Date(rawDateStr).getTime() : 0;

      items.push({
        id: `eco_${m.$id || m.id}`,
        source: 'ecosystem',
        authorName: m.userName || m.user?.name || m.username || 'Kylrix Engineer',
        authorUsername: m.username || m.user?.username || 'engineer',
        authorAvatar: m.userAvatar || m.user?.avatarUrl,
        isEcosystemUser: true,
        content: m.caption || m.content || '',
        createdAt: createdAtMs,
        likesCount: m.likeCount || 0,
        pulsesCount: m.pulseCount || 0,
        repliesCount: m.replyCount || 0,
        rawEvent: m,
      });
    });

    // Add Nostr feed posts
    nostrFeed.forEach((event) => {
      let authorName = `npub...${event.pubkey.slice(-8)}`;
      let isEco = false;
      try {
        const npubStr = bytesToNpub(hexToBytes(event.pubkey));
        if (resolvedProfiles[npubStr]) {
          authorName = `@${resolvedProfiles[npubStr].username}`;
          isEco = true;
        } else {
          authorName = `npub...${npubStr.slice(-8)}`;
        }
      } catch {
        authorName = `npub...${event.pubkey.slice(-8)}`;
      }

      items.push({
        id: `nostr_${event.id}`,
        source: 'nostr',
        authorName,
        authorAvatar: resolvedProfiles[authorName]?.avatarUrl,
        isEcosystemUser: isEco,
        content: event.content,
        createdAt: event.created_at * 1000,
        rawEvent: event,
      });
    });

    // Sort newest first
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }, [ecosystemMoments, nostrFeed, resolvedProfiles]);

  // 4. Smooth Infinite Scroll IntersectionObserver
  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 15, unifiedStream.length));
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [unifiedStream.length]);

  const displayedItems = unifiedStream.slice(0, visibleCount);

  return (
    <div className="w-full flex flex-col max-w-2xl mx-auto font-satoshi text-white select-none pb-12 bg-[#0A0908]">
      {/* Vault Unlock Banner if locked */}
      {isVaultLocked && (
        <div className="mb-4 bg-[#161412] border border-[#F59E0B]/20 rounded-3xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B]">
              <Lock size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white/90">Vault Key Encrypted</span>
              <span className="text-[11px] text-white/40">Unlock vault to sign & broadcast sovereign posts directly to Nostr relays.</span>
            </div>
          </div>
          <button
            onClick={unlockAndLoad}
            className="px-4 py-2 bg-[#F59E0B] hover:bg-amber-600 text-black font-extrabold text-xs rounded-xl"
          >
            Unlock Vault
          </button>
        </div>
      )}

      {/* Feed Stream — opaque gutters between cards (no shadow bleed / compositor gaps) */}
      <div className="flex flex-col gap-3 bg-[#0A0908]">
        {nostrLoading && unifiedStream.length === 0 ? (
          <div className="text-center py-16 text-white/40 flex flex-col items-center gap-3">
            <span className="animate-spin inline-block w-6 h-6 border-2 border-[#F59E0B] border-t-transparent rounded-full" />
            <p className="text-xs font-mono">Hydrating Moments & Nostr relays...</p>
          </div>
        ) : unifiedStream.length === 0 ? (
          <div className="text-center py-20 bg-[#161412] border border-white/5 rounded-3xl text-white/30 p-8">
            <Sparkles size={36} className="mx-auto text-[#F59E0B] mb-3 opacity-60" />
            <h4 className="text-base font-extrabold mb-1 font-clash text-white">No Moments Yet</h4>
            <p className="text-xs max-w-xs mx-auto text-white/40">
              Be the first to share an engineering update or workflow moment with the community!
            </p>
          </div>
        ) : (
          displayedItems.map((item) => <MomentCard key={item.id} item={item} />)
        )}
      </div>

      {/* Infinite Scroll Bottom Trigger Element */}
      {visibleCount < unifiedStream.length && (
        <div ref={observerRef} className="py-6 flex items-center justify-center text-white/40 gap-2">
          <span className="animate-spin w-4 h-4 border-2 border-[#F59E0B] border-t-transparent rounded-full" />
          <span className="text-xs font-mono">Loading more moments...</span>
        </div>
      )}
    </div>
  );
}

function MomentCard({ item }: { item: UnifiedFeedItem }) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);

  const media = useMemo(() => extractMediaAndCleanText(item.content), [item.content]);
  // JS truncate — never use CSS line-clamp (Chromium compositor tears at card gaps)
  const COLLAPSED_CHARS = 220;
  const isLong = media.cleanText.length > COLLAPSED_CHARS;
  const bodyText =
    !expanded && isLong
      ? `${media.cleanText.slice(0, COLLAPSED_CHARS).trimEnd()}…`
      : media.cleanText;
  const multiImage = media.images.length > 1;

  return (
    <article className="bg-[#161412] border border-white/10 rounded-3xl p-5 flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#F59E0B] p-0.5 shrink-0">
            <div className="w-full h-full bg-[#0A0908] rounded-[14px] flex items-center justify-center font-black font-mono text-xs text-[#F59E0B]">
              {item.authorName.replace('@', '').slice(0, 2).toUpperCase() || 'KY'}
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-white truncate">
                {item.authorName}
              </span>
              {item.isEcosystemUser && (
                <span className="px-2 py-0.5 rounded-md bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] font-bold border border-[#F59E0B]/20 shrink-0">
                  Kylrix User
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/40 font-mono mt-0.5">
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
              {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/5 text-[10px] font-mono text-white/50 flex items-center gap-1 shrink-0">
          {item.source === 'nostr' ? <Globe size={12} className="text-[#F59E0B]" /> : <Shield size={12} className="text-emerald-400" />}
          {item.source === 'nostr' ? 'Nostr' : 'Kylrix'}
        </span>
      </div>

      {media.cleanText && (
        <div className="min-w-0">
          <p className="text-sm text-white/90 leading-relaxed font-sans break-words">
            {bodyText}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="text-xs font-bold text-[#F59E0B] hover:underline mt-1.5 px-0.5"
            >
              {expanded ? 'Show less' : 'Show more...'}
            </button>
          )}
        </div>
      )}

      {/* Fixed aspect slots — images paint into reserved space (no layout jump / gap tear) */}
      {media.images.length > 0 && (
        <div className={`grid gap-2 ${multiImage ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {media.images.map((imgUrl, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setLightboxImg(imgUrl);
                setZoomScale(1);
              }}
              className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#121110] p-0 cursor-pointer ${
                multiImage ? 'aspect-square' : 'aspect-[16/10]'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgUrl}
                alt=""
                width={multiImage ? 400 : 800}
                height={multiImage ? 400 : 500}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: 0 }}
                loading="lazy"
                decoding="async"
                onLoad={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </button>
          ))}
        </div>
      )}

      {media.videos.length > 0 && (
        <div className="flex flex-col gap-2">
          {media.videos.map((vidUrl, i) => (
            <div key={i} className="relative w-full aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
              <video
                controls
                preload="none"
                src={vidUrl}
                className="absolute inset-0 w-full h-full object-contain bg-black"
              />
            </div>
          ))}
        </div>
      )}

      {media.audios.length > 0 && (
        <div className="flex flex-col gap-2">
          {media.audios.map((audUrl, i) => (
            <audio key={i} controls preload="none" src={audUrl} className="w-full rounded-xl bg-[#0A0908] p-1 border border-white/10" />
          ))}
        </div>
      )}

      <div className="flex items-center gap-6 border-t border-white/5 pt-3 text-white/40 text-xs select-none">
        <button
          onClick={() => toast.success('Pulse logged!')}
          className="flex items-center gap-1.5 hover:text-[#F59E0B] font-bold"
        >
          <Heart size={15} />
          <span>{item.likesCount || 0} Pulse</span>
        </button>
        <button className="flex items-center gap-1.5 hover:text-white font-bold">
          <MessageCircle size={15} />
          <span>{item.repliesCount || 0} Reply</span>
        </button>
        <button
          onClick={() => {
            if (navigator.share) {
              void navigator.share({ text: item.content });
            } else {
              void navigator.clipboard.writeText(item.content);
              toast.success('Copied moment link to clipboard');
            }
          }}
          className="flex items-center gap-1.5 hover:text-white font-bold"
        >
          <Share2 size={15} />
          <span>Share</span>
        </button>
      </div>

      {lightboxImg && (
        <div
          className="fixed inset-0 z-[99999] bg-[#0A0908]/95 flex items-center justify-center p-4"
          onClick={() => {
            setLightboxImg(null);
            setZoomScale(1);
          }}
        >
          <div
            className="relative w-full max-w-4xl max-h-[92vh] bg-[#161412] border border-[#34322F] rounded-3xl p-6 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
              <span className="text-xs font-bold text-white/80 font-mono">Image Preview</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoomScale((s) => Math.max(0.5, s - 0.25))}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white bg-white/5"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs font-mono text-white px-2">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  onClick={() => setZoomScale((s) => Math.min(4, s + 0.25))}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white bg-white/5"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  onClick={() => setZoomScale(1)}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white bg-white/5"
                  title="Reset Zoom"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  onClick={() => {
                    setLightboxImg(null);
                    setZoomScale(1);
                  }}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white bg-white/5"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center py-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImg}
                alt="Enlarged media"
                style={{ transform: `scale(${zoomScale})` }}
                className="max-h-[65vh] max-w-full object-contain rounded-2xl border border-white/10"
              />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

