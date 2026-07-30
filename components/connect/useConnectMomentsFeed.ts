'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNostrFeed } from '@/hooks/useNostrFeed';
import { resolveNostrPubkeysAction } from '@/lib/actions/secure-ops';
import { bytesToNpub, hexToBytes } from '@/lib/nostr/crypto';
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
}

const PAGE_SIZE = 12;

function buildItems(
  ecosystemMoments: any[],
  nostrFeed: { id: string; pubkey: string; content: string; created_at: number }[],
  resolvedProfiles: Record<string, { username: string; avatarUrl?: string }>): UnifiedFeedItem[] {
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
      rawEvent: m});
  }

  for (const event of nostrFeed) {
    let authorName = `npub…${event.pubkey.slice(-8)}`;
    let isEco = false;
    try {
      const npubStr = bytesToNpub(hexToBytes(event.pubkey));
      if (resolvedProfiles[npubStr]) {
        authorName = `@${resolvedProfiles[npubStr].username}`;
        isEco = true;
      }
    } catch {
      /* keep fallback */
    }

    rows.push({
      id: `nostr_${event.id}`,
      source: 'nostr',
      authorName,
      isEcosystemUser: isEco,
      content: event.content,
      createdAt: event.created_at * 1000,
      rawEvent: event});
  }

  return rows.sort((a: any, b: any) => b.createdAt - a.createdAt);
}

export function useConnectMomentsFeed() {
  const { user } = useAuth();
  const { feed: nostrFeed, loading: nostrLoading } = useNostrFeed();
  const [ecosystemMoments, setEcosystemMoments] = useState<any[]>([]);
  const [resolvedProfiles, setResolvedProfiles] = useState<Record<string, { username: string; avatarUrl?: string }>>({});
  const [displayItems, setDisplayItems] = useState<UnifiedFeedItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const resolvedProfilesRef = useRef(resolvedProfiles);
  const nostrFeedRef = useRef(nostrFeed);
  const ecosystemRef = useRef(ecosystemMoments);
  const hasSeededRef = useRef(false);

  useEffect(() => {
    nostrFeedRef.current = nostrFeed;
    ecosystemRef.current = ecosystemMoments;
    resolvedProfilesRef.current = resolvedProfiles;
  }, [nostrFeed, ecosystemMoments, resolvedProfiles]);

  const snapshot = useCallback(
    () => buildItems(ecosystemRef.current, nostrFeedRef.current, resolvedProfilesRef.current),
    []);

  // Snapshot only on first load or explicit refresh — never from live relay traffic.
  const syncDisplay = useCallback(() => {
    setDisplayItems(snapshot());
    setCurrentPage(1);
  }, [snapshot]);

  useEffect(() => {
    const hasData = ecosystemMoments.length > 0 || nostrFeed.length > 0;
    if (!hasSeededRef.current && hasData) {
      hasSeededRef.current = true;
      syncDisplay();
    }
  }, [ecosystemMoments, nostrFeed, syncDisplay]);

  useEffect(() => {
    let cancelled = false;
    const loadEcosystemMoments = async () => {
      try {
        const cached = await LocalEngine.cacheGet<any[]>('f_moments_list');
        if (!cancelled && cached?.length) {
          setEcosystemMoments(cached);
        }

        const liveRes = await SocialService.getFeed(user?.$id);
        const liveMoments = Array.isArray(liveRes) ? liveRes : (liveRes as any)?.rows || [];
        if (!cancelled && liveMoments.length) {
          setEcosystemMoments(liveMoments);
          await LocalEngine.cacheSet('f_moments_list', liveMoments);
        }
      } catch (err) {
        console.warn('[ConnectMoments] load failed:', err);
      }
    };
    void loadEcosystemMoments();
    return () => {
      cancelled = true;
    };
  }, [user?.$id]);

  // Resolve handles once before refresh — never patch visible rows in place.
  useEffect(() => {
    if (!nostrFeed.length) return;

    const unresolved = nostrFeed
      .map((event: any) => {
        try {
          return bytesToNpub(hexToBytes(event.pubkey));
        } catch {
          return null;
        }
      })
      .filter((n): n is string => !!n && !resolvedProfilesRef.current[n]);

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
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [nostrFeed.length]);

  const refresh = useCallback(async () => {
    try {
      const cached = await LocalEngine.cacheGet<any[]>('f_moments_list');
      if (cached?.length) {
        setEcosystemMoments(cached);
      }

      const liveRes = await SocialService.getFeed(user?.$id);
      const liveMoments = Array.isArray(liveRes) ? liveRes : (liveRes as any)?.rows || [];
      if (liveMoments.length) {
        setEcosystemMoments(liveMoments);
        await LocalEngine.cacheSet('f_moments_list', liveMoments);
      }
    } catch (err) {
      console.warn('[ConnectMoments] refresh failed:', err);
    }
    syncDisplay();
  }, [user, syncDisplay]);

  const totalPages = Math.max(1, Math.ceil(displayItems.length / PAGE_SIZE));
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  const items = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return displayItems.slice(start, start + PAGE_SIZE);
  }, [displayItems, currentPage]);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.min(Math.max(1, page), totalPages));
    },
    [totalPages]);

  const nextPage = useCallback(() => {
    if (hasNextPage) setCurrentPage((p) => p + 1);
  }, [hasNextPage]);

  const previousPage = useCallback(() => {
    if (hasPreviousPage) setCurrentPage((p) => p - 1);
  }, [hasPreviousPage]);

  const loading = nostrLoading && displayItems.length === 0 && ecosystemMoments.length === 0;

  return {
    items,
    total: displayItems.length,
    loading,
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    pageSize: PAGE_SIZE,
    goToPage,
    nextPage,
    previousPage,
    refresh};
}
