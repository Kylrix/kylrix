'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNostrFeed } from '@/hooks/useNostrFeed';
import { resolveNostrPubkeysAction } from '@/lib/actions/secure-ops';
import { bytesToNpub, hexToBytes } from '@/lib/tmp/crypto';
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

export function useConnectMomentsFeed() {
  const { user } = useAuth();
  const { feed: nostrFeed, loading: nostrLoading } = useNostrFeed();
  const [ecosystemMoments, setEcosystemMoments] = useState<any[]>([]);
  const [resolvedProfiles, setResolvedProfiles] = useState<Record<string, { username: string; avatarUrl?: string }>>({});
  const [page, setPage] = useState(1);
  const resolvedProfilesRef = useRef(resolvedProfiles);

  useEffect(() => {
    resolvedProfilesRef.current = resolvedProfiles;
  }, [resolvedProfiles]);

  const loadEcosystemMoments = useCallback(async () => {
    try {
      const cached = await LocalEngine.cacheGet<any[]>('f_moments_list');
      if (cached?.length) setEcosystemMoments(cached);

      const liveRes = await SocialService.getFeed(user?.$id);
      const liveMoments = Array.isArray(liveRes) ? liveRes : (liveRes as any)?.rows || [];
      if (liveMoments.length) {
        setEcosystemMoments(liveMoments);
        await LocalEngine.cacheSet('f_moments_list', liveMoments);
      }
    } catch (err) {
      console.warn('[ConnectMoments] load failed:', err);
    }
  }, [user?.$id]);

  useEffect(() => {
    void loadEcosystemMoments();
  }, [loadEcosystemMoments]);

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
      .filter((n): n is string => !!n && !resolvedProfilesRef.current[n]);

    if (!unresolved.length) return;

    let cancelled = false;
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

    return () => {
      cancelled = true;
    };
  }, [nostrFeed]);

  const items = useMemo<UnifiedFeedItem[]>(() => {
    const rows: UnifiedFeedItem[] = [];

    ecosystemMoments.forEach((m) => {
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
        rawEvent: m,
      });
    });

    nostrFeed.forEach((event) => {
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
        rawEvent: event,
      });
    });

    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }, [ecosystemMoments, nostrFeed, resolvedProfiles]);

  const visibleItems = items.slice(0, page * PAGE_SIZE);
  const hasMore = visibleItems.length < items.length;
  const loading = nostrLoading && items.length === 0;

  return {
    items: visibleItems,
    total: items.length,
    loading,
    hasMore,
    loadMore: () => setPage((p) => p + 1),
    refresh: loadEcosystemMoments,
  };
}
