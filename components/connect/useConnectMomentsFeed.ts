'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNostrFeed } from '@/hooks/useNostrFeed';
import { resolveNostrPubkeysAction } from '@/lib/actions/secure-ops';
import { bytesToNpub, hexToBytes } from '@/lib/nostr/crypto';
import { fetchNostrEngagement } from '@/lib/nostr/thread';
import { SocialService } from '@/lib/services/social';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useAuth } from '@/context/auth/AuthContext';
import { getCachedNostrProfile, queueNostrProfileFetch } from '@/lib/nostr/metadata';
import { parseInterestsWithWeights } from '@/lib/ecosystem/intelligence-topics';

export interface UnifiedFeedItem {
  id: string;
  source: 'ecosystem' | 'nostr';
  authorName: string;
  authorAvatar?: string;
  authorUsername?: string;
  isEcosystemUser: boolean;
  content: string;
  createdAt: number;
  rawEvent?: any;
  likesCount?: number;
  pulsesCount?: number;
  repliesCount?: number;
  zapsCount?: number;
  repostsCount?: number;
  isLiked?: boolean;
  isSeen?: boolean;
  /** 0–100 quality rank; lower = worse; used for feed ordering. Default 50. */
  rank?: number;
}

const PAGE_SIZE = 16;
const UNIFIED_CACHE = 'f_unified_moments_feed';
const MAX_FEED = 240;

// Memory mirrors for instant paint (0ms) before IndexedDB resolves
let memoryUnified: UnifiedFeedItem[] | null = null;
let memoryEco: any[] | null = null;

const SPAM_KEYWORDS = [
  'presale', 'pump', 'solana contract', 'airdrop claim', 'moonshot', '100x gem',
  'free btc', 't.me/', 'pumpex', 'ca:', 'buy now!', '0x', '$pepe', '$wif',
  'airdrop', 'giveaway', 'join channel', 'telegram.me', 'casin', 'bonus claim',
  'free spin', 'crypto signal', 'whatsapp', 'dm to buy', 'whitelist', 'mint now',
  'presale is live', 'private key', 'seed phrase', 'nigger', 'faggot', 'kike', 'retard'
];

