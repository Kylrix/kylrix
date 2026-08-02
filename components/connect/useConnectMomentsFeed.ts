'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNostrFeed } from '@/hooks/useNostrFeed';
import { resolveNostrPubkeysAction } from '@/lib/actions/secure-ops';
import { bytesToNpub, hexToBytes } from '@/lib/nostr/crypto';
import { fetchNostrEngagement } from '@/lib/nostr/thread';
import { SocialService } from '@/lib/services/social';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useAuth } from '@/context/auth/AuthContext';

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
  isLiked?: boolean;
}

const PAGE_SIZE = 16;
const UNIFIED_CACHE = 'f_unified_moments_feed';
const MAX_FEED = 240;

function buildItems(
  ecosystemMoments: any[],
  nostrFeed: { id: string; pubkey: string; content: string; created_at: number; tags?: string[][] }[],
  resolvedProfiles: Record<string, { username: string; avatarUrl?: string }>,
  nostrEngagement: { replyCount: Record<string, number>; likeCount: Record<string, number> },
): UnifiedFeedItem[] {
  const rows: UnifiedFeedItem[] = [];

  for (const m of ecosystemMoments) {
    const rawDateStr = m.createdAt || m.$createdAt;
    const createdAtMs = rawDateStr ? new Date(rawDateStr).getTime() : 0;
    rows.push({
      id: `eco_${m.$id || m.id}`,
      source: 'ecosystem',
      authorName: m.userName || m.user?.name || m.username || 'Kylrix User',
      authorUsername: m.username || m.user?.username,
      authorAvatar: m.userAvatar || m.user?.avatarUrl,
      isEcosystemUser: true,
      content: m.caption || m.content || '',
      createdAt: createdAtMs,
      likesCount: m.likeCount || 0,
      pulsesCount: m.pulseCount || 0,
      repliesCount: m.replyCount || 0,
      isLiked: Boolean(m.isLiked),
      rawEvent: m,
    });
  }

  for (const event of nostrFeed) {
    if ((event as any).tags?.some((t: string[]) => t[0] === 'e')) continue;

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
    } catch {
      /* keep fallback */
    }

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
      rawEvent: event,
    });
  }

  return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_FEED);
}

/** Patch engagement / profile fields on existing rows — never drop rows. */
function patchExisting(
  prev: UnifiedFeedItem[],
  incomingById: Map<string, UnifiedFeedItem>,
): UnifiedFeedItem[] {
  let changed = false;
  const next = prev.map((row) => {
    const inc = incomingById.get(row.id);
    if (!inc) return row;
    const likes = inc.likesCount ?? row.likesCount;
    const replies = inc.repliesCount ?? row.repliesCount;
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
 * Silent add: prepend brand-new ids (higher rank), patch existing.
 * Never removes rows. Never reshuffles existing order.
 */
function silentMerge(prev: UnifiedFeedItem[], incoming: UnifiedFeedItem[]): UnifiedFeedItem[] {
  if (!incoming.length) return prev;
  const incomingById = new Map(incoming.map((i) => [i.id, i]));
  const existingIds = new Set(prev.map((i) => i.id));
  const additions = incoming
    .filter((i) => !existingIds.has(i.id))
    .sort((a, b) => b.createdAt - a.createdAt);

  const patched = patchExisting(prev, incomingById);
  if (!additions.length) return patched;

  return [...additions, ...patched].slice(0, MAX_FEED);
}

function persistUnified(rows: UnifiedFeedItem[]) {
  void LocalEngine.cacheSet(UNIFIED_CACHE, rows.slice(0, MAX_FEED));
}

export function useConnectMomentsFeed() {
  const { user } = useAuth();
  const { feed: nostrFeed } = useNostrFeed();
  const [ecosystemMoments, setEcosystemMoments] = useState<any[]>([]);
  const [resolvedProfiles, setResolvedProfiles] = useState<
    Record<string, { username: string; avatarUrl?: string }>
  >({});
  const [nostrEngagement, setNostrEngagement] = useState<{
    replyCount: Record<string, number>;
    likeCount: Record<string, number>;
  }>({ replyCount: {}, likeCount: {} });
  const [displayItems, setDisplayItems] = useState<UnifiedFeedItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [hydrated, setHydrated] = useState(false);
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

  // 1) Hydrate unified feed from LocalEngine first — never flash empty.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cached = await LocalEngine.cacheGet<UnifiedFeedItem[]>(UNIFIED_CACHE);
        if (!cancelled && Array.isArray(cached) && cached.length) {
          setDisplayItems(cached);
          setVisibleCount(Math.min(PAGE_SIZE, cached.length));
        }
        const ecoCached = await LocalEngine.cacheGet<any[]>('f_moments_list');
        if (!cancelled && Array.isArray(ecoCached) && ecoCached.length) {
          setEcosystemMoments(ecoCached);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Background ecosystem fetch — merge only, never wipe.
  useEffect(() => {
    if (!hydrated) return;
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

  // 3) When sources update, silently add / patch — never replace the visible feed.
  useEffect(() => {
    if (!hydrated) return;
    const incoming = buildItems(
      ecosystemMoments,
      nostrFeed,
      resolvedProfiles,
      nostrEngagement,
    );
    if (!incoming.length) return;
    applySilent(incoming);
  }, [
    hydrated,
    ecosystemMoments,
    nostrFeed,
    resolvedProfiles,
    nostrEngagement,
    applySilent,
  ]);

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
  }, [user?.$id]);

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
