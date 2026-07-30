'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { NostrRelayPool, NostrEvent, signEvent } from '@/lib/tmp/nostr';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { bytesToHex } from '@/lib/tmp/crypto';
import * as secp256k1 from '@noble/secp256k1';
import toast from 'react-hot-toast';

const RELAYS = [
  'wss://nos.lol',
  'wss://purplepag.es',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
];

const LOCAL_CACHE_KEY = 'kylrix_nostr_feed_cache';
const FILTER_TAGS = ['sovereignengineering', 'localfirst', 'linux', 'openbuidl', 'nostr', 'bitcoin'];
const FLUSH_MS = 2500;
const MAX_EVENTS = 100;

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
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(next.slice(0, MAX_EVENTS)));
  } catch {
    /* ignore quota */
  }
}

export function useNostrFeed() {
  const { identity } = useNostrIdentity();
  const [feed, setFeed] = useState<NostrEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const poolRef = useRef<NostrRelayPool | null>(null);
  const pendingRef = useRef<NostrEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedRef = useRef<NostrEvent[]>([]);

  useEffect(() => {
    feedRef.current = feed;
  }, [feed]);

  const flushPending = useCallback(() => {
    flushTimerRef.current = null;
    const batch = pendingRef.current;
    pendingRef.current = [];
    if (!batch.length) return;

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
    try {
      const cached = localStorage.getItem(LOCAL_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as NostrEvent[];
        if (Array.isArray(parsed) && parsed.length) {
          setFeed(parsed);
        }
      }
    } catch {
      console.warn('Failed to load Nostr cache');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const pool = new NostrRelayPool(RELAYS);
    poolRef.current = pool;
    pool.connect();

    pool.addListener(queueEvent);
    pool.subscribe('kylrix-tech-feed', [{ kinds: [1], '#t': FILTER_TAGS, limit: 50 }]);
    setLoading(false);

    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      pool.removeListener(queueEvent);
      pool.unsubscribe('kylrix-tech-feed');
      pool.close();
    };
  }, [queueEvent]);

  const publishPost = useCallback(async (content: string) => {
    if (!identity) {
      toast.error('Identity not unlocked');
      return false;
    }

    if (!poolRef.current) {
      toast.error('Not connected to relays');
      return false;
    }

    try {
      const unsignedEvent = {
        pubkey: bytesToHex(secp256k1.schnorr.getPublicKey(identity.privateKeyBytes)),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [['t', 'sovereignengineering'], ['client', 'kylrix']],
        content};

      const signed = signEvent(unsignedEvent, identity.privateKeyBytes);
      await poolRef.current.publish(signed);

      setFeed((prev) => {
        const next = mergeEvents(prev, [signed]);
        persistFeed(next);
        return next;
      });

      toast.success('Post published to Nostr relays!');
      return true;
    } catch (err) {
      console.error('Failed to publish event:', err);
      toast.error('Failed to publish post');
      return false;
    }
  }, [identity]);

  const refresh = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    pendingRef.current = [];
    flushPending();

    if (poolRef.current) {
      setLoading(true);
      poolRef.current.close();
      poolRef.current.connect();
      poolRef.current.subscribe('kylrix-tech-feed', [{ kinds: [1], '#t': FILTER_TAGS, limit: 50 }]);
      setLoading(false);
      toast.success('Reconnecting to Nostr relays...');
    }
  }, [flushPending]);

  return {
    feed,
    loading,
    publishPost,
    refresh,
    filterTags: FILTER_TAGS};
}
