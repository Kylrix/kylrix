'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { NostrRelayPool, NostrEvent, signEvent } from '@/lib/nostr/nostr';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { bytesToHex, normalizePrivateKeyBytes } from '@/lib/nostr/crypto';
import * as secp256k1 from '@noble/secp256k1';
import { getConnectFeedSettings, subscribeConnectFeedSettings, getNostrReadRelays, type ConnectFeedSettings } from '@/lib/connect/feed-settings';
import { queueNostrProfileFetch } from '@/lib/nostr/metadata';
import toast from 'react-hot-toast';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://purplepag.es',
];

const LOCAL_CACHE_KEY = 'kylrix_nostr_feed_cache';
const BASE_TOPICS = ['sovereignengineering', 'localfirst', 'linux', 'openbuidl', 'nostr', 'bitcoin'];
const FLUSH_MS = 1500;
const MAX_EVENTS = 120;

function mergeEvents(prev: NostrEvent[], incoming: NostrEvent[]): NostrEvent[] {
  if (!incoming.length) return prev;
  const byId = new Map<string, NostrEvent>();
  for (const event of prev) byId.set(event.id, event);
  for (const event of incoming) byId.set(event.id, event);
  return Array.from(byId.values())
    .sort((a: any, b: any) => b.created_at - a.created_at)
    .slice(0, MAX_EVENTS);
}

function persistFeed(next: NostrEvent[]) {
  void import('@/lib/services/LocalEngine').then(({ LocalEngine }) => {
    void LocalEngine.cacheSet(LOCAL_CACHE_KEY, next.slice(0, MAX_EVENTS)).catch(() => {});
  });
}

export function useNostrFeed() {
  const { identity } = useNostrIdentity();
  const [feed, setFeed] = useState<NostrEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedSettings, setFeedSettings] = useState<ConnectFeedSettings | null>(null);
  const poolRef = useRef<NostrRelayPool | null>(null);
  const pendingRef = useRef<NostrEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedRef = useRef<NostrEvent[]>([]);

  useEffect(() => {
    feedRef.current = feed;
  }, [feed]);

  // Load live feed settings (user declared interests & topics)
  useEffect(() => {
    let active = true;
    void getConnectFeedSettings().then((s) => {
      if (active) setFeedSettings(s);
    });
    const unsub = subscribeConnectFeedSettings((s) => {
      if (active) setFeedSettings(s);
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const activeInterests = Array.from(
    new Set([
      ...(feedSettings?.interests || []).map((t) => t.toLowerCase().replace(/^#/, '').trim()),
      ...(feedSettings?.topics || []).map((t) => t.toLowerCase().replace(/^#/, '').trim()),
      ...BASE_TOPICS,
    ].filter(Boolean))
  );

  const flushPending = useCallback(() => {
    flushTimerRef.current = null;
    const batch = pendingRef.current;
    pendingRef.current = [];
    if (!batch.length) return;

    // Queue author metadata lookup
    const authorPubkeys = Array.from(new Set(batch.map((e) => e.pubkey).filter(Boolean)));
    if (authorPubkeys.length) {
      void queueNostrProfileFetch(authorPubkeys);
    }

    setFeed((prev) => {
      const next = mergeEvents(prev, batch);
      if (next.length === prev.length && next.every((e, i) => e.id === prev[i]?.id)) {
        return prev;
      }
      persistFeed(next);
      return next;
    });
  }, []);

  const queueEvent = useCallback(
    (event: NostrEvent) => {
      if (feedRef.current.some((e) => e.id === event.id)) return;
      if (pendingRef.current.some((e) => e.id === event.id)) return;
      pendingRef.current.push(event);
      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(flushPending, FLUSH_MS);
      }
    },
    [flushPending],
  );

  useEffect(() => {
    void import('@/lib/services/LocalEngine').then(async ({ LocalEngine }) => {
      const cached = await LocalEngine.cacheGet<NostrEvent[]>(LOCAL_CACHE_KEY).catch(() => null);
      if (Array.isArray(cached) && cached.length) {
        setFeed(cached);
        const authorPubkeys = Array.from(new Set(cached.map((e) => e.pubkey).filter(Boolean)));
        if (authorPubkeys.length) {
          void queueNostrProfileFetch(authorPubkeys);
        }
      }
    });
  }, []);

  // Connect and subscribe to relays based on user configured read relays & declared interests
  useEffect(() => {
    let cancelled = false;
    let pool: NostrRelayPool | null = null;

    void (async () => {
      setLoading(true);
      const configuredRelays = await getNostrReadRelays();
      const targetRelays = configuredRelays.length ? configuredRelays : DEFAULT_RELAYS;

      if (cancelled) return;

      pool = new NostrRelayPool(targetRelays);
      poolRef.current = pool;
      pool.addListener(queueEvent);
      pool.connect();

      // Dynamic subscription filter using user's explicit declared interests + base topics
      const tagsToQuery = activeInterests.slice(0, 25);
      pool.subscribe('kylrix-interest-feed', [
        { kinds: [1], '#t': tagsToQuery, limit: 60 },
      ]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      if (pool) {
        pool.removeListener(queueEvent);
        pool.unsubscribe('kylrix-interest-feed');
        pool.close();
      }
    };
  }, [queueEvent, activeInterests.join(',')]);

  const publishPost = useCallback(
    async (content: string, extraTags?: string[][]): Promise<{ success: boolean; eventId?: string }> => {
      if (!identity) {
        toast.error('Identity not unlocked');
        return { success: false };
      }

      if (!poolRef.current) {
        toast.error('Not connected to relays');
        return { success: false };
      }

      try {
        const privBytes =
          normalizePrivateKeyBytes(identity.privateKeyBytes) ??
          normalizePrivateKeyBytes(identity.nsec);
        if (!privBytes) {
          toast.error('Identity key unavailable — unlock vault and try again');
          return { success: false };
        }

        const primaryTag = activeInterests[0] || 'sovereignengineering';
        const tags: string[][] = [['t', primaryTag], ['client', 'kylrix'], ...(extraTags || [])];
        const unsignedEvent = {
          pubkey: bytesToHex(secp256k1.schnorr.getPublicKey(privBytes)),
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          tags,
          content,
        };

        const signed = signEvent(unsignedEvent, privBytes);
        await poolRef.current.publish(signed);

        setFeed((prev) => {
          const next = mergeEvents(prev, [signed]);
          persistFeed(next);
          return next;
        });

        toast.success('Post published to Nostr relays!');
        return { success: true, eventId: signed.id };
      } catch (err) {
        console.error('Failed to publish event:', err);
        toast.error('Failed to publish post');
        return { success: false };
      }
    },
    [identity, activeInterests],
  );

  const refresh = useCallback(async () => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    pendingRef.current = [];
    flushPending();

    if (poolRef.current) {
      setLoading(true);
      poolRef.current.close();
      const configuredRelays = await getNostrReadRelays();
      const targetRelays = configuredRelays.length ? configuredRelays : DEFAULT_RELAYS;
      poolRef.current = new NostrRelayPool(targetRelays);
      poolRef.current.addListener(queueEvent);
      poolRef.current.connect();
      const tagsToQuery = activeInterests.slice(0, 25);
      poolRef.current.subscribe('kylrix-interest-feed', [
        { kinds: [1], '#t': tagsToQuery, limit: 60 },
      ]);
      setLoading(false);
    }
  }, [flushPending, queueEvent, activeInterests]);

  return {
    feed,
    loading,
    publishPost,
    refresh,
    filterTags: activeInterests,
  };
}