/** Returns false = hide completely, { rank } = show but with adjusted rank (0–100). */
export function sanitizeFeedContent(text: string, author: string): false | { rank: number } {
  const trimmed = (text || '').trim();
  const hay = `${trimmed} ${author || ''}`.toLowerCase();

  // Hard blocklist keywords
  if (SPAM_KEYWORDS.some((w) => hay.includes(w))) return false;

  // Too short to convey anything meaningful
  if (trimmed.length < 3) return false;

  // Strip Nostr metadata markers (npub/note refs, URLs) from content to assess actual prose
  const stripped = trimmed
    .replace(/nostr:[a-z0-9]+/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // ── HASHTAG-ONLY FILTER ──────────────────────────────────────────────────
  // Post whose entire visible body is one or more hashtags (and whitespace)
  const isHashtagsOnly = stripped.length > 0 && /^(#\S+\s*)+$/.test(stripped);
  if (isHashtagsOnly) return false;

  // ── SYMBOLS / RANDOM NUMBERS ONLY ───────────────────────────────────────
  // Post whose stripped body has no recognisable word characters at all —
  // just punctuation, emoji sequences, raw numbers, arrows, etc.
  // We require at least one Latin/Unicode letter in a run of 2+ chars.
  const hasActualWords = /[a-zA-Z\u00C0-\u024F\u0400-\u04FF\u4E00-\u9FFF]{2,}/.test(stripped);
  if (stripped.length > 0 && !hasActualWords) return false;

  // ── HASHTAG SPAM DERANK (5+) ─────────────────────────────────────────────
  const hashtagCount = (trimmed.match(/#\S+/g) || []).length;
  if (hashtagCount >= 5) return { rank: 20 };
  if (hashtagCount >= 3) return { rank: 40 };

  // ── LINK-ONLY POSTS (no prose, just a URL or two) ───────────────────────
  const isLinksOnly = stripped.length === 0 && /https?:\/\//.test(trimmed);
  if (isLinksOnly) return { rank: 30 };

  return { rank: 50 };
}

function buildItems(
  ecosystemMoments: any[],
  nostrFeed: { id: string; pubkey: string; content: string; created_at: number; tags?: string[][] }[],
  resolvedProfiles: Record<string, { username: string; avatarUrl?: string }>,
  nostrEngagement: { 
    replyCount: Record<string, number>; 
    likeCount: Record<string, number>;
    zapCount?: Record<string, number>;
    repostCount?: Record<string, number>;
  },
  interestsConfig?: { topics?: string[]; interests?: string[] },
): UnifiedFeedItem[] {
  const rows: UnifiedFeedItem[] = [];
  const ecosystemNostrIds = new Set<string>();
  const authorPostCount: Record<string, number> = {};

  const parsedInterests = parseInterestsWithWeights([
    ...((interestsConfig?.topics as string[]) || []).map((t: string) => ({ name: t, weight: 2 })),
    ...((interestsConfig?.interests as string[]) || []),
  ]);

  for (const m of ecosystemMoments) {
    if (m.nostrId) {
      ecosystemNostrIds.add(m.nostrId);
    }
    const rawContent = m.caption || m.content || '';
    const authorName = m.userName || m.user?.name || m.username || 'Creator';
    const authorUsername = m.username || m.user?.username || m.userName;
    const authorKey = m.userId || authorUsername || authorName || m.$id;

    const sanitizeResult = sanitizeFeedContent(rawContent, `${authorName} ${authorUsername || ''}`);
    if (!sanitizeResult) {
      continue;
    }

    const currentCount = authorPostCount[authorKey] || 0;
    if (currentCount >= 3) continue;
    authorPostCount[authorKey] = currentCount + 1;

    const rawDateStr = m.createdAt || m.$createdAt;
    const createdAtMs = rawDateStr ? new Date(rawDateStr).getTime() : 0;
    rows.push({
      id: `eco_${m.$id || m.id}`,
      source: 'ecosystem',
      authorName,
      authorUsername,
      authorAvatar: m.userAvatar || m.user?.avatarUrl,
      isEcosystemUser: true,
      content: rawContent,
      createdAt: createdAtMs,
      likesCount: m.likeCount || 0,
      pulsesCount: m.pulseCount || 0,
      repliesCount: m.replyCount || 0,
      zapsCount: m.zapCount || 0,
      repostsCount: m.repostCount || 0,
      isLiked: Boolean(m.isLiked),
      rank: sanitizeResult.rank,
      rawEvent: m,
    });
  }

  const pubkeysToFetch: string[] = [];

  for (const event of nostrFeed) {
    if ((event as any).tags?.some((t: string[]) => t[0] === 'e')) continue;
    if (ecosystemNostrIds.has(event.id)) continue;

    let authorName = `npub…${event.pubkey.slice(-8)}`;
    let authorAvatar: string | undefined;
    let authorUsername: string | undefined;
    let isEco = false;

    try {
      const npubStr = bytesToNpub(hexToBytes(event.pubkey));
      const profile = resolvedProfiles[npubStr];
      if (profile) {
        authorName = profile.username;
        authorUsername = profile.username;
        authorAvatar = profile.avatarUrl;
        isEco = true;
      }
    } catch {}

    if (!isEco) {
      const nostrProf = getCachedNostrProfile(event.pubkey);
      if (nostrProf) {
        if (nostrProf.displayName || nostrProf.name) {
          authorName = nostrProf.displayName || nostrProf.name || authorName;
        }
        if (nostrProf.username || nostrProf.nip05) {
          authorUsername = nostrProf.nip05 || nostrProf.username;
        }
        if (nostrProf.picture) {
          authorAvatar = nostrProf.picture;
        }
      } else {
        pubkeysToFetch.push(event.pubkey);
      }
    }

    const nostrSanitize = sanitizeFeedContent(event.content || '', `${authorName} ${authorUsername || ''}`);
    if (!nostrSanitize) {
      continue;
    }

    let score = 0;
    if (parsedInterests.length) {
      const hay = `${event.content || ''} ${authorName} ${authorUsername || ''}`.toLowerCase();
      const tags = Array.isArray(event.tags)
        ? event.tags.filter((t: any) => t[0] === 't').map((t: any) => String(t[1] || '').toLowerCase())
        : [];
      for (const interest of parsedInterests) {
        const w = interest.weight || 1;
        if (tags.includes(interest.name)) score += w * 4;
        else if (hay.includes(interest.name)) score += w * 1.5;
      }
    } else {
      score = 1;
    }

    if (parsedInterests.length > 0 && score === 0 && !isEco) {
      continue;
    }

    const authorKey = event.pubkey || authorUsername || authorName;
    const currentCount = authorPostCount[authorKey] || 0;
    const allowedSlots = score >= 5 ? 3 : score >= 2 ? 2 : 1;

    if (currentCount >= allowedSlots) {
      continue;
    }

    authorPostCount[authorKey] = currentCount + 1;

    rows.push({
      id: `nostr_${event.id}`,
      source: 'nostr',
      authorName,
      authorUsername,
      authorAvatar,
      isEcosystemUser: isEco,
      content: event.content,
      createdAt: event.created_at * 1000,
      likesCount: nostrEngagement.likeCount[event.id] || 0,
      repliesCount: nostrEngagement.replyCount[event.id] || 0,
      zapsCount: nostrEngagement.zapCount?.[event.id] || 0,
      repostsCount: nostrEngagement.repostCount?.[event.id] || 0,
      rank: nostrSanitize.rank,
      rawEvent: event,
    });
  }

  if (pubkeysToFetch.length) {
    void queueNostrProfileFetch(pubkeysToFetch);
  }

  return rows
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_FEED);
}

/** Patch engagement / profile fields on existing rows — never drop rows. */
function _patchExisting(
  prev: UnifiedFeedItem[],
  incomingById: Map<string, UnifiedFeedItem>,
): UnifiedFeedItem[] {
  let changed = false;
  const next = prev.map((row) => {
    const inc = incomingById.get(row.id);
    if (!inc) return row;
    const likes = Math.max(inc.likesCount ?? 0, row.likesCount ?? 0);
    const replies = Math.max(inc.repliesCount ?? 0, row.repliesCount ?? 0);
    const avatar = inc.authorAvatar || row.authorAvatar;
    const name = inc.isEcosystemUser ? inc.authorName : row.authorName;
    const username = inc.authorUsername || row.authorUsername;
    if (
      likes === row.likesCount &&
      replies === row.repliesCount &&
      avatar === row.authorAvatar &&
      name === row.authorName &&
      username === row.authorUsername
    ) {
      return row;
    }
    changed = true;
    return {
      ...row,
      likesCount: likes,
      repliesCount: replies,
      authorAvatar: avatar,
      authorName: name,
      authorUsername: username,
      isEcosystemUser: inc.isEcosystemUser || row.isEcosystemUser,
    };
  });
  return changed ? next : prev;
}

/**
 * Merge feed items and strictly maintain chronological order (newest first).
 */
function silentMerge(prev: UnifiedFeedItem[], incoming: UnifiedFeedItem[]): UnifiedFeedItem[] {
  if (!incoming.length) return prev;
  const byId = new Map<string, UnifiedFeedItem>();
  
  for (const item of prev) {
    byId.set(item.id, item);
  }
  
  for (const inc of incoming) {
    const existing = byId.get(inc.id);
    if (existing) {
      byId.set(inc.id, {
        ...existing,
        ...inc,
        likesCount: Math.max(existing.likesCount || 0, inc.likesCount || 0),
        pulsesCount: Math.max(existing.pulsesCount || 0, inc.pulsesCount || 0),
        repliesCount: Math.max(existing.repliesCount || 0, inc.repliesCount || 0),
        zapsCount: Math.max(existing.zapsCount || 0, inc.zapsCount || 0),
        repostsCount: Math.max(existing.repostsCount || 0, inc.repostsCount || 0),
      });
    } else {
      byId.set(inc.id, inc);
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_FEED);
}

function persistUnified(rows: UnifiedFeedItem[]) {
  const sliced = rows.slice(0, MAX_FEED);
  memoryUnified = sliced;
  void LocalEngine.cacheSet(UNIFIED_CACHE, sliced);
}

export function useConnectMomentsFeed() {
  const { user } = useAuth();
  const { feed: nostrFeed, refresh: refreshNostr } = useNostrFeed();
  const [feedSettings, setFeedSettings] = useState<any>(null);
  const [ecosystemMoments, setEcosystemMoments] = useState<any[]>(() => (memoryEco ? [...memoryEco] : []));
  const [resolvedProfiles, setResolvedProfiles] = useState<
    Record<string, { username: string; avatarUrl?: string }>
  >({});
  const [nostrEngagement, setNostrEngagement] = useState<{
    replyCount: Record<string, number>;
    likeCount: Record<string, number>;
    zapCount?: Record<string, number>;
    repostCount?: Record<string, number>;
  }>({ replyCount: {}, likeCount: {}, zapCount: {}, repostCount: {} });
  const [displayItems, setDisplayItems] = useState<UnifiedFeedItem[]>(() => (memoryUnified ? [...memoryUnified] : []));
  const [visibleCount, setVisibleCount] = useState(() => (memoryUnified?.length ? Math.min(PAGE_SIZE, memoryUnified.length) : PAGE_SIZE));
  const [hydrated, setHydrated] = useState(() => !!memoryUnified?.length);
  const [refreshing, setRefreshing] = useState(false);

  const displayRef = useRef(displayItems);
  const ecosystemRef = useRef(ecosystemMoments);
  const nostrFeedRef = useRef(nostrFeed);
  const profilesRef = useRef(resolvedProfiles);
  const engagementRef = useRef(nostrEngagement);

  useEffect(() => {
    displayRef.current = displayItems;
  }, [displayItems]);
  useEffect(() => {
    ecosystemRef.current = ecosystemMoments;
    nostrFeedRef.current = nostrFeed;
    profilesRef.current = resolvedProfiles;
    engagementRef.current = nostrEngagement;
  }, [ecosystemMoments, nostrFeed, resolvedProfiles, nostrEngagement]);

  const applySilent = useCallback((incoming: UnifiedFeedItem[]) => {
    setDisplayItems((prev) => {
      const merged = silentMerge(prev, incoming);
      if (merged === prev) return prev;
      const added = merged.length - prev.length;
      if (added > 0) {
        setVisibleCount((c) => Math.min(c + added, merged.length));
      }
      persistUnified(merged);
      return merged;
    });
  }, []);

  // Feed settings — single hydrate + subscription (was duplicated across two effects).
  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void (async () => {
      try {
        const { getConnectFeedSettings, subscribeConnectFeedSettings } = await import('@/lib/connect/feed-settings');
        const settings = await getConnectFeedSettings().catch(() => null);
        if (!cancelled && settings) setFeedSettings(settings);
        unsub = subscribeConnectFeedSettings((next) => {
          if (!cancelled) setFeedSettings(next);
        });
      } catch {}
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  // 1) Hydrate unified feed from LocalEngine first — enforce system-level sanitization & slot allocation
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [cached, ecoCached] = await Promise.all([
          LocalEngine.cacheGet<UnifiedFeedItem[]>(UNIFIED_CACHE).catch(() => null),
          LocalEngine.cacheGet<any[]>('f_moments_list').catch(() => null),
        ]);
        if (cancelled) return;

        if (Array.isArray(cached) && cached.length) {
          // Backward-compatibility filter: prune spam and enforce slot caps on cached items
          const authorPostCount: Record<string, number> = {};
          const sanitizedCached = cached.filter((item) => {
            const result = sanitizeFeedContent(item.content || '', `${item.authorName || ''} ${item.authorUsername || ''}`);
            if (!result) return false;
            const authorKey = item.authorUsername || item.authorName || item.id;
            const count = authorPostCount[authorKey] || 0;
            if (count >= 3) return false;
            authorPostCount[authorKey] = count + 1;
            // Propagate rank if not already set
            if (item.rank === undefined) item.rank = result.rank;
            return true;
          });

          memoryUnified = sanitizedCached;
          setDisplayItems(sanitizedCached);
          setVisibleCount(Math.min(PAGE_SIZE, sanitizedCached.length));
        }

        if (Array.isArray(ecoCached) && ecoCached.length) {
          memoryEco = ecoCached;
          setEcosystemMoments(ecoCached);
          if (!Array.isArray(cached) || !cached.length) {
            const { getConnectFeedSettings } = await import('@/lib/connect/feed-settings');
            const settings = await getConnectFeedSettings().catch(() => null);
            const built = buildItems(ecoCached, [], {}, { replyCount: {}, likeCount: {} }, settings || undefined);
            if (built.length) {
              memoryUnified = built;
              setDisplayItems(built);
              setVisibleCount(Math.min(PAGE_SIZE, built.length));
            }
          }
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Background ecosystem fetch — merge only, never wipe. Runs even before hydrated if memory exists.
  useEffect(() => {
    if (!hydrated && !memoryUnified?.length && !memoryEco?.length) return;
    let cancelled = false;
    void (async () => {
      try {
        const liveRes = await SocialService.getFeed(user?.$id);
        const liveMoments = Array.isArray(liveRes) ? liveRes : (liveRes as any)?.rows || [];
        if (cancelled || !liveMoments.length) return;
        setEcosystemMoments((prev) => {
          const byId = new Map(prev.map((m) => [m.$id || m.id, m]));
          let changed = false;
          for (const m of liveMoments) {
            const key = m.$id || m.id;
            const old = byId.get(key);
            if (!old) {
              byId.set(key, m);
              changed = true;
            } else if (
              (m.likeCount || 0) !== (old.likeCount || 0) ||
              (m.replyCount || 0) !== (old.replyCount || 0) ||
              (m.caption || m.content) !== (old.caption || old.content)
            ) {
              byId.set(key, m);
              changed = true;
            }
          }
          if (!changed && prev.length === byId.size) return prev;
          const next = Array.from(byId.values());
          memoryEco = next;
          void LocalEngine.cacheSet('f_moments_list', next);
          return next;
        });
      } catch (err) {
        console.warn('[ConnectMoments] eco load failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, user?.$id]);

  // 3) When sources update, silently add / patch — never replace the visible feed. Respects live settings.
  useEffect(() => {
    if (!hydrated && !memoryUnified?.length) return;
    let incoming = buildItems(
      ecosystemMoments,
      nostrFeed,
      resolvedProfiles,
      nostrEngagement,
    );
    if (!incoming.length) return;
    // Respect live settings — source toggles, curated topics/interests phrase search & spam reduction
    if (feedSettings) {
      const s: any = feedSettings;
      if (s.showEcosystem === false) incoming = incoming.filter(i => i.source !== 'ecosystem');
      if (s.showNostr === false) incoming = incoming.filter(i => i.source !== 'nostr');
      if (s.showReplies === false) incoming = incoming.filter(i => (i.repliesCount || 0) === 0);

      const parsedInterests = parseInterestsWithWeights([
        ...((s.topics as string[]) || []).map((t: string) => ({ name: t, weight: 2 })),
        ...((s.interests as string[]) || []),
      ]);

      const spamKeywords = [
        'presale', 'pump', 'solana contract', 'airdrop claim', 'moonshot', '100x gem',
        'free btc', 't.me/', 'pumpex', 'ca:', 'buy now!', '0x', '$pepe', '$wif',
        'airdrop', 'giveaway', 'join channel', 'telegram.me', 'casin', 'bonus claim',
        'free spin', 'crypto signal', 'whatsapp', 'dm to buy', 'whitelist', 'mint now',
        'presale is live', 'private key', 'seed phrase'
      ];

      // Aggressive anti-spam filter: eliminate shilling, bots, and spam links
      incoming = incoming.filter(i => {
        const text = (i.content || '').toLowerCase();
        const author = `${i.authorName || ''} ${i.authorUsername || ''}`.toLowerCase();
        const isSpamText = spamKeywords.some(w => text.includes(w) || author.includes(w));
        if (isSpamText) return false;
        // Eliminate repetitive single-character or blank noise
        if (text.trim().length < 3 && !i.rawEvent?.attachments) return false;
        return true;
      });

      if (parsedInterests.length) {
        // Score items by user declared interest match count multiplied by weight
        const scored = incoming.map(item => {
          const hay = `${item.content || ''} ${item.authorName || ''} ${item.authorUsername || ''}`.toLowerCase();
          const tags = Array.isArray(item.rawEvent?.tags)
            ? item.rawEvent.tags.filter((t: any) => t[0] === 't').map((t: any) => String(t[1] || '').toLowerCase())
            : [];
          
          let score = 0;
          let matchedTopics: string[] = [];
          for (const interest of parsedInterests) {
            const w = interest.weight || 1;
            if (tags.includes(interest.name)) {
              score += w * 4;
              matchedTopics.push(interest.name);
            } else if (hay.includes(interest.name)) {
              score += w * 1.5;
              matchedTopics.push(interest.name);
            }
          }
          return { item, score, matchedTopics };
        });

        // Retain items matching declared interests, or native ecosystem posts (capped)
        const matched = scored.filter(s => s.score > 0 || s.item.source === 'ecosystem');
        if (matched.length > 0) {
          // Sort strictly by recency (newest first)
          const sorted = matched
            .sort((a, b) => b.item.createdAt - a.item.createdAt);

          // Dynamic author slot allocation (0-3 posts per author in a single FYP view)
          const balanced: typeof sorted = [];
          const authorPostCount: Record<string, number> = {};

          for (const entry of sorted) {
            const authorKey = entry.item.authorUsername || entry.item.authorName || entry.item.id;
            const count = authorPostCount[authorKey] || 0;
            const allowedSlots = entry.score >= 5 ? 3 : entry.score >= 2 ? 2 : 1;

            if (count < allowedSlots) {
              balanced.push(entry);
              authorPostCount[authorKey] = count + 1;
            }
          }

          incoming = balanced.map(s => s.item);
        }
      }
    }
    if (!incoming.length) return;
    applySilent(incoming);
  }, [
    hydrated,
    ecosystemMoments,
    nostrFeed,
    resolvedProfiles,
    nostrEngagement,
    applySilent,
    feedSettings,
  ]);

  // Instant live adapt — when settings toggle, re-filter current feed without waiting for network
  useEffect(() => {
    if (!hydrated || !feedSettings) return;
    setDisplayItems(prev => {
      if (!prev.length) return prev;
      let next = [...prev];
      const s: any = feedSettings;
      if (s.showEcosystem === false) next = next.filter(i => i.source !== 'ecosystem');
      if (s.showNostr === false) next = next.filter(i => i.source !== 'nostr');
      if (s.showReplies === false) next = next.filter(i => (i.repliesCount || 0) === 0);
      const phrases: string[] = [...((s.topics as string[]) || []), ...((s.interests as string[]) || [])].map(t => String(t).toLowerCase()).filter(Boolean);
      if (phrases.length) {
        const filtered = next.filter(i => {
          const hay = `${i.content || ''} ${i.authorName || ''} ${i.authorUsername || ''}`.toLowerCase();
          return phrases.some(p => hay.includes(p));
        });
        if (filtered.length) next = filtered;
      }
      // Never empty instantly — keep at least previous if filter would wipe; do NOT persist filtered view over canonical cache (local-first)
      if (!next.length && prev.length) return prev;
      if (next === prev) return prev;
      return next;
    });
  }, [feedSettings, hydrated]);

  // Feed search submit listener — instant in-page query filter and prioritize
  useEffect(() => {
    const handleFeedSearchSubmit = (event: any) => {
      const query = String(event?.detail?.query || '').trim().toLowerCase();
      if (!query) return;
      const terms = query.match(/\b[a-z0-9]{2,}\b/g) || [query];
      setDisplayItems((prev) => {
        if (!prev.length) return prev;
        const matched = prev.filter((i) => {
          const text = `${i.content || ''} ${i.authorName || ''} ${i.authorUsername || ''}`.toLowerCase();
          return terms.some((term) => text.includes(term));
        });
        if (matched.length > 0) {
          // Bring exact matches to top
          const matchedIds = new Set(matched.map((m) => m.id));
          const rest = prev.filter((m) => !matchedIds.has(m.id));
          return [...matched, ...rest];
        }
        return prev;
      });
    };

    window.addEventListener('kylrix:feed-search-submit', handleFeedSearchSubmit);
    return () => window.removeEventListener('kylrix:feed-search-submit', handleFeedSearchSubmit);
  }, []);

  // Resolve Nostr handles quietly.
  useEffect(() => {
    if (!nostrFeed.length) return;
    const unresolved = nostrFeed
      .map((event) => {
        try {
          return bytesToNpub(hexToBytes(event.pubkey));
        } catch {
          return null;
        }
      })
      .filter((n): n is string => !!n && !profilesRef.current[n]);

    if (!unresolved.length) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void resolveNostrPubkeysAction(unresolved).then((res) => {
        if (cancelled || !res) return;
        setResolvedProfiles((prev) => {
          const next = { ...prev };
          let changed = false;
          for (const [key, value] of Object.entries(res)) {
            if (!next[key]) {
              next[key] = value;
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      });
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [nostrFeed.length]);

  // Engagement counts — patch only, no rebuild flicker.
  useEffect(() => {
    if (!nostrFeed.length || !hydrated) return;
    const ids = nostrFeed.slice(0, 50).map((e) => e.id);
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetchNostrEngagement(ids, 3000).then((res) => {
        if (cancelled) return;
        setNostrEngagement({
          replyCount: res.replyCount,
          likeCount: res.likeCount,
          zapCount: res.zapCount,
          repostCount: res.repostCount,
        });
      });
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [nostrFeed.length, hydrated]);

  /** Manual refresh only — still refuses to show empty if live returns nothing. */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      void refreshNostr().catch(() => {});
      const liveRes = await SocialService.getFeed(user?.$id);
      const liveMoments = Array.isArray(liveRes) ? liveRes : (liveRes as any)?.rows || [];
      if (liveMoments.length) {
        setEcosystemMoments(liveMoments);
        await LocalEngine.cacheSet('f_moments_list', liveMoments);
      }

      const rebuilt = buildItems(
        liveMoments.length ? liveMoments : ecosystemRef.current,
        nostrFeedRef.current,
        profilesRef.current,
        engagementRef.current,
      );

      if (rebuilt.length) {
        setDisplayItems(rebuilt);
        setVisibleCount(Math.min(PAGE_SIZE, rebuilt.length));
        persistUnified(rebuilt);
      } else if (displayRef.current.length) {
        // Keep buffer — never empty the feed on a bad refresh.
        persistUnified(displayRef.current);
      }
    } catch (err) {
      console.warn('[ConnectMoments] refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }, [user?.$id, refreshNostr]);

  // Listen for FAB Back-to-Top & Refresh click event
  useEffect(() => {
    const handleRefresh = () => {
      void refresh();
    };
    window.addEventListener('kylrix:refresh-feed', handleRefresh);
    return () => window.removeEventListener('kylrix:refresh-feed', handleRefresh);
  }, [refresh]);

  // Strictly stable chronological feed without unprovoked in-place swapping
  const hasMore = visibleCount < displayItems.length;
  const loadingMoreRef = useRef(false);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, displayItems.length));
    // Release gate after paint so IntersectionObserver does not double-fire.
    requestAnimationFrame(() => {
      loadingMoreRef.current = false;
    });
  }, [hasMore, displayItems.length]);

  const items = useMemo(
    () => displayItems.slice(0, visibleCount),
    [displayItems, visibleCount],
  );

  // Skeletons only when we have zero local copy and nothing hydrated yet.
  const loading = !hydrated && displayItems.length === 0;

  return {
    items,
    total: displayItems.length,
    loading,
    refreshing,
    hasMore,
    loadMore,
    refresh,
  };
}
