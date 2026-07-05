'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { NostrRelayPool, NostrEvent, signEvent } from '@/lib/tmp/nostr';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import toast from 'react-hot-toast';

const RELAYS = [
  'wss://nos.lol',
  'wss://purplepag.es',
  'wss://relay.damus.io',
  'wss://relay.primal.net'
];

const LOCAL_CACHE_KEY = 'kylrix_nostr_feed_cache';
const FILTER_TAGS = ['sovereignengineering', 'localfirst', 'linux', 'openbuidl', 'nostr', 'bitcoin'];

export function useNostrFeed() {
  const { identity } = useNostrIdentity();
  const [feed, setFeed] = useState<NostrEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const poolRef = useRef<NostrRelayPool | null>(null);

  // Load from local-first cache on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LOCAL_CACHE_KEY);
      if (cached) {
        setFeed(JSON.parse(cached));
      }
    } catch (e) {
      console.warn('Failed to load Nostr cache:', e);
    }
  }, []);

  // Sync feed updates to local-first cache
  const updateFeedAndCache = useCallback((updated: NostrEvent[]) => {
    setFeed(updated);
    try {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(updated.slice(0, 100)));
    } catch (e) {
      console.warn('Failed to save Nostr feed cache:', e);
    }
  }, []);

  // Connect to relays and subscribe
  useEffect(() => {
    setLoading(true);
    const pool = new NostrRelayPool(RELAYS);
    poolRef.current = pool;
    pool.connect();

    const handleNewEvent = (event: NostrEvent) => {
      // De-duplicate and sort
      setFeed((prev) => {
        if (prev.some((e) => e.id === event.id)) return prev;
        const newFeed = [event, ...prev];
        // Sort newest first
        newFeed.sort((a, b) => b.created_at - a.created_at);
        // Keep top 100 events
        const trimmed = newFeed.slice(0, 100);
        // Save to cache
        try {
          localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(trimmed));
        } catch (e) {}
        return trimmed;
      });
    };

    pool.addListener(handleNewEvent);

    // Subscribe to tag-filtered technical feed (avoids global firehose data tax)
    const filters = [
      {
        kinds: [1],
        '#t': FILTER_TAGS,
        limit: 50
      }
    ];

    pool.subscribe('kylrix-tech-feed', filters);
    setLoading(false);

    return () => {
      pool.removeListener(handleNewEvent);
      pool.unsubscribe('kylrix-tech-feed');
      pool.close();
    };
  }, [updateFeedAndCache]);

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
        content
      };

      const signed = signEvent(unsignedEvent, identity.privateKeyBytes);
      await poolRef.current.publish(signed);
      
      // Optimitistically add to feed
      setFeed((prev) => {
        const next = [signed, ...prev];
        next.sort((a, b) => b.created_at - a.created_at);
        const trimmed = next.slice(0, 100);
        try {
          localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(trimmed));
        } catch (e) {}
        return trimmed;
      });

      toast.success('Post published to Nostr relays!');
      return true;
    } catch (err) {
      console.error('Failed to publish event:', err);
      toast.error('Failed to publish post');
      return false;
    }
  }, [identity]);

  return {
    feed,
    loading,
    publishPost,
    filterTags: FILTER_TAGS
  };
}
