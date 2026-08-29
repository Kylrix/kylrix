'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UnifiedFeedItem } from '@/components/connect/useConnectMomentsFeed';
import {
  fetchPersonalTabItems,
  peekPersonalTabMemory,
  persistPersonalTab,
  PERSONAL_TAB_CACHE,
  PERSONAL_TAB_PAGE_SIZE,
  type PersonalConnectTab,
} from '@/lib/connect/connect-personal-feed';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useAuth } from '@/context/auth/AuthContext';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { bytesToHex } from '@/lib/nostr/crypto';
import * as secp256k1 from '@noble/secp256k1';

export function useConnectPersonalTab(tab: PersonalConnectTab, enabled: boolean) {
  const { user } = useAuth();
  const { identity } = useNostrIdentity();
  const [displayItems, setDisplayItems] = useState<UnifiedFeedItem[]>(() => peekPersonalTabMemory(tab) || []);
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(PERSONAL_TAB_PAGE_SIZE, peekPersonalTabMemory(tab)?.length || PERSONAL_TAB_PAGE_SIZE),
  );
  const [hydrated, setHydrated] = useState(() => Boolean(peekPersonalTabMemory(tab)?.length));
  const [refreshing, setRefreshing] = useState(false);
  const displayRef = useRef(displayItems);

  useEffect(() => {
    displayRef.current = displayItems;
  }, [displayItems]);

  const nostrPubkeyHex = useMemo(() => {
    if (!identity?.privateKeyBytes) return '';
    try {
      return bytesToHex(secp256k1.schnorr.getPublicKey(identity.privateKeyBytes));
    } catch {
      return '';
    }
  }, [identity?.privateKeyBytes]);

  // Hydrate from LocalEngine — always runs so tab switches are instant.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cached = await LocalEngine.cacheGet<UnifiedFeedItem[]>(PERSONAL_TAB_CACHE[tab]).catch(() => null);
        if (cancelled) return;
        if (Array.isArray(cached) && cached.length) {
          persistPersonalTab(tab, cached);
          setDisplayItems(cached);
          setVisibleCount(Math.min(PERSONAL_TAB_PAGE_SIZE, cached.length));
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const refresh = useCallback(async () => {
    if (!user?.$id && tab !== 'bookmarks') return;
    setRefreshing(true);
    try {
      const live = await fetchPersonalTabItems(tab, {
        userId: user?.$id,
        nostrPubkeyHex,
      });
      if (live.length) {
        setDisplayItems((prev) => {
          const byId = new Map(prev.map((r) => [r.id, r]));
          for (const row of live) byId.set(row.id, row);
          const merged = Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
          persistPersonalTab(tab, merged);
          return merged;
        });
        setVisibleCount((c) => Math.max(c, Math.min(PERSONAL_TAB_PAGE_SIZE, live.length)));
      } else if (displayRef.current.length) {
        persistPersonalTab(tab, displayRef.current);
      }
    } catch (err) {
      console.warn(`[ConnectPersonalTab:${tab}] refresh failed`, err);
    } finally {
      setRefreshing(false);
    }
  }, [tab, user?.$id, nostrPubkeyHex]);

  // Background network refresh when tab is active.
  useEffect(() => {
    if (!enabled || !hydrated) return;
    if (!user?.$id && tab !== 'bookmarks') return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        if (cancelled) return;
        await refresh();
      })();
    }, tab === 'bookmarks' ? 120 : 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, hydrated, refresh, tab, user?.$id]);

  useEffect(() => {
    const onBookmarks = () => {
      if (tab !== 'bookmarks') return;
      void refresh();
    };
    const onRefreshFeed = () => {
      if (!enabled) return;
      void refresh();
    };
    window.addEventListener('kylrix:bookmarks-updated', onBookmarks);
    window.addEventListener('kylrix:refresh-feed', onRefreshFeed);
    return () => {
      window.removeEventListener('kylrix:bookmarks-updated', onBookmarks);
      window.removeEventListener('kylrix:refresh-feed', onRefreshFeed);
    };
  }, [enabled, refresh, tab]);

  const hasMore = visibleCount < displayItems.length;
  const loadingMoreRef = useRef(false);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setVisibleCount((c) => Math.min(c + PERSONAL_TAB_PAGE_SIZE, displayItems.length));
    requestAnimationFrame(() => {
      loadingMoreRef.current = false;
    });
  }, [hasMore, displayItems.length]);

  const items = useMemo(() => displayItems.slice(0, visibleCount), [displayItems, visibleCount]);
  const loading = !hydrated && displayItems.length === 0;

  return { items, total: displayItems.length, loading, refreshing, hasMore, loadMore, refresh };
}
